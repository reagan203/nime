/* Sending Nine's summaries by email. Server only.

   Delivery, in order of preference (set in .env, see .env.example):
   1. Resend's HTTP API, when RESEND_API_KEY is set
   2. Any SMTP server, when SMTP_HOST is set (Gmail, Microsoft 365, Mailgun, ...)
   3. Otherwise, in development, each email is written to .data/outbox/ so nothing is lost.
   Every lead is also appended to .data/leads.jsonl. */
import { mkdir, appendFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Lead, SendResult } from "./lead-schema";

export interface Email { to: string; replyTo?: string; subject: string; text: string; html: string }
export interface MailerEnv {
  RESEND_API_KEY?: string;
  SMTP_HOST?: string; SMTP_PORT?: string; SMTP_SECURE?: string; SMTP_USER?: string; SMTP_PASS?: string;
  MAIL_FROM?: string; LEADS_TO?: string; DATA_DIR?: string; NODE_ENV?: string;
}

const LEVEL_NAMES = ["AI as a tool", "AI as a process", "AI as a team member", "AI as an operating system", "AI as a competitive advantage"];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ROUTES: Record<Lead["route"], string> = { project: "AI project", train: "Training", level: "Maturity level", explore: "Services", quick: "Quick message" };

export function leadRows(l: Lead): [string, string][] {
  const lv = (n: number | null) => (n ? `Level ${n} · ${LEVEL_NAMES[n - 1]}` : "");
  const rows: [string, string][] = [
    ["Name", l.name || "Not given"],
    ["Organisation", l.org],
    ["Interested in", l.service ? `${l.service}${l.area ? ` (${l.area})` : ""}` : ""],
    ["Today", lv(l.levelNow)],
    ["In 12 months", l.levelGoal && l.levelGoal !== l.levelNow ? lv(l.levelGoal) : ""],
    ["What they need", l.need],
    ["Where they are", l.situation],
    ["Timing", l.timing],
    ["Email", l.email],
    ["Phone / WhatsApp", l.phone],
    ["Message", l.message],
    ["Notes", l.notes],
  ];
  return rows.filter(([, v]) => v);
}

