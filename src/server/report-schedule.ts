/* Sending the website report by email, on a schedule or on demand. Server only.

   REPORT_TO         who gets it (default: the Managing Director's address on the site)
   REPORT_FREQUENCY  weekly (default: Monday morning, for the week before), daily, monthly, or off
   REPORT_HOUR       the hour it goes out, Nairobi time (default 8)
   REPORT_KEY        a secret that unlocks the browser preview at /api/report?key=... */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CONTACT } from "~/data/content";
import { SITE } from "~/data/site";
import { makeTransport, type MailerEnv } from "./mailer";
import { readBeacons } from "./analytics-store";
import { aggregate, renderReport, TZ, type Range } from "./report";

export type Frequency = "daily" | "weekly" | "monthly";
export interface ReportEnv extends MailerEnv { REPORT_TO?: string; REPORT_FREQUENCY?: string; REPORT_HOUR?: string; SITE_URL?: string }

const H = 3600_000, D = 24 * H, TZ_MS = 3 * H;
/** Midnight in Nairobi, as a UTC instant, for the Nairobi day containing `t`. */
const nairobiMidnight = (t: number) => Math.floor((t + TZ_MS) / D) * D - TZ_MS;

/** The last complete period before `now`: yesterday, last Monday to Sunday, or last month (Nairobi time). */
export function lastPeriod(freq: Frequency, now = new Date()): Range & { key: string } {
  const today = nairobiMidnight(now.getTime());
  if (freq === "daily") return { from: new Date(today - D), to: new Date(today - 1), key: "d-" + new Date(today - D + TZ_MS).toISOString().slice(0, 10) };
  if (freq === "weekly") {
    const dow = (new Date(today + TZ_MS).getUTCDay() + 6) % 7; // Monday = 0
    const monday = today - dow * D;
    return { from: new Date(monday - 7 * D), to: new Date(monday - 1), key: "w-" + new Date(monday - 7 * D + TZ_MS).toISOString().slice(0, 10) };
  }
  const local = new Date(today + TZ_MS), y = local.getUTCFullYear(), m = local.getUTCMonth();
  const start = Date.UTC(y, m - 1, 1) - TZ_MS, end = Date.UTC(y, m, 1) - TZ_MS;
  return { from: new Date(start), to: new Date(end - 1), key: "m-" + new Date(start + TZ_MS).toISOString().slice(0, 7) };
}
const previousOf = (r: Range): Range => { const len = r.to.getTime() - r.from.getTime() + 1; return { from: new Date(r.from.getTime() - len), to: new Date(r.from.getTime() - 1) }; };

/** Builds the report for a period, with the period before it for comparison. */
export async function buildReport(range: Range, env: ReportEnv = process.env, recipient?: string) {
  const dataDir = env.DATA_DIR || ".data";
  const prevRange = previousOf(range);
  const rows = await readBeacons(new Date(prevRange.from.getTime() - D), new Date(range.to.getTime() + D), dataDir);
  const report = aggregate(rows, range), prev = aggregate(rows, prevRange);
  const siteUrl = (env.SITE_URL || SITE.url).replace(/\/$/, "");
  return { report, ...renderReport(report, { prev, siteUrl, logoUrl: siteUrl + SITE.logo, recipient }) };
}

export async function sendReport(range: Range, env: ReportEnv = process.env, to = env.REPORT_TO || CONTACT.email) {
  const { subject, html, text, report } = await buildReport(range, env, to === CONTACT.email ? CONTACT.short : undefined);
  const transport = await makeTransport(env);
  await transport.send({ to, subject, html, text });
  return { subject, via: transport.via, visits: report.visits };
}

/** Checks every 15 minutes whether a report is due, and sends it once. Started by server.ts. */
export function startReportSchedule(env: ReportEnv = process.env) {
  const freq = (env.REPORT_FREQUENCY || "weekly").toLowerCase();
  if (freq === "off" || !["daily", "weekly", "monthly"].includes(freq)) return;
  const hour = Math.min(23, Math.max(0, Number(env.REPORT_HOUR ?? 8)));
  const stateFile = join(env.DATA_DIR || ".data", "report-state.json");
  let busy = false;
  const check = async () => {
    if (busy) return;
    const now = new Date(), localHour = new Date(now.getTime() + TZ_MS).getUTCHours();
    if (localHour < hour) return;
    const period = lastPeriod(freq as Frequency, now);
    let state: { sent?: string[] } = {};
    try { state = JSON.parse(await readFile(stateFile, "utf8")); } catch {}
    if (state.sent?.includes(period.key)) return;
    busy = true;
    try {
      const r = await sendReport(period, env);
      state.sent = [...(state.sent || []), period.key].slice(-60);
      await mkdir(env.DATA_DIR || ".data", { recursive: true });
      await writeFile(stateFile, JSON.stringify(state));
      console.info(`[report] sent "${r.subject}" via ${r.via} (${TZ})`);
    } catch (e) {
      console.error("[report] could not send the website report", e);
    } finally { busy = false; }
  };
  setTimeout(check, 30_000);
  setInterval(check, 15 * 60_000);
}
