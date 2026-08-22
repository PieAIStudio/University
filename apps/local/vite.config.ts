/// <reference types="node" />
import { createReadStream, cpSync, existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * The world kit lives in the delivery shell's public dir until it moves into
 * `packages/world`. This serves `/kit/` and `/basis/` from there so the
 * authoring shell renders the same GLBs without copying the archipelago.
 */
function serveWorldKit(): Plugin {
  const kitRoot = resolve(import.meta.dirname, "../online/public");
  function mimeFor(file: string): string {
    if (file.endsWith(".js")) return "text/javascript";
    if (file.endsWith(".wasm")) return "application/wasm";
    if (file.endsWith(".glb")) return "model/gltf-binary";
    return "application/octet-stream";
  }
  return {
    name: "university-local-world-kit",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith("/kit/") && !url.startsWith("/basis/")) {
          next();
          return;
        }
        let decoded: string;
        try {
          decoded = decodeURIComponent(url.slice(1));
        } catch {
          res.statusCode = 400;
          res.end();
          return;
        }
        const target = resolve(kitRoot, decoded);
        const rel = relative(kitRoot, target);
        if (
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
    closeBundle() {
      const out = resolve(import.meta.dirname, "dist");
      cpSync(resolve(kitRoot, "kit"), resolve(out, "kit"), { recursive: true });
      cpSync(resolve(kitRoot, "basis"), resolve(out, "basis"), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveWorldKit()],
  server: {
    host: "127.0.0.1",
    port: 9999,
    // Silently moving to 5174 would leave the campus at an address the user did
    // not bookmark, so a taken port fails loudly instead. `scripts/dev.mjs`
    // checks both ports up front and explains what to do.
    strictPort: true,
    /*
      `studies/` is learner data, not source, and nothing in it is imported by
      the app — the server reads it and serves JSON. Watching it was harmless
      until `snapshot open` began materialising a whole checkout of the studied
      project in there: thousands of files appearing at once made Vite full-
      reload the page, which threw away the state of the very click that had
      asked for the checkout, so the button appeared to do nothing while
      quietly succeeding every time.
    */
    watch: { ignored: ["**/studies/**"] },
    proxy: {
      "/api": `http://127.0.0.1:${process.env["UNIVERSITY_LOCAL_PORT"] ?? "4317"}`,
    },
  },
});
