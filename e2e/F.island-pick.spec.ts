import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { humanClick, waitForStableBox } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { LOCAL_ORIGIN } from "./ports.js";
import { openOnline, waitForMapReady } from "./harness/online-learner.js";
import { namedStep } from "./harness/step.js";

/**
 * The 「进入这门课」 card must follow the island, not pin to a screen corner.
 *
 * A CSS `right:` on `.picked` is why collapsing the context rail stacked the
 * card on the collapse capsule. The test clicks with a real mouse —
 * `element.click()` never hit-tests, and that is how "looks clickable,
 * isn't" shipped twice in this repo.
 */

const SHOTS = fileURLToPath(new URL("../SHOTS", import.meta.url));

type Box = { x: number; y: number; width: number; height: number };

function center(box: Box): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function overlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function enterCard(page: Page): Locator {
  return page.locator(".picked.picked--follow.is-visible", {
    has: page.getByRole("button", { name: /进入这门课/ }),
  });
}

async function visibleCourseLabels(page: Page): Promise<Locator> {
  const labels = page.locator("button.label.label--course.is-visible");
  await expect(labels.first()).toBeVisible({ timeout: 30_000 });
  return labels;
}

/**
 * Real pointer on the course-name button that sits on the island.
 *
 * The name is a DOM button whose `activate` is the same as the mesh
 * `onClick`. `humanClick` hit-tests first. Clicking 18px below the name
 * (the mesh) misses on the local shell, where islands are smaller; the
 * name is the target a person actually aims at.
 */
async function clickCourseLabel(page: Page, label: Locator): Promise<Box> {
  await humanClick(page, label, "课名");
  const box = await label.boundingBox();
  if (!box) throw new Error("课名标签没有屏幕矩形");
  return box;
}

