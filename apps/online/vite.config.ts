/// <reference types="node" />
import { createReadStream, existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * `pnpm content` writes gitignored packages into `content/`. Vite only serves
 * `public/` as static files, so without this the reader fetches HTML for every
 * course JSON and every baked snippet.
 */
function serveImportedContent(): Plugin {
  const contentDir = resolve(import.meta.dirname, "content");
  function mimeFor(file: string): string {
    if (file.endsWith(".json")) return "application/json; charset=utf-8";
    if (file.endsWith(".png")) return "image/png";
    if (file.endsWith(".svg")) return "image/svg+xml";
    if (file.endsWith(".jpg") || file.endsWith(".jpeg")) return "image/jpeg";
    if (file.endsWith(".webp")) return "image/webp";
    return "application/octet-stream";
  }
  return {
    name: "university-imported-content",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith("/content/")) {
          next();
          return;
        }
        let decoded: string;
        try {
          decoded = decodeURIComponent(url.slice("/content/".length));
        } catch {
          res.statusCode = 400;
          res.end();
          return;
        }
        const target = resolve(contentDir, decoded);
        const rel = relative(contentDir, target);
        if (
          rel === "" ||
          rel.startsWith("..") ||
          isAbsolute(rel) ||
          !existsSync(target) ||
          !statSync(target).isFile()
        ) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader("Content-Type", mimeFor(target));
        createReadStream(target).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveImportedContent()],
  server: {
    host: "127.0.0.1",
    // UniversityLocal owns 9999. A different fixed port keeps both campuses
    // open at once, and strictPort makes a collision fail loudly instead of
    // silently moving the product to an address nobody bookmarked.
    port: 9998,
    strictPort: true,
  },
});
