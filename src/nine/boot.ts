/* Starts every Nine on the page (hero, chat, mini Nine), her autopilot, and her
   reactions to the page. Called once from an effect in <NineProvider>. */
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

  // the 360 turn frames load after the page has loaded
  if (document.readyState === "complete") setTimeout(loadTurn, 1200);
  else window.addEventListener("load", () => setTimeout(loadTurn, 1200));

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

  /* ---- mini Nine at the bottom of the page ---- */
  const walkerHost = document.createElement("div");
  walkerHost.className = "nm-walker is-hidden"; walkerHost.setAttribute("aria-hidden", "true");
  document.body.appendChild(walkerHost);
  const walker = mountPhoto(walkerHost);
  walker.el.title = "Talk to Nine";
  /* Mini Nine offers help that fits the section the visitor is reading;
     clicking her starts that conversation. */
  const OFFERS: Record<string, { say: string; flow?: string; screen: string }> = {
    approach: { say: "Want to find your AI maturity level? I'll walk you through it.", flow: "level", screen: "chart" },
    training: { say: "Need training for your team? I can set that up.", flow: "train", screen: "cap" },
    services: { say: "Not sure which service fits? Tell me what you need.", flow: "project", screen: "services" },
    programme: { say: "Curious how a programme would run for you? Ask me.", flow: "project", screen: "idea" },
    mfi: { say: "Want this approach in your organisation? Let's talk.", flow: "project", screen: "logo" },
    planned: { say: "Interested in what's planned? I'll tell the team.", flow: "quick", screen: "idea" },
    contact: { say: "I can pass a message to our team right now.", flow: "quick", screen: "check" },
  };
  let section = "", offered = new Set<string>(), offerT = 0;
  const sectionSpy = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    section = en.target.id;
    clearTimeout(offerT);
    // offer once per section, after the visitor has been reading it for a moment
    offerT = window.setTimeout(() => {
      const o = OFFERS[section];
      if (!o || offered.has(section) || !walkerOn || walker.pose !== "stand") return;
      offered.add(section);
      walker.act("wave", 1600); Faces.show(walker.face, o.screen, 2600); walker.say(o.say, 5200);
    }, 2500);
  }), { rootMargin: "-40% 0px -50% 0px" });
  Object.keys(OFFERS).forEach(id => { const el = document.getElementById(id); if (el) sectionSpy.observe(el); });
  walker.el.addEventListener("click", () => chat.open({ flow: OFFERS[section]?.flow }));
  let heroInView = true, walkerOn = false;
  const walkerPilot = autopilot(walker, { host: walkerHost, talks: true, isActive: () => walkerOn });
  autopilot(heroNine, { host: null, talks: true, isActive: () => heroInView && !nineOpen() });
  setTimeout(() => document.querySelector(".nm-bubble")?.classList.add("is-gone"), 7000);
  function syncWalker() {
    const on = !heroInView && !nineOpen() && !reduceMotion;
    if (on === walkerOn) return;
    walkerOn = on;
    walkerHost.classList.toggle("is-hidden", !on);
    if (on && !walkerPilot.entered) {
      walkerPilot.entered = true;
      walkerPilot.place(innerWidth + 10, 0);
      requestAnimationFrame(() => requestAnimationFrame(() => walkerPilot.walkTo(innerWidth * 0.7, () => {
        walker.act("wave", 2200); Faces.mood(walker.face, "happy"); walker.say("Hi! I'm Nine. Click me to talk.", 3400);
        setTimeout(() => Faces.mood(walker.face, "idle"), 2200);
      })));
    }
  }
  const heroSpot = document.querySelector(".nm-hero-nine") as HTMLElement;
  function checkHero() {
    const r = heroSpot.getBoundingClientRect();
    heroInView = r.bottom > r.height * 0.25 && r.top < innerHeight - r.height * 0.25;
    syncWalker();
  }
  let heroRaf = 0;
  window.addEventListener("scroll", () => { if (!heroRaf) heroRaf = requestAnimationFrame(() => { heroRaf = 0; checkHero(); }); }, { passive: true });
  window.addEventListener("resize", checkHero);
  new IntersectionObserver(checkHero, { threshold: [0, 0.25, 0.5, 1] }).observe(heroSpot);
  checkHero();
  document.addEventListener("nine:toggle", syncWalker);
  window.addEventListener("resize", () => { if (walkerPilot.x > innerWidth - 60) walkerPilot.place(innerWidth - 120, 0); });
  setTimeout(() => { heroNine.act("wave", 2400); Faces.mood(heroNine.face, "happy"); setTimeout(() => Faces.mood(heroNine.face, "idle"), 2400); }, 900);

  /* Mini Nine glides along the bottom toward wherever the pointer rests. */
  let ptrX = innerWidth / 2, ptrStill = 0;
  window.addEventListener("pointermove", e => { ptrX = e.clientX; ptrStill = performance.now(); }, { passive: true });
  setInterval(() => {
    if (!walkerOn || walker.pose !== "stand" || walker.el.dataset.act || walker.el.classList.contains("is-turning")) return;
    const w = walker.el.offsetWidth || 120, target = Math.max(16, Math.min(innerWidth - w - 16, ptrX - w / 2));
    if (performance.now() - ptrStill > 500 && Math.abs(target - walkerPilot.x) > 160) walkerPilot.walkTo(target, null, 220);
  }, 700);

  /* ---- Nine reacts to the page ---- */
  const photoNines: NineFigure[] = [heroNine, walker, asBody];
  const visibleNine = () => (nineOpen() ? asBody : heroInView ? heroNine : walker);
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
