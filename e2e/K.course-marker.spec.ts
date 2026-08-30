import { expect, test } from "@playwright/test";

import { humanClick, waitForStableBox } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { openOnline, waitForMapReady } from "./harness/online-learner.js";
import { namedStep } from "./harness/step.js";

const SECOND_LESSON_TITLE = "屏幕上的按钮，代码里能找到对应的哪几行？";

test.describe("K 课程岛 · 点课程标记进入课程", () => {
  test.use({ viewport: { width: 1440, height: 810 } });

  test("点路径上的课程图标 → 课程卡 → 打开对应课文", async ({ page }) => {
    const consoleErrors = watchConsole(page);

    await namedStep(page, "从世界地图进入一座课程岛", async () => {
      await openOnline(page);
      await waitForMapReady(page);

      const course = page.locator("button.label--course.is-visible").first();
      await expect(course).toBeVisible({ timeout: 30_000 });
      await humanClick(page, course, "世界地图上的课程");

      const enterCard = page.locator(".picked.picked--follow.is-visible");
      await expect(enterCard).toBeVisible({ timeout: 10_000 });
      const enter = enterCard.getByRole("button", { name: /进入这门课/ });
      await humanClick(page, enter, "进入这门课");
      await expect(page).toHaveURL(/\/turing-pact\/[^/]+$/);
    });

    await namedStep(page, "课程岛上的图标本身是可点击标记", async () => {
      await expect(page.locator(".stagewrap canvas")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });

      const icon = page.locator("button.label--icon.is-visible").first();
      await expect(icon).toBeVisible({ timeout: 30_000 });
      await waitForStableBox(icon);
      await humanClick(page, icon, "课程图标");
    });

    await namedStep(page, "课程标记打开对应的课程卡", async () => {
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await expect(dialog).toContainText(SECOND_LESSON_TITLE);
      await expect(dialog).toContainText("读 ");
    });

    await namedStep(page, "课程卡的开始按钮打开这节课", async () => {
      const start = page.getByRole("dialog").getByRole("button", { name: /^开始/ });
      await humanClick(page, start, "开始课程");
      await expect(page).toHaveURL(/\/turing-pact\/[^/]+\/what-is-an-app\/app-is-a-pile-of-files$/);
      await expect(page.getByRole("heading", { name: SECOND_LESSON_TITLE })).toBeVisible({
        timeout: 30_000,
      });
    });

    consoleErrors.assertClean();
  });
});
