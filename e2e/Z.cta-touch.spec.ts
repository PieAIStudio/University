import { expect, test } from "@playwright/test";
import { ONLINE_ORIGIN } from "./ports.js";
import { FIRST_LESSON_ROUTE } from "./harness/online-learner.js";

for (const hasTouch of [false, true]) {
  test.describe(hasTouch ? "touch emulation" : "mouse at phone width", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch });
    test("lesson next-step keeps the 44px product touch floor without claiming completion", async ({
      page,
    }) => {
      await page.goto(`${ONLINE_ORIGIN}${FIRST_LESSON_ROUTE}`, { waitUntil: "domcontentloaded" });
      const next = page
        .locator('.lesson-next[data-state="unfinished"]')
        .getByRole("button", { name: "先去下一节", exact: true });
      await expect(next).toBeVisible();
      await next.scrollIntoViewIfNeeded();
      expect(
        await next.evaluate((button) => button.getBoundingClientRect().height),
        "unfinished footer touch target must be at least 44px",
      ).toBeGreaterThanOrEqual(44);
      await expect(page.locator(".settle")).toHaveCount(0);
      const previous = page.url();
      if (hasTouch) await next.tap();
      else await next.click();
      await expect(page).not.toHaveURL(previous);
    });
  });
}
