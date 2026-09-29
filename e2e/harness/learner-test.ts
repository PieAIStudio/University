import { expect, test as base } from "@playwright/test";

/**
 * Ordinary route tests describe a returning learner. V7 still requires a real
 * launch tap on the web, including reloads: this fixture presses the actual
 * ready-only button when a launch screen blocks their next action. It never
 * removes DOM, changes readiness, seeds learning progress or skips loading.
 * The dedicated first-arrival specs use Playwright's base test and exercise
 * every launch/welcome decision themselves, without this handler.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addLocatorHandler(page.locator(".game-ui-splash--opening"), async (splash) => {
      await page.waitForFunction(
        () => {
          const current = document.querySelector(".game-ui-splash--opening");
          // Recovery is a different, tested path, not permission to fake readiness.
          return current === null || current.getAttribute("data-splash-ready") === "true";
        },
        undefined,
        // A recovery test deliberately freezes rAF. Its DOM timeout must
        // still be observed without waiting for the broken frame scheduler.
        { timeout: 90_000, polling: 100 },
      );
      if (await splash.count()) await splash.getByRole("button").click();
    });
    await use(page);
  },
});
export { expect };
export type { Page, Locator, BrowserContext, TestInfo, Route } from "@playwright/test";
