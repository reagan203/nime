import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LeadSchema } from "~/server/lead-schema";
import { deliverLead, leadRows, teamEmail, visitorEmail } from "~/server/mailer";

const dir = mkdtempSync(join(tmpdir(), "nine-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const base = { route: "project", name: "Jane Wanjiru", org: "Acme <Ltd>", service: "AI Training, Workshops & Capacity Building", email: "jane@example.com", startedAt: Date.now() - 60000 };

describe("the lead schema", () => {
  test("accepts a full lead and fills defaults", () => {
    const l = LeadSchema.parse(base);
    expect(l.phone).toBe("");
    expect(l.transcript).toEqual([]);
  });
  test("accepts a visitor who left no contact details", () => expect(LeadSchema.safeParse({ ...base, email: "" }).success).toBe(true));
  test("rejects a bad email", () => expect(LeadSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false));
  test("rejects a bad phone", () => expect(LeadSchema.safeParse({ ...base, phone: "call me" }).success).toBe(false));
});

describe("the emails", () => {
  const l = LeadSchema.parse({ ...base, transcript: [{ who: "nine", text: "Hi" }, { who: "visitor", text: "<script>x</script>" }] });
  test("the team email escapes what visitors type", () => {
    const e = teamEmail(l, "NM-1", "team@example.com");
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("Acme &lt;Ltd&gt;");
    expect(e.replyTo).toBe("jane@example.com");
    expect(e.subject).toContain("Jane Wanjiru");
  });
  test("an anonymous lead says the team can't reply", () => {
    const anon = LeadSchema.parse({ ...base, name: "", email: "" });
    expect(teamEmail(anon, "NM-2", "t@example.com").text).toContain("chose not to leave contact details");
    expect(leadRows(anon)[0]).toEqual(["Name", "Not given"]);
  });
  test("the visitor's copy greets them by first name", () => expect(visitorEmail(l, "NM-3", "t@example.com").text.startsWith("Hi Jane,")).toBe(true));
});

describe("delivery without an email service (development)", () => {
  test("writes the team email and the visitor's copy to the outbox, and records the lead", async () => {
    const l = LeadSchema.parse({ ...base, copy: true });
    const r = await deliverLead(l, { DATA_DIR: dir, LEADS_TO: "team@example.com" });
    expect(r.ok).toBe(true);
    expect(r.via).toBe("outbox");
    expect(r.copySent).toBe(true);
    expect(readdirSync(join(dir, "outbox"))).toHaveLength(2);
    const rec = JSON.parse(readFileSync(join(dir, "leads.jsonl"), "utf8").trim());
    expect(rec.id).toBe(r.id);
    expect(rec.website).toBeUndefined();
  });
  test("refuses to pretend in production", async () => {
    const r = await deliverLead(LeadSchema.parse(base), { DATA_DIR: dir, NODE_ENV: "production" });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("delivery-failed");
  });
});
