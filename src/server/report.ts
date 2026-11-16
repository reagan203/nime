/* The website report emailed to the Managing Director: who visited, where they came
   from, where on the page they spent their time, and what they did. Pure functions
   (aggregate, render) so they can be tested; server only. */
import { SECTIONS, type Stored, type StoredLeave, type StoredView } from "~/analytics/events";

export const TZ = "Africa/Nairobi";
const TZ_MS = 3 * 3600_000; // Nairobi is UTC+3 all year

export interface Range { from: Date; to: Date } // inclusive instants (UTC)
type Count = { key: string; label: string; n: number };
export interface Report {
  range: Range;
  visitors: number; visits: number; totalMs: number; avgMs: number; medianMs: number;
  engaged: number; quick: number; avgDepth: number;
  enquiries: number; nineEnquiries: number; formEmails: number; nineOpens: number; contactClicks: number;
  daily: { day: string; visits: number; visitors: number }[];
  sections: { id: string; label: string; totalMs: number; reached: number; avgMs: number }[];
  sources: Count[]; devices: Count[]; browsers: Count[]; places: Count[];
  actions: Count[]; services: Count[]; flows: Count[]; levels: Count[];
}

/* ---- where visitors came from ---- */
const SOURCE_RULES: [RegExp, string][] = [
  [/(^|\.)google\./, "Google"], [/(^|\.)bing\.com/, "Bing"], [/duckduckgo/, "DuckDuckGo"], [/(^|\.)yahoo\./, "Yahoo"],
  [/linkedin\.com|lnkd\.in/, "LinkedIn"], [/facebook\.com|fb\.me|(^|\.)fb\.com/, "Facebook"], [/instagram\.com/, "Instagram"],
  [/(^|\.)t\.co$|twitter\.com|(^|\.)x\.com/, "X (Twitter)"], [/whatsapp/, "WhatsApp"], [/youtube\.com|youtu\.be/, "YouTube"],
  [/chatgpt\.com|chat\.openai\.com/, "ChatGPT"], [/perplexity\.ai/, "Perplexity"], [/claude\.ai/, "Claude"], [/gemini\.google/, "Gemini"], [/copilot\.microsoft/, "Copilot"],
  [/mail\.|outlook\.|gmail/, "Email"],
];
export function sourceOf(v: Pick<StoredView, "ref" | "utm">): string {
  const utm = (v.utm?.source || "").trim();
  if (utm) return utm.charAt(0).toUpperCase() + utm.slice(1);
  const host = (v.ref || "").split("/")[0].toLowerCase().replace(/^www\./, "");
  if (!host) return "Direct or bookmarks";
  for (const [re, name] of SOURCE_RULES) if (re.test(host)) return name;
  return host;
}
const regionNames = (() => { try { return new Intl.DisplayNames(["en"], { type: "region" }); } catch { return null; } })();
export function placeOf(v: Pick<StoredView, "country" | "tz">): string {
  if (v.country) { try { return regionNames?.of(v.country) || v.country; } catch { return v.country; } }
  const city = (v.tz || "").split("/").pop()?.replace(/_/g, " ");
  return city ? `${city} time zone` : "Unknown";
}

const ACTION_LABELS: Record<string, string> = {
  nine_open: "Opened Nine", nine_enquiry: "Sent an enquiry through Nine", email_form_sent: "Sent an email with the form",
  click_email: "Clicked the email address", click_phone: "Clicked the phone number", click_whatsapp: "Opened WhatsApp",
  click_linkedin: "Opened LinkedIn", click_map: "Opened the office map", click_talk: "Clicked a \"Talk to Nine\" button",
  service_view: "Opened a service's details", level_view: "Explored a maturity level",
};
const FLOW_LABELS: Record<string, string> = { project: "Start an AI project", level: "Find our AI maturity level", train: "Train my team", explore: "Explore the services", quick: "Leave a quick message" };

