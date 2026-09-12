import { expect, test } from "@playwright/test";

import { watchConsole } from "./harness/console.js";
import { humanClick } from "./harness/click.js";
import { ONLINE_ORIGIN } from "./ports.js";
import {
  FIRST_COURSE_ID,
  FIRST_COURSE_ROUTE,
  SETTLEMENT_LESSON_COUNT,
  walkFirstOnlineLesson,
} from "./harness/online-learner.js";

test.describe("A 新学习者 · 在线端 · 手机宽度", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: false });

  test(`清空 storage → 落地 → 第一节 → 结算 1/${SETTLEMENT_LESSON_COUNT}`, async ({ page }) => {
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
  test("课程岛收起时仍能直接回到地图", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    await page.goto(
      `${ONLINE_ORIGIN}${FIRST_COURSE_ROUTE}?seed=${encodeURIComponent(FIRST_COURSE_ID)}&freeze=1`,
      { waitUntil: "domcontentloaded" },
    );
    await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });

    const island = page.locator(".picked--left");
    await expect(island).toBeVisible({ timeout: 30_000 });
    const route = island.locator("details.picked__route");
    await expect(route).toBeVisible({ timeout: 30_000 });
    await expect(route).not.toHaveAttribute("open");
    await expect(route.locator(":scope > .unit-strip")).toBeHidden();
    await expect(route.locator(":scope > .course-route-quiz")).toBeHidden();

    const collapsedBox = await island.boundingBox();
    expect(collapsedBox).not.toBeNull();
    expect(collapsedBox!.height).toBeLessThanOrEqual(180);

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

  test("点开学习路线后手机也能到达分级测验并回地图", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    await page.goto(
      `${ONLINE_ORIGIN}${FIRST_COURSE_ROUTE}?seed=${encodeURIComponent(FIRST_COURSE_ID)}&freeze=1`,
      { waitUntil: "domcontentloaded" },
    );
    await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });

    const island = page.locator(".picked--left");
    await expect(island).toBeVisible({ timeout: 30_000 });
    const route = island.locator("details.picked__route");
    const routeSummary = route.locator(":scope > summary");
    await expect(routeSummary).toContainText("学习路线");

    await humanClick(page, routeSummary, "手机课程岛的「学习路线」");
    await expect(route).toHaveAttribute("open", "");
    await expect(island.getByRole("button", { name: /先看这一单元讲什么/ })).toBeVisible();

    /* Native summary remains a keyboard disclosure after the pointer path. */
    await routeSummary.focus();
    await expect(routeSummary).toBeFocused();
    await routeSummary.press("Enter");
    await expect(route).not.toHaveAttribute("open");
    await routeSummary.press("Enter");
    await expect(route).toHaveAttribute("open", "");

    const routeQuiz = route.locator(":scope > details.course-route-quiz");
    await expect(routeQuiz).toBeVisible({ timeout: 30_000 });
    const quizSummary = routeQuiz.locator(":scope > summary");
    await expect(quizSummary).toContainText("先测测你的学习起点");
    const quizBody = routeQuiz.locator(":scope > .course-route-quiz__body");
    await expect(quizBody).toBeHidden();

    await quizSummary.focus();
    await expect(quizSummary).toBeFocused();
    await quizSummary.press("Enter");
    await expect(quizBody).toBeVisible();
    await expect(routeQuiz).toContainText(/第\s*1\s*\/\s*3\s*题/);
    await expect(routeQuiz.locator(".course-route-quiz__option")).toHaveCount(3);

    await humanClick(
      page,
      routeQuiz.locator(".course-route-quiz__option").first(),
      "手机课程岛小测第 1 题选项",
    );
    await expect(routeQuiz).toContainText(/第\s*2\s*\/\s*3\s*题/);

    const back = island.getByRole("button", { name: /回到.*地图/ });
    await humanClick(page, back, "展开后的手机课程岛的「回到地图」");
    await expect(island).toHaveCount(0, { timeout: 15_000 });

    consoleErrors.assertClean();
  });
});

test.describe("A 在线端 · 手机指针", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });

  test("地图提示说双指缩放，不说滚轮", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    await page.goto(`${ONLINE_ORIGIN}/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
    const hint = page.locator(".hint--controls");
    await expect(hint).toBeVisible({ timeout: 30_000 });
    await expect(hint).toContainText("双指缩放");
    await expect(hint).not.toContainText("滚轮");
    consoleErrors.assertClean();
  });
});