export function teamEmail(l: Lead, id: string, to: string): Email {
  const rows = leadRows(l);
  const who = l.name || "A visitor";
  const subject = `Nine: ${ROUTES[l.route]} from ${who}${l.org ? `, ${l.org}` : ""}`;
  const contact = l.email || l.phone ? "" : "\nThe visitor chose not to leave contact details, so this is for information only.\n";
  const transcript = l.transcript.map(t => `${t.who === "nine" ? "Nine" : "Visitor"}: ${t.text}`).join("\n");
  const text = `${who} talked to Nine on the website.\n${contact}\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nReference: ${id}\n\n--- Conversation ---\n${transcript}\n`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#2b2d31;max-width:620px">
<p style="font-size:16px">${esc(who)} talked to Nine on the website.</p>
${contact ? `<p style="color:#5c636d">${esc(contact.trim())}</p>` : ""}
<table style="border-collapse:collapse;font-size:15px">${rows.map(([k, v]) => `<tr><td style="padding:6px 18px 6px 0;color:#5c636d;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0">${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>
<p style="color:#868d97;font-size:13px">Reference: ${esc(id)}</p>
${transcript ? `<details><summary style="cursor:pointer;color:#0a6fb8">The conversation</summary><pre style="white-space:pre-wrap;font:13px/1.5 ui-monospace,monospace;color:#5c636d">${esc(transcript)}</pre></details>` : ""}
</div>`;
  return { to, replyTo: l.email || undefined, subject, text, html };
}

export function visitorEmail(l: Lead, id: string, replyTo: string): Email {
  const rows = leadRows(l).filter(([k]) => k !== "Email");
  const hi = l.name ? `Hi ${l.name.split(/\s+/)[0]},` : "Hello,";
  const text = `${hi}\n\nThank you for talking to Nine. This is a copy of what was sent to the Ninth Mind team. Someone will be in touch soon.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nYou can reply to this email to add anything.\n\nNinth Mind Limited\nNo. 16 Kanjata Road, off James Gichuru Road, Nairobi, Kenya\nwww.ninthmind.ai\n\nReference: ${id}\n`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#2b2d31;max-width:620px">
<p>${esc(hi)}</p>
<p>Thank you for talking to Nine. This is a copy of what was sent to the Ninth Mind team. Someone will be in touch soon.</p>
<table style="border-collapse:collapse;font-size:15px">${rows.map(([k, v]) => `<tr><td style="padding:6px 18px 6px 0;color:#5c636d;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0">${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>
<p>You can reply to this email to add anything.</p>
<p style="color:#5c636d;font-size:14px">Ninth Mind Limited · No. 16 Kanjata Road, off James Gichuru Road, Nairobi, Kenya · <a href="https://www.ninthmind.ai" style="color:#0a6fb8">www.ninthmind.ai</a></p>
<p style="color:#868d97;font-size:13px">Reference: ${esc(id)}</p></div>`;
  return { to: l.email, replyTo, subject: "Your conversation with Nine, Ninth Mind's assistant", text, html };
}

type Transport = { via: NonNullable<SendResult["via"]>; send: (e: Email) => Promise<void> };

export async function makeTransport(env: MailerEnv): Promise<Transport> {
  const from = env.MAIL_FROM || "Nine at Ninth Mind <nine@ninthmind.ai>";
  if (env.RESEND_API_KEY) {
    return {
      via: "resend",
      async send(e) {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [e.to], reply_to: e.replyTo, subject: e.subject, text: e.text, html: e.html }),
        });
        if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
      },
    };
  }
  if (env.SMTP_HOST) {
    const nodemailer = await import("nodemailer");
    const port = Number(env.SMTP_PORT || 587);
    const t = nodemailer.createTransport({
      host: env.SMTP_HOST, port, secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
    return { via: "smtp", async send(e) { await t.sendMail({ from, to: e.to, replyTo: e.replyTo, subject: e.subject, text: e.text, html: e.html }); } };
  }
  if (env.NODE_ENV === "production") throw new Error("No email transport: set RESEND_API_KEY or SMTP_HOST.");
  const dir = join(env.DATA_DIR || ".data", "outbox");
  return {
    via: "outbox",
    async send(e) {
      await mkdir(dir, { recursive: true });
      const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${e.to.replace(/[^a-z0-9@.]/gi, "_")}.json`);
      await writeFile(file, JSON.stringify(e, null, 2));
      console.info(`[nine] email written to ${file} (no transport configured)`);
    },
  };
}

/** Records the lead and emails the team, plus the visitor when they asked for a copy. */
export async function deliverLead(lead: Lead, env: MailerEnv, meta: { ip?: string } = {}): Promise<SendResult> {
  const id = `NM-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const dataDir = env.DATA_DIR || ".data";
  try {
    await mkdir(dataDir, { recursive: true });
    const { website: _hp, ...record } = lead;
    await appendFile(join(dataDir, "leads.jsonl"), JSON.stringify({ id, at: new Date().toISOString(), ip: meta.ip, ...record }) + "\n");
  } catch (e) {
    console.error("[nine] could not record the lead", e);
  }
  const to = env.LEADS_TO || "anup.tabe@ninthmind.ai";
  let transport: Transport;
  try {
    transport = await makeTransport(env);
    await transport.send(teamEmail(lead, id, to));
  } catch (e) {
    console.error("[nine] could not email the team", e);
    return { ok: false, id, error: "delivery-failed", message: "The email service didn't accept the message." };
  }
  let copySent = false;
  if (lead.copy && lead.email) {
    try { await transport.send(visitorEmail(lead, id, to)); copySent = true; }
    catch (e) { console.error("[nine] could not send the visitor's copy", e); }
  }
  return { ok: true, id, via: transport.via, copySent };
}
