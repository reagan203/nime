/* Send or preview the website report from the command line.

   bun scripts/report.ts                   email last week's report to REPORT_TO
   bun scripts/report.ts --period daily    yesterday (or: weekly, monthly)
   bun scripts/report.ts --days 30         the last 30 days, including today
   bun scripts/report.ts --to someone@example.com
   bun scripts/report.ts --preview report.html   write the HTML instead of sending it */
import { writeFile } from "node:fs/promises";
import { buildReport, lastPeriod, sendReport, type Frequency } from "../src/server/report-schedule";

const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : undefined; };

const D = 86400_000, TZ_MS = 3 * 3600_000;
let range;
if (opt("days")) {
  const days = Math.max(1, Number(opt("days")));
  const today = Math.floor((Date.now() + TZ_MS) / D) * D - TZ_MS;
  range = { from: new Date(today - (days - 1) * D), to: new Date(today + D - 1) };
} else range = lastPeriod((opt("period") as Frequency) || "weekly");

const preview = opt("preview");
if (preview) {
  const { html, subject, report } = await buildReport(range);
  await writeFile(preview, html);
  console.log(`${subject}\n${report.visits} visits. Written to ${preview}`);
} else {
  const r = await sendReport(range, process.env, opt("to") || process.env.REPORT_TO);
  console.log(`Sent "${r.subject}" via ${r.via}.`);
}
