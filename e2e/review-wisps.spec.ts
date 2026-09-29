import { expect, test } from "./harness/learner-test.js";

import { CATALOGUE_ROLES, coursePathOf } from "./harness/catalogue.js";
import { makeDroppedCardsDue, walkFirstOnlineLesson } from "./harness/online-learner.js";
import { namedStep } from "./harness/step.js";
import { ONLINE_ORIGIN } from "./ports.js";

/**
 * V7 decision O1: when a finished lesson's review cards come due, a wisp
 * comes back to its stone. Structure, not pixels: the scene's wisp group and
 * how many wisps it holds.
 */
test("a wisp comes back to the finished stone once its cards are due", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await walkFirstOnlineLesson(page);
  const course = coursePathOf(CATALOGUE_ROLES.settlement.course);
  const wisps = () =>
    page.evaluate(() => {
      const group = (globalThis as any).three?.scene.getObjectByName("course-review-wisps");
      return group ? (group.children[0]?.count ?? 0) : 0;
    });

  await namedStep(page, "当天：卡片还没到期，岛上没有小精灵", async () => {
    await page.goto(`${ONLINE_ORIGIN}${course}`);
    await expect(page.locator("button.label--icon.is-visible").first()).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(1500);
    expect(await wisps()).toBe(0);
  });

  await namedStep(page, "第二天：刚学完的那一节上飞回一只小精灵", async () => {
    await makeDroppedCardsDue(page);
    await page.goto(`${ONLINE_ORIGIN}${course}`);
    await expect(page.locator("button.label--icon.is-visible").first()).toBeVisible({
      timeout: 60_000,
    });
    await expect.poll(wisps, { timeout: 30_000 }).toBe(1);
  });
});
