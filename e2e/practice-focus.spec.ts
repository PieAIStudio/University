import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ONLINE_ORIGIN } from "./ports.js";

for (const width of [390, 320, 1440]) {
  test.describe(`V practice focus ${width}`, () => {
    const height = width === 390 ? 844 : width === 320 ? 740 : 900;
    test.use({
      viewport: { width, height },
      isMobile: width < 768,
      hasTouch: width < 768,
      storageState: { cookies: [], origins: [] },
    });

    test.beforeEach(async ({ page }) => {
      // A repeatable isolated guest; never prefill answers or award progress.
      await page.addInitScript(() => {
        Math.random = () => 0;
      });
      await page.goto(`${ONLINE_ORIGIN}/practice`);
      await page.locator("[data-practice-round]").click();
    });

    test("V1 starting puts the question in focus without a second page introduction", async ({
      page,
    }) => {
      const prompt = page.locator(".practice-stream__question .exercise-prompt");
      await expect(prompt).toBeVisible();
      await expect(page.locator(".practice-overview")).toHaveCount(0);
      const box = await prompt.boundingBox();
      expect(box!.y).toBeLessThan(240);
      await expect(page.locator("[data-practice-focus]")).toBeFocused();
      await page.locator(".practice-stream__question .choice-block__option").first().click();
      const submit = page.locator(".practice-stream__question .choice-block__submit button");
      await expect(submit).toBeEnabled();
      const action = await submit.boundingBox();
      expect(action!.height).toBeGreaterThanOrEqual(44);
      expect(action!.y + action!.height).toBeLessThanOrEqual(height - (width < 768 ? 56 : 0));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    });

    test("V2 the last explanation is not replaced by celebration before I read it", async ({
      page,
    }) => {
      for (let question = 0; question < 3; question++) {
        const block = page.locator(".practice-stream__question .choice-block");
        const options = block.locator(".choice-block__option");
        for (let choice = 0; choice < (await options.count()); choice++) {
          await options.nth(choice).click();
          await block.locator(".choice-block__submit button").click();
          if (await block.locator(".choice-block__option--correct").count()) break;
        }
        await expect(page.locator("[data-practice-round-complete]")).toHaveCount(0);
        await expect(block).toContainText("答案解释");
        const reward = page.locator("[data-practice-reward]");
        await expect(reward).not.toHaveAttribute("open");
        if (question === 0) {
          await reward.locator("summary").click();
          await expect(reward).toHaveAttribute("open", "");
          await expect(reward.locator(".entry-page")).toBeVisible();
        }
        if (question < 2) {
          await block.getByRole("button", { name: /继续下一题/ }).click();
          await expect(page.locator("[data-practice-focus]")).toBeFocused();
          await expect(page.locator("[data-practice-reward]")).toHaveCount(0);
        } else {
          await block.getByRole("button", { name: "完成这一轮", exact: true }).click();
        }
      }
      const completed = page.locator("[data-practice-round-complete]");
      await expect(completed).toContainText("3 道题");
      await expect(page.locator("[data-practice-focus]")).toBeFocused();
      await expect(completed.locator("[data-practice-finish]")).toHaveClass(
        /game-ui-button--primary/,
      );
      await expect(page.locator(".practice-overview")).toHaveCount(0);
      expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
    });
  });
}

test("V3 named details have finger-sized targets and still support keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${ONLINE_ORIGIN}/settings`);
  const summaries = page.locator("main .product-details > summary");
  await expect(summaries.first()).toBeVisible();
  for (const summary of await summaries.all()) {
    expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const first = summaries.first();
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(first.locator("..")).toHaveAttribute("open", "");
  await page.keyboard.press("Space");
  await expect(first.locator("..")).not.toHaveAttribute("open");
});

test("V4 disabled answer labels stay readable in both themes, with real reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto(`${ONLINE_ORIGIN}/practice`);
    await page.locator("[data-practice-round]").click();
    const submit = page.locator(".practice-stream__question .choice-block__submit button");
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveText("提交");
    const paint = await submit.evaluate((element) => {
      const probe = document.createElement("span");
      probe.style.color = "var(--game-ui-text-muted)";
      element.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return {
        color: getComputedStyle(element).color,
        expected,
        background: getComputedStyle(element).backgroundColor,
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      };
    });
    expect(paint.reduced).toBe(true);
    expect(paint.color).toBe(paint.expected);
    expect(paint.background).not.toBe("rgba(0, 0, 0, 0)");
    await page.locator(".practice-stream__question .choice-block__option").first().click();
    await expect(submit).toBeEnabled();
    await expect(page.locator(".choice-block__submit .game-ui-liquid-surface__body")).toHaveCSS(
      "visibility",
      "visible",
      { timeout: 2000 },
    );
  }
});
