/// <reference types="node" />
import { cpSync, createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
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
 *
 * This plugin used to have only `configureServer`, which meant `/content/`
 * existed in `pnpm dev` and nowhere else. A production build shipped a bundle
 * that fetches `/content/<study>/<course>.json` into a 404 — an app that looks
 * like it loaded and then shows an empty sea. Nobody had noticed because
 * nobody had deployed it yet, and every test runs against the dev server.
 *
 * So `writeBundle` copies the tree into `dist/content/` as well. One directory,
 * two ways of reaching it, and the second one is the one customers use.
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
    writeBundle(options) {
      const outDir = options.dir ?? resolve(import.meta.dirname, "dist");
      if (!existsSync(contentDir)) {
        // Failing loudly here rather than shipping an empty sea: a build with
        // no content is not a smaller build, it is a broken one.
        throw new Error(
          "apps/online/content is missing — run `pnpm content` before building, " +
            "or the deployed app will load and show no courses at all.",
        );
      }
      cpSync(contentDir, resolve(outDir, "content"), { recursive: true, dereference: true });
    },
  };
}

export default defineConfig({
  /*
    A separate optimizer cache when the e2e suite is the one running Vite.

    Vite pre-bundles dependencies into `cacheDir` and hands the browser hashed
    URLs for them. Two Vite instances in one app directory share that
    directory, so starting the suite re-optimises, rewrites the hashes, and a
    `pnpm start` server that has been up all along keeps serving the old ones —
    the campus answers 504 Outdated Optimize Dep and paints a white page.
    Measured the hard way: the delivery shell went blank in the middle of a
    session because the tests had been run beside it.
  */
  ...(process.env.UNIVERSITY_E2E === "1"
    ? { cacheDir: resolve(import.meta.dirname, "node_modules/.vite-e2e") }
    : {}),
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
