import { expect, test, type Page } from "@playwright/test";

import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import {
  openOnline,
  readAndAnswerFirstLesson,
  startFirstLessonFromLanding,
  waitForMapReady,
} from "./harness/online-learner.js";
import { namedStep } from "./harness/step.js";

/**
 * V7 station 4: finishing a lesson opens its chest on the island before the
 * lesson's page. The controls are found by `data-chest-action` and the card by
 * `data-chest-stage`, never by their words.
 */

/** The learner's one progress document, however the guest cache is named. */
async function recordedXp(page: Page): Promise<number> {
  return page.evaluate(() => {
    const key = "university.progress.v2";
    const totals = Object.keys(localStorage)
      .filter((name) => name === key || name.startsWith(`${key}.account.`))
      .map(
        (name) =>
          (JSON.parse(localStorage.getItem(name) ?? "null") as { totalXp?: number } | null)
            ?.totalXp ?? 0,
      )
      .filter((xp) => xp > 0);
    if (totals.length !== 1)
      throw new Error(`expected one learner record with XP, found ${totals.length}`);
    return totals[0]!;
  });
}

async function finishFirstLesson(page: Page) {
  await openOnline(page);
  await waitForMapReady(page);
  await startFirstLessonFromLanding(page);
  await readAndAnswerFirstLesson(page);
}

test.describe("V7 chest opening", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the chest opens on the island, with the record's rewards, before the lesson's page", async ({
    page,
  }) => {
    const consoleErrors = watchConsole(page);
    await finishFirstLesson(page);
    const card = page.locator("[data-chest-stage]");

    await namedStep(page, "学完不直接进结算页：先是岛上的宝箱", async () => {
      await expect(card).toHaveAttribute("data-chest-stage", "closed", { timeout: 20_000 });
      await expect(page.locator(".settle")).toHaveCount(0);
      await expect(page.locator(".learn-stage canvas").first()).toBeVisible();
    });

    await namedStep(page, "点一下打开，奖励一条条出来", async () => {
      await humanClick(page, page.locator('[data-chest-action="open"]'), "点一下，打开");
      await expect(card).toHaveAttribute("data-chest-stage", /opening|rewards/);
      await expect(card).toHaveAttribute("data-chest-stage", "rewards", { timeout: 20_000 });
      const lines = card.locator(".chest-rewards__line");
      await expect(lines.first()).toBeVisible();
      // The XP line is the record's own gain: a fresh learner started at zero.
      const xp = await recordedXp(page);
      await expect(lines.first()).toContainText(String(xp));
    });

    await namedStep(page, "扔出知识之星，小怪逃走，再继续", async () => {
      const star = page.locator('[data-chest-action="throw"]');
      await expect(star).toBeVisible({ timeout: 20_000 });
      await humanClick(page, star, "扔出知识之星");
      await expect(card).toHaveAttribute("data-chest-stage", "throwing");
      const done = page.locator('[data-chest-action="continue"]');
      await expect(done).toBeVisible({ timeout: 20_000 });
      await humanClick(page, done, "继续");
      await expect(card).toHaveCount(0, { timeout: 10_000 });
      await expect(page.getByText("读完了。")).toBeVisible({ timeout: 20_000 });
    });
    consoleErrors.assertClean();
  });

  test("under reduced motion the chest is simply open and the rewards come at once", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await finishFirstLesson(page);
    const card = page.locator("[data-chest-stage]");
    await expect(card).toHaveAttribute("data-chest-stage", "closed", { timeout: 20_000 });
    await humanClick(page, page.locator('[data-chest-action="open"]'), "点一下，打开");
    await expect(card).toHaveAttribute("data-chest-stage", "rewards", { timeout: 10_000 });
    const lines = card.locator(".chest-rewards__line");
    const count = await lines.count();
    expect(count).toBeGreaterThan(1);
    // No star to watch: the monster is simply gone, so Continue comes straight away.
    await expect(page.locator('[data-chest-action="throw"]')).toHaveCount(0);
    await humanClick(page, page.locator('[data-chest-action="continue"]'), "继续");
    await expect(card).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText("读完了。")).toBeVisible({ timeout: 20_000 });
  });
});
