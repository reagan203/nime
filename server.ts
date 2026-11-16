/* Production server: `bun run build && bun run start`.
   Serves the built files in dist/client, and everything else (pages, server
   functions) through TanStack Start's fetch handler. */
import { join, normalize } from "node:path";
// @ts-ignore: created by `bun run build`
import handler from "./dist/server/server.js";

const CLIENT = join(import.meta.dir, "dist", "client");
const port = Number(process.env.PORT || 3000);
// behind a proxy (nginx, a load balancer) that sets X-Forwarded-For, set TRUST_PROXY=true
const trustProxy = process.env.TRUST_PROXY === "true";

const server = Bun.serve({
  port,
  async fetch(req, srv) {
    const url = new URL(req.url);
    if (req.method === "GET" || req.method === "HEAD") {
      let path = "";
      try { path = normalize(decodeURIComponent(url.pathname)).replace(/^[\\/]+/, ""); } catch { /* a malformed URL is not a file */ }
      if (path && !path.startsWith("..")) {
        const file = Bun.file(join(CLIENT, path));
        if (await file.exists()) {
          // hashed build files never change; Nine's images change rarely
          const cache = /^assets[\\/][^\\/]+-[A-Za-z0-9_-]{8}\.(js|css)$/.test(path) ? "public, max-age=31536000, immutable" : "public, max-age=3600";
          return new Response(file, { headers: { "Cache-Control": cache } });
        }
      }
    }
    const headers = new Headers(req.headers);
    if (!trustProxy) headers.set("x-forwarded-for", srv.requestIP(req)?.address || "unknown");
    return handler.fetch(new Request(req, { headers }));
  },
});
console.log(`Ninth Mind is running at http://localhost:${server.port}`);
