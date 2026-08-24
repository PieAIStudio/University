import { expect, test } from "@playwright/test";

import { assertVisibleText } from "./harness/assert.js";
import { watchConsole } from "./harness/console.js";
import {
  TODAY_CTA,
  openOnline,
  readAndAnswerFirstLesson,
  startFirstLessonFromLanding,
  waitForMapReady,
  waitForSettlementProgress,
} from "./harness/online-learner.js";
import { namedStep } from "./harness/step.js";

test.describe("C 在线端 · 桌面宽度", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("右栏今天卡和地图一致，并且同样走完第一节", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    await openOnline(page);
    await waitForMapReady(page);

    let todayLesson = "";
    let todayCourse = "";
    await namedStep(page, "右栏「今天」卡说的和地图一致", async () => {
      /*
        `.today-hero`, not the old `.today-card`. That class belonged to this
        shell's own copy of the panel; the panel is shared now and the authoring
        shell renders the same markup, so pinning the retired class was pinning
        the fork rather than the product.

        The panel leads with the lesson and names its course underneath, which
        is the right way round for someone deciding whether to sit down. The
        map names courses, because an island is a course. So the thing to check
        is that the panel's *course* line is a label you can see — comparing
        the panel's headline to the map would compare a lesson to a course and
        fail on a product that is behaving correctly.
      */
      const card = page.locator(".today-hero");
      await expect(card).toBeVisible();
      await expect(card.getByText("今天的第一件事")).toBeVisible();
      await expect(card.getByRole("button", { name: TODAY_CTA })).toBeVisible();
      todayLesson = (await card.getByRole("heading").first().innerText()).trim();
      expect(todayLesson.length).toBeGreaterThan(0);
      await assertVisibleText(page, todayLesson);

      const meta = (await card.locator(".today-hero__meta").innerText()).trim();
      todayCourse = meta.split("·").at(-1)?.trim() ?? "";
      expect(todayCourse.length).toBeGreaterThan(0);
      const needle = todayCourse.replace(/[《》]/g, "").slice(0, 8);
      const labels = await page.locator("button.label.is-visible").allInnerTexts();
      const onMap = labels.some(
        (label) => label.includes(needle) || todayCourse.includes(label.trim()),
      );
      if (!onMap) {
        throw new Error(`地图上看不到今天卡说的「${todayCourse}」。可见标签: ${labels.join(" / ")}`);
      }
    });

    await startFirstLessonFromLanding(page);

    await namedStep(page, "进的就是今天卡说的那一节", async () => {
      /*
        The button opens the lesson, not the course path. It named a lesson and
        went to a course for as long as the two shells had two 「今天」 panels;
        one panel, one destination.
      */
      await assertVisibleText(page, todayLesson);
    });

    await readAndAnswerFirstLesson(page);
    await waitForSettlementProgress(page);
    consoleErrors.assertClean();
  });
});
