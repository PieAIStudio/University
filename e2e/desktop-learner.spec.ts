import { expect, test } from "@playwright/test";

import { assertVisibleText } from "./harness/assert.js";
import { watchConsole } from "./harness/console.js";
import { humanClick } from "./harness/click.js";
import {
  FIRST_COURSE_TITLE,
  FIRST_COURSE_ID,
  FIRST_LESSON_TITLE,
  openOnline,
  readAndAnswerFirstLesson,
  startFirstLessonFromLanding,
  waitForMapReady,
  waitForSettlementProgress,
} from "./harness/online-learner.js";
import { namedStep } from "./harness/step.js";

test.describe("C 在线端 · 桌面宽度", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("右侧当前对象说明和地图一致，并且同样走完第一节", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    await openOnline(page);
    await waitForMapReady(page);

    const firstLesson = FIRST_LESSON_TITLE;
    await namedStep(page, "右侧只读当前对象说明和地图选择一致", async () => {
      const info = page.locator(".map-information");
      await expect(info).toBeVisible();
      const course = page.locator(
        `button.label--course.is-visible[data-map-marker=${JSON.stringify(FIRST_COURSE_ID)}]`,
      );
      await expect(course).toBeVisible({ timeout: 30_000 });
      await humanClick(page, course, "选择真实课程岛");
      await expect(page.locator(".map-shell__heading h2")).toHaveText(FIRST_COURSE_TITLE);
      await expect(info).toHaveAttribute("data-map-information", `course:${FIRST_COURSE_ID}`);
      await expect(info.locator("button,a")).toHaveCount(0);
      await expect(info).not.toContainText("开始学习");
      await assertVisibleText(page, FIRST_COURSE_TITLE);
    });

    await startFirstLessonFromLanding(page);

    await namedStep(page, "进入地图所选课程的第一节", async () => {
      /*
        The map selection and the lesson route must agree. The right rail is
        read-only context now; it is not a second lesson destination.
      */
      await assertVisibleText(page, firstLesson);
    });

    await readAndAnswerFirstLesson(page);
    await waitForSettlementProgress(page);
    consoleErrors.assertClean();
  });
});
