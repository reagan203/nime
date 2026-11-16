/* Website analytics: what the browser sends. First-party and cookie-free:
   no cookies, nothing stored in the browser, no third parties. A visit is one
   page load; the server counts unique visitors per day with a salted hash it
   throws away daily, so no one can be followed across days. */
import { z } from "zod";

/** Things worth counting. Anything else is ignored by the server. */
export const EVENT_NAMES = [
  "nine_open", "nine_flow", "nine_enquiry", "email_form_sent",
  "service_view", "level_view", "click_email", "click_phone", "click_whatsapp", "click_linkedin", "click_map", "click_talk",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** The page's sections, in order, with the names the report uses. "nine" is time spent in the conversation. */
export const SECTIONS: Record<string, string> = {
  top: "Hero: AI is the process",
  approach: "Five levels of AI maturity",
  training: "Training",
  services: "Services",
  programme: "How a programme runs",
  mfi: "MFI Group",
  planned: "Future plans",
  contact: "Get in touch",
  footer: "Footer",
  nine: "Talking to Nine",
};

const id = z.string().regex(/^[a-z0-9]{8,32}$/);
const short = (n: number) => z.string().max(n).optional().default("");

export const ViewSchema = z.object({
  t: z.literal("view"),
  sid: id,
  path: short(200),
  ref: short(300),
  utm: z.object({ source: short(80), medium: short(80), campaign: short(120) }).partial().optional().default({}),
  lang: short(20),
  tz: short(60),
  w: z.number().int().min(0).max(10000).optional().default(0),
});

export const LeaveSchema = z.object({
  t: z.literal("leave"),
  sid: id,
  /** active time on the page (visible and in use), in ms */
  dur: z.number().int().min(0).max(6 * 3600_000),
  /** active ms per section */
  sections: z.record(z.string().max(20), z.number().int().min(0).max(6 * 3600_000)).optional().default({}),
  /** furthest point scrolled to, 0 to 100 */
  depth: z.number().int().min(0).max(100).optional().default(0),
  events: z.array(z.object({ n: z.enum(EVENT_NAMES), v: z.string().max(120).optional() })).max(200).optional().default([]),
});

export const BeaconSchema = z.discriminatedUnion("t", [ViewSchema, LeaveSchema]);
export type Beacon = z.output<typeof BeaconSchema>;

/** What the server stores, one JSON line per beacon (see src/server/analytics-store.ts). */
export type StoredView = z.output<typeof ViewSchema> & { at: string; vid: string; device: string; browser: string; country: string };
export type StoredLeave = z.output<typeof LeaveSchema> & { at: string };
export type Stored = StoredView | StoredLeave;
