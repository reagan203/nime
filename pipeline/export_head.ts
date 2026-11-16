/* Place a new head render onto the existing body, for the website.
   Usage: bun pipeline/export_head.ts <render dir with display_head.png and display_head.json> [site dir = public]

   The body layer (body.webp) and the frame stay as they are. The new head is scaled so its
   collar is the same width as before and placed so its collar sits where it did, then
   cropped to what's visible and saved at twice the display scale for a sharper head.
   nine.json gets the new head box, pivot and screen corners; the site reads them from there.
   Uses the installed Chrome (or Edge) to do the image work, so no Python imaging is needed. */
import { chromium } from "playwright-core";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [renderDir, siteDir = "public"] = process.argv.slice(2);
if (!renderDir) { console.error("Usage: bun pipeline/export_head.ts <render dir> [site dir]"); process.exit(1); }
const out = join(siteDir, "assets", "nine", "photo");
const rig = JSON.parse(readFileSync(join(out, "nine.json"), "utf8"));
const info = JSON.parse(readFileSync(join(renderDir, "display_head.json"), "utf8"));
const png = "data:image/png;base64," + readFileSync(join(renderDir, "display_head.png")).toString("base64");

// where the collar sat before, in frame pixels, and how wide it was (the original export: neck width 175 × 1.12)
const old = rig.head, COLLAR_W = Number(process.env.COLLAR_W || 196), SCALE = 2;
const collar = [old.x + old.pivot[0] * old.w, old.y + old.pivot[1] * old.h];
const s = COLLAR_W / info.collar_width_px;           // render px → frame px

const browserPath = [process.env.BROWSER, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome"].find(p => p && existsSync(p));
const b = await chromium.launch({ executablePath: browserPath });
const page = await b.newPage();
const res = await page.evaluate(async ({ png, s, scale }) => {
  const im = new Image(); im.src = png; await im.decode();
  const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const x = c.getContext("2d")!; x.drawImage(im, 0, 0);
  const a = x.getImageData(0, 0, c.width, c.height).data;
  let l = c.width, t = c.height, r = 0, bt = 0;
  for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) if (a[(yy * c.width + xx) * 4 + 3] > 2) { if (xx < l) l = xx; if (xx > r) r = xx; if (yy < t) t = yy; if (yy > bt) bt = yy; }
  r += 1; bt += 1;
  const w = Math.round((r - l) * s * scale), h = Math.round((bt - t) * s * scale);
  const o = document.createElement("canvas"); o.width = w; o.height = h;
  const ox = o.getContext("2d")!; ox.imageSmoothingQuality = "high"; ox.drawImage(c, l, t, r - l, bt - t, 0, 0, w, h);
  return { l, t, r, b: bt, data: o.toDataURL("image/webp", 0.9) };
}, { png, s, scale: SCALE });
await b.close();

const rel = (p: number[]) => [+((p[0] - res.l) / (res.r - res.l)).toFixed(4), +((p[1] - res.t) / (res.b - res.t)).toFixed(4)];
const pivot = rel(info.collar_bottom);
const w = +((res.r - res.l) * s).toFixed(1), h = +((res.b - res.t) * s).toFixed(1);
const head = {
  x: +(collar[0] - pivot[0] * w).toFixed(1), y: +(collar[1] - pivot[1] * h).toFixed(1), w, h, pivot,
  screen: Object.fromEntries(Object.entries(info.screen as Record<string, number[]>).map(([k, v]) => [k, rel(v)])),
};
if (head.y < 0) console.warn(`The head now reaches ${-head.y}px above the frame; it will be cut off at the top.`);
writeFileSync(join(out, "head.webp"), Buffer.from(res.data.split(",")[1], "base64"));
writeFileSync(join(out, "nine.json"), JSON.stringify({ ...rig, head }, null, 2) + "\n");
console.log(JSON.stringify(head));
