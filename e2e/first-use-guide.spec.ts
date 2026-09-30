import { expect, test, type Page } from "./harness/learner-test.js";

import { ONLINE_ORIGIN } from "./ports.js";

/**
 * First-use guides (Owner 2026-09-30): no screen of rules; the first time a
 * learner plays a game, 涟's droplet walks them through it, once.
 */
const state = (page: Page) =>
  page.evaluate(
    () =>
      (Reflect.get(window, "__links")() as { state: { phase: string; elapsed: number } }).state,
  );

async function startLinks(page: Page) {
  await page.getByTestId("game-start").click({ timeout: 120_000 });
  await page.getByTestId("game-ready").click();
  await expect.poll(async () => (await state(page)).phase, { timeout: 30_000 }).toBe("playing");
}

test("涟 walks a first-time player through 连连看, once", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=links&lang=zh-CN`);
  await startLinks(page);

  const guide = page.getByTestId("first-use");
  // The droplet's bubble is drawn at the top of the page, not inside the guide.
  const next = page.getByTestId("first-use-next");
  await expect(guide).toBeVisible({ timeout: 30_000 });
  await expect(guide).toHaveAttribute("data-step", "0");
  await expect(guide).toHaveAttribute("data-status", "showing");

  // Time stands still while 涟 speaks.
  const held = (await state(page)).elapsed;
  await page.waitForTimeout(800);
  expect((await state(page)).elapsed).toBe(held);

  await next.click();
  await expect(guide).toHaveAttribute("data-step", "1");
  // A do step has no 知道了: using the stone it points at moves the walk on.
  await expect(next).toHaveCount(0);
  await page.locator('button[data-guide="links-stone"]').click();
  await expect(guide).toHaveAttribute("data-step", "2");
  await next.click();
  await expect(guide).toHaveAttribute("data-step", "3");
  await next.click();
  await expect(guide).toHaveCount(0);
  await expect.poll(async () => (await state(page)).elapsed).toBeGreaterThan(held);

  // Once is enough: the next game starts straight away and offers a replay.
  await page.reload();
  await expect(page.getByTestId("game-howto")).toBeVisible({ timeout: 120_000 });
  await startLinks(page);
  await page.waitForTimeout(500);
  await expect(page.getByTestId("first-use")).toHaveCount(0);
});
