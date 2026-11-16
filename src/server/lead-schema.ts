import { z } from "zod";

const text = (max: number) => z.string().trim().max(max).optional().default("");

/** What Nine sends when a visitor says "send it". Shared by the client and the server. */
export const LeadSchema = z.object({
  route: z.enum(["project", "train", "level", "explore", "quick", "form"]),
  name: text(80),
  org: text(120),
  service: text(120),
  area: text(120),
  levelNow: z.number().int().min(1).max(5).nullable().optional().default(null),
  levelGoal: z.number().int().min(1).max(5).nullable().optional().default(null),
  need: text(2000),
  situation: text(200),
  timing: text(200),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(254)]).optional().default(""),
  phone: z.union([z.literal(""), z.string().trim().regex(/^\+?\d{7,15}$/)]).optional().default(""),
  notes: text(4000),
  message: text(4000),
  /** the visitor asked for a copy at their email address */
  copy: z.boolean().optional().default(false),
  /** the conversation, so the team has the context */
  transcript: z.array(z.object({ who: z.enum(["nine", "visitor"]), text: z.string().max(2000) })).max(200).optional().default([]),
  /** honeypot: a hidden field people never fill in */
  website: z.string().max(200).optional().default(""),
  /** when the conversation started (ms since epoch), to spot bots that post instantly */
  startedAt: z.number().int().positive(),
  page: text(300),
});

export type LeadInput = z.input<typeof LeadSchema>;
export type Lead = z.output<typeof LeadSchema>;

export interface SendResult {
  ok: boolean;
  id?: string;
  /** how the email went out: through Resend, SMTP, or written to the local outbox in development */
  via?: "resend" | "smtp" | "outbox";
  copySent?: boolean;
  error?: "rate-limited" | "invalid" | "delivery-failed";
  message?: string;
}
