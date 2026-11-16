/// <reference types="vite/client" />
import type { ReactNode } from "react";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import siteCss from "~/styles/site.css?url";

const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cline x1='32' y1='14' x2='32' y2='6' stroke='%232b2d31' stroke-width='3'/%3E%3Ccircle cx='32' cy='6' r='5' fill='%231d97dc'/%3E%3Crect x='8' y='14' width='48' height='44' rx='17' fill='%23ffffff' stroke='%23d8e0e9' stroke-width='2'/%3E%3Crect x='14' y='22' width='36' height='26' rx='11' fill='%23081a2b'/%3E%3Crect x='22' y='28' width='5' height='9' rx='2' fill='%23e3f7ff'/%3E%3Crect x='37' y='28' width='5' height='9' rx='2' fill='%23e3f7ff'/%3E%3C/svg%3E";

/* Pick the theme before the page paints: saved choice, else the device setting. */
const THEME = `(function(){var t=null;try{t=localStorage.getItem("nm-theme")}catch(e){}if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Ninth Mind · AI-Powered Business Transformation & Training" },
      { name: "description", content: "Ninth Mind helps organisations become AI-first: advice, building and integration, training, governance and research. Nairobi, Kenya." },
      { name: "theme-color", content: "#0a6fb8" },
    ],
    links: [
      { rel: "icon", href: ICON },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Montserrat:wght@500;600;700&display=swap" },
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
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
