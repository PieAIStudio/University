import { test, expect, type Page } from "@playwright/test";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";
import { writeFile } from "node:fs/promises";
const ids = [
  "rock-large",
  "rock-small",
  "fir",
  "broadleaf",
  "stall",
  "cart",
  "lantern",
  "fountain",
  "doorway",
  "roof",
];
const methods = ["original", "sculpted", "bevel", "crafted"];
const inspect = (page: Page) =>
  page
    .getByTestId("finish-viewport")
    .locator("canvas")
    .evaluate((n) => (n as any).__propFinish());
async function open(page: Page, origin = ONLINE_ORIGIN, lang = "zh-CN") {
  await page.goto(`${origin}/play-lab/prop-finish?method=original&lang=${lang}`);
  await expect(page.getByTestId("prop-finish")).toHaveAttribute("data-ready", "true");
}

async function settledGallery(page: Page) {
  await expect(page.locator(".prop-finish__gallery-label")).toHaveCount(10);
  await page.waitForFunction(() => {
    const board = document.querySelector('[data-testid="finish-viewport"]')!;
    const state = (window as any).three.get();
    return Math.abs(state.size.height - board.clientHeight) < 1;
  });
  const labels = await page.locator(".prop-finish__gallery-label").evaluateAll((nodes) =>
    nodes.map((node) => ({
      width: node.clientWidth,
      height: node.clientHeight,
      overflow: node.scrollWidth - node.clientWidth,
    })),
  );
  for (const label of labels) {
    expect(label.width).toBeGreaterThanOrEqual(80);
    expect(label.height).toBeLessThanOrEqual(40);
    expect(label.overflow).toBeLessThanOrEqual(1);
  }
  // ResizeObserver delivery and the completed Stage draw are separate events.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  // Names fitting does not prove the models fit: the real tree crowns used to
  // touch/cross the top edge. Measure rendered vertices, not only DOM labels.
  const silhouettes = await page.evaluate(() => {
    const state = (window as any).three.get();
    state.scene.updateMatrixWorld(true);
    const result: { name: string; minX: number; maxX: number; minY: number; maxY: number }[] = [];
    state.scene.traverse((group: any) => {
      if (!group.name.startsWith("display-")) return;
      const bound = {
        name: group.name,
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
      };
      const point = state.camera.position.clone();
      group.traverse((mesh: any) => {
        if (!mesh.isMesh || !mesh.visible) return;
        const vertices = mesh.geometry.getAttribute("position");
        for (let i = 0; i < vertices.count; i++) {
          point
            .fromBufferAttribute(vertices, i)
            .applyMatrix4(mesh.matrixWorld)
            .project(state.camera);
          bound.minX = Math.min(bound.minX, point.x);
          bound.maxX = Math.max(bound.maxX, point.x);
          bound.minY = Math.min(bound.minY, point.y);
          bound.maxY = Math.max(bound.maxY, point.y);
        }
      });
      result.push(bound);
    });
    return result;
  });
  expect(silhouettes).toHaveLength(10);
  for (const bound of silhouettes) {
    expect(bound.minX, bound.name).toBeGreaterThan(-0.99);
    expect(bound.maxX, bound.name).toBeLessThan(0.99);
    expect(bound.minY, bound.name).toBeGreaterThan(-0.99);
    expect(bound.maxY, bound.name).toBeLessThan(0.99);
  }
}

test("prop finish: ten real objects, four treatments, same source identity and live paired rendering", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  const baseline = await inspect(page);
  expect(baseline.loaded).toBe(10);
  expect(baseline.ready).toBe(true);
  const board = page.getByTestId("finish-viewport");
  for (const id of ids) {
    await page.getByTestId(`finish-object-${id}`).click();
    for (const method of methods) {
      await page.getByTestId(`finish-${method}`).click();
      await board.scrollIntoViewIfNeeded();
      await expect.poll(async () => (await inspect(page)).finish).toBe(method);
      await board.screenshot({ path: info.outputPath(`${id}-${method}.png`) });
    }
  }
  const after = await inspect(page);
  expect(after.scene).toBe(baseline.scene);
  expect(after.objects.map((o: any) => o.original)).toEqual(
    baseline.objects.map((o: any) => o.original),
  );
  for (const obj of after.objects) {
    expect(obj.variants.sculpted.triangles).toBe(obj.variants.original.triangles);
    expect(obj.variants.crafted.triangles).toBe(obj.variants.original.triangles);
    expect(obj.variants.bevel.triangles).toBeGreaterThan(obj.variants.original.triangles);
  }
  await page.getByTestId("finish-object-rock-small").click();
  await page.getByTestId("finish-crafted").click();
  await page.locator(".prop-finish__technical summary").click();
  await page.getByTestId("finish-grade").uncheck();
  await board.screenshot({ path: info.outputPath("crafted-no-grade.png") });
  await page.getByTestId("finish-diagnostic").check();
  await board.screenshot({ path: info.outputPath("geometric-masks.png") });
  await page.getByTestId("finish-diagnostic").uncheck();
  await page.getByTestId("finish-grade").check();
  await page.getByTestId("finish-gallery").click();
  await settledGallery(page);
  await board.screenshot({ path: info.outputPath("ten-objects.png") });
  await writeFile(
    info.outputPath("comparison-receipt.json"),
    JSON.stringify({ baseline, after, errors }, null, 2),
  );
  expect(errors).toEqual([]);
});

