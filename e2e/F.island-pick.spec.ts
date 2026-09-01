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
  // The visible-label list is allowed to reflow when the entry hint retires
  // after a pick. Resolve the chosen course by its accessible name before the
  // click, and retain the pre-click box: it is the screen point the pointer
  // actually aimed at, not a different nth label after the list reflowed.
  const name = (await label.innerText()).trim();
  const target = page.getByRole("button", { name, exact: true });
  await waitForStableBox(target);
  const box = await target.boundingBox();
  if (!box) throw new Error("课名标签没有屏幕矩形");
  await humanClick(page, target, "课名");
  return box;
}

async function clickEmptySky(page: Page): Promise<void> {
  const canvas = page.locator(".stagewrap canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("画布没有屏幕矩形");
  // Sky and island are the same <canvas> node, so `elementsFromPoint` can
  // rule out DOM overlays but can never tell the two apart — the ray did
  // that, not the DOM. Ask the product instead: the hint reads
  // the control hint while nothing is hovered, and swaps to a course title
  // the moment the ray hits an island. A point that leaves the hover hint
  // absent is a point the raycaster missed.
  //
  // The four fixed guesses this replaces were written when the map held a
  // handful of islands. Fifty-three of them leave almost no sky at a fixed
  // coordinate, so scan instead of guess.
  const columns = [0.5, 0.42, 0.58, 0.34, 0.66, 0.28, 0.72];
  const rows = [18, 34, 52, 74, box.height - 24, box.height - 44];
  const candidates: { x: number; y: number }[] = [];
  for (const row of rows) {
    for (const column of columns) {
      candidates.push({ x: box.x + box.width * column, y: box.y + row });
    }
  }

  for (const point of candidates) {
    const domClear = await page.evaluate(({ x, y }) => {
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
    if (!domClear) continue;

    await page.mouse.move(point.x, point.y);
    // One frame for the raycast, one for React to render the swapped hint.
    await page.waitForTimeout(120);
    const rayHitIsland = await page.locator(".hint--hover").count();
    if (rayHitIsland > 0) continue;

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

  await namedStep(page, "卡片自带关闭按钮，够手指点，点了就走", async () => {
    // The sky-click below is the gesture; this is the affordance. A dense
    // map can leave a learner with no sky to click and no Escape key on a
    // phone, so the way out has to be a control they can see.
    const close = page.locator(".picked--follow.is-visible .picked__close");
    await expect(close).toBeVisible();
    const closeBox = await close.boundingBox();
    if (!closeBox) throw new Error("关闭按钮没有屏幕矩形");
    expect(closeBox.width, "关闭按钮宽度够不上手指").toBeGreaterThanOrEqual(44);
    expect(closeBox.height, "关闭按钮高度够不上手指").toBeGreaterThanOrEqual(44);
    await humanClick(page, close, "关闭课程卡");
    await expect(page.locator(".picked--follow.is-visible")).toHaveCount(0);
  });

  await namedStep(page, "再点回那座岛，好接着验海面", async () => {
    const island = await pickLeftishIsland(page);
    await assertCardFollowsIsland(page, island);
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
