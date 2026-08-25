/**
 * Playwright shots of PlanetPage. Uses system Chrome and a real pointer.
 * `element.click()` is banned here for the same reason it is banned in e2e:
 * it skips hit-testing and would bless a canvas that looks clickable.
 *
 * Vite and the React plugin live on the university shell. This file reaches
 * them by resolved path rather than adding a second copy of either to
 * `packages/world` — the preview is evidence, not a product dependency.
 */
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const SHOTS = join(ROOT, "SHOTS");
const PREVIEW = "http://127.0.0.1:9994/preview.html";
const SHOT_TAG = process.env.PLANET_SHOT_TAG?.trim() || "latest";

const requireFromUniversity = createRequire(join(ROOT, "apps/university/package.json"));

async function loadFromUniversity(specifier) {
  const resolved = requireFromUniversity.resolve(specifier);
  return import(pathToFileURL(resolved).href);
}

function shotPath(name) {
  return join(SHOTS, `planet-${SHOT_TAG}-${name}`);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const [{ createServer }, reactMod] = await Promise.all([
    loadFromUniversity("vite"),
    loadFromUniversity("@vitejs/plugin-react"),
  ]);
  const react = reactMod.default ?? reactMod;
  const server = await createServer({
    configFile: false,
    root: HERE,
    plugins: [react()],
    server: { host: "127.0.0.1", port: 9994, strictPort: true },
    resolve: {
      dedupe: ["react", "react-dom", "three", "@react-three/fiber"],
    },
  });
  await server.listen();

  try {
    await mkdir(SHOTS, { recursive: true });
    const browser = await chromium.launch({ channel: "chrome" });
    const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
    const warnings = [];
    page.on("console", (message) => {
      if (message.type() === "warning" || message.type() === "error") {
        warnings.push(`${message.type()}: ${message.text()}`);
      }
    });
    await page.goto(PREVIEW, { waitUntil: "networkidle" });
    await page.locator("[data-planet-page]").waitFor();
    await page.locator("canvas").waitFor();
    await wait(1200);
    await page.screenshot({ path: shotPath("desktop-1440x810.png"), fullPage: false });

    const log = [];
    // Fixed viewport, real canvas coordinates: this deliberately exercises the
    // 3D beacon hit target rather than a DOM list button or element.click().
    await page.mouse.click(775, 390);
    const afterBeacon = await page.locator("[data-planet-page]").getAttribute("data-selected");
    log.push(`real pointer on Buzz beacon at canvas (775,390) → selected=${afterBeacon}`);

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const afterTab = await page.evaluate(() => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement)) return "none";
      return `${el.tagName}:${el.getAttribute("data-study-id") ?? el.getAttribute("aria-label") ?? el.textContent?.trim()}`;
    });
    log.push(`Tab → ${afterTab}`);

    const buzz = page.locator('[data-study-id="buzz"]');
    await buzz.focus();
    await buzz.press("Enter");
    const selected = await page.locator("[data-planet-page]").getAttribute("data-selected");
    log.push(`Enter on Buzz → selected=${selected}`);

    await page.keyboard.press("Escape");
    const closed = await page.locator("[data-planet-closed]").count();
    log.push(`Escape → closed=${closed > 0}`);

    await page.goto(PREVIEW, { waitUntil: "networkidle" });
    await page.locator("[data-planet-page]").waitFor();
    await page.locator("canvas").waitFor();
    await wait(800);
    await buzz.click();
    const afterClick = await page.locator("[data-planet-page]").getAttribute("data-selected");
    log.push(`locator.click Buzz → selected=${afterClick}`);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PREVIEW, { waitUntil: "networkidle" });
    await page.locator("[data-planet-page]").waitFor();
    await page.locator("canvas").waitFor();
    await wait(1200);
    await page.screenshot({ path: shotPath("mobile-390x844.png"), fullPage: false });

    await browser.close();
    console.log(log.join("\n"));
    if (warnings.length > 0) console.log(`console warnings/errors:\n${warnings.join("\n")}`);
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
