import { expect, test } from "@playwright/test";

import { assertVisibleText } from "./harness/assert.js";
import { watchConsole } from "./harness/console.js";
import {
  FIRST_COURSE_TITLE,
  confirmNodeCardAndStart,
  openLiveNode,
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

    let todayTitle = "";
    await namedStep(page, "右栏「今天」卡说的和地图一致", async () => {
      const card = page.locator(".today-card");
      await expect(card).toBeVisible();
      await expect(card.getByRole("heading", { name: "今天" })).toBeVisible();
      await expect(card.getByRole("button", { name: /开始第一节/ })).toBeVisible();
      todayTitle = (await card.locator(".today-card__title").innerText()).trim();
      expect(todayTitle.length).toBeGreaterThan(0);
      await assertVisibleText(page, todayTitle);
      const needle = todayTitle.replace(/[《》]/g, "").slice(0, 8);
      const labels = await page.locator("button.label.is-visible").allInnerTexts();
      const onMap = labels.some((label) => label.includes(needle) || todayTitle.includes(label.trim()));
      if (!onMap) {
        throw new Error(`地图上看不到今天卡说的「${todayTitle}」。可见标签: ${labels.join(" / ")}`);
      }
    });

    await startFirstLessonFromLanding(page);

    await namedStep(page, "进课后今天卡仍指向同一门课", async () => {
      await expect(page.locator(".picked, .path-card, [aria-modal='true']").first()).toBeVisible({
        timeout: 60_000,
      });
      await assertVisibleText(page, FIRST_COURSE_TITLE);
      const card = page.locator(".today-card");
      await expect(card).toBeVisible();
      await expect(card).toContainText(todayTitle);
    });

    await openLiveNode(page);
    await confirmNodeCardAndStart(page);
    await readAndAnswerFirstLesson(page);
    await waitForSettlementProgress(page);
    consoleErrors.assertClean();
  });
});
