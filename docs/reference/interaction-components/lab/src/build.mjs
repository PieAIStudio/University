// Rebuilds ../toy3d.js: one classic script (window.Toy) so every page opens by double-click, offline.
// Run from anywhere: node docs/reference/interaction-components/lab/src/build.mjs
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../../../..");
const pnpm = join(root, "node_modules/.pnpm");
const rolldownDir = readdirSync(pnpm).find((n) => n.startsWith("rolldown@"));
const { build } = await import(pathToFileURL(join(pnpm, rolldownDir, "node_modules/rolldown/dist/index.mjs")).href);
const threeDir = join(root, "packages/world/node_modules/three");
const out = join(here, "../toy3d.js");
await build({
  input: join(here, "entry.js"),
  resolve: { alias: { "three/addons": threeDir + "/examples/jsm", three: threeDir + "/build/three.module.js" } },
  output: { file: out, format: "iife", minify: true },
  logLevel: "warn",
});
console.log("built", out);
