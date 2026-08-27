import { expect, test } from "@playwright/test";

import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import {
  openOnline,
  startFirstLessonFromLanding,
  waitForMapReady,
} from "./harness/online-learner.js";
import { ONLINE_ORIGIN } from "./ports.js";

/**
 * A wrong answer has to survive the question it was wrong about.
 *
 * The attempt record has carried the answer, the score and the revision for a
 * long time; nothing read the failed ones, so 错题本 read as unbuilt when it
 * was really unsurfaced. A unit test over the read model cannot tell those two
 * apart — the fold is correct either way. This walks the actual product: get
 * one wrong on purpose, then go looking for it.
 */
test.describe("H 错题本 · 在线端", () => {
  test("答错一道题 → 它出现在错题本里，带着题面和你当时的答案", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    await openOnline(page);
    await waitForMapReady(page);
    await startFirstLessonFromLanding(page);

    const quiz = page.locator(".exercise-panel").first();
    await expect(quiz).toBeVisible({ timeout: 30_000 });
    await quiz.scrollIntoViewIfNeeded();
    const wrong = "香蕉船和月球轨道";
    await page.getByPlaceholder(/用自己的话/).fill(wrong);
    await humanClick(page, page.getByRole("button", { name: /提交/ }), "提交");

    await page.goto(`${ONLINE_ORIGIN}/mistakes`, { waitUntil: "domcontentloaded" });

    const card = page.locator(".mistake-card").first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText(wrong);
    await expect(card).toContainText("待订正");

    /*
      The delivery build must not be able to print the answer. Packages ship a
      fingerprint, not a reference answer, and this is the learner-facing half
      of the check that `no-answers-shipped.test.ts` makes against the bytes.
    */
    await expect(card).toContainText("不随课程包下发参考答案");

    consoleErrors.assertClean();
  });
});
