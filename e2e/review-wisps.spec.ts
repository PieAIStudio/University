import { mkdirSync } from "node:fs";
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
  await page.clock.setFixedTime(Date.now());
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

  let due = 0;
  await namedStep(page, "第二天：刚学完的那一节上飞回一只小精灵", async () => {
    due = await makeDroppedCardsDue(page);
    await page.goto(`${ONLINE_ORIGIN}${course}`);
    await expect(page.locator("button.label--icon.is-visible").first()).toBeVisible({
      timeout: 60_000,
    });
    await expect.poll(wisps, { timeout: 30_000 }).toBe(1);
    mkdirSync("SCRATCH/e2e/cosmetics", { recursive: true });
    await page.screenshot({ path: "SCRATCH/e2e/cosmetics/review-wisp-before.png" });
  });

  await namedStep(page, "真实复习排程移走到期卡，回岛后小精灵消失", async () => {
    expect(due).toBeGreaterThan(0);
    await page.evaluate(() => {
      history.pushState(null, "", "/review");
      dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page.locator("[data-review-due]")).toHaveAttribute("data-review-due", String(due));
    mkdirSync("SCRATCH/e2e/menu-doors", { recursive: true });
    await page.screenshot({ path: "SCRATCH/e2e/menu-doors/review-real-due-cards.png" });
    for (let index = 0; index < due; index++) {
      const answer = page.getByPlaceholder(/先写下自己的答案/);
      await expect(answer).toBeEnabled();
      await answer.fill("先自己回忆这一关，再对照卡片检查。");
      await page.getByRole("button", { name: /揭示答案/ }).click();
      const ratings = page.locator(".rating-row > button");
      await expect(ratings).toHaveCount(4);
      // The label includes the actual next interval; the fourth rating is Easy.
      await ratings.nth(3).click();
    }
    await expect(page.locator("[data-review-due]")).toHaveAttribute("data-review-due", "0");
    await expect(page.locator(".review-card")).toHaveCount(0);
    await page.evaluate((path) => {
      history.pushState(null, "", path);
      dispatchEvent(new PopStateEvent("popstate"));
    }, course);
    await expect(page.locator("button.label--icon.is-visible").first()).toBeVisible();
    await expect.poll(wisps).toBe(0);
    await page.screenshot({ path: "SCRATCH/e2e/cosmetics/review-wisp-after.png" });
  });
});
