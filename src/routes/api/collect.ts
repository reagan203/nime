/* POST /api/collect: receives the website's analytics beacons (src/analytics/track.ts). */
import { createFileRoute } from "@tanstack/react-router";
import { BeaconSchema } from "~/analytics/events";
import { BOT_UA, storeBeacon } from "~/server/analytics-store";

// at most 120 beacons a minute from one address
const hits = new Map<string, { n: number; t: number }>();
const limited = (ip: string) => {
  const now = Date.now(), h = hits.get(ip);
  if (!h || now - h.t > 60_000) { hits.set(ip, { n: 1, t: now }); if (hits.size > 10000) hits.clear(); return false; }
  return ++h.n > 120;
};

export const Route = createFileRoute("/api/collect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const done = new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
        const ua = request.headers.get("user-agent") || "";
        if (!ua || BOT_UA.test(ua)) return done;
        const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
        if (limited(ip)) return done;
        const text = await request.text();
        if (text.length > 20_000) return done;
        let body: unknown;
        try { body = JSON.parse(text); } catch { return done; }
        const parsed = BeaconSchema.safeParse(body);
        if (!parsed.success) return done;
        // a country code, when a CDN in front of the site provides one (Cloudflare, Vercel, Fastly)
        const country = request.headers.get("cf-ipcountry") || request.headers.get("x-vercel-ip-country") || request.headers.get("fastly-geo-country") || "";
        await storeBeacon(parsed.data, { ip, ua, country: country === "XX" ? "" : country }).catch(e => console.error("[analytics]", e));
        return done;
      },
    },
  },
});
