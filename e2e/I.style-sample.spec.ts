import { expect, test } from "@playwright/test";

import { watchConsole } from "./harness/console.js";
import { ONLINE_ORIGIN } from "./ports.js";

/**
 * Each style entry has to show its own style, and say so in Chinese.
 *
 * Both halves were broken and neither showed up in a unit test or a rendered
 * contact sheet. The compare toggle kept its state across a route change, so
 * flipping 苹果风 to 新粗野 and then opening the next entry rendered 新粗野
 * under someone else's heading. And the switch labelled its buttons from a
 * two-entry map in the renderer, falling back to the raw id — so 22 of the 24
 * skins offered 「wabisabi」 and 「dark-tech」 to a Chinese-reading beginner.
 *
 * Walking more than one entry in one page session is the whole point: a test
 * that opens a single entry passes with the state bug still in place.
 */
const CASES: readonly (readonly [string, string, string, string])[] = [
  ["style-y2k", "y2k", "saas", "SaaS 产品官网"],
  ["style-wabisabi", "wabisabi", "commerce", "DTC 品牌电商"],
  ["style-bauhaus", "bauhaus", "dark-tech", "深色界面"],
  ["style-terminal", "terminal", "neumorphism", "新拟态"],
];

test.describe("I 风格样例 · 在线端", () => {
  test("走过多条风格词条，每页都是自己的皮肤，按钮说中文", async ({ page }) => {
    test.setTimeout(180_000);
    const consoleErrors = watchConsole(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const [id, skin, contrast, contrastLabel] of CASES) {
      await page.goto(`${ONLINE_ORIGIN}/concepts/${id}`, { waitUntil: "domcontentloaded" });
      const frame = page.locator(".stylesample__frame");
      await expect(frame, id).toBeVisible({ timeout: 60_000 });
      await expect(frame, id).toHaveClass(new RegExp(`stylesample--${skin}(\\s|$)`));

      const buttons = page.locator(".stylesample__switch-button");
      await expect(buttons).toHaveCount(2);
      await expect(buttons.nth(1), `${id} contrast label`).toHaveText(contrastLabel);

      await buttons.nth(1).click();
      await expect(frame, `${id} after switching`).toHaveClass(
        new RegExp(`stylesample--${contrast}(\\s|$)`),
      );
    }

    consoleErrors.assertClean();
  });
});
