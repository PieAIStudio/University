import { expect, test, type Page } from "@playwright/test";

import { waitForStableBox } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import {
  COURSE_SCENE_FIXTURE,
  coursePathOf,
  installCourseSceneFixture,
} from "./harness/catalogue.js";
import { LOCAL_ORIGIN, ONLINE_ORIGIN } from "./ports.js";
import { namedStep } from "./harness/step.js";
import { assertCompleteCourseOverview, waitForCourseFraming } from "./harness/course-overview.js";

const COURSE_PATH = coursePathOf(COURSE_SCENE_FIXTURE.course);

interface ModeConfig {
  readonly mode: "delivery" | "authoring";
  readonly origin: string;
}

const MODES: readonly ModeConfig[] = [
  { mode: "delivery", origin: ONLINE_ORIGIN },
  { mode: "authoring", origin: LOCAL_ORIGIN },
];

async function getSceneMatrices(page: Page) {
  return page.evaluate(() => {
    const bag = globalThis as unknown as {
      three?: {
        scene: {
          traverse(
            cb: (obj: { name: string; instanceMatrix?: { array: ArrayLike<number> } }) => void,
          ): void;
        };
      };
    };
    let flameMatrix: number[] | null = null;
    let engravingMatrix: number[] | null = null;
    bag.three?.scene.traverse((obj) => {
      if (obj.name === "island-campfire-flames" && obj.instanceMatrix) {
        flameMatrix = Array.from(obj.instanceMatrix.array);
      }
      if (
        typeof obj.name === "string" &&
        obj.name.startsWith("lesson-medallion-engraving-") &&
        obj.instanceMatrix
      ) {
        engravingMatrix = [...(engravingMatrix ?? []), ...Array.from(obj.instanceMatrix.array)];
      }
    });
    return { flameMatrix, engravingMatrix };
  });
}

