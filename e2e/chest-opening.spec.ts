import { expect, test, type Page } from "./harness/learner-test.js";

import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import {
  openOnline,
  readAndAnswerFirstLesson,
  startFirstLessonFromLanding,
  waitForMapReady,
} from "./harness/online-learner.js";
import { namedStep } from "./harness/step.js";
import { isolatedAnonymousSession } from "./harness/anonymous-session.js";

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

async function finishFirstLesson(page: Page, holdAccount = false) {
  const account = await isolatedAnonymousSession(page, holdAccount);
  await openOnline(page);
  await waitForMapReady(page);
  await startFirstLessonFromLanding(page);
  await readAndAnswerFirstLesson(page);
  return account;
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
      await expect(page.locator('[data-opening-topic="wrap-up"]')).toBeVisible({ timeout: 20_000 });
      await expect(page.locator(".settle")).toHaveCount(0);
    });
    consoleErrors.assertClean();
  });

  test("a delayed anonymous save keeps this guest's chest and its real reward until Continue", async ({
    page,
  }) => {
    const account = await finishFirstLesson(page, true);
    const card = page.locator("[data-chest-stage]");
    await expect(card).toHaveAttribute("data-chest-stage", "closed");
    await page.locator('[data-chest-action="open"]').click();
    await expect.poll(account.creations).toBe(1);
    account.release();
    await expect(card).toHaveAttribute("data-chest-stage", "rewards", { timeout: 20_000 });
    await expect(page.locator(".settle")).toHaveCount(0);
    expect(await recordedXp(page)).toBeGreaterThan(0);
    await expect
      .poll(() =>
        page.evaluate((id) => {
          const raw = localStorage.getItem(`university.progress.v2.account.${id}`);
          return raw ? JSON.parse(raw).totalXp : 0;
        }, account.id),
      )
      .toBeGreaterThan(0);
    const throwStar = page.locator('[data-chest-action="throw"]');
    await expect(throwStar).toBeVisible();
    await throwStar.click();
    const next = page.locator('[data-chest-action="continue"]');
    await expect(next).toBeVisible({ timeout: 20_000 });
    await next.click();
    await expect(page.locator('[data-opening-topic="wrap-up"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".settle")).toHaveCount(0);
  });

  test("a real pointer held across anonymous adoption opens the same button exactly once", async ({
    page,
  }) => {
    const account = await finishFirstLesson(page, true);
    const open = page.locator('[data-chest-action="open"]');
    await expect(open).toBeVisible();
    await open.scrollIntoViewIfNeeded();
    const handle = await open.elementHandle();
    const box = await open.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await expect.poll(account.creations).toBe(1);
    account.release();
    await expect
      .poll(() =>
        page.evaluate((id) => {
          const raw = localStorage.getItem(`university.progress.v2.account.${id}`);
          return raw ? JSON.parse(raw).totalXp : 0;
        }, account.id),
      )
      .toBeGreaterThan(0);
    expect(
      await handle!.evaluate(
        (node) => node === document.querySelector('[data-chest-action="open"]'),
      ),
    ).toBe(true);
    await page.mouse.up();
    await expect(page.locator("[data-chest-stage]")).toHaveAttribute(
      "data-chest-stage",
      /opening|rewards/,
    );
    await handle!.dispose();
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
    await expect(page.locator('[data-opening-topic="wrap-up"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".settle")).toHaveCount(0);
  });
});
