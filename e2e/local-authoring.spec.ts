import { expect, test } from "@playwright/test";

import { LOCAL_ORIGIN } from "./ports.js";
import { assertImagesStayInViewport, assertVisibleText } from "./harness/assert.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { namedStep } from "./harness/step.js";
import { FIRST_COURSE_ID, FIRST_LESSON_ID, selectGameRoute } from "./harness/online-learner.js";
import { enterSelectedMapObject } from "./harness/map-actions.js";

test.describe("D 本地端", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("落地 → 进一节课 → 课文末尾有完成本次更新和练习", async ({ page }) => {
    const consoleErrors = watchConsole(page);

    await namedStep(page, "打开本地端落地页", async () => {
      await page.goto(`${LOCAL_ORIGIN}/`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("第一项学习还没有准备好。")).toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByText(/正在打开校园档案/)).toHaveCount(0, { timeout: 30_000 });
      await selectGameRoute(page);
      await expect(
        page.locator(
          `button.label--course.is-visible[data-map-marker=${JSON.stringify(FIRST_COURSE_ID)}]`,
        ),
      ).toBeVisible({ timeout: 30_000 });
    });

    await namedStep(page, "进一节课", async () => {
      const course = page.locator(
        `button.label--course[data-map-marker=${JSON.stringify(FIRST_COURSE_ID)}]`,
      );
      await humanClick(page, course, "选择作者端的真实课程岛");
      await enterSelectedMapObject(page, "进入课程岛");
      const lesson = page.locator(
        `button.label--lesson[data-map-marker=${JSON.stringify(FIRST_LESSON_ID)}]`,
      );
      await expect(lesson).toBeVisible();
      await humanClick(page, lesson, "选择第一节");
      await enterSelectedMapObject(page, "进入课文");
    });

    await namedStep(page, "课文渲染出来", async () => {
      await expect(page.getByRole("article")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("heading").first()).toBeVisible();
      await assertImagesStayInViewport(page);
    });

    await namedStep(page, "滚到末尾：完成本次更新和练习", async () => {
      const confirm = page.getByRole("button", { name: /我读完了|完成本次更新|再次确认本次更新/ });
      await confirm.scrollIntoViewIfNeeded();
      await expect(confirm).toBeVisible({ timeout: 20_000 });
      const exercise = page.locator("section.lesson-completion, .exercise-panel, .choice-block");
      await exercise.first().scrollIntoViewIfNeeded();
      await expect(exercise.first()).toBeVisible();
      await assertVisibleText(page, /我读完了|完成本次更新|再次确认本次更新/);
    });

    consoleErrors.assertClean();
  });
});
