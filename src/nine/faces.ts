/* Nine's face: glowing eyes and a light-bar mouth on the display head.
   Eyes follow the pointer, blink, change with Nine's mood, and the display can
   show pictures instead of the face (Faces.show).

   Browser only: call getFaces() from an effect, never during SSR. */

export type Mood = "idle" | "happy" | "thinking" | "listening" | "surprised" | "sleep" | "sad";

export interface FaceEl extends HTMLElement {
  _lx: number;
  _ly: number;
  _energy: number;
  _bars: HTMLElement[];
  _showEl: HTMLElement | null;
  _showT?: number;
  _lookAt?: Element | null;
  _force?: { x: number; y: number } | null;
  _talk?: boolean;
}

const SMILE = [-1.6, -0.8, -0.2, 0, -0.2, -0.8, -1.6];
const MOUTH = `<span class="nf-mouth">${SMILE.map(c => `<i style="--c:${c}cqw"></i>`).join("")}</span>`;
// a bare face for the display screen: eyes and mouth only
const SCREEN = `<div class="nf nf-screen" data-mood="idle"><div class="nf-face">
    <span class="nf-eye nf-l"></span><span class="nf-eye nf-r"></span>${MOUTH}
    <div class="nf-show"></div>
  </div></div>`;

/* ---- what the display can show besides the face (drawn in a 400 x 272 box) ---- */
const star = (cx: number, cy: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2, k = i % 2 ? r * 0.45 : r;
    return `${(cx + Math.cos(a) * k).toFixed(1)},${(cy + Math.sin(a) * k).toFixed(1)}`;
  }).join(" ");
