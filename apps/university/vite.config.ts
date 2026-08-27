/// <reference types="node" />
import {
  cpSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { gzipSync } from "node:zlib";
import { isAbsolute, relative, resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { toPath } from "@pieai/university-core";
import { defineConfig, type Plugin } from "vite";

import { checkShelfData } from "./scripts/check-shelf.mjs";
import { buildSiteIndex } from "./scripts/site-index.mjs";

/**
 * One app, two modes.
 *
 * `--mode authoring` proxies `/api` to the loopback server that reads the disk,
 * so what was saved a second ago is on screen now. `--mode delivery` serves the
 * frozen packages under `content/` and ships as a static bundle. The mode name
 * reaches the source as `import.meta.env.MODE`, which is a literal by the time
 * Rollup runs — that is what lets `src/authoring/` be dropped from a customer's
 * build rather than merely hidden behind a runtime flag.
 *
 * The modes are not called `local` and `online`, which is what they are called
 * in Chinese and in every comment here. Vite reserves `local`: `.env.local` is
 * its always-loaded override file, and `vite build --mode local` stops with an
 * error saying so. The dev server accepts it, so the collision only shows up
 * at build time.
 */

/**
 * One-shot bundle census. `ANALYZE=1 pnpm --filter @pieai/university-app build`
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
function serveImportedContent(mode: string): Plugin {
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
      // The authoring build reads courses off the disk through 4317; it has no
      // packages to copy, and demanding some would make `--mode local` refuse
      // to build on a machine that has never run the import.
      if (mode !== "delivery") return;
      const outDir = options.dir ?? resolve(import.meta.dirname, "dist");
      if (!existsSync(contentDir)) {
        // Failing loudly here rather than shipping an empty sea: a build with
        // no content is not a smaller build, it is a broken one.
        throw new Error(
          "apps/university/content is missing — run `pnpm content` before building, " +
            "or the deployed app will load and show no courses at all.",
        );
      }
      cpSync(contentDir, resolve(outDir, "content"), { recursive: true, dereference: true });
    },
  };
}

/** Emit crawler files from the importer’s already-generated shelf. */
function emitSiteIndex(mode: string): Plugin {
  return {
    name: "university-site-index",
    generateBundle() {
      if (mode !== "delivery") return;
      const shelfPath = resolve(import.meta.dirname, "content", "shelf.json");
      const manifestPath = resolve(import.meta.dirname, "content", "manifest.json");
      if (!existsSync(shelfPath)) {
        throw new Error(
          "apps/university/content/shelf.json is missing — run `pnpm content` before building.",
        );
      }
      if (!existsSync(manifestPath)) {
        throw new Error(
          "apps/university/content/manifest.json is missing — run `pnpm content` before building.",
        );
      }
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const shelf = JSON.parse(readFileSync(shelfPath, "utf8"));
      const published = checkShelfData(manifest, shelf);
      const siteIndex = buildSiteIndex(shelf, {
        publicOrigin:
          process.env["UNIVERSITY_PUBLIC_ORIGIN"] ?? "https://university.pieaistudio.com",
        pathForLesson: ({ studyId, courseId, unitId, lessonId }) =>
          toPath({ kind: "lesson", studyId, courseId, unitId, lessonId }),
        expectedLessonCount: published.lessons,
      });
      this.emitFile({ type: "asset", fileName: "robots.txt", source: siteIndex.robots });
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: siteIndex.sitemap });
      console.log(`site-index: ${siteIndex.lessonCount} lesson URLs emitted`);
    },
  };
}

export default defineConfig(({ mode }) => ({
  /*
    A separate optimizer cache per mode, and another one for the test run.

    Vite pre-bundles dependencies into `cacheDir` and hands the browser hashed
    URLs for them. Two Vite instances in one app directory share that
    directory, so the second one re-optimises, rewrites the hashes, and the
    first keeps serving the old ones — the campus answers 504 Outdated Optimize
    Dep and paints a white page. Measured the hard way twice: once when the
    e2e suite ran beside a live campus, and once the moment both modes became
    one directory.
  */
  cacheDir: resolve(
    import.meta.dirname,
    `node_modules/.vite-${mode}${process.env.UNIVERSITY_E2E === "1" ? "-e2e" : ""}`,
  ),
  plugins: [react(), serveImportedContent(mode), emitSiteIndex(mode), analyzeChunks()],
  build: {
    outDir: `dist/${mode}`,
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    // Two fixed ports so both campuses can be open at once, and `strictPort`
    // so a collision fails loudly instead of silently moving the product to an
    // address nobody bookmarked.
    port: mode === "authoring" ? 9999 : 9998,
    strictPort: true,
    ...(mode === "authoring"
      ? {
          /*
            `studies/` is learner data, not source, and nothing in it is
            imported by the app — the server reads it and serves JSON. Watching
            it was harmless until `snapshot open` began materialising a whole
            checkout in there: thousands of files appearing at once made Vite
            full-reload the page, which threw away the state of the very click
            that had asked for the checkout.
          */
          watch: { ignored: ["**/studies/**"] },
          proxy: {
            "/api": `http://127.0.0.1:${process.env["UNIVERSITY_LOCAL_PORT"] ?? "4317"}`,
          },
        }
      : {}),
  },
}));
