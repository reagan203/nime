/* Production server: `bun run build && bun run start`.
   Serves the built files in dist/client (compressed with Brotli or gzip, with
   long cache lifetimes for fingerprinted files), and everything else (pages,
   robots.txt, sitemap.xml, llms.txt, server functions) through TanStack
   Start's fetch handler. */
import { join, normalize } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
// @ts-ignore: created by `bun run build`
import handler from "./dist/server/server.js";
import { startReportSchedule } from "./src/server/report-schedule";

const CLIENT = join(import.meta.dir, "dist", "client");
const port = Number(process.env.PORT || 3000);
// behind a proxy (nginx, a load balancer) that sets X-Forwarded-For, set TRUST_PROXY=true
const trustProxy = process.env.TRUST_PROXY === "true";
// the one address the site answers on (e.g. www.ninthmind.ai): other hosts pointed here, like the bare
// ninthmind.ai, get a permanent redirect so search engines see a single site
const canonicalHost = (process.env.CANONICAL_HOST || "").toLowerCase();

const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml|manifest\+json)|image\/svg\+xml)/;
const SECURITY: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "microphone=(self), camera=(), geolocation=()",
  "X-Frame-Options": "SAMEORIGIN",
};

type Encoding = "br" | "gzip" | null;
const pickEncoding = (req: Request): Encoding => {
  const a = req.headers.get("accept-encoding") || "";
  return /\bbr\b/.test(a) ? "br" : /\bgzip\b/.test(a) ? "gzip" : null;
};
const compress = (buf: Uint8Array, enc: "br" | "gzip") =>
  enc === "br" ? brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }) : gzipSync(buf, { level: 9 });

// static text files are compressed once and kept in memory
const cache = new Map<string, Uint8Array>();

function cacheControl(path: string) {
  if (/^assets[\\/][^\\/]+-[A-Za-z0-9_-]{8}\.(js|css|woff2)$/.test(path)) return "public, max-age=31536000, immutable"; // fingerprinted build output
  if (/^assets[\\/]nine[\\/]/.test(path)) return "public, max-age=2592000, stale-while-revalidate=86400"; // Nine's images
  return "public, max-age=86400, stale-while-revalidate=604800";
}

async function serveStatic(req: Request, path: string): Promise<Response | null> {
  const file = Bun.file(join(CLIENT, path));
  if (!(await file.exists())) return null;
  const type = file.type;
  const headers: Record<string, string> = { ...SECURITY, "Content-Type": type, "Cache-Control": cacheControl(path), Vary: "Accept-Encoding" };
  const enc = pickEncoding(req);
  if (enc && COMPRESSIBLE.test(type) && file.size > 1024) {
    const key = enc + ":" + path;
    let body = cache.get(key);
    if (!body) { body = compress(new Uint8Array(await file.arrayBuffer()), enc); cache.set(key, body); }
    return new Response(req.method === "HEAD" ? null : new Blob([body as BlobPart]), { headers: { ...headers, "Content-Encoding": enc } });
  }
  return new Response(req.method === "HEAD" ? null : file, { headers });
}

const server = Bun.serve({
  port,
  async fetch(req, srv) {
    const url = new URL(req.url);
    const host = (req.headers.get("host") || url.host).toLowerCase();
    // for the host's health checks, which call by IP address and must not be redirected
    if (url.pathname === "/healthz") return new Response("ok", { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
    const https = url.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
    if (canonicalHost && host !== canonicalHost && !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) {
      return new Response(null, { status: 301, headers: { Location: `https://${canonicalHost}${url.pathname}${url.search}` } });
    }
    // once the site is served over HTTPS, browsers are told to keep using it
    if (https) SECURITY["Strict-Transport-Security"] ??= "max-age=31536000";
    if (req.method === "GET" || req.method === "HEAD") {
      let path = "";
      try { path = normalize(decodeURIComponent(url.pathname)).replace(/^[\\/]+/, ""); } catch { /* a malformed URL is not a file */ }
      if (path && !path.startsWith("..")) {
        const res = await serveStatic(req, path);
        if (res) return res;
      }
    }
    const headers = new Headers(req.headers);
    if (!trustProxy) headers.set("x-forwarded-for", srv.requestIP(req)?.address || "unknown");
    const res: Response = await handler.fetch(new Request(req, { headers }));

    // pages and text routes: compress on the way out
    const out = new Headers(res.headers);
    for (const [k, v] of Object.entries(SECURITY)) if (!out.has(k)) out.set(k, v);
    const type = out.get("content-type") || "";
    const enc = pickEncoding(req);
    if (enc && res.body && COMPRESSIBLE.test(type) && !out.has("content-encoding")) {
      out.set("Content-Encoding", enc === "br" ? "br" : "gzip"); out.append("Vary", "Accept-Encoding"); out.delete("content-length");
      if (enc === "gzip") return new Response(res.body.pipeThrough(new CompressionStream("gzip")), { status: res.status, headers: out });
      // Brotli for streamed pages: buffer once (the page is small) and compress at a fast setting
      const buf = new Uint8Array(await res.arrayBuffer());
      return new Response(new Blob([brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }) as BlobPart]), { status: res.status, headers: out });
    }
    return new Response(res.body, { status: res.status, headers: out });
  },
});
console.log(`Ninth Mind is running at http://localhost:${server.port}`);
// the website report for the Managing Director (see src/server/report-schedule.ts)
startReportSchedule();
