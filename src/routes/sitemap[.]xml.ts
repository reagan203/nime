import { createFileRoute } from "@tanstack/react-router";
import { abs } from "~/data/site";

const PAGES = [{ path: "/", priority: "1.0", changefreq: "monthly" }];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => new Response(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${PAGES.map(p => `  <url>\n    <loc>${abs(p.path)}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n    <image:image><image:loc>${abs("/og-image.jpg")}</image:loc></image:image>\n  </url>`).join("\n")}\n</urlset>\n`,
        { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=86400" } },
      ),
    },
  },
});
