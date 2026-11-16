/* End-to-end check of Nine in a real browser.
   Run against a running site:  BASE_URL=http://localhost:3000 bun tests/e2e/chat.e2e.ts
   Uses an installed Chrome or Edge (set BROWSER to its path if it isn't found). */
import { chromium, type Page } from "playwright-core";
import { existsSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.env.SHOTS || "";
const browserPath = process.env.BROWSER || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find(p => existsSync(p));

let failures = 0;
const ok = (cond: boolean, what: string) => { console.log(`${cond ? "✓" : "✗"} ${what}`); if (!cond) failures++; };

async function nineSays(page: Page, text: string, timeout = 15000) {
  try {
    await page.waitForFunction(t => (document.getElementById("asNow")?.textContent || "").includes(t), text, { timeout, polling: 50 });
    return true;
  } catch { return false; }
}
async function answerBox(page: Page) { await page.waitForSelector("#asForm:not(.nm-as-hidden)", { timeout: 15000 }); }
async function type(page: Page, text: string) { await answerBox(page); await page.fill("#asInput", text); await page.press("#asInput", "Enter"); }
async function tap(page: Page, label: string) { await answerBox(page); await page.click(`.nm-as-opt:has-text("${label}")`); }

const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => { try { localStorage.setItem("nm-voice", "off"); localStorage.setItem("nm-theme", "light"); } catch {} });
const page = await ctx.newPage();
const errors: string[] = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(BASE, { waitUntil: "networkidle" });
ok(await page.locator(".np").count() >= 2, "Nine is on the page (hero and chat)");
ok(await page.locator(".nm-tile").count() === 5, "five service areas");
if (OUT) await page.screenshot({ path: `${OUT}/new-hero.png` });

// open Nine and say no straight away
await page.click(".nm-header-cta");
ok(await nineSays(page, "Where shall we start?"), "Nine greets and offers the menu");
await type(page, "no");
ok(await nineSays(page, "I'll be around if you change your mind"), "a no at the menu is taken gracefully");
await tap(page, "Actually, let's talk");
await tap(page, "Start an AI project");
ok(await nineSays(page, "what's your name?"), "asks for a name");
await type(page, "I'd rather not");
ok(await nineSays(page, "you don't have to tell me"), "declining the name is fine");
await type(page, "Acme Logistics");
ok(await nineSays(page, "help Acme Logistics with"), "uses the organisation");
await type(page, "we process invoices by hand");
ok(await nineSays(page, "closest fit"), "matches the need to services");
await tap(page, "AI Implementation, Integration & Automation");
await tap(page, "Just exploring the idea");
ok(await nineSays(page, "When would you like to start?"), "asks about timing");
await type(page, "no");
ok(await nineSays(page, "talk about timing with you"), "skipping timing is fine");
await type(page, "nope");
ok(await nineSays(page, "can read your message but can't reply"), "declining the email explains what that means");
await tap(page, "Give a phone or WhatsApp number instead");
await type(page, "+254 711 223 344");
ok(await nineSays(page, "anything else the team should know"), "takes a phone number instead");
await type(page, "nothing else");
ok(await nineSays(page, "Here's what I'll send"), "shows the summary");
ok((await page.textContent("#asNow"))!.includes("+254711223344"), "the summary has the phone number");
if (OUT) await page.screenshot({ path: `${OUT}/new-summary.png` });
await type(page, "no");
ok(await nineSays(page, "I won't send it"), "a no at the summary does not send");
await type(page, "help");
ok(await nineSays(page, "You can say no to anything"), "help works mid-conversation");
await tap(page, "Send it after all");
ok(await nineSays(page, "on its way to the team", 20000), "sends after all");
ok(await nineSays(page, "anything else I can help with", 20000), "offers more help");
if (OUT) await page.screenshot({ path: `${OUT}/new-sent.png` });
await tap(page, "No, that's all");
await page.waitForSelector("#as:not(.is-open)", { timeout: 15000 }).catch(() => {});
ok(!(await page.locator("#as.is-open").count()), "a final no says goodbye and closes Nine");

// a visitor who keeps saying no is offered a way out
await page.click(".nm-header-cta");
ok(await nineSays(page, "Where shall we start?"), "a new conversation starts fresh");
await tap(page, "Start an AI project");
await type(page, "no");                       // name
await type(page, "no");                       // organisation
ok(await nineSays(page, "help you with"), "a skipped organisation is fine");
await type(page, "no");                       // need: third no in a row
ok(await nineSays(page, "If now isn't the right moment"), "three refusals in a row: Nine checks in");
await tap(page, "Talk to a person instead");
ok(await nineSays(page, "reach our Managing Director"), "offers the team's direct contacts");

// client-facing: mini Nine offers help that fits the section, and clicking her starts it
await page.click("#asClose");
await page.evaluate(() => document.getElementById("approach")!.scrollIntoView({ behavior: "instant" as ScrollBehavior }));
const offered = await page.waitForFunction(() => /maturity level/.test(document.querySelector(".nm-walker .nb-say.is-on")?.textContent || ""), null, { timeout: 15000 }).then(() => true, () => false);
ok(offered, "on the maturity section, mini Nine offers to find your level");
if (OUT) await page.screenshot({ path: `${OUT}/new-offer.png` });
await page.click(".nm-walker .np-clip", { force: true });
ok(await nineSays(page, "sounds most like your organisation today"), "clicking mini Nine starts the level conversation");

ok(errors.length === 0, `no errors in the browser console${errors.length ? ": " + errors.join(" | ") : ""}`);
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