const nairobiDay = (iso: string | Date) => new Date(new Date(iso).getTime() + TZ_MS).toISOString().slice(0, 10);
function tally(items: string[], label = (k: string) => k): Count[] {
  const m = new Map<string, number>();
  for (const k of items) if (k) m.set(k, (m.get(k) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([key, n]) => ({ key, label: label(key), n }));
}

export function aggregate(rows: Stored[], range: Range): Report {
  const inRange = (r: Stored) => { const t = Date.parse(r.at); return t >= range.from.getTime() && t <= range.to.getTime(); };
  const views = new Map<string, StoredView>(), leaves = new Map<string, StoredLeave>();
  for (const r of rows) {
    if (r.t === "view") { if (inRange(r) && !views.has(r.sid)) views.set(r.sid, r); }
    else { const p = leaves.get(r.sid); if (!p || r.dur >= p.dur) leaves.set(r.sid, r); } // the leave beacons are cumulative: keep the fullest
  }
  const visits = [...views.values()].map(v => ({ v, l: leaves.get(v.sid) }));
  const durs = visits.map(x => x.l?.dur || 0);
  const totalMs = durs.reduce((a, b) => a + b, 0);
  const sorted = [...durs].sort((a, b) => a - b);
  const events = visits.flatMap(x => x.l?.events || []);
  const sessionsWith = (n: string) => visits.filter(x => x.l?.events.some(e => e.n === n)).length;
  const count = (n: string) => events.filter(e => e.n === n).length;

  // every day in the range, including quiet ones
  const days: string[] = [];
  for (let t = range.from.getTime(); nairobiDay(new Date(t)) <= nairobiDay(range.to); t += 86400_000) { const d = nairobiDay(new Date(t)); if (!days.includes(d)) days.push(d); }
  const daily = days.map(day => {
    const vs = visits.filter(x => nairobiDay(x.v.at) === day);
    return { day, visits: vs.length, visitors: new Set(vs.map(x => x.v.vid)).size };
  });

  const sections = Object.entries(SECTIONS).map(([id, label]) => {
    const per = visits.map(x => x.l?.sections?.[id] || 0);
    const total = per.reduce((a, b) => a + b, 0), reached = per.filter(ms => ms >= 2000).length;
    return { id, label, totalMs: total, reached, avgMs: reached ? total / reached : 0 };
  }).filter(s => s.totalMs > 0).sort((a, b) => b.totalMs - a.totalMs);

  const nineEnquiries = count("nine_enquiry"), formEmails = count("email_form_sent");
  return {
    range,
    visitors: new Set(visits.map(x => x.v.vid)).size,
    visits: visits.length,
    totalMs,
    avgMs: visits.length ? totalMs / visits.length : 0,
    medianMs: sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0,
    engaged: durs.filter(d => d >= 30_000).length,
    quick: durs.filter(d => d < 10_000).length,
    avgDepth: visits.length ? visits.reduce((a, x) => a + (x.l?.depth || 0), 0) / visits.length : 0,
    enquiries: nineEnquiries + formEmails, nineEnquiries, formEmails,
    nineOpens: sessionsWith("nine_open"),
    contactClicks: ["click_email", "click_phone", "click_whatsapp"].reduce((a, n) => a + count(n), 0),
    daily,
    sections,
    sources: tally(visits.map(x => sourceOf(x.v))),
    devices: tally(visits.map(x => x.v.device)),
    browsers: tally(visits.map(x => x.v.browser)),
    places: tally(visits.map(x => placeOf(x.v))),
    actions: tally(events.filter(e => e.n !== "nine_flow").map(e => e.n), k => ACTION_LABELS[k] || k),
    services: tally(events.filter(e => e.n === "service_view").map(e => e.v || "")),
    flows: tally(events.filter(e => e.n === "nine_flow").map(e => e.v || ""), k => FLOW_LABELS[k] || k),
    levels: tally(events.filter(e => e.n === "level_view").map(e => e.v || ""), k => `Level ${k}`),
  };
}

/* ---- writing it up ---- */
export const fmtDur = (ms: number) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const num = (n: number) => n.toLocaleString("en-GB");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
export function periodLabel(r: Range) {
  const a = nairobiDay(r.from), b = nairobiDay(r.to);
  if (a === b) return dayLabel(a, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const sameMonth = a.slice(0, 7) === b.slice(0, 7);
  return `${dayLabel(a, sameMonth ? { day: "numeric" } : { day: "numeric", month: "long" })} to ${dayLabel(b, { day: "numeric", month: "long", year: "numeric" })}`;
}

/** A few sentences that say what happened, in plain words. */
export function insights(r: Report, prev?: Report): string[] {
  if (!r.visits) return ["No visits were recorded in this period."];
  const out: string[] = [];
  const change = prev && prev.visitors ? Math.round(((r.visitors - prev.visitors) / prev.visitors) * 100) : null;
  out.push(`${num(r.visitors)} ${r.visitors === 1 ? "person" : "people"} visited the website${change === null ? "" : change === 0 ? ", the same as the period before" : `, ${Math.abs(change)}% ${change > 0 ? "more" : "fewer"} than the period before`}.`);
  const top = r.sections.filter(s => s.id !== "top" && s.id !== "footer")[0];
  if (top) out.push(`Most time was spent on ${top.label}: ${fmtDur(top.totalMs)} in total, ${fmtDur(top.avgMs)} on average for those who reached it.`);
  if (r.sources[0]) out.push(`The biggest source of visits was ${r.sources[0].label} (${pct(r.sources[0].n, r.visits)}% of visits).`);
  if (r.enquiries) out.push(`${num(r.enquiries)} ${r.enquiries === 1 ? "enquiry was" : "enquiries were"} sent: ${r.nineEnquiries} through Nine and ${r.formEmails} with the email form.`);
  else if (r.nineOpens) out.push(`${num(r.nineOpens)} ${r.nineOpens === 1 ? "visit" : "visits"} opened Nine, but no enquiries were sent.`);
  if (r.services[0]) out.push(`The service people read about most was ${r.services[0].label}.`);
  return out;
}

const C = { ink: "#1f2125", text: "#2b2d31", muted: "#5c636d", soft: "#868d97", line: "#e2e6eb", bg: "#f4f6f8", surface: "#ffffff", accent: "#0a6fb8", track: "#eaf4fb", band: "#0e1620" };
const FONT = "font-family:'DM Sans',Segoe UI,Helvetica,Arial,sans-serif;";

function delta(now: number, before: number | undefined, unit = "") {
  if (before === undefined) return "";
  if (!before) return now ? `<div style="${FONT}font-size:12px;color:${C.soft};margin-top:4px">new this period</div>` : "";
  const d = Math.round(((now - before) / before) * 100);
  const arrow = d > 0 ? "&#9650;" : d < 0 ? "&#9660;" : "&#9644;";
  return `<div style="${FONT}font-size:12px;color:${C.muted};margin-top:4px">${arrow} ${Math.abs(d)}%${unit} vs previous</div>`;
}
const tile = (label: string, value: string, sub = "") =>
  `<td width="33%" valign="top" style="padding:6px"><div style="background:${C.surface};border:1px solid ${C.line};border-radius:14px;padding:16px 18px">
    <div style="${FONT}font-size:13px;color:${C.muted}">${label}</div>
    <div style="${FONT}font-size:28px;line-height:1.2;font-weight:700;color:${C.ink};margin-top:6px">${value}</div>${sub}</div></td>`;
const h2 = (t: string, sub = "") => `<tr><td style="padding:28px 24px 10px"><div style="${FONT}font-size:18px;font-weight:700;color:${C.ink}">${t}</div>${sub ? `<div style="${FONT}font-size:13px;color:${C.muted};margin-top:4px">${sub}</div>` : ""}</td></tr>`;
const card = (inner: string) => `<tr><td style="padding:0 24px"><div style="background:${C.surface};border:1px solid ${C.line};border-radius:14px;padding:14px 18px">${inner}</div></td></tr>`;

/** Horizontal bars: label, a bar sized against the largest value, and the value written out. */
function bars(items: { label: string; value: number; text: string }[], max = Math.max(1, ...items.map(i => i.value))) {
  if (!items.length) return `<div style="${FONT}font-size:14px;color:${C.muted}">Nothing recorded yet.</div>`;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${items.map(i => {
    const w = Math.max(2, Math.round((i.value / max) * 100));
    return `<tr>
      <td width="38%" style="${FONT}font-size:14px;color:${C.text};padding:7px 10px 7px 0;vertical-align:middle">${esc(i.label)}</td>
      <td width="44%" style="padding:7px 0;vertical-align:middle"><div style="background:${C.track};border-radius:4px;height:12px;width:100%"><div style="background:${C.accent};border-radius:0 4px 4px 0;height:12px;width:${w}%"></div></div></td>
      <td width="18%" align="right" style="${FONT}font-size:13px;color:${C.muted};padding:7px 0 7px 10px;white-space:nowrap;vertical-align:middle">${i.text}</td></tr>`;
  }).join("")}</table>`;
}

/** Daily visits as columns. Only the busiest day carries its number; the table view below has them all. */
function columns(daily: Report["daily"]) {
  const max = Math.max(1, ...daily.map(d => d.visits)), H = 120, busiest = daily.reduce((a, d) => (d.visits > a.visits ? d : a), daily[0]);
  const every = daily.length > 14 ? 7 : 1;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;table-layout:fixed"><tr>${daily.map(d => {
    const h = d.visits ? Math.max(3, Math.round((d.visits / max) * H)) : 0;
    const label = d === busiest && d.visits ? `<div style="${FONT}font-size:12px;color:${C.ink};font-weight:700;text-align:center;padding-bottom:4px">${d.visits}</div>` : "";
    return `<td valign="bottom" style="height:${H + 22}px;padding:0 2px;vertical-align:bottom">${label}<div style="background:${C.accent};border-radius:4px 4px 0 0;height:${h}px;line-height:${h}px;font-size:1px">&nbsp;</div></td>`;
  }).join("")}</tr><tr>${daily.map((d, i) => `<td style="${FONT}font-size:11px;color:${C.soft};text-align:center;padding-top:6px;border-top:1px solid ${C.line}">${i % every === 0 ? dayLabel(d.day, daily.length > 7 ? { day: "numeric", month: "short" } : { weekday: "short" }) : ""}</td>`).join("")}</tr></table>`;
}

export function renderReport(r: Report, opts: { prev?: Report; siteUrl: string; logoUrl: string; recipient?: string }) {
  const p = opts.prev;
  const period = periodLabel(r.range);
  const subject = `Ninth Mind website: ${num(r.visitors)} visitor${r.visitors === 1 ? "" : "s"}${r.enquiries ? `, ${r.enquiries} enquir${r.enquiries === 1 ? "y" : "ies"}` : ""} (${period})`;
  const tiles1 = tile("Visitors", num(r.visitors), delta(r.visitors, p?.visitors)) + tile("Visits", num(r.visits), delta(r.visits, p?.visits)) + tile("Average time on site", fmtDur(r.avgMs), delta(r.avgMs, p?.avgMs));
  const tiles2 = tile("Engaged visits", `${pct(r.engaged, r.visits)}%`, `<div style="${FONT}font-size:12px;color:${C.muted};margin-top:4px">${num(r.engaged)} stayed 30s or more</div>`)
    + tile("Enquiries", num(r.enquiries), `<div style="${FONT}font-size:12px;color:${C.muted};margin-top:4px">${r.nineEnquiries} via Nine · ${r.formEmails} by email form</div>`)
    + tile("Contact clicks", num(r.contactClicks), `<div style="${FONT}font-size:12px;color:${C.muted};margin-top:4px">email, phone or WhatsApp</div>`);

  const sectionRows = r.sections.map(s => ({ label: s.label, value: s.totalMs, text: `${fmtDur(s.totalMs)} · ${pct(s.reached, r.visits)}% saw it` }));
  const countRows = (cs: Count[], total = r.visits, n = 6) => cs.slice(0, n).map(c => ({ label: c.label, value: c.n, text: `${num(c.n)} · ${pct(c.n, total)}%` }));
  const plainRows = (cs: Count[], n = 6) => cs.slice(0, n).map(c => ({ label: c.label, value: c.n, text: num(c.n) }));
  const table = (head: string[], rows: string[][]) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;${FONT}font-size:13px">
    <tr>${head.map((h, i) => `<th align="${i ? "right" : "left"}" style="color:${C.muted};font-weight:600;padding:6px 0;border-bottom:1px solid ${C.line}">${h}</th>`).join("")}</tr>
    ${rows.map(row => `<tr>${row.map((c, i) => `<td align="${i ? "right" : "left"}" style="color:${C.text};padding:6px 0;border-bottom:1px solid ${C.line}">${c}</td>`).join("")}</tr>`).join("")}</table>`;

  const body = !r.visits ? card(`<div style="${FONT}font-size:15px;color:${C.text}">No visits were recorded in this period. If the site is live, check that it is reachable and that /api/collect is not blocked.</div>`) : `
    <tr><td style="padding:16px 18px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${tiles1}</tr><tr>${tiles2}</tr></table></td></tr>
    ${h2("Visits per day", `${num(r.visits)} visits, ${num(r.visitors)} visitors`)}
    ${card(columns(r.daily) + `<details style="margin-top:10px"><summary style="${FONT}font-size:12px;color:${C.accent};cursor:pointer">Show as a table</summary>${table(["Day", "Visits", "Visitors"], r.daily.map(d => [dayLabel(d.day, { weekday: "short", day: "numeric", month: "short" }), num(d.visits), num(d.visitors)]))}</details>`)}
    ${h2("Where people spend their time", "Active time on each part of the page, and the share of visits that spent at least two seconds there")}
    ${card(bars(sectionRows))}
    ${h2("How people found the website")}
    ${card(bars(countRows(r.sources)))}
    ${h2("What people did")}
    ${card(bars(plainRows(r.actions, 10)))}
    ${r.flows.length ? h2("What people asked Nine for") + card(bars(plainRows(r.flows))) : ""}
    ${r.services.length ? h2("Services people read about") + card(bars(plainRows(r.services))) : ""}
    ${h2("Where visitors are", "From the visitor's country when the hosting provides it, otherwise their time zone")}
    ${card(bars(countRows(r.places)))}
    ${h2("Devices and browsers")}
    ${card(bars(countRows(r.devices, r.visits, 3)) + `<div style="height:12px"></div>` + bars(countRows(r.browsers, r.visits, 5)))}
    ${h2("Engagement")}
    ${card(table(["Measure", "This period"], [
      ["Median time on site", fmtDur(r.medianMs)],
      ["Visits that left within 10 seconds", `${pct(r.quick, r.visits)}%`],
      ["How far down the page people scrolled, on average", `${Math.round(r.avgDepth)}%`],
      ["Total time people spent on the site", fmtDur(r.totalMs)],
      ["Visits that opened Nine", num(r.nineOpens)],
    ]))}`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:${C.bg}">
  <tr><td style="background:${C.band};border-radius:18px 18px 0 0;padding:26px 24px">
    <div style="${FONT}font-size:13px;color:#9aa7b5;letter-spacing:.04em">NINTH MIND · WEBSITE REPORT</div>
    <div style="${FONT}font-size:26px;font-weight:700;color:#eef2f6;margin-top:6px">${esc(period)}</div>
    ${opts.recipient ? `<div style="${FONT}font-size:14px;color:#9aa7b5;margin-top:4px">Prepared for ${esc(opts.recipient)}</div>` : ""}
  </td></tr>
  <tr><td style="background:${C.surface};padding:18px 24px;border:1px solid ${C.line};border-top:0">
    <div style="${FONT}font-size:13px;font-weight:700;color:${C.accent};margin-bottom:6px">In short</div>
    ${insights(r, p).map(t => `<div style="${FONT}font-size:15px;line-height:1.5;color:${C.text};margin:6px 0">&#8226;&nbsp; ${esc(t)}</div>`).join("")}
  </td></tr>
  ${body}
  <tr><td style="padding:28px 24px 8px;${FONT}font-size:12px;line-height:1.6;color:${C.soft}">
    Measured on <a href="${opts.siteUrl}" style="color:${C.accent}">${esc(opts.siteUrl.replace(/^https?:\/\//, ""))}</a> without cookies or third-party trackers. A visit is one page load; a visitor is a unique device per day. Time counts only while the page is open in front of someone who is using it. Times are in Nairobi time.
  </td></tr>
  <tr><td style="padding:8px 24px 24px"><img src="${opts.logoUrl}" width="148" height="48" alt="Ninth Mind" style="display:block;border:0"></td></tr>
</table></td></tr></table></body></html>`;

  const text = [`Ninth Mind website report: ${period}`, "", ...insights(r, p).map(t => "- " + t), "",
    `Visitors: ${r.visitors}`, `Visits: ${r.visits}`, `Average time on site: ${fmtDur(r.avgMs)}`, `Enquiries: ${r.enquiries}`, `Contact clicks: ${r.contactClicks}`, "",
    "Where people spend their time:", ...r.sections.map(s => `  ${s.label}: ${fmtDur(s.totalMs)}`), "",
    "How people found the website:", ...r.sources.slice(0, 6).map(s => `  ${s.label}: ${s.n}`), ""].join("\n");
  return { subject, html, text };
}