test("prop finish: actual synchronized drag, keyboard, reset, toggles and stable warmed resources", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  const board = page.getByTestId("finish-viewport");
  await board.scrollIntoViewIfNeeded();
  const before = await inspect(page),
    box = (await board.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.66, box.y + box.height * 0.64, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await inspect(page)).rotation).not.toBe(before.rotation);
  await board.focus();
  const beforeKey = await inspect(page);
  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(async () => (await inspect(page)).rotation)
    .toBeCloseTo(beforeKey.rotation - 0.15, 9);
  const moved = await inspect(page);
  await page.getByTestId("finish-crafted").click();
  const switched = await inspect(page);
  expect(switched.rotation).toBe(moved.rotation);
  expect(switched.tilt).toBe(moved.tilt);
  for (const method of methods) {
    await page.getByTestId(`finish-${method}`).click();
    await board.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
  }
  const warmed = await inspect(page);
  for (let n = 0; n < 8; n++)
    for (const method of methods) {
      await page.getByTestId(`finish-${method}`).click();
      await board.scrollIntoViewIfNeeded();
    }
  const repeated = await inspect(page);
  expect(repeated.memory).toEqual(warmed.memory);
  await page.getByTestId("finish-reset").click();
  await expect.poll(async () => (await inspect(page)).rotation).toBe(before.rotation);
  const reset = await inspect(page);
  expect(reset.rotation).toBe(before.rotation);
  expect(reset.tilt).toBe(before.tilt);
  await board.screenshot({ path: info.outputPath("reset-pair.png") });
});

for (const sample of [
  { width: 320, locale: "zh-CN", origin: ONLINE_ORIGIN },
  { width: 390, locale: "en", origin: LOCAL_ORIGIN },
])
  test(`prop finish: ${sample.width}px ${sample.locale} touch and all controls are readable`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: sample.width, height: 900 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
      colorScheme: "dark",
    });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await open(page, sample.origin, sample.locale);
      const board = page.getByTestId("finish-viewport");
      await page.getByTestId("finish-object-rock-small").tap();
      await page.getByTestId("finish-bevel").tap();
      await board.screenshot({ path: info.outputPath("phone-pair.png") });
      await page.getByTestId("finish-crafted").tap();
      await page.getByTestId("finish-object-cart").tap();
      await board.screenshot({ path: info.outputPath("phone-material.png") });
      await page.getByTestId("finish-gallery").tap();
      await settledGallery(page);
      await board.screenshot({ path: info.outputPath("phone-ten-objects.png") });
      await page.screenshot({ path: info.outputPath("phone-page.png"), fullPage: true });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1);
      const controls = await page.locator(".prop-finish button").evaluateAll((ns) =>
        ns.map((n) => ({
          w: n.getBoundingClientRect().width,
          h: n.getBoundingClientRect().height,
          overflow: n.scrollWidth - n.clientWidth,
        })),
      );
      for (const c of controls) {
        expect(c.w).toBeGreaterThanOrEqual(44);
        expect(c.h).toBeGreaterThanOrEqual(44);
        expect(c.overflow).toBeLessThanOrEqual(1);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("prop finish: retired wax URL has no old canvas and links to useful methods", async ({
  page,
}) => {
  await page.goto(`${ONLINE_ORIGIN}/play-lab/wax-island?lang=en`);
  await expect(page.getByTestId("appearance-retired")).toBeVisible();
  await expect(page.locator(".wax-island")).toHaveCount(0);
  await page.getByRole("link", { name: "Open the ten-object comparison", exact: true }).click();
  await expect(page.getByTestId("prop-finish")).toHaveAttribute("data-ready", "true");
  await page.goto(`${ONLINE_ORIGIN}/play-lab/catalog?group=three&lang=en`);
  await expect(page.getByTestId("prop-finish-link")).toBeVisible();
});

test("prop finish: a missing derivative fails visibly and retry restores the comparison", async ({
  page,
}) => {
  await page.route("**/art/prop-finish/cart.bin", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.goto(`${ONLINE_ORIGIN}/play-lab/prop-finish?lang=en`);
  await expect(page.getByRole("button", { name: "Reopen 3D", exact: true })).toBeVisible();
  await expect(page.getByTestId("prop-finish")).toHaveAttribute("data-ready", "false");
  await page.unroute("**/art/prop-finish/cart.bin");
  await page.getByRole("button", { name: "Reopen 3D", exact: true }).click();
  await expect(page.getByTestId("prop-finish")).toHaveAttribute("data-ready", "true");
});
