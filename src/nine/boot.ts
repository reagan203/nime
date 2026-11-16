/* Starts Nine on the page (in the hero and in the chat), her autopilot, and her
   reactions to the page. Called once from an effect on the home page. */
import { getFaces } from "./faces";
import { loadTurn, mountPhoto, type NineFigure } from "./photo";
import { autopilot } from "./autopilot";
import { createChat, type Chat, type OpenOptions } from "./chat";

export interface NineApi { open(o?: OpenOptions): void; close(): void }
let api: NineApi | null = null;
const waiting: ((a: NineApi) => void)[] = [];

/** The chat, once Nine has started. Safe to call before then: the call waits. */
export function withNine(fn: (a: NineApi) => void) { if (api) fn(api); else waiting.push(fn); }

export function bootNine(): NineApi {
  if (api) return api;
  const Faces = getFaces();
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const heroSlot = document.getElementById("heroBody")!, chatSlot = document.getElementById("asBody")!;
  const heroNine = mountPhoto(heroSlot);
  const asBody = mountPhoto(chatSlot);
  const chat: Chat = createChat(asBody);
  const nineOpen = () => chat.isOpen();

  // the 360 turn frames (about 4 MB) load once the page is idle, and not at all
  // on data saver, slow connections or reduced motion: Nine works fine without them
  const conn = (navigator as any).connection;
  const lean = reduceMotion || conn?.saveData || /(^|-)2g|3g/.test(conn?.effectiveType || "");
  if (!lean) {
    const later = () => ("requestIdleCallback" in window ? (window as any).requestIdleCallback(loadTurn, { timeout: 4000 }) : setTimeout(loadTurn, 2500));
    if (document.readyState === "complete") later(); else window.addEventListener("load", later, { once: true });
  }

  /* Nine smiles at "Talk to Nine" buttons and looks at them; any [data-talk] opens her. */
  const pageFaces = () => Faces.all.filter(f => !f.closest("#as") && (f.closest(".np") as HTMLElement | null)?.dataset.pose !== "sleep");
  document.addEventListener("pointerover", e => {
    const b = (e.target as Element).closest?.("[data-talk]");
    if (!b || b.contains(e.relatedTarget as Node)) return;
    pageFaces().forEach(f => { Faces.mood(f, "happy"); Faces.lookAt(f, b.closest(".nm-nine") ? null : b); });
  });
  document.addEventListener("pointerout", e => {
    const b = (e.target as Element).closest?.("[data-talk]");
    if (!b || b.contains(e.relatedTarget as Node)) return;
    pageFaces().forEach(f => { Faces.mood(f, "idle"); Faces.lookAt(f, null); });
  });
  document.addEventListener("click", e => {
    const b = (e.target as Element).closest?.("[data-talk]") as HTMLElement | null;
    if (!b) return;
    e.preventDefault();
    chat.open({ voice: b.hasAttribute("data-voice"), flow: b.getAttribute("data-talk") || undefined });
  });

  /* Nine lives in the hero at the top of the page (and in the chat when it's open). */
  let heroInView = true;
  autopilot(heroNine, { talks: true, isActive: () => heroInView && !nineOpen() });
  setTimeout(() => document.querySelector(".nm-bubble")?.classList.add("is-gone"), 7000);
  const heroSpot = document.querySelector(".nm-hero-nine") as HTMLElement;
  const checkHero = () => {
    const r = heroSpot.getBoundingClientRect();
    heroInView = r.bottom > r.height * 0.25 && r.top < innerHeight - r.height * 0.25;
  };
  new IntersectionObserver(checkHero, { threshold: [0, 0.25, 0.5, 1] }).observe(heroSpot);
  checkHero();
  setTimeout(() => { heroNine.act("wave", 2400); Faces.mood(heroNine.face, "happy"); setTimeout(() => Faces.mood(heroNine.face, "idle"), 2400); }, 900);

  /* ---- Nine reacts to the page ---- */
  const photoNines: NineFigure[] = [heroNine, asBody];
  const visibleNine = () => (nineOpen() ? asBody : heroNine);
  const flash = (kind: string, ms: number, arg?: unknown) => Faces.show(visibleNine().face, kind, ms, arg);
  setTimeout(() => { const h = new Date().getHours(); flash("text", 2600, h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"); }, 3400);
  document.addEventListener("nine:theme", e => {
    const dark = (e as CustomEvent<{ dark: boolean }>).detail.dark;
    photoNines.forEach(n => Faces.show(n.face, dark ? "moon" : "sun", 2000));
  });
  // hovering a service area shows its symbol (Advise, Build, Train, Govern, Research)
  const AREA_ICON = ["chart", "bolt", "cap", "shield", "flask"];
  let hovered: Element | null = null;
  document.addEventListener("pointerover", e => {
    const t = (e.target as Element).closest?.(".nm-tile, .nm-card, .nm-rung") as HTMLElement | null;
    if (!t || t === hovered) return;
    hovered = t;
    if (t.classList.contains("nm-rung")) flash("num", 1800, t.dataset.n);
    else { const i = t.classList.contains("nm-tile") ? +(t.dataset.n || 0) - 1 : +(t.dataset.s || -1); if (AREA_ICON[i]) flash(AREA_ICON[i], 1800); }
  });
  document.addEventListener("copy", () => { flash("check", 1400); visibleNine().say("Copied!", 1400); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { const n = visibleNine(); flash("text", 2200, "Welcome back"); if (n.pose === "stand") n.act("wave", 1800); } });
  // new: losing and finding the internet connection
  window.addEventListener("offline", () => { const n = visibleNine(); Faces.show(n.face, "error", 2400); n.say("We're offline. I'll wait.", 2600); });
  window.addEventListener("online", () => { const n = visibleNine(); Faces.show(n.face, "check", 1800); n.say("We're back online.", 2200); });
  // Nine pays attention: she looks where the visitor clicks
  document.addEventListener("click", e => {
    if ((e.target as Element).closest(".np, .nm-as, a, button, input, textarea, .nm-sheet")) return;
    const dot = document.createElement("i"); dot.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:1px;height:1px;pointer-events:none`;
    document.body.appendChild(dot);
    const n = visibleNine(); Faces.lookAt(n.face, dot);
    setTimeout(() => { Faces.lookAt(n.face, null); dot.remove(); }, 1300);
  });
  // once she has waved, Nine shows off a full turn (when the 360 frames have loaded)
  setTimeout(() => { if (heroInView && !nineOpen() && heroNine.pose === "stand") heroNine.turn(); }, 6500);

  api = { open: o => chat.open(o), close: () => chat.close() };
  waiting.splice(0).forEach(fn => fn(api!));
  return api;
}
