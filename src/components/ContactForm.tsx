/* "Send us an email": for visitors who'd rather write than talk to Nine.
   Uses the same server function as Nine (validation, honeypot, rate limit, delivery). */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { sendLead } from "~/server/lead";
import { track } from "~/analytics/track";
import { CONTACT } from "~/data/content";
import { ArrowIcon } from "./icons";

type Status = { kind: "idle" | "sending" | "sent" | "error"; text?: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", org: "", phone: "", message: "", copy: true, website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const startedAt = useRef(0);
  useEffect(() => { startedAt.current = Date.now(); }, []);
  const set = (k: keyof typeof f) => (e: { target: HTMLInputElement | HTMLTextAreaElement }) =>
    setF(s => ({ ...s, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.name.trim()) err.name = "Please tell us your name.";
    if (!EMAIL.test(f.email.trim())) err.email = "Please enter an email address we can reply to.";
    const phone = f.phone.replace(/[^\d+]/g, "");
    if (f.phone.trim() && !/^\+?\d{7,15}$/.test(phone)) err.phone = "Please check the number, with the country code.";
    if (f.message.trim().length < 5) err.message = "Please write a short message.";
    setErrors(err);
    if (Object.keys(err).length) { document.getElementById("cf-" + Object.keys(err)[0])?.focus(); return; }
    setStatus({ kind: "sending" });
    try {
      const r = await sendLead({ data: {
        route: "form", name: f.name.trim(), email: f.email.trim(), org: f.org.trim(), phone, message: f.message.trim(),
        copy: f.copy, website: f.website, startedAt: startedAt.current || Date.now() - 60000, page: location.pathname,
      } });
      if (r.ok) {
        track("email_form_sent");
        setStatus({ kind: "sent", text: `Thank you${f.name ? ", " + f.name.trim().split(/\s+/)[0] : ""}. Your message is with the team${r.id && r.id !== "NM-IGNORED" ? ` (reference ${r.id})` : ""}, and we'll reply to ${f.email.trim()}.${r.copySent ? " We've emailed you a copy." : ""}` });
        setF(s => ({ ...s, message: "" }));
      } else setStatus({ kind: "error", text: r.message || "We couldn't send that just now." });
    } catch {
      setStatus({ kind: "error", text: "We couldn't reach our server." });
    }
  }

  const field = (k: "name" | "email" | "org" | "phone", label: string, props: Record<string, unknown>) => (
    <label className="nm-field">
      <span>{label}</span>
      <input id={"cf-" + k} value={f[k]} onChange={set(k)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `cf-${k}-err` : undefined} {...props} />
      {errors[k] && <small id={`cf-${k}-err`} className="nm-field-err">{errors[k]}</small>}
    </label>
  );

  return (
    <div className="nm-panel nm-panel-form" id="email-us">
      <h2>Send us an email</h2>
      <p className="nm-form-lead">Write to the team directly, and we will reply by email.</p>
      {status.kind === "sent" ? (
        <div className="nm-form-done" role="status">
          <p>{status.text}</p>
          <button className="nm-btn nm-btn-ghost nm-btn-sm" type="button" onClick={() => setStatus({ kind: "idle" })}>Send another message</button>
        </div>
      ) : (
        <form className="nm-form" onSubmit={submit} noValidate>
          {field("name", "Your name", { autoComplete: "name", required: true })}
          {field("email", "Email", { type: "email", autoComplete: "email", inputMode: "email", required: true })}
          {field("org", "Organisation (optional)", { autoComplete: "organization" })}
          {field("phone", "Phone or WhatsApp (optional)", { type: "tel", autoComplete: "tel", inputMode: "tel", placeholder: "+254 7xx xxx xxx" })}
          <label className="nm-field nm-field-wide">
            <span>Message</span>
            <textarea id="cf-message" rows={5} value={f.message} onChange={set("message")} required aria-invalid={!!errors.message} aria-describedby={errors.message ? "cf-message-err" : undefined}
              placeholder="What would you like AI to help your organisation with?" />
            {errors.message && <small id="cf-message-err" className="nm-field-err">{errors.message}</small>}
          </label>
          {/* honeypot for spam bots: hidden from people and screen readers */}
          <input className="nm-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set("website")} />
          <div className="nm-form-foot nm-field-wide">
            <label className="nm-check"><input type="checkbox" checked={f.copy} onChange={set("copy")} /> Email me a copy</label>
            <button className="nm-btn nm-btn-primary" type="submit" disabled={status.kind === "sending"}>
              {status.kind === "sending" ? "Sending…" : <>Send email <ArrowIcon /></>}
            </button>
          </div>
          <p className="nm-form-status nm-field-wide" role="status" aria-live="polite">
            {status.kind === "error" && <>{status.text} You can also write to <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.</>}
          </p>
        </form>
      )}
    </div>
  );
}