const spiral = (cx: number, cy: number) => {
  let d = "";
  for (let i = 0; i <= 60; i++) { const a = i * 0.35, r = 2 + i * 0.75; d += `${i ? "L" : "M"}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`; }
  return d;
};
const heart = (cx: number, cy: number, k: number) => `<path transform="translate(${cx} ${cy}) scale(${k})" d="M0 30C-40 0-30-35 0-14C30-35 40 0 0 30Z" fill="currentColor" stroke="none"/>`;
const txt = (x: number, y: number, size: number, t: string | number, extra = "") =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="700" fill="currentColor" stroke="none" ${extra}>${String(t).replace(/</g, "&lt;")}</text>`;

const ICON = {
  chart: `<path d="M110 220h180"/><rect x="125" y="165" width="30" height="45" rx="6" fill="currentColor"/><rect x="170" y="135" width="30" height="75" rx="6" fill="currentColor"/><rect x="215" y="100" width="30" height="110" rx="6" fill="currentColor"/><path d="M120 120l60-40 40 25 70-55m-30 0h30v30"/>`,
  bolt: `<path d="M215 40l-70 110h55l-20 85 75-115h-55z" fill="currentColor" stroke="none"/>`,
  cap: `<path d="M200 60l120 45-120 45-120-45z" fill="currentColor" stroke="none"/><path d="M135 128v45c40 30 90 30 130 0v-45M320 105v70"/><circle cx="320" cy="185" r="9" fill="currentColor"/>`,
  shield: `<path d="M200 40l85 30v60c0 55-40 90-85 105-45-15-85-50-85-105V70z"/><path d="M160 135l30 30 55-60"/>`,
  flask: `<path d="M175 45h50M185 45v60l-60 100c-6 12 2 25 15 25h120c13 0 21-13 15-25l-60-100V45"/><path d="M140 190h120"/><circle cx="185" cy="205" r="7" fill="currentColor"/><circle cx="220" cy="195" r="5" fill="currentColor"/>`,
};
const ENVELOPE = `<rect x="120" y="76" width="160" height="112" rx="14"/><path d="M126 86l74 56 74-56"/>`;

const SHOW: Record<string, (arg?: unknown) => string> = {
  heart: () => heart(145, 100, 1.6) + heart(255, 100, 1.6) + `<path d="M160 200q40 35 80 0"/>`,
  star: () => `<polygon points="${star(145, 105, 48)}" fill="currentColor" stroke="none"/><polygon points="${star(255, 105, 48)}" fill="currentColor" stroke="none"/><path d="M155 190q45 50 90 0z" fill="currentColor"/>`,
  wink: () => `<path d="M115 110q30-35 60 0"/><rect x="232" y="62" width="46" height="96" rx="16" fill="currentColor" stroke="none"/><path d="M150 195q50 40 100 0"/>`,
  dizzy: () => `<g class="nfs-spin"><path d="${spiral(145, 105)}" stroke-width="9"/></g><g class="nfs-spin"><path d="${spiral(255, 105)}" stroke-width="9"/></g><path d="M140 210q15-15 30 0t30 0t30 0t30 0" stroke-width="10"/>`,
  question: () => `<circle cx="145" cy="110" r="20" fill="currentColor" stroke="none"/><rect x="232" y="60" width="46" height="100" rx="16" fill="currentColor" stroke="none"/><path d="M150 210l25-12 25 12 25-12 25 12" stroke-width="10"/>` + txt(335, 105, 90, "?", 'class="nfs-bob"'),
  wow: () => `<circle cx="145" cy="105" r="40" stroke-width="12"/><circle cx="255" cy="105" r="40" stroke-width="12"/><circle cx="145" cy="105" r="14" fill="currentColor"/><circle cx="255" cy="105" r="14" fill="currentColor"/><ellipse cx="200" cy="205" rx="22" ry="26" stroke-width="12"/>`,
  loading: () => `<g class="nfs-spin"><circle cx="200" cy="136" r="70" stroke-dasharray="140 300" stroke-width="16"/></g><circle cx="200" cy="136" r="70" stroke-width="16" opacity=".18"/>`,
  check: () => `<circle cx="200" cy="136" r="92" stroke-width="12"/><path class="nfs-draw" d="M150 140l35 35 70-80" stroke-width="18"/>`,
  eq: () => Array.from({ length: 11 }, (_, i) => `<rect class="nfs-eq" style="animation-delay:${(-i * 0.13).toFixed(2)}s" x="${68 + i * 25}" y="76" width="14" height="120" rx="7" fill="currentColor" stroke="none"/>`).join(""),
  dots: () => [150, 200, 250].map((x, i) => `<circle class="nfs-bob" style="animation-delay:${i * 0.15}s" cx="${x}" cy="136" r="18" fill="currentColor" stroke="none"/>`).join(""),
  clock: () => `<circle cx="200" cy="136" r="95" stroke-width="12"/><path d="M200 136v-50" stroke-width="14"/><g class="nfs-spin" style="animation-duration:1.6s"><path d="M200 136h70" stroke-width="10"/></g><circle cx="200" cy="136" r="10" fill="currentColor"/>`,
  music: () => `<g class="nfs-bob"><ellipse cx="150" cy="190" rx="26" ry="20" fill="currentColor" stroke="none"/><path d="M174 188V60l70-18v120"/><ellipse cx="220" cy="168" rx="26" ry="20" fill="currentColor" stroke="none"/></g><g class="nfs-bob" style="animation-delay:.3s"><ellipse cx="300" cy="150" rx="20" ry="15" fill="currentColor" stroke="none"/><path d="M318 148V70l25 15"/></g>`,
  idea: () => `<path d="M200 50c-38 0-62 28-62 60 0 25 15 38 25 52 6 8 8 15 8 25h58c0-10 2-17 8-25 10-14 25-27 25-52 0-32-24-60-62-60z"/><path d="M175 210h50M182 235h36"/><g class="nfs-blink"><path d="M120 40l-15-15M280 40l15-15M95 110h-25M305 110h25"/></g>`,
  logo: () => `<circle cx="200" cy="80" r="26" fill="currentColor" stroke="none" class="nfs-bob"/>` + txt(200, 175, 52, "NINTH MIND", 'letter-spacing="6"') + txt(200, 225, 26, "AI is the process.", 'opacity=".75" font-weight="400"'),
  text: t => { const s = String(t); return txt(200, 160, s.length > 12 ? 44 : s.length > 8 ? 54 : 90, s); },
  hi: () => txt(200, 185, 150, "Hi!"),
  num: n => txt(200, 70, 34, "LEVEL", 'letter-spacing="8" opacity=".75" font-weight="400"') + txt(200, 225, 160, Number(n) || 1),
  matrix: () => `<g class="nfs-scroll">${Array.from({ length: 9 }, (_, c) => Array.from({ length: 14 }, (_, r) => `<text x="${40 + c * 42}" y="${r * 38 - 260 + (c % 3) * 12}" font-size="30" fill="currentColor" stroke="none" opacity="${(0.3 + ((c * 7 + r * 3) % 7) / 10).toFixed(2)}">${(c * 5 + r * 3) % 2}</text>`).join("")).join("")}</g>`,
  battery: () => `<rect x="105" y="85" width="180" height="100" rx="16" stroke-width="12"/><rect x="290" y="115" width="14" height="40" rx="4" fill="currentColor"/><rect class="nfs-fill" x="120" y="100" width="150" height="70" rx="8" fill="currentColor" stroke="none"/>`,
  sun: () => `<circle cx="200" cy="136" r="48" fill="currentColor" stroke="none"/><g class="nfs-spin" style="animation-duration:6s"><path d="M200 50v-25M200 222v25M114 136h-25M286 136h25M139 75l-17-17M261 197l17 17M261 75l17-17M139 197l-17 17"/></g>`,
  moon: () => `<path d="M235 50a90 90 0 1 0 50 150 75 75 0 1 1-50-150z" fill="currentColor" stroke="none"/><polygon points="${star(120, 70, 14)}" fill="currentColor" stroke="none" class="nfs-blink"/>`,
  services: () => Object.values(ICON).map((g, i) => `<g class="nfs-cycle" style="animation-delay:${(i * 0.7).toFixed(1)}s">${g}</g>`).join(""),
  chart: () => ICON.chart, cap: () => ICON.cap, shield: () => ICON.shield, bolt: () => ICON.bolt, flask: () => ICON.flask,
  /* added in the rebuild */
  mail: () => `<g class="nfs-fly">${ENVELOPE}</g><g class="nfs-blink" stroke-width="10"><path d="M60 110h40M45 140h55M70 170h30"/></g>`,
  sent: () => `<g>${ENVELOPE}</g><circle cx="290" cy="190" r="42" fill="currentColor" stroke="none"/><path class="nfs-draw" d="M270 190l14 14 26-28" stroke="#081a2b" stroke-width="12"/>`,
  sad: () => `<path d="M112 78l60 22M288 78l-60 22" stroke-width="10"/><rect x="122" y="104" width="44" height="66" rx="16" fill="currentColor" stroke="none"/><rect x="234" y="104" width="44" height="66" rx="16" fill="currentColor" stroke="none"/><path d="M155 222q45-40 90 0"/>`,
  ok: () => txt(200, 180, 140, "OK") + `<path d="M120 215q80 30 160 0" stroke-width="10" opacity=".7"/>`,
  bye: () => `<g class="nfs-wave"><path d="M95 120c-10-30 20-40 30-15l18 40M125 105l-8-35c-5-25 25-28 30-5l12 50M147 115l-5-42c-3-24 27-25 30-2l6 52M170 125l3-30c3-22 30-18 28 4l-4 55c-3 40-40 60-75 40l-40-35" stroke-width="10"/></g>` + txt(285, 170, 76, "Bye!"),
  shh: () => `<path d="M150 105h-35v62h35l45 38V67z" fill="currentColor" stroke="none"/><path d="M235 105l60 62M295 105l-60 62" stroke-width="14"/>`,
  phone: () => `<g class="nfs-ring"><path d="M140 70c-14 0-28 14-25 30 10 60 55 105 115 115 16 3 30-11 30-25v-25l-45-18-20 20c-25-12-40-27-52-52l20-20-18-45z" fill="currentColor" stroke="none"/></g><g class="nfs-blink" stroke-width="10"><path d="M250 75q35 10 45 45M245 105q15 5 20 20"/></g>`,
  error: () => `<circle cx="200" cy="136" r="92" stroke-width="12"/><path d="M162 98l76 76M238 98l-76 76" stroke-width="16"/>`,
};

/** Screens Nine may show at random while idling: the company and its five service areas. */
export const SCREENS = ["logo", "idea", "chart", "bolt", "cap", "shield", "flask", "services", "hi", "logo"];
export type ScreenKind = keyof typeof SHOW | "glitch";

function create() {
  const all: FaceEl[] = [];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let px = innerWidth * 0.7, py = innerHeight * 0.4, lastMove = -1e9;

  function show(f: FaceEl | null | undefined, kind: string | null, ms = 2400, arg?: unknown) {
    if (!f || !f._showEl) return;
    clearTimeout(f._showT);
    if (kind === "glitch") { f.classList.add("is-glitch"); f._showT = window.setTimeout(() => f.classList.remove("is-glitch"), ms || 600); return; }
    if (!kind || !SHOW[kind]) { delete f.dataset.show; return; }
    f._showEl.innerHTML = `<svg viewBox="0 0 400 272" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SHOW[kind](arg)}</svg>`;
    f.dataset.show = kind;
    if (ms) f._showT = window.setTimeout(() => { if (f.dataset.show === kind) delete f.dataset.show; }, ms);
  }

  function blink(f: FaceEl) { f.classList.add("is-blink"); setTimeout(() => f.classList.remove("is-blink"), 120); }
  function blinkLater(f: FaceEl) {
    setTimeout(() => {
      if (!f.isConnected) return;
      if (f.dataset.mood !== "happy" && f.dataset.mood !== "sleep") { blink(f); if (Math.random() < 0.25) setTimeout(() => blink(f), 260); }
      blinkLater(f);
    }, 2000 + Math.random() * 4200);
  }
  function mount(el: HTMLElement): FaceEl {
    el.innerHTML = SCREEN;
    const f = el.querySelector(".nf") as FaceEl;
    f._lx = 0; f._ly = 0; f._energy = 0; f._bars = [...f.querySelectorAll<HTMLElement>(".nf-mouth i")];
    f._showEl = f.querySelector(".nf-show");
    all.push(f); blinkLater(f);
    return f;
  }
  function unmount(f: FaceEl) { const i = all.indexOf(f); if (i >= 0) all.splice(i, 1); }

  window.addEventListener("pointermove", e => { px = e.clientX; py = e.clientY; lastMove = performance.now(); }, { passive: true });
  window.addEventListener("touchstart", e => { const t = e.touches[0]; if (t) { px = t.clientX; py = t.clientY; lastMove = performance.now(); } }, { passive: true });

  let lastBars = 0;
  function frame(t: number) {
    const W = innerWidth, H = innerHeight;
    all.forEach(f => {
      const r = f.getBoundingClientRect();
      if (!r.width || r.bottom < -50 || r.top > H + 50) return;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let tx = px, ty = py;
      if (f._lookAt && f._lookAt.isConnected) { const b = f._lookAt.getBoundingClientRect(); tx = b.left + b.width / 2; ty = b.top + b.height / 2; }
      else if (t - lastMove > 3500 && !reduce) { tx = cx + Math.sin(t / 1900 + r.left) * W * 0.35; ty = cy + Math.cos(t / 2600) * H * 0.18; }
      let lx = Math.max(-1, Math.min(1, (tx - cx) / (W * 0.32))), ly = Math.max(-1, Math.min(1, (ty - cy) / (H * 0.45)));
      if (f._force) { lx = f._force.x; ly = f._force.y; }
      f._lx += (lx - f._lx) * 0.1; f._ly += (ly - f._ly) * 0.1;
      f.style.setProperty("--lx", f._lx.toFixed(3)); f.style.setProperty("--ly", f._ly.toFixed(3));
      f.style.setProperty("--ry", (f._lx * 16).toFixed(2) + "deg"); f.style.setProperty("--rx", (-f._ly * 12).toFixed(2) + "deg");
      if (f._talk && t - lastBars > 75) {
        f._energy = Math.max(0.25, f._energy * 0.82);
        f._bars.forEach((b, i) => {
          const centre = 1 - Math.abs(i - 3) / 4;
          b.style.setProperty("--m", (1.2 + Math.random() * (1.5 + 5 * f._energy) * (0.45 + centre)).toFixed(2) + "cqw");
        });
      }
    });
    if (t - lastBars > 75) lastBars = t;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    mount, unmount, all, show, blink, SCREENS,
    mood(f: FaceEl | null, m: Mood) { (f ? [f] : all).forEach(x => { x.dataset.mood = m; }); },
    lookAt(f: FaceEl | null, el: Element | null) { (f ? [f] : all).forEach(x => { x._lookAt = el || null; }); },
    talk(f: FaceEl, on: boolean) {
      f._talk = on; f.classList.toggle("is-talking", on);
      if (!on) f._bars.forEach(b => b.style.removeProperty("--m"));
      else f._energy = 1;
    },
    bump(f: FaceEl) { f._energy = 1; },
    force(f: FaceEl, v: { x: number; y: number } | null) { f._force = v || null; },
  };
}

export type Faces = ReturnType<typeof create>;
let instance: Faces | null = null;
export function getFaces(): Faces {
  if (!instance) instance = create();
  return instance;
}