async function clickEmptySky(page: Page): Promise<void> {
  const canvas = page.locator(".stagewrap canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("画布没有屏幕矩形");
  // Collapse capsules sit on the left and right edges; islands sit lower.
  // A document click listener is forbidden here — this is a pointer on
  // the canvas, which is the 3D miss the product has to see. Probe a few
  // sky candidates: a study name can sit near the top-centre.
  const candidates = [
    { x: box.x + box.width * 0.5, y: box.y + 28 },
    { x: box.x + box.width * 0.42, y: box.y + 40 },
    { x: box.x + box.width * 0.58, y: box.y + 40 },
    { x: box.x + box.width * 0.5, y: box.y + box.height - 36 },
  ];
  for (const point of candidates) {
    const empty = await page.evaluate(({ x, y }) => {
      const stack = document.elementsFromPoint(x, y);
      const blocked = stack.some((entry) => {
        const el = entry as HTMLElement;
        return Boolean(
          el.closest(".picked--follow") ||
            el.closest("button.label") ||
            el.closest(".app-shell__collapse") ||
            el.closest(".nav-rail") ||
            el.closest(".app-shell__aside"),
        );
      });
      return stack.some((entry) => entry.tagName === "CANVAS") && !blocked;
    }, point);
    if (!empty) continue;
    await page.mouse.click(point.x, point.y);
    return;
  }
  throw new Error("找不到能点到画布的空处（海面/天空）");
}

async function pickLeftishIsland(page: Page): Promise<Box> {
  const labels = await visibleCourseLabels(page);
  const count = await labels.count();
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("没有视口");
  let best: { label: Locator; box: Box } | null = null;
  for (let i = 0; i < count; i += 1) {
    const label = labels.nth(i);
    const box = await label.boundingBox();
    if (!box || box.width < 4) continue;
    if (box.x + box.width / 2 > viewport.width * 0.55) continue;
    if (!best || box.x < best.box.x) best = { label, box };
  }
  const chosen = best ?? { label: labels.first(), box: (await labels.first().boundingBox())! };
  return clickCourseLabel(page, chosen.label);
}

async function pickRightEdgeIsland(page: Page): Promise<Box> {
  const labels = await visibleCourseLabels(page);
  const count = await labels.count();
  let rightmost: { label: Locator; box: Box } | null = null;
  for (let i = 0; i < count; i += 1) {
    const label = labels.nth(i);
    const box = await label.boundingBox();
    if (!box) continue;
    if (!rightmost || box.x + box.width > rightmost.box.x + rightmost.box.width) {
      rightmost = { label, box };
    }
  }
  if (!rightmost) throw new Error("地图上没有可见的课名");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("没有视口");
  const now = rightmost.box.x + rightmost.box.width / 2;
  const wantX = viewport.width * 0.78;
  const dx = Math.min(Math.max(wantX - now, 0), 220);
  if (dx > 40) {
    const canvas = page.locator(".stagewrap canvas").first();
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error("画布没有屏幕矩形");
    const fromX = canvasBox.x + canvasBox.width * 0.4;
    const fromY = canvasBox.y + 56;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(fromX + dx, fromY, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(500);
  }
  const labelsAfter = await visibleCourseLabels(page);
  const afterCount = await labelsAfter.count();
  let next: Locator = labelsAfter.first();
  let nextBox: Box | null = null;
  for (let i = 0; i < afterCount; i += 1) {
    const label = labelsAfter.nth(i);
    const box = await label.boundingBox();
    if (!box) continue;
    if (!nextBox || box.x > nextBox.x) {
      next = label;
      nextBox = box;
    }
  }
  return clickCourseLabel(page, next);
}

async function assertCardFollowsIsland(page: Page, island: Box): Promise<Box> {
  const card = enterCard(page);
  await expect(card).toBeVisible({ timeout: 10_000 });
  await waitForStableBox(card);
  const cardBox = await card.boundingBox();
  if (!cardBox) throw new Error("进入这门课卡片没有屏幕矩形");
  const islandAt = center(island);
  const cardAt = center(cardBox);
  const distance = Math.hypot(cardAt.x - islandAt.x, cardAt.y - islandAt.y);
  expect(
    distance,
    `卡片应跟在岛旁边（距岛心 < 420px），现在是 ${distance.toFixed(0)}px。钉在角落会远得多。`,
  ).toBeLessThan(420);
  expect(Math.abs(cardAt.x - islandAt.x), "卡片应在岛的一侧，而不是叠在岛心上").toBeGreaterThan(20);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("没有视口");
  expect(cardBox.x).toBeGreaterThanOrEqual(-1);
  expect(cardBox.y).toBeGreaterThanOrEqual(-1);
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(viewport.height + 1);
  return cardBox;
}

async function walkIslandPick(page: Page, prefix: "online" | "local"): Promise<void> {
  mkdirSync(SHOTS, { recursive: true });

  await namedStep(page, "初始没有「进入这门课」卡片", async () => {
    await expect(page.locator(".picked--follow.is-visible")).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/${prefix}-unselected.png` });
  });

  const collapse = page.locator(".app-shell__collapse--aside");
  const canCollapse = await collapse.isVisible().catch(() => false);
  if (canCollapse) {
    await namedStep(page, "先收起右栏，好验卡片不再钉在胶囊上", async () => {
      await humanClick(page, collapse, "收起上下文");
      await expect(page.locator(".app-shell")).toHaveAttribute("data-aside-collapsed", "true");
    });
  }

  await namedStep(page, "点一座偏左的岛，卡片出现在岛旁边", async () => {
    const island = await pickLeftishIsland(page);
    const cardBox = await assertCardFollowsIsland(page, island);
    expect(center(cardBox).x, "偏左的岛：卡片默认在右侧").toBeGreaterThan(center(island).x);
    await page.screenshot({ path: `${SHOTS}/${prefix}-picked-left.png` });
  });

  await namedStep(page, "点海面（天空）后卡片消失", async () => {
    await clickEmptySky(page);
    await expect(page.locator(".picked--follow.is-visible")).toHaveCount(0);
  });

  await namedStep(page, "点靠右边缘的岛，卡片翻到左边且不裁切", async () => {
    const rightIsland = await pickRightEdgeIsland(page);
    const cardBox = await assertCardFollowsIsland(page, rightIsland);
    const islandAt = center(rightIsland);
    if (islandAt.x > (page.viewportSize()?.width ?? 0) * 0.62) {
      expect(center(cardBox).x, "靠右的岛：卡片应翻到左边").toBeLessThan(islandAt.x);
    }
    await page.screenshot({ path: `${SHOTS}/${prefix}-picked-right.png` });
  });

  if (canCollapse) {
    await namedStep(page, "收起右栏时卡片不和收起胶囊重叠", async () => {
      const card = enterCard(page);
      await expect(card).toBeVisible();
      const cardBox = await card.boundingBox();
      const handleBox = await collapse.boundingBox();
      if (!cardBox || !handleBox) throw new Error("卡片或收起按钮没有矩形");
      expect(overlap(cardBox, handleBox), "收起右栏后「进入这门课」叠在胶囊上").toBe(false);
      await page.screenshot({ path: `${SHOTS}/${prefix}-aside-collapsed.png` });
    });
  }
}

test.describe("F 点岛弹出「进入这门课」· 跟岛走", () => {
  test.use({ viewport: { width: 1440, height: 810 } });

  test("在线端：未选中 → 点岛出现在旁边 → 点海面消失 → 靠右翻边", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    await openOnline(page);
    await waitForMapReady(page);
    await walkIslandPick(page, "online");
    consoleErrors.assertClean();
  });

  test("本地端：同一套卡片，跟岛走", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    await namedStep(page, "打开本地端世界地图", async () => {
      await page.goto(`${LOCAL_ORIGIN}/`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("第一项学习还没有准备好。")).toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByText(/正在打开校园档案/)).toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator(".stagewrap canvas")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
      await expect(page.locator("button.label.is-visible").first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(600);
    });
    await walkIslandPick(page, "local");
    consoleErrors.assertClean();
  });
});
