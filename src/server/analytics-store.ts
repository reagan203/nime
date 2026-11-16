/* Storing website analytics: one JSON line per beacon in $DATA_DIR/analytics/YYYY-MM-DD.jsonl.
   Server only. Visitors are counted with a hash of (daily salt, IP, browser) that can't be
   reversed; the salt changes every day and is deleted after it, so no one can be followed
   across days and no personal data is kept. */
import { appendFile, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";
import type { Beacon, Stored } from "~/analytics/events";

export const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|whatsapp|telegram|curl|wget|python|axios|node-fetch|go-http|java\/|phantom|puppeteer|playwright/i;

const dir = (dataDir: string) => join(dataDir, "analytics");
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

let salt: { day: string; value: string } | null = null;
async function dailySalt(dataDir: string, day: string) {
  if (salt?.day === day) return salt.value;
  const file = join(dir(dataDir), `.salt-${day}`);
  let value: string;
  try { value = (await readFile(file, "utf8")).trim(); }
  catch {
    value = randomBytes(24).toString("hex");
    await mkdir(dir(dataDir), { recursive: true });
    await writeFile(file, value);
    // yesterday's salts are no longer needed: deleting them makes old hashes unlinkable
    for (const f of await readdir(dir(dataDir))) if (f.startsWith(".salt-") && f !== `.salt-${day}`) await unlink(join(dir(dataDir), f)).catch(() => {});
  }
  salt = { day, value };
  return value;
}

export function deviceOf(width: number, ua: string) {
  if (/ipad|tablet/i.test(ua) || (width >= 600 && width < 1024 && /mobile|android/i.test(ua))) return "Tablet";
  if (width && width < 600) return "Phone";
  if (/mobi|iphone|android/i.test(ua)) return "Phone";
  return width && width < 1024 ? "Tablet" : "Desktop";
}
export function browserOf(ua: string) {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/samsungbrowser/i.test(ua)) return "Samsung Internet";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "Other";
}

export async function storeBeacon(b: Beacon, meta: { ip: string; ua: string; country?: string; now?: Date }, dataDir = process.env.DATA_DIR || ".data") {
  const now = meta.now || new Date(), day = dayKey(now);
  let rec: Stored;
  if (b.t === "view") {
    const s = await dailySalt(dataDir, day);
    const vid = createHash("sha256").update(`${s}|${meta.ip}|${meta.ua}`).digest("hex").slice(0, 16);
    rec = { ...b, at: now.toISOString(), vid, device: deviceOf(b.w, meta.ua), browser: browserOf(meta.ua), country: (meta.country || "").toUpperCase().slice(0, 2) };
  } else rec = { ...b, at: now.toISOString() };
  await mkdir(dir(dataDir), { recursive: true });
  await appendFile(join(dir(dataDir), `${day}.jsonl`), JSON.stringify(rec) + "\n");
}

/** Every stored beacon between two dates (inclusive, UTC days). */
export async function readBeacons(from: Date, to: Date, dataDir = process.env.DATA_DIR || ".data"): Promise<Stored[]> {
  const out: Stored[] = [];
  for (let d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())); d <= to; d = new Date(d.getTime() + 86400_000)) {
    let text = "";
    try { text = await readFile(join(dir(dataDir), `${dayKey(d)}.jsonl`), "utf8"); } catch { continue; }
    for (const line of text.split("\n")) { if (!line) continue; try { out.push(JSON.parse(line)); } catch { /* a torn line */ } }
  }
  return out;
}
