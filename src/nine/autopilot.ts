/* What Nine does on the page between conversations.

   Nine is client-facing: she behaves like a good receptionist, not a mascot.
   She greets, pays attention to where the visitor is looking, now and then
   shows one of the five service areas on her screen or quotes the company's
   own line, and offers help. No slapstick, and she never falls asleep on the
   page: after a while without activity she simply waits. */
import { getFaces } from "./faces";
import type { NineFigure } from "./photo";

interface Options { host: HTMLElement | null; talks: boolean; isActive: () => boolean }
export interface Pilot {
  entered: boolean;
  place(px: number, dur: number): void;
  walkTo(tx: number, done?: (() => void) | null, speed?: number, act?: string): number;
  wake(): void;
  readonly x: number;
}

const pickOne = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const LINES: Record<string, string[]> = {
  back: ["Welcome back.", "Hello again. Can I help?"],
  wait: ["I'm here whenever you need me.", "Questions? Just click me."],
  hover: ["Can I help you find the right service?", "Click me to talk.", "Planning an AI project? I can help.", "I can pass a message to our team."],
  // Lines quoted from the AI Transformation Framework (F)
  quote: ["AI is not the answer. AI is the process.", "Tools can be purchased in a day. Capability cannot.", "Where are you today, and where should you be in 12 months?", "Everyone is buying AI. Very few are becoming AI-first."],
};
// [action, how long, how often]
const ACTIONS: [string, number, number][] = [
  ["look", 2000, 1.4], ["think", 2200, 0.5], ["nod", 900, 0.6], ["wave", 2000, 0.4],
  ["point", 1800, 0.5], ["quote", 4400, 0.9], ["screen", 2600, 2.2], ["spin", 1000, 0.35],
];

export function autopilot(c: NineFigure, opt: Options): Pilot {
  const Faces = getFaces();
  let lastActive = performance.now(), waiting = false, x = innerWidth + 40, walkT = 0;
  const line = (k: string) => { if (opt.talks && LINES[k]) c.say(pickOne(LINES[k]), k === "quote" ? 4400 : 2600); };
  const weighted = (list: [string, number, number][]) => {
    let s = list.reduce((a, l) => a + l[2], 0) * Math.random();
    for (const l of list) { s -= l[2]; if (s <= 0) return l; }
    return list[0];
  };
  const happyFor = (ms: number) => { Faces.mood(c.face, "happy"); setTimeout(() => { if (c.pose === "stand") Faces.mood(c.face, "idle"); }, ms); };
  function wake() {
    waiting = false; c.setPose("stand"); c.act("wave", 1500); happyFor(1500);
    if (opt.talks) line("back");
  }
  function activity() { lastActive = performance.now(); if (waiting && opt.isActive()) wake(); }
  (["pointermove", "scroll", "keydown", "touchstart"] as const).forEach(ev => window.addEventListener(ev, activity, { passive: true }));
  function place(px: number, dur: number) {
    if (!opt.host) return;
    opt.host.style.transition = dur ? `transform ${dur}s ease-in-out` : "none";
    opt.host.style.transform = `translateX(${Math.round(px)}px)`; x = px;
  }
  function walkTo(tx: number, done?: (() => void) | null, speed = 160, act = "walk") {
    const dist = Math.abs(tx - x);
    if (dist < 24) { if (done) done(); return 0; }
    const dir = tx > x ? 1 : -1, dur = dist / speed;
    c.act(act); Faces.force(c.face, { x: dir * 0.9, y: 0.2 });
    place(tx, dur);
    clearTimeout(walkT);
    walkT = window.setTimeout(() => { if (c.el.dataset.act === act) c.act(""); Faces.force(c.face, null); if (done) done(); }, dur * 1000);
    return dur * 1000;
  }
  function look() { Faces.force(c.face, { x: -1, y: 0 }); setTimeout(() => Faces.force(c.face, { x: 1, y: -0.3 }), 900); setTimeout(() => Faces.force(c.face, null), 1900); }

  function tick() {
    let wait = 1500;
    if (opt.isActive()) {
      const idle = performance.now() - lastActive;
      if (idle > 30000) {
        // nobody around: sit back and wait politely, with an offer of help
        if (c.pose === "stand" && !/walk/.test(c.el.dataset.act || "")) { c.act(""); Faces.force(c.face, null); c.setPose("sit"); waiting = true; line("wait"); }
        wait = 2000;
      } else if (c.pose === "stand" && !c.el.dataset.act) {
        const [a, ms] = weighted(ACTIONS);
        if (a === "quote") { c.act("think", 1200); line("quote"); }
        else if (a === "screen") Faces.show(c.face, pickOne(Faces.SCREENS), ms);
        else if (a === "look") look();
        else {
          c.act(a, ms);
          if (a === "point") { Faces.force(c.face, { x: 1, y: 0 }); setTimeout(() => Faces.force(c.face, null), ms); }
          if (a === "wave") happyFor(ms);
        }
        wait = ms + 3000 + Math.random() * 5000;
      }
    }
    setTimeout(tick, wait);
  }
  c.el.addEventListener("pointerenter", () => {
    if (waiting) { lastActive = performance.now(); wake(); return; }
    if (/walk/.test(c.el.dataset.act || "")) return;
    c.act("wave", 1600); happyFor(1600);
    if (opt.talks) c.say(pickOne(LINES.hover), 2200);
  });
  c.el.addEventListener("pointerleave", () => { if (c.pose === "stand") Faces.mood(c.face, "idle"); });
  setTimeout(tick, 2500);
  return { entered: false, place, walkTo, wake, get x() { return x; } };
}