test.describe("M 课程岛无障碍与移动触控回归", () => {
  for (const { mode, origin } of MODES) {
    test.describe(`[${mode} 模式] 375x812 真实触控模拟 (hasTouch: true)`, () => {
      test.use({
        viewport: { width: 375, height: 812 },
        hasTouch: true,
        isMobile: true,
      });

      test(`${mode}: 触控点击关卡标记 → 课程卡打开 → 课文阅读器进退`, async ({ page }) => {
        const consoleErrors = watchConsole(page);

        await installCourseSceneFixture(page);

        await namedStep(page, `打开 ${mode} 课程岛页面`, async () => {
          await page.goto(`${origin}${COURSE_PATH}`, {
            waitUntil: "domcontentloaded",
          });
          await expect(page.locator(".stagewrap canvas")).toBeVisible({ timeout: 30_000 });
          await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
        });

        await namedStep(page, "真实触控点击第一节关卡标记", async () => {
          await page.getByRole("button", { name: "总览课程岛", exact: true }).tap();
          await assertCompleteCourseOverview(page);
          await page.getByRole("button", { name: "回到当前关", exact: true }).tap();
          await waitForCourseFraming(page);
          const marker = page
            .locator(
              'button.label--icon.is-visible:not([data-lesson-state="done"]):not([data-lesson-state="locked"])',
            )
            .first();
          await expect(marker).toBeVisible({ timeout: 30_000 });
          await waitForStableBox(marker);

          // 验证触控尺寸语义与无障碍属性
          await expect(marker).toHaveAttribute("data-lesson-state");
          await expect(marker).toHaveAttribute("aria-label");

          // 真实触控事件点击标记
          await marker.tap();
        });

        await namedStep(page, "检查课程卡以对话框正常浮起", async () => {
          const dialog = page.getByRole("dialog");
          await expect(dialog).toBeVisible({ timeout: 10_000 });
          await expect(dialog.getByRole("button", { name: /^开始/ })).toBeVisible({
            timeout: 10_000,
          });
        });

        await namedStep(page, "从课程卡触控点击开始进入课文并触控退出", async () => {
          const startBtn = page.getByRole("dialog").getByRole("button", { name: /^开始/ });
          await startBtn.tap();

          await expect(page).toHaveURL(new RegExp(`${COURSE_PATH}/[^/]+/[^/]+$`));
          const exitBtn = page.getByRole("button", { name: "离开课文" });
          await expect(exitBtn).toBeVisible({ timeout: 30_000 });
          await exitBtn.tap();

          await expect(page).toHaveURL(new RegExp(`${COURSE_PATH}$`));
          await expect(page.locator(".stagewrap canvas")).toBeVisible({ timeout: 30_000 });
        });

        consoleErrors.assertClean();
      });
    });

    test.describe(`[${mode} 模式] 键盘导航与焦点语义`, () => {
      test.use({
        viewport: { width: 1440, height: 900 },
        hasTouch: false,
      });

      test(`${mode}: 键盘 Tab 遍历关卡标记并激活，Escape 关闭`, async ({ page }) => {
        const consoleErrors = watchConsole(page);

        await installCourseSceneFixture(page);

        await page.goto(`${origin}${COURSE_PATH}`, {
          waitUntil: "domcontentloaded",
        });
        await expect(page.locator(".stagewrap canvas")).toBeVisible({ timeout: 30_000 });
        await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });

        // 等待可见的关卡标记按钮就绪
        const markers = page.locator("nav.labels button.label.is-visible");
        await expect(markers.first()).toBeVisible({ timeout: 30_000 });

        // 有界 Tab 导航直到聚焦到实际可见的标记 button
        let focusedMarker = false;
        for (let i = 0; i < 30; i += 1) {
          await page.keyboard.press("Tab");
          const isVisibleMarker = await page.evaluate(() => {
            const active = document.activeElement;
            return Boolean(
              active &&
              active instanceof HTMLElement &&
              active.tagName === "BUTTON" &&
              active.classList.contains("label") &&
              active.classList.contains("is-visible") &&
              active.offsetParent !== null,
            );
          });
          if (isVisibleMarker) {
            focusedMarker = true;
            break;
          }
        }
        expect(focusedMarker, "键盘 Tab 应能聚焦到实际可见的标记按钮").toBe(true);

        // 使用 Enter 键激活标记
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible({ timeout: 10_000 });

        // 按 Escape 键安全退出并断言对话框关闭
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden({ timeout: 10_000 });

        consoleErrors.assertClean();
      });
    });

    test.describe(`[${mode} 模式] 减少动态效果与矩阵多帧静止`, () => {
      test.use({
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce",
      });

      test(`${mode}: 未冻结场景火焰与刻纹 instanceMatrix 多帧静止，动态切换后复位`, async ({
        page,
      }) => {
        const consoleErrors = watchConsole(page);

        await installCourseSceneFixture(page);

        // 普通无 freeze / seed 参数 URL
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(`${origin}${COURSE_PATH}`, {
          waitUntil: "domcontentloaded",
        });
        await expect(page.locator(".stagewrap canvas")).toBeVisible({ timeout: 30_000 });
        await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });

        // 验证系统媒体查询识别
        const respectsReducedMotion = await page.evaluate(() => {
          return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        });
        expect(respectsReducedMotion).toBe(true);

        const overviewButton = page.getByRole("button", { name: "总览课程岛", exact: true });
        await overviewButton.focus();
        await page.keyboard.press("Enter");
        await assertCompleteCourseOverview(page);
        await page.keyboard.press("Enter");
        await expect(page.locator('.stagewrap[data-map-view="learning"]')).toBeVisible();
        await waitForCourseFraming(page);

        // 等待 3D 渲染场景实例就绪
        await page.waitForFunction(
          () => {
            const bag = globalThis as unknown as {
              three?: { scene?: { traverse?: unknown } };
            };
            return typeof bag.three?.scene?.traverse === "function";
          },
          undefined,
          { timeout: 30_000 },
        );

        // 等待刻纹实例网格可用
        await expect
          .poll(
            async () => {
              const mats = await getSceneMatrices(page);
              return mats.engravingMatrix !== null && mats.flameMatrix !== null;
            },
            { timeout: 15_000 },
          )
          .toBe(true);

        // 1. 在 reduced-motion 下，连续跨多帧采样，真实 instanceMatrix 必须严格静止
        const sample1 = await getSceneMatrices(page);
        expect(sample1.engravingMatrix, "刻纹实例矩阵已装配").not.toBeNull();
        expect(sample1.flameMatrix, "该真实课程必须有营火，不能跳过火焰断言").not.toBeNull();

        await page.waitForTimeout(300);
        const sample2 = await getSceneMatrices(page);
        expect(sample2.engravingMatrix).toEqual(sample1.engravingMatrix);
        expect(sample2.flameMatrix).toEqual(sample1.flameMatrix);

        // 2. 媒体查询动态切换至有动画 (no-preference)
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await waitForRenderedFrames(page, 2);

        const moving1 = await getSceneMatrices(page);
        await waitForRenderedFrames(page, 3);
        const moving2 = await getSceneMatrices(page);

        // 运动状态下，刻纹或火焰随帧更新，矩阵随时间波动
        expect(moving1.engravingMatrix).not.toEqual(moving2.engravingMatrix);
        expect(moving1.flameMatrix).not.toEqual(moving2.flameMatrix);

        // 3. 动态切回 reduced-motion：必须立即复位刻纹 scale 并在多帧内保持静止
        await page.emulateMedia({ reducedMotion: "reduce" });
        await waitForRenderedFrames(page, 2);

        const restored1 = await getSceneMatrices(page);
        await waitForRenderedFrames(page, 3);
        const restored2 = await getSceneMatrices(page);

        expect(restored1.engravingMatrix).not.toBeNull();
        expect(restored2.engravingMatrix).toEqual(restored1.engravingMatrix);
        expect(restored2.flameMatrix).toEqual(restored1.flameMatrix);
        expect(restored1.engravingMatrix, "恢复到初始静止姿态，而不是停在任意脉冲帧").toEqual(
          sample1.engravingMatrix,
        );

        consoleErrors.assertClean();
      });
    });
  }
});

/** Media emulation acknowledges the browser setting, not a rendered R3F
 * frame. A 150ms sleep does not guarantee a new Stage frame; the failed run compared
 * a moving pose with a restored one. This barrier observes actual frames,
 * never waits for an expected matrix value, and keeps every equality/change
 * assertion above intact. A stalled or replaced renderer still fails.
 */
async function waitForRenderedFrames(page: Page, count: number) {
  const start = await page.evaluate(() => {
    const frame = (
      globalThis as unknown as {
        __stageFrameMetrics?: { frame: number; sceneUuid: string };
      }
    ).__stageFrameMetrics;
    if (!frame) throw new Error("No actual Stage frame is available");
    return { frame: frame.frame, sceneUuid: frame.sceneUuid };
  });
  const handle = await page.waitForFunction(
    ({ start, count }) => {
      const now = (
        globalThis as unknown as {
          __stageFrameMetrics?: { frame: number; sceneUuid: string };
        }
      ).__stageFrameMetrics;
      return now?.sceneUuid === start.sceneUuid && now.frame >= start.frame + count;
    },
    { start, count },
    { timeout: 20_000 },
  );
  await handle.dispose();
}
