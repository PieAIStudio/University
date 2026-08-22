/// <reference types="node" />
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { isAbsolute, relative, resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * One-shot bundle census. `ANALYZE=1 pnpm --filter @pieai/university-online build`
 * writes `SCRATCH/chunk-modules.json` so we can see what sits in the first
 * chunk before splitting anything. Off unless asked — it does not change the
 * emitted JS.
 */
function analyzeChunks(): Plugin {
  return {
    name: "university-analyze-chunks",
    generateBundle(_opts, bundle) {
      if (process.env.ANALYZE !== "1") return;
      const report: {
        fileName: string;
        type: string;
        isEntry?: boolean;
        isDynamicEntry?: boolean;
        bytes: number;
        gzip: number;
        imports: string[];
        dynamicImports: string[];
        topModules: { id: string; rendered: number }[];
      }[] = [];
      for (const output of Object.values(bundle)) {
        if (output.type === "asset") {
          const source =
            typeof output.source === "string" ? output.source : Buffer.from(output.source);
          const bytes = Buffer.byteLength(source);
          report.push({
            fileName: output.fileName,
            type: "asset",
            bytes,
            gzip: gzipSync(source).length,
            imports: [],
            dynamicImports: [],
            topModules: [],
          });
          continue;
        }
        const modules = Object.entries(output.modules).map(([id, info]) => ({
          id,
          rendered: info.renderedLength,
        }));
        modules.sort((a, b) => b.rendered - a.rendered);
        const bytes = Buffer.byteLength(output.code);
        report.push({
          fileName: output.fileName,
          type: "chunk",
          isEntry: output.isEntry,
          isDynamicEntry: output.isDynamicEntry,
          bytes,
          gzip: gzipSync(output.code).length,
          imports: [...output.imports],
          dynamicImports: [...output.dynamicImports],
          topModules: modules.slice(0, 40),
        });
      }
      report.sort((a, b) => b.bytes - a.bytes);
      const scratch = resolve(import.meta.dirname, "../../SCRATCH");
      mkdirSync(scratch, { recursive: true });
      writeFileSync(resolve(scratch, "chunk-modules.json"), `${JSON.stringify(report, null, 2)}\n`);
    },
  };
}

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
  plugins: [react(), serveImportedContent(), analyzeChunks()],
  server: {
    host: "127.0.0.1",
    // UniversityLocal owns 9999. A different fixed port keeps both campuses
    // open at once, and strictPort makes a collision fail loudly instead of
    // silently moving the product to an address nobody bookmarked.
    port: 9998,
    strictPort: true,
  },
});
