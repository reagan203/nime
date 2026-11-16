import { describe, expect, test } from "bun:test";
import type { Stored } from "~/analytics/events";
import { aggregate, fmtDur, insights, placeOf, renderReport, sourceOf } from "~/server/report";
import { lastPeriod } from "~/server/report-schedule";
import { BOT_UA, browserOf, deviceOf } from "~/server/analytics-store";

const at = (d: string) => new Date(d).toISOString();
const view = (sid: string, vid: string, when: string, extra: Partial<Stored> = {}): Stored =>
  ({ t: "view", sid, vid, at: at(when), path: "/", ref: "", utm: {}, lang: "en", tz: "Africa/Nairobi", w: 1280, device: "Desktop", browser: "Chrome", country: "", ...extra } as Stored);
const leave = (sid: string, when: string, dur: number, sections: Record<string, number>, events: { n: string; v?: string }[] = [], depth = 50): Stored =>
  ({ t: "leave", sid, at: at(when), dur, sections, depth, events } as Stored);

const range = { from: new Date("2026-11-09T00:00:00+03:00"), to: new Date("2026-11-15T23:59:59.999+03:00") };
const rows: Stored[] = [
  view("aaaaaaaa1", "v1", "2026-11-10T10:00:00+03:00", { ref: "www.linkedin.com/feed" }),
  leave("aaaaaaaa1", "2026-11-10T10:01:00+03:00", 20_000, { services: 15_000 }),
  leave("aaaaaaaa1", "2026-11-10T10:03:00+03:00", 90_000, { top: 10_000, services: 60_000, contact: 20_000 }, [{ n: "service_view", v: "AI Strategy & Readiness Assessment" }, { n: "nine_open" }, { n: "nine_enquiry", v: "project" }]),
  view("bbbbbbbb2", "v1", "2026-11-11T09:00:00+03:00"),
  leave("bbbbbbbb2", "2026-11-11T09:00:05+03:00", 5_000, { top: 5_000 }, [{ n: "click_email" }]),
  view("cccccccc3", "v2", "2026-11-12T15:00:00+03:00", { ref: "www.google.com/", device: "Phone", country: "KE" }),
  leave("cccccccc3", "2026-11-12T15:02:00+03:00", 40_000, { approach: 30_000, top: 10_000 }, [{ n: "email_form_sent" }]),
  view("dddddddd4", "v3", "2026-11-20T12:00:00+03:00"), // outside the range
];

describe("the website report", () => {
  const r = aggregate(rows, range);
  test("counts visits and visitors", () => { expect(r.visits).toBe(3); expect(r.visitors).toBe(2); });
  test("keeps the fullest of a visit's leave beacons", () => expect(r.totalMs).toBe(135_000));
  test("engagement", () => { expect(r.engaged).toBe(2); expect(r.quick).toBe(1); });
  test("enquiries and contact clicks", () => { expect(r.enquiries).toBe(2); expect(r.nineEnquiries).toBe(1); expect(r.formEmails).toBe(1); expect(r.contactClicks).toBe(1); });
  test("where time is spent, most first", () => { expect(r.sections[0].id).toBe("services"); expect(r.sections[0].totalMs).toBe(60_000); });
  test("every day of the range is listed", () => { expect(r.daily).toHaveLength(7); expect(r.daily.find(d => d.day === "2026-11-10")?.visits).toBe(1); });
  test("sources", () => expect(r.sources.map(s => s.label).sort()).toEqual(["Direct or bookmarks", "Google", "LinkedIn"]));
  test("insights read well", () => expect(insights(r).join(" ")).toContain("Most time was spent on Services"));
  test("the email escapes what visitors' data could contain", () => {
    const bad = aggregate([view("eeeeeeee5", "v9", "2026-11-10T10:00:00+03:00", { utm: { source: "<script>x</script>" } })], range);
    const { html, subject } = renderReport(bad, { siteUrl: "https://www.ninthmind.ai", logoUrl: "https://www.ninthmind.ai/l.png" });
    expect(html).not.toContain("<script>x");
    expect(subject).toContain("1 visitor");
  });
  test("an empty period still renders", () => expect(renderReport(aggregate([], range), { siteUrl: "https://x", logoUrl: "https://x/l.png" }).html).toContain("No visits were recorded"));
});

describe("helpers", () => {
  test("durations", () => { expect(fmtDur(5_000)).toBe("5s"); expect(fmtDur(72_000)).toBe("1m 12s"); expect(fmtDur(3_720_000)).toBe("1h 2m"); });
  test("sources from referrers and campaigns", () => {
    expect(sourceOf({ ref: "chatgpt.com/", utm: {} } as any)).toBe("ChatGPT");
    expect(sourceOf({ ref: "", utm: { source: "newsletter" } } as any)).toBe("Newsletter");
  });
  test("places", () => { expect(placeOf({ country: "KE", tz: "" } as any)).toBe("Kenya"); expect(placeOf({ country: "", tz: "Africa/Dar_es_Salaam" } as any)).toBe("Dar es Salaam time zone"); });
  test("devices, browsers and bots", () => {
    expect(deviceOf(390, "Mozilla/5.0 (iPhone)")).toBe("Phone");
    expect(browserOf("Mozilla/5.0 Chrome/140 Safari/537 Edg/140")).toBe("Edge");
    expect(BOT_UA.test("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(BOT_UA.test("Mozilla/5.0 (Windows NT 10.0) Chrome/140 Safari/537.36")).toBe(false);
  });
  test("last week runs Monday to Sunday, Nairobi time", () => {
    const p = lastPeriod("weekly", new Date("2026-11-16T06:00:00Z")); // Monday 09:00 in Nairobi
    expect(p.from.toISOString()).toBe("2026-11-08T21:00:00.000Z");   // Monday 9 Nov, 00:00 Nairobi
    expect(p.to.toISOString()).toBe("2026-11-15T20:59:59.999Z");
    expect(p.key).toBe("w-2026-11-09");
  });
});
