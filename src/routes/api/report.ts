/* GET /api/report?key=REPORT_KEY&days=7  shows the website report in the browser.
   Optional: from=YYYY-MM-DD&to=YYYY-MM-DD (Nairobi days). In development no key is needed. */
import { createFileRoute } from "@tanstack/react-router";
import { buildReport } from "~/server/report-schedule";

const TZ_MS = 3 * 3600_000, D = 86400_000;
const day = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(s + "T00:00:00Z") - TZ_MS : NaN);

export const Route = createFileRoute("/api/report")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url), key = process.env.REPORT_KEY;
        const allowed = key ? url.searchParams.get("key") === key : process.env.NODE_ENV !== "production";
        if (!allowed) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        let from = day(url.searchParams.get("from")), to = day(url.searchParams.get("to"));
        if (isNaN(from) || isNaN(to)) {
          const days = Math.min(366, Math.max(1, Number(url.searchParams.get("days")) || 7));
          const today = Math.floor((Date.now() + TZ_MS) / D) * D - TZ_MS;
          to = today + D; from = today - (days - 1) * D; // includes today so far
        } else to += D;
        const { html } = await buildReport({ from: new Date(from), to: new Date(to - 1) });
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
      },
    },
  },
});
