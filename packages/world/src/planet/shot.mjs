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
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const SHOTS = process.env.PLANET_SHOT_DIR
  ? join(ROOT, process.env.PLANET_SHOT_DIR)
  : join(ROOT, "SHOTS");
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

async function sceneEvidence(page) {
  return page.evaluate(() => {
    const state = globalThis.three;
    const renderer = state?.gl;
    const canvas = renderer?.domElement;
    const projection = globalThis.__planetProjection?.() ?? null;
    const sceneRender = globalThis.__lastStageSceneRender ?? null;
    const selectedId = document.querySelector("[data-planet-page]")?.getAttribute("data-selected");
    const focusObject = selectedId
      ? state?.scene?.getObjectByName(`planet-study-focus-${selectedId}`)
      : null;
    if (!renderer || !canvas) return { projection, renderer: null, sceneRender, readPixels: [] };

    const context = renderer.getContext();
    const points = [
      [0.2, 0.2],
      [0.5, 0.2],
      [0.8, 0.2],
      [0.2, 0.5],
      [0.5, 0.5],
      [0.8, 0.5],
      [0.2, 0.8],
      [0.5, 0.8],
      [0.8, 0.8],
    ];
    const readPixels = points.map(([x, y]) => {
      const pixel = new Uint8Array(4);
      context.readPixels(
        Math.max(0, Math.min(canvas.width - 1, Math.floor(canvas.width * x))),
        Math.max(0, Math.min(canvas.height - 1, Math.floor(canvas.height * (1 - y)))),
        1,
        1,
        context.RGBA,
        context.UNSIGNED_BYTE,
        pixel,
      );
      return { x, y, rgba: [...pixel], nonBlack: pixel[0] + pixel[1] + pixel[2] > 12 };
    });
    return {
      projection,
      sceneRender,
      focusObject: focusObject
        ? {
            visible: focusObject.visible,
            position: [focusObject.position.x, focusObject.position.y, focusObject.position.z],
            renderOrder: focusObject.renderOrder,
          }
        : null,
      renderer: {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      },
      camera: {
        fov: state.camera?.fov ?? null,
        position: state.camera
          ? [state.camera.position.x, state.camera.position.y, state.camera.position.z]
          : null,
      },
      readPixels,
    };
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clickStudyWithRealPointer(page, studyId) {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Planet canvas has no bounding box");
  const center = await page.evaluate((targetStudyId) => {
    const state = globalThis.three;
    const projection = globalThis.__planetProjection?.();
    const cluster = projection?.clusters?.find((item) => item.studyId === targetStudyId);
    const reference = state?.scene?.getObjectByName("planet-study-focus-turing-pact");
    if (!state || !cluster || !reference)
      throw new Error(`Cannot project ${targetStudyId} cluster`);
    const point = reference.position.clone().set(cluster.centerX, 0.56, cluster.centerZ);
    point.project(state.camera);
    const rect = state.gl.domElement.getBoundingClientRect();
    return {
      x: rect.left + (point.x + 1) * rect.width * 0.5,
      y: rect.top + (1 - point.y) * rect.height * 0.5,
    };
  }, studyId);
  const offsets = [];
  for (let y = -120; y <= 120; y += 12) {
    for (let x = -120; x <= 120; x += 12) offsets.push({ x, y });
  }
  offsets.sort((left, right) => left.x ** 2 + left.y ** 2 - (right.x ** 2 + right.y ** 2));
  for (const offset of offsets) {
    const x = Math.max(box.x + 2, Math.min(box.x + box.width - 2, center.x + offset.x));
    const y = Math.max(box.y + 2, Math.min(box.y + box.height - 2, center.y + offset.y));
    await page.mouse.click(x, y);
    await wait(12);
    if ((await page.locator("[data-planet-page]").getAttribute("data-selected")) === studyId) {
      return { x: Math.round(x), y: Math.round(y) };
    }
  }
  throw new Error(`Real pointer scan did not select ${studyId}`);
}

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
    const desktopEvidence = await sceneEvidence(page);

    const log = [];
    // Fixed viewport, real canvas coordinates: this deliberately exercises the
    // 3D beacon hit target rather than a DOM list button or element.click().
    const pointer = await clickStudyWithRealPointer(page, "buzz");
    const afterBeacon = await page.locator("[data-planet-page]").getAttribute("data-selected");
    log.push(
      `real pointer on Buzz course island at canvas (${pointer.x},${pointer.y}) → selected=${afterBeacon}`,
    );

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
    await wait(700);
    await page.screenshot({
      path: shotPath("desktop-selected-buzz-1440x810.png"),
      fullPage: false,
    });
    const desktopBuzzEvidence = await sceneEvidence(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PREVIEW, { waitUntil: "networkidle" });
    await page.locator("[data-planet-page]").waitFor();
    await page.locator("canvas").waitFor();
    await wait(1200);
    await page.screenshot({ path: shotPath("mobile-390x844.png"), fullPage: false });
    const mobileEvidence = await sceneEvidence(page);

    await writeFile(
      shotPath("evidence.json"),
      `${JSON.stringify(
        {
          tag: SHOT_TAG,
          viewport: {
            desktop: { width: 1440, height: 810 },
            mobile: { width: 390, height: 844 },
          },
          desktop: desktopEvidence,
          desktopSelectedBuzz: desktopBuzzEvidence,
          mobile: mobileEvidence,
          interactions: log,
        },
        null,
        2,
      )}\n`,
    );

    if (process.env.PLANET_KEEP_SERVER) {
      await new Promise((resolve) => process.once("SIGINT", resolve));
    }

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
