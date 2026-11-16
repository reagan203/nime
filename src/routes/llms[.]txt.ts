import { createFileRoute } from "@tanstack/react-router";
import { llmsText } from "~/data/site";

// A plain-text summary for AI assistants and answer engines (https://llmstxt.org), built from the same content as the page.
export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () => new Response(llmsText(), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } }),
    },
  },
});
