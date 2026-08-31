import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { humanClick } from "./harness/click.js";
import {
  assertVisibleAndHittableAtFivePoints,
  EXPERIENCE_ROUTES,
  EXPERIENCE_VIEWPORTS,
  LONG_LESSON_PATH,
  openExperienceRoute,
} from "./harness/experience.js";
import { waitForMapReady } from "./harness/online-learner.js";
import { ONLINE_ORIGIN } from "./ports.js";

const SHOTS = fileURLToPath(new URL("../SHOTS", import.meta.url));
mkdirSync(SHOTS, { recursive: true });

const WORLD_ROUTE = EXPERIENCE_ROUTES.find((route) => route.id === "world");
if (!WORLD_ROUTE) throw new Error("缺少世界地图体验路由");

type Point = { readonly x: number; readonly y: number };

async function clearCanvasPoint(page: Page): Promise<Point> {
  const canvas = page.locator(".stagewrap canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("地图画布没有屏幕矩形");
  const candidates = [
    [0.5, 0.76],
    [0.42, 0.68],
    [0.58, 0.68],
    [0.34, 0.56],
    [0.66, 0.56],
  ] as const;
  for (const [xRatio, yRatio] of candidates) {
    const point = { x: box.x + box.width * xRatio, y: box.y + box.height * yRatio };
    const domClear = await page.evaluate(({ x, y }) => {
      const stack = document.elementsFromPoint(x, y);
      const blocked = stack.some((entry) => {
        const element = entry as HTMLElement;
        return Boolean(
          element.closest("button.label") ||
            element.closest(".nextup") ||
            element.closest(".picked") ||
            element.closest(".nav-rail") ||
            element.closest(".app-shell__aside"),
        );
      });
      return stack.some((entry) => entry.tagName === "CANVAS") && !blocked;
    }, point);
    if (!domClear) continue;
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(120);
    if ((await page.locator(".hint--hover").count()) === 0) return point;
  }
  throw new Error("地图回归找不到没有悬停岛屿的画布点");
}

async function dragMap(page: Page): Promise<void> {
  const point = await clearCanvasPoint(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 90, point.y - 24, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(350);
  await clearCanvasPoint(page);
}

test.describe("O 导航 · 提示槽位与课程位置", () => {
  for (const viewport of EXPERIENCE_VIEWPORTS) {
    test(`O1 ${viewport.id}：拖动地图后仍看得到「点岛进入」，首次选岛后才退场`, async ({ page }) => {
      await openExperienceRoute(page, WORLD_ROUTE, viewport);
      await waitForMapReady(page);

      const entryHint = page.locator(".hint--entry");
      const controlsHint = page.locator(".hint--controls");
      await assertVisibleAndHittableAtFivePoints(
        page,
        entryHint,
        `${viewport.id} / 初始点岛进入提示`,
        { hitTest: "pass-through" },
      );
      await page.screenshot({ path: `${SHOTS}/nav-${viewport.id}-before-drag.png` });

      await dragMap(page);
      await expect(controlsHint).toHaveClass(/hint--dismissed/);
      await expect(entryHint).not.toHaveClass(/hint--dismissed/);
      await assertVisibleAndHittableAtFivePoints(
        page,
        entryHint,
        `${viewport.id} / 拖动后点岛进入提示`,
        { hitTest: "pass-through" },
      );
      await page.screenshot({ path: `${SHOTS}/nav-${viewport.id}-after-drag.png` });

      const label = page.locator("button.label.label--course.is-visible").first();
      await expect(label, `${viewport.id} 没有可选课程岛`).toBeVisible({ timeout: 30_000 });
      await humanClick(page, label, `${viewport.id} / 选择课程岛`);
      await expect(entryHint).toHaveClass(/hint--dismissed/);
    });
  }

  for (const viewport of EXPERIENCE_VIEWPORTS) {
    test(`O2 ${viewport.id}：课程面包屑四层同一行，课程层可回到课程地图`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${ONLINE_ORIGIN}${LONG_LESSON_PATH}`, { waitUntil: "domcontentloaded" });

      const breadcrumb = page.locator("nav.lesson-breadcrumb");
      await expect(breadcrumb).toBeVisible({ timeout: 30_000 });
      await expect(breadcrumb.locator("li")).toHaveCount(4);
      await expect(breadcrumb.locator("a")).toHaveCount(3);
      await expect(breadcrumb.locator("[aria-current='page']")).toHaveText(/\S/);
      await expect(breadcrumb.locator("a").nth(0)).toHaveAttribute("href", "/");
      await expect(breadcrumb.locator("a").nth(1)).toHaveAttribute(
        "href",
        "/turing-pact/foundations-terrain",
      );
      await expect(breadcrumb.locator("a").nth(2)).toHaveAttribute(
        "href",
        "/turing-pact/foundations-terrain",
      );

      const rowTops = await breadcrumb.locator("li").evaluateAll((items) =>
        items.map((item) => Math.round(item.getBoundingClientRect().top)),
      );
      expect(Math.max(...rowTops) - Math.min(...rowTops), "面包屑在手机上换成了两行").toBeLessThanOrEqual(1);

      const courseLink = breadcrumb.locator("a").nth(1);
      await page.screenshot({ path: `${SHOTS}/nav-${viewport.id}-breadcrumb.png`, fullPage: true });
      await courseLink.scrollIntoViewIfNeeded();
      await assertVisibleAndHittableAtFivePoints(page, courseLink, `${viewport.id} / 回到课程地图`);
      await humanClick(page, courseLink, `${viewport.id} / 课程面包屑`);
      await expect(page).toHaveURL(`${ONLINE_ORIGIN}/turing-pact/foundations-terrain`);
      await expect(page.locator(".picked--left")).toBeVisible({ timeout: 30_000 });
    });
  }
});
