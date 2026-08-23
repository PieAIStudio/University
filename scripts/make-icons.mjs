/**
 * The two shells' icons, from one mark.
 *
 * Both shells had no icon at all: `/favicon.ico` 404'd, there was no manifest,
 * no `theme-color`, no apple-touch-icon. Saved to a phone's home screen this
 * gives a blank box, and the browser's own chrome stays light above a very
 * dark app. The catalogue in this very product carries entries for 「网站图标」
 * and 「Web 应用清单」; not having either was hard to defend.
 *
 * The mark is not new. `IslandIcon` in `packages/ui/src/shell/icons.tsx` is
 * already what this product draws when it means "an island / a project", and
 * the whole map is an archipelago. Inventing a second island here would be the
 * same mistake as a second stylesheet.
 *
 * The two shells differ only in the mark's colour, and that difference is the
 * point: `pnpm start` opens both at once, and two tabs wearing an identical
 * favicon cannot be told apart in a tab strip — which is exactly the moment
 * the icon is supposed to be doing its job.
 *
 *   node scripts/make-icons.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Copied from `IslandIcon` — a floating plate with two water lines under it. */
const ISLAND_PATH =
  "M12 4.2 15.6 11h4.6L17 17.2H7L3.8 11h4.6L12 4.2Zm-8.4 14c2.1 1.2 4.6 1.3 8.4.1 3.8 1.2 6.3 1.1 8.4-.1v1.7c-2.2 1.3-5 1.5-8.4.2-3.4 1.3-6.2 1.1-8.4-.2V18.2Z";

/** The night theme's ground, read from the running app rather than guessed. */
const GROUND = "#221812";

const SHELLS = [
  {
    dir: "apps/online/public",
    name: "University",
    shortName: "University",
    description: "在群岛上把一件事学到会。",
    mark: "#ef8148", // the product's action colour
  },
  {
    dir: "apps/local/public",
    name: "UniversityLocal",
    shortName: "UniLocal",
    description: "写课、改课、自己学。",
    mark: "#63b6d6", // the sea, so the two tabs are not the same icon
  },
];

/**
 * `maskable` fills the whole square: Android crops an adaptive icon to
 * whatever shape the launcher uses, so anything inside the corner radius has
 * to survive being cut off. The plain icon keeps its rounded plate.
 */
function svg({ mark, maskable = false, rounded = true }) {
  const scale = maskable ? 0.58 : 0.72;
  const offset = (24 - 24 * scale) / 2;
  const radius = maskable ? 0 : rounded ? 96 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="${radius}" fill="${GROUND}"/>
  <g transform="translate(${(offset / 24) * 512} ${(offset / 24) * 512}) scale(${(512 / 24) * scale})">
    <path d="${ISLAND_PATH}" fill="${mark}"/>
  </g>
</svg>`;
}

async function rasterise(page, markup, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`,
  );
  return page.screenshot({ omitBackground: true });
}

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();

for (const shell of SHELLS) {
  const out = join(ROOT, shell.dir);
  mkdirSync(out, { recursive: true });

  writeFileSync(join(out, "favicon.svg"), svg({ mark: shell.mark }));

  for (const [file, size, opts] of [
    ["apple-touch-icon.png", 180, {}],
    ["icon-192.png", 192, {}],
    ["icon-512.png", 512, {}],
    ["icon-512-maskable.png", 512, { maskable: true }],
  ]) {
    writeFileSync(
      join(out, file),
      await rasterise(page, svg({ mark: shell.mark, ...opts }), size),
    );
  }

  writeFileSync(
    join(out, "manifest.webmanifest"),
    `${JSON.stringify(
      {
        name: shell.name,
        short_name: shell.shortName,
        description: shell.description,
        start_url: "/",
        display: "standalone",
        background_color: GROUND,
        theme_color: GROUND,
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  console.log(`${shell.dir}: favicon.svg, 4 png, manifest.webmanifest`);
}

await browser.close();
