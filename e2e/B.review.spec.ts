import { expect, test } from "@playwright/test";

import { ONLINE_ORIGIN } from "./ports.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { makeDroppedCardsDue, walkFirstOnlineLesson } from "./harness/online-learner.js";
import { namedStep } from "./harness/step.js";
import { assertVisibleText } from "./harness/assert.js";

const GRADES = ["没想起来", "有点吃力", "想起来了", "很轻松"] as const;

test.describe("B 同一个人回来复习", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("#/review → 显示答案 → 四档评分 → 空态", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    await walkFirstOnlineLesson(page);

    let dropped = 0;
    await namedStep(page, "把掉落的卡片改成已到期（模拟第二天回来）", async () => {
      dropped = await makeDroppedCardsDue(page);
      expect(dropped).toBeGreaterThan(0);
    });

    await namedStep(page, "打开 #/review", async () => {
      await page.goto(`${ONLINE_ORIGIN}/#/review`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(/还剩 \d+ 张/)).toBeVisible({ timeout: 30_000 });
    });

    const remaining = () => page.locator(".review__bar").getByText(/还剩 \d+ 张/);

    await namedStep(page, "有到期卡片，显示答案，四档都在", async () => {
      const before = await remaining().innerText();
      await humanClick(page, page.getByRole("button", { name: "显示答案" }), "显示答案");
      for (const grade of GRADES) {
        await expect(page.getByRole("button", { name: grade })).toBeVisible();
      }
      await humanClick(page, page.getByRole("button", { name: "想起来了" }), "想起来了");
      await expect(async () => {
        if (await page.getByText("今天没有到期卡片").isVisible().catch(() => false)) return;
        const now = await remaining().innerText();
        expect(now).not.toBe(before);
      }).toPass({ timeout: 10_000 });
    });

    await namedStep(page, "把剩下的卡片评完", async () => {
      const guard = Date.now() + 60_000;
      while (Date.now() < guard) {
        if (await page.getByText("今天没有到期卡片").isVisible().catch(() => false)) return;
        if (await page.getByRole("button", { name: "显示答案" }).isVisible().catch(() => false)) {
          await humanClick(page, page.getByRole("button", { name: "显示答案" }), "显示答案");
          await humanClick(page, page.getByRole("button", { name: "很轻松" }), "很轻松");
          continue;
        }
        await page.waitForTimeout(200);
      }
      throw new Error("复习队列没有清空");
    });

    await namedStep(page, "复习完的空态", async () => {
      await assertVisibleText(page, "今天没有到期卡片");
      await expect(page.getByRole("button", { name: "回到地图" })).toBeVisible();
    });

    consoleErrors.assertClean();
  });
});
