/* Photo Nine: a photographic body with an original display head.
   The head is its own layer so it can look, nod and tilt; the face is live HTML
   mapped onto the glass with a perspective transform; a 360 turn plays from
   rendered video frames and can be dragged by hand. */
import { getFaces, type FaceEl } from "./faces";

const SRC = "/assets/nine/photo/";
// from pipeline/export_web.py (nine.json): screen corners as fractions of the head image
const QUAD = { tl: [0.0454, 0.0601], tr: [0.7727, 0.0449], br: [0.7715, 0.5638], bl: [0.0408, 0.5631] } as const;
const SW = 400, SH = 272;

// the site's actions mapped to what a photo with a moving head can do
const MOVES: Record<string, string> = {
  wave: "greet", celebrate: "greet", chase: "greet", jump: "hop", hiccup: "hop", kick: "hop", dance: "sway", juggle: "sway",
  spin: "shake", sneeze: "jerk", trip: "jerk", bow: "nod", tap: "nod", nod: "nod", stretch: "roll", yawn: "roll", think: "think",
  listen: "listen", talk: "talk", shrug: "shrug", watch: "down", look: "", point: "", pointl: "",
  // added in the rebuild
  decline: "shake", goodbye: "greet", send: "nod", sorry: "down", typing: "listen",
};
// actions that also put something on the display
const SCREEN_FOR: Record<string, string> = {
  dance: "music", watch: "clock", celebrate: "star", juggle: "services", hiccup: "glitch", sneeze: "glitch", trip: "dizzy",
  shrug: "question", stretch: "battery", bow: "heart", tap: "dots", kick: "wow", jump: "wow",
  decline: "ok", goodbye: "bye", send: "mail", sorry: "sad",
};

// the 360 turn, rendered with Wan 2.2 and cut out with BiRefNet
const TURN = { frames: 161, fps: 24, src: "/assets/nine/turn/f{i}.webp" };
const turnImgs: HTMLImageElement[] = [];
/** Loads the 161 turn frames (about 4 MB) a few at a time, so they never compete with the page. */
export function loadTurn() {
  if (turnImgs.length) return;
  const srcs = Array.from({ length: TURN.frames }, (_, i) => TURN.src.replace("{i}", String(i).padStart(3, "0")));
  srcs.forEach(() => turnImgs.push(new Image()));
  let next = 0;
  const one = () => {
    const i = next++; if (i >= srcs.length) return;
    const im = turnImgs[i]; im.decoding = "async";
    im.onload = im.onerror = one;
    im.src = srcs[i];
  };
  for (let k = 0; k < 6; k++) one();
}

/** Nine's photo markup. The page renders the hero's on the server, so the browser fetches her image straight away. */
export function photoMarkup(priority = false) {
  const p = priority ? ' fetchpriority="high"' : ' loading="lazy"';
  return `<div class="np" data-pose="stand" data-act="" data-move=""><div class="np-clip"><div class="np-stage">
      <img class="np-body" src="${SRC}body.webp" alt="" width="896" height="1233" draggable="false" decoding="async"${p}>
      <div class="np-head"><div class="np-neck"><div class="np-act">
        <img src="${SRC}head.webp" alt="" width="594" height="583" draggable="false" decoding="async"${p}><div class="np-screen"></div>
      </div></div></div>
      <canvas class="np-turn" aria-hidden="true"></canvas>
      <div class="nb-zzz"><i>z</i><i>z</i><i>Z</i></div>
    </div></div><div class="nb-say"></div></div>`;
}
const turnReady = () => turnImgs.length === TURN.frames && turnImgs.every(im => im.complete && im.naturalWidth);

function quadMatrix(pts: number[][]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = pts;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1, g = (sx * dy2 - dx2 * sy) / det, h = (dx1 * sy - sx * dy1) / det;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
  const n = (v: number) => +v.toFixed(8);
  return `matrix3d(${n(a / SW)},${n(d / SW)},0,${n(g / SW)},${n(b / SH)},${n(e / SH)},0,${n(h / SH)},0,0,1,0,${n(x0)},${n(y0)},0,1)`;
}

export type Pose = "stand" | "sit" | "sleep";
export interface NineFigure {
  el: HTMLElement;
  face: FaceEl;
  readonly pose: Pose;
  setPose(p: Pose): void;
  act(a: string, ms?: number): void;
  say(text: string, ms?: number): void;
  turn(): number;
}

const all: NineFigure[] = [];
let following = false;

