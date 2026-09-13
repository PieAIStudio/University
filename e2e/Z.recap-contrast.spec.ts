import { expect, test } from "@playwright/test";
import { ONLINE_ORIGIN } from "./ports.js";
import { walkFirstOnlineLesson } from "./harness/online-learner.js";
for (const theme of ["浅色", "深色"])
  test(`settlement explanatory text follows readable theme ink: ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${ONLINE_ORIGIN}/settings`);
    await page.getByRole("button", { name: theme, exact: true }).click();
    await walkFirstOnlineLesson(page);
    for (const selector of [
      ".recap-prompt__instruction",
      ".recap-prompt__objective p:last-child",
    ]) {
      const text = page.locator(selector);
      await expect(text).toBeVisible();
      const ink = await text.evaluate((element) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--game-ui-text)";
        element.append(probe);
        const expected = getComputedStyle(probe).color;
        probe.remove();
        return { actual: getComputedStyle(element).color, expected, text: element.textContent };
      });
      expect(ink.text?.trim().length).toBeGreaterThan(0);
      expect(
        ink.actual,
        `${theme} settlement body copy must use the readable theme text token`,
      ).toBe(ink.expected);
    }
  });
