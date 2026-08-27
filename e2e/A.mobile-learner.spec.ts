import { expect, test } from "@playwright/test";

import { watchConsole } from "./harness/console.js";
import { humanClick } from "./harness/click.js";
import { ONLINE_ORIGIN } from "./ports.js";
import { walkFirstOnlineLesson } from "./harness/online-learner.js";

test.describe("A 新学习者 · 在线端 · 手机宽度", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: false });

  test("清空 storage → 落地 → 第一节 → 结算 1/41", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    await walkFirstOnlineLesson(page);
    consoleErrors.assertClean();
  });

  /*
    The course island is one panel rendered into two slots, and this asserts
    the narrow slot gets the whole panel rather than a shortened copy.

    It was two panels. The wide one had grown a 分级测验 and the narrow one
    never did, so on a phone the question 「我该从哪一关开始」 did not exist —
    silently, with every unit test green, because no test had ever looked at
    the narrow copy. A width is not allowed to decide what a panel contains;
    only which slot it lands in.
  */
  test("课程岛在手机宽度上带着分级测验，不是宽屏专属", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    /*
      Straight to the course address. 「今天」 opens the *lesson* at both
      widths now, so the landing walk never passes through the island; a
      returning learner reaches it by bookmark or by tapping the island on the
      map, and the address is the cheaper of the two to hold steady.
    */
    await page.goto(`${ONLINE_ORIGIN}/turing-pact/foundations-before-zero`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });

    const island = page.locator(".picked--left");
    await expect(island).toBeVisible({ timeout: 30_000 });
    await expect(island.locator(".course-route-quiz")).toBeVisible({ timeout: 30_000 });

    /*
      The way out has to be clickable, not merely present.

      A first draft of this test asserted `boundingBox().y + height <= 812` and
      passed while 「回到地图」 sat under the map's hint bar, outside the panel's
      own scroll: a box inside an overflow container still reports a position.
      `humanClick` hit-tests before it presses, which is the difference between
      「在 DOM 里」 and 「点得到」 — this repo has shipped that gap twice.
    */
    const back = island.getByRole("button", { name: /回到.*地图/ });
    await humanClick(page, back, "手机课程岛的「回到地图」");
    await expect(island).toHaveCount(0, { timeout: 15_000 });

    consoleErrors.assertClean();
  });
});
