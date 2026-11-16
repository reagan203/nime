import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

// Browsers from about 2020 on (Safari 14, Chrome/Edge 88, Firefox 78) get working code and styles.
const BROWSERS = ["es2020", "chrome88", "edge88", "firefox78", "safari14", "ios14"];

export default defineConfig({
  server: { port: 3000 },
  resolve: { tsconfigPaths: true },
  build: { target: BROWSERS, cssTarget: BROWSERS, assetsInlineLimit: 2048 },
  plugins: [tanstackStart(), viteReact()],
});
