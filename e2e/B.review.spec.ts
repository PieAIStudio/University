import { expect, test } from "@playwright/test";

import { ONLINE_ORIGIN } from "./ports.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { makeDroppedCardsDue, walkFirstOnlineLesson } from "./harness/online-learner.js";
import { namedStep } from "./harness/step.js";
import { assertVisibleText } from "./harness/assert.js";

// The shared card's four ratings. FSRS reads them as "how hard was the recall".
const GRADES = ["重来", "困难", "良好", "简单"] as const;

test.describe("B 同一个人回来复习", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("#/review → 写下答案 → 揭示 → 四档评分 → 空态", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    await walkFirstOnlineLesson(page);

    let dropped = 0;
    await namedStep(page, "把掉落的卡片改成已到期（模拟第二天回来）", async () => {
      dropped = await makeDroppedCardsDue(page);
      expect(dropped).toBeGreaterThan(0);
    });

    /*
      One review card, both shells. This used to walk the delivery shell's own
      `ReviewHost` — a bar reading 「还剩 N 张」 and a 「显示答案」 button that
      showed the answer straight away. The shared card asks you to write your
      answer first and only then reveals, which is the whole point of a
      retrieval card: an answer you recognise is not an answer you recalled.
      The old screen is gone, so the old script tested nothing.
    */
    await namedStep(page, "打开 #/review", async () => {
      await page.goto(`${ONLINE_ORIGIN}/#/review`, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".review-card")).toBeVisible({ timeout: 30_000 });
    });

    await namedStep(page, "写下答案才能揭示，然后四档都在", async () => {
      const reveal = page.getByRole("button", { name: /揭示答案/ });
      await expect(reveal).toBeDisabled();
      await page.getByPlaceholder(/先写下自己的答案/).fill("先自己回忆一遍");
      // 375×812: the card is taller than the viewport, so the button a learner
      // would scroll to is a button the pointer cannot reach where it stands.
      await reveal.scrollIntoViewIfNeeded();
      await humanClick(page, reveal, "揭示答案");
      for (const grade of GRADES) {
        await expect(page.getByRole("button", { name: grade })).toBeVisible({ timeout: 20_000 });
      }
      const good = page.getByRole("button", { name: "良好" });
      await good.scrollIntoViewIfNeeded();
      await humanClick(page, good, "良好");
    });

    await namedStep(page, "把剩下的卡片评完", async () => {
      /*
        Rate, wait for the box to come back, rate again. The textarea is
        disabled while a card is revealed or just rated, so "the box accepts
        typing" is the honest signal that the next card has arrived — polling
        the button would type into the previous card's receipt.
      */
      const box = page.getByPlaceholder(/先写下自己的答案/);
      const empty = page.getByText("今天没有到期卡片");
      const guard = Date.now() + 90_000;
      while (Date.now() < guard) {
        if (await empty.isVisible().catch(() => false)) return;
        if (!(await box.isEnabled().catch(() => false))) {
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.waitForTimeout(1200);
          continue;
        }
        await box.fill("先自己回忆一遍");
        const next = page.getByRole("button", { name: /揭示答案/ });
        await next.scrollIntoViewIfNeeded();
        await humanClick(page, next, "揭示答案");
        const easy = page.getByRole("button", { name: "简单" });
        await easy.scrollIntoViewIfNeeded();
        await humanClick(page, easy, "简单");
        await page.waitForTimeout(400);
      }
      throw new Error("复习队列没有清空");
    });

    await namedStep(page, "复习完的空态", async () => {
      await assertVisibleText(page, "今天没有到期卡片");
    });

    consoleErrors.assertClean();
  });
});