export function mountPhoto(slot: HTMLElement): NineFigure {
  const Faces = getFaces();
  const reduceTurn = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // keep the server-rendered markup when it's there (the hero), so the image isn't fetched or painted twice
  if (!slot.querySelector(":scope > .np")) slot.innerHTML = photoMarkup();
  const el = slot.querySelector(".np") as HTMLElement, head = el.querySelector(".np-head") as HTMLElement;
  const screen = el.querySelector(".np-screen") as HTMLElement;
  const face = Faces.mount(screen), bubble = el.querySelector(".nb-say") as HTMLElement;
  const fit = () => {
    const w = head.offsetWidth, h = head.offsetHeight; if (!w) return;
    screen.style.transform = quadMatrix((["tl", "tr", "br", "bl"] as const).map(k => [QUAD[k][0] * w, QUAD[k][1] * h]));
  };
  new ResizeObserver(fit).observe(head); fit();

  let actT = 0, sayT = 0;
  const cv = el.querySelector(".np-turn") as HTMLCanvasElement, ctx = cv.getContext("2d")!;
  let raf = 0, idx = 0, drag: { x: number; from: number } | null = null, moved = false;
  const N = TURN.frames;

  const c: NineFigure = {
    el, face,
    get pose() { return el.dataset.pose as Pose; },
    setPose(p) {
      el.dataset.pose = p;
      if (p !== "stand") el.dataset.move = "";
      if (p === "sleep") Faces.mood(face, "sleep"); else if (face.dataset.mood === "sleep") Faces.mood(face, "idle");
    },
    act(a, ms) {
      if (a === "spin" && el.dataset.pose === "stand" && c.turn()) return;
      if (SCREEN_FOR[a]) Faces.show(face, SCREEN_FOR[a], ms || 2200);
      clearTimeout(actT); el.dataset.act = a || ""; el.dataset.move = el.dataset.pose === "stand" ? (MOVES[a] ?? "") : "";
      if (ms) actT = window.setTimeout(() => { if (el.dataset.act === a) { el.dataset.act = ""; el.dataset.move = ""; } }, ms);
    },
    say(text, ms = 2800) {
      bubble.textContent = text; bubble.classList.add("is-on"); clearTimeout(sayT);
      sayT = window.setTimeout(() => bubble.classList.remove("is-on"), ms);
    },
    turn: () => (turnReady() && !drag && !reduceTurn ? play(0) : 0),
  };

  // ---- the 360 turn ----
  function draw(i: number) {
    idx = ((Math.round(i) % N) + N) % N;
    const im = turnImgs[idx];
    if (im && im.complete && im.naturalWidth) {
      if (cv.width !== im.naturalWidth) { cv.width = im.naturalWidth; cv.height = im.naturalHeight; }
      ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(im, 0, 0);
    }
  }
  const front = () => idx < 3 || idx > N - 4;
  function settle() { cancelAnimationFrame(raf); if (front()) { el.classList.remove("is-turning"); return; } play(idx); }
  function play(from = 0) {
    cancelAnimationFrame(raf);
    const t0 = performance.now() - (from / TURN.fps) * 1000;
    el.dataset.move = ""; el.classList.add("is-turning");
    const step = (t: number) => {
      const i = Math.min(N - 1, ((t - t0) / 1000) * TURN.fps);
      draw(i);
      if (i < N - 1) raf = requestAnimationFrame(step);
      else setTimeout(() => { if (!drag) { el.classList.remove("is-turning"); } }, 80);
    };
    raf = requestAnimationFrame(step);
    return ((N - from) / TURN.fps) * 1000;
  }
  const clip = el.querySelector(".np-clip") as HTMLElement;
  clip.addEventListener("pointerdown", e => {
    if (!turnReady() || reduceTurn) return;
    drag = { x: e.clientX, from: el.classList.contains("is-turning") ? idx : 0 }; moved = false;
  });
  window.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!moved && Math.abs(dx) < 6) return;
    if (!moved) { moved = true; cancelAnimationFrame(raf); el.classList.add("is-turning", "is-dragging"); el.dataset.move = ""; }
    draw(drag.from - (dx / clip.offsetWidth) * N * 0.9); // one width of drag is about one full turn
  }, { passive: true });
  window.addEventListener("pointerup", () => {
    if (!drag) return;
    drag = null; el.classList.remove("is-dragging");
    if (moved) settle();
  });
  // a drag is not a click: don't open the chat after spinning her
  el.addEventListener("click", e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  el.classList.add("can-turn");

  all.push(c);
  if (!following) {
    following = true;
    // the head follows where the face is looking
    const follow = () => {
      all.forEach(n => { n.el.style.setProperty("--lx", (n.face._lx || 0).toFixed(3)); n.el.style.setProperty("--ly", (n.face._ly || 0).toFixed(3)); });
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
  }
  return c;
}
