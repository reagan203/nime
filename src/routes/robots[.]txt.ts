import { createFileRoute } from "@tanstack/react-router";
import { abs } from "~/data/site";

// Search engines and AI assistants are welcome: the site wants to be found and quoted.
const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Bingbot", "CCBot", "meta-externalagent"];

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => new Response(
        ["User-agent: *", "Allow: /", "Disallow: /_serverFn/", "Disallow: /api/", "", ...AI_CRAWLERS.flatMap(a => [`User-agent: ${a}`, "Allow: /", ""]), `Sitemap: ${abs("/sitemap.xml")}`, ""].join("\n"),
        { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } },
      ),
    },
  },
});
