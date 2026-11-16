/* The browser side of the website analytics. Measures active time on the page and
   in each section (only while the tab is visible and someone is using it), how far
   people scroll, where they came from, and a few actions. Sends two small beacons
   to /api/collect: one on arrival, one (repeated, cumulative) when the page is hidden. */
import { SECTIONS, type EventName } from "./events";

type Ev = { n: EventName; v?: string };
let events: Ev[] = [];
let started = false;

/** Counts an action, e.g. track("nine_open"). Safe to call on the server or before tracking starts. */
export function track(n: EventName, v?: string) {
  if (typeof window === "undefined") return;
  if (events.length < 200) events.push(v ? { n, v: v.slice(0, 120) } : { n });
}

const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => (b % 36).toString(36)).join("");

function send(body: unknown) {
  const data = JSON.stringify(body);
  try {
    if (navigator.sendBeacon && navigator.sendBeacon("/api/collect", new Blob([data], { type: "text/plain" }))) return;
  } catch { /* fall through */ }
  fetch("/api/collect", { method: "POST", body: data, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
}

export function startTracking() {
  if (started || typeof window === "undefined") return;
  started = true;
  // respect "do not track" and Global Privacy Control
  if ((navigator as any).doNotTrack === "1" || (navigator as any).globalPrivacyControl) return;

  const sid = rid();
  const q = new URLSearchParams(location.search);
  let ref = "";
  try { const r = new URL(document.referrer); if (r.host !== location.host) ref = r.host + r.pathname.slice(0, 80); } catch {}
  send({
    t: "view", sid, path: location.pathname, ref,
    utm: { source: q.get("utm_source") || undefined, medium: q.get("utm_medium") || undefined, campaign: q.get("utm_campaign") || undefined },
    lang: navigator.language || "", tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "", w: innerWidth,
  });

  // active time: a one-second tick counts while the tab is visible and there was activity in the last 30 seconds
  let dur = 0, depth = 0, lastActive = Date.now();
  const sections: Record<string, number> = {};
  const els = Object.keys(SECTIONS).map(id => [id, id === "top" ? document.querySelector(".nm-hero") : id === "footer" ? document.querySelector(".nm-footer") : document.getElementById(id)] as const)
    .filter((x): x is readonly [string, Element] => !!x[1]);
  const current = () => {
    if (document.getElementById("as")?.classList.contains("is-open")) return "nine";
    const mid = innerHeight * 0.45;
    for (const [id, el] of els) { const r = el.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) return id; }
    return scrollY < 200 ? "top" : "";
  };
  const activity = () => { lastActive = Date.now(); };
  (["pointermove", "pointerdown", "keydown", "scroll", "touchstart", "wheel"] as const).forEach(e => window.addEventListener(e, activity, { passive: true }));
  window.setInterval(() => {
    if (document.visibilityState !== "visible" || Date.now() - lastActive > 30000) return;
    dur += 1000;
    const s = current(); if (s) sections[s] = (sections[s] || 0) + 1000;
    const h = document.documentElement.scrollHeight - innerHeight;
    depth = Math.max(depth, h > 0 ? Math.round(((scrollY + 1) / h) * 100) : 100);
  }, 1000);

  // contact actions: delegated clicks on links and "Talk to Nine" buttons
  document.addEventListener("click", e => {
    const el = (e.target as Element).closest?.("a, [data-talk]") as HTMLElement | null;
    if (!el) return;
    if (el.hasAttribute("data-talk")) return track("click_talk", el.getAttribute("data-talk") || "");
    const href = el.getAttribute("href") || "";
    if (href.startsWith("mailto:")) track("click_email");
    else if (href.startsWith("tel:")) track("click_phone");
    else if (href.includes("wa.me")) track("click_whatsapp");
    else if (href.includes("linkedin.com")) track("click_linkedin");
    else if (href.includes("google.com/maps")) track("click_map");
  }, { capture: true });

  const leave = () => {
    send({ t: "leave", sid, dur: Math.round(dur), sections, depth: Math.min(100, depth), events });
  };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") leave(); });
  window.addEventListener("pagehide", leave);
}
