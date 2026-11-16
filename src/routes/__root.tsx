/// <reference types="vite/client" />
import type { ReactNode } from "react";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import siteCss from "~/styles/site.css?url";
import dmSans from "@fontsource-variable/dm-sans/files/dm-sans-latin-opsz-normal.woff2?url";
import montserrat from "@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2?url";
import { SITE, abs, structuredData } from "~/data/site";

const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cline x1='32' y1='14' x2='32' y2='6' stroke='%232b2d31' stroke-width='3'/%3E%3Ccircle cx='32' cy='6' r='5' fill='%231d97dc'/%3E%3Crect x='8' y='14' width='48' height='44' rx='17' fill='%23ffffff' stroke='%23d8e0e9' stroke-width='2'/%3E%3Crect x='14' y='22' width='36' height='26' rx='11' fill='%23081a2b'/%3E%3Crect x='22' y='28' width='5' height='9' rx='2' fill='%23e3f7ff'/%3E%3Crect x='37' y='28' width='5' height='9' rx='2' fill='%23e3f7ff'/%3E%3C/svg%3E";

/* Pick the theme before the page paints: saved choice, else the device setting. */
const THEME = `(function(){var t=null;try{t=localStorage.getItem("nm-theme")}catch(e){}if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)})();`;
// "<" escaped so the JSON can never close the script tag
const JSON_LD = JSON.stringify(structuredData()).replace(/</g, "\\u003c");

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: SITE.title },
      { name: "description", content: SITE.description },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { name: "author", content: SITE.legalName },
      { name: "theme-color", content: "#0a6fb8", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#111317", media: "(prefers-color-scheme: dark)" },
      { name: "color-scheme", content: "light dark" },
      { name: "format-detection", content: "telephone=no" },
      // sharing: Open Graph (LinkedIn, WhatsApp, Facebook, Slack) and X
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE.name },
      { property: "og:locale", content: SITE.locale },
      { property: "og:url", content: SITE.url + "/" },
      { property: "og:title", content: SITE.title },
      { property: "og:description", content: SITE.description },
      { property: "og:image", content: abs(SITE.image) },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: SITE.imageAlt },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE.title },
      { name: "twitter:description", content: SITE.description },
      { name: "twitter:image", content: abs(SITE.image) },
      { name: "twitter:image:alt", content: SITE.imageAlt },
    ],
    links: [
      { rel: "canonical", href: SITE.url + "/" },
      { rel: "icon", href: ICON, type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "alternate", type: "text/plain", href: "/llms.txt", title: "Ninth Mind for AI assistants" },
      // fonts are served from this site; preload the two the first screen needs
      { rel: "preload", href: dmSans, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: montserrat, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: siteCss },
    ],
  }),
  shellComponent: RootDocument,
  component: () => <Outlet />,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
        <HeadContent />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
