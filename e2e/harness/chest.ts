import { expect, type Page } from "@playwright/test";

import { humanClick } from "./click.js";
import { namedStep } from "./step.js";

/**
 * Finishing a lesson opens its chest on the island before the lesson's page
 * (V7 station 4). A learner taps it open, may tap again to skip the show,
 * throws the knowledge star when a monster stands next, and continues. Every
 * control is keyed on `data-chest-action`, not on its words.
 */
export async function passChestOpening(page: Page): Promise<void> {
  await namedStep(page, "学完一节：开宝箱、扔星星、继续", async () => {
    const card = page.locator("[data-chest-stage]");
    await expect(card).toBeVisible({ timeout: 20_000 });
    await humanClick(page, page.locator('[data-chest-action="open"]'), "点一下，打开");
    await humanClick(page, page.locator('[data-chest-action="skip"]'), "直接看奖励");
    // The rewards come one at a time; then either the star or Continue is offered.
    const next = page.locator('[data-chest-action="throw"], [data-chest-action="continue"]');
    await expect(next.first()).toBeVisible({ timeout: 20_000 });
    if ((await next.first().getAttribute("data-chest-action")) === "throw") {
      await humanClick(page, next.first(), "扔出知识之星");
    }
    const done = page.locator('[data-chest-action="continue"]');
    await expect(done).toBeVisible({ timeout: 20_000 });
    await humanClick(page, done, "继续");
    await expect(card).toHaveCount(0, { timeout: 10_000 });
  });
}
