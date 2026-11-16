/* The server function Nine calls when the visitor says "send it". */
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { LeadSchema, type SendResult } from "./lead-schema";
import { deliverLead } from "./mailer";

// a small in-memory rate limit: 5 sends per address every 10 minutes
const WINDOW = 10 * 60 * 1000, LIMIT = 5;
const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now(), list = (hits.get(key) || []).filter(t => now - t < WINDOW);
  list.push(now); hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < WINDOW)) hits.delete(k);
  return list.length > LIMIT;
}

export const sendLead = createServerFn({ method: "POST" })
  .validator(LeadSchema)
  .handler(async ({ data }): Promise<SendResult> => {
    // bots: the honeypot is filled in, or the "conversation" took under three seconds. Pretend it worked.
    if (data.website || Date.now() - data.startedAt < 3000) return { ok: true, id: "NM-IGNORED" };
    const ip = getRequestIP({ xForwardedFor: true }) || "unknown";
    if (limited(ip)) return { ok: false, error: "rate-limited", message: "That's a lot of messages in a short time. Please try again in a few minutes." };
    return deliverLead(data, process.env, { ip });
  });
