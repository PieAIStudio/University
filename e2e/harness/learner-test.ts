import { expect, test as base } from "@playwright/test";

/**
 * Ordinary route tests describe a returning learner. V7 still requires a real
 * launch tap on the web, including reloads: this fixture presses the actual
 * ready-only button when a launch screen blocks their next action. It never
 * removes DOM, changes readiness, seeds learning progress or skips loading.
 * The dedicated first-arrival specs use Playwright's base test and exercise
 * every launch/welcome decision themselves, without this handler.
 */
export const test = base.extend<{
  /**
   * 涟's first-use guides appear the first time a game or a kind of lesson
   * step is met, which is every time in a fresh browser. A spec about
   * something else has them skipped as soon as one would be in the way; a spec
   * about the guides says `test.use({ firstUseGuides: "show" })`.
   */
  firstUseGuides: "skip" | "show";
}>({
  firstUseGuides: ["skip", { option: true }],
  page: async ({ page, firstUseGuides }, use) => {
    // One handler, not two: Playwright checks every handler before every
    // action, and a second check shifted the serial timing lane enough to
    // turn map-studio-3d's no-remount window red. The locator matches either
    // blocker; the body tells them apart.
    const guide = page.getByTestId("first-use");
    const splash = page.locator(".game-ui-splash--opening");
    const blocker = firstUseGuides === "skip" ? splash.or(guide) : splash;
    await page.addLocatorHandler(blocker, async () => {
      if (firstUseGuides === "skip" && (await guide.isVisible())) {
        // The skip button rides in 涟's bubble, which only shows once the
        // droplet has flown to its target; under load that outlasts a click's
        // wait. Its own click handler is the learner's skip, recorded as usual.
        await page.getByTestId("first-use-skip").dispatchEvent("click");
        return;
      }
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
