// Rebuilds ../liquid-theme.js, ../lian-lab.js (+ ../uikit.css): the 彩色液体 column of
// ui-compare.html and the 涟 experiment, drawn with the real SwimmerUIKit liquid components, as one
// classic script so the page still opens by double-click, offline.
// Run from anywhere: node docs/reference/interaction-components/lab/src/build-liquid.mjs
import { copyFileSync, readdirSync, realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../../../..");
const pnpm = join(root, "node_modules/.pnpm");
const rolldownDir = readdirSync(pnpm).find((n) => n.startsWith("rolldown@"));
const { build } = await import(
  pathToFileURL(join(pnpm, rolldownDir, "node_modules/rolldown/dist/index.mjs")).href
);
// The same versions the product uses, resolved through the app.
const app = join(root, "apps/university/node_modules");
const kit = realpathSync(join(app, "@pieai/swimmer-ui-kit"));
const react = realpathSync(join(app, "react"));
const reactDom = realpathSync(join(app, "react-dom"));
// Two pages share the kit: ui-compare.html and the 涟 experiment, lian-lab.html.
const targets = [
  ["liquid-entry.jsx", "../liquid-theme.js"],
  ["lian-lab-entry.jsx", "../lian-lab.js"],
];
for (const [entry, file] of targets) {
  const out = join(here, file);
  await build({
    input: join(here, entry),
    resolve: {
      alias: {
        "@pieai/swimmer-ui-kit": join(kit, "dist/index.js"),
        "react-dom/client": join(reactDom, "client.js"),
        "react-dom": reactDom,
        "react/jsx-runtime": join(react, "jsx-runtime.js"),
        react: react,
      },
    },
    transform: { define: { "process.env.NODE_ENV": '"production"' } },
    output: { file: out, format: "iife", minify: true },
    logLevel: "warn",
  });
  console.log("built", out);
}
copyFileSync(join(kit, "dist/styles.css"), join(here, "../uikit.css"));
