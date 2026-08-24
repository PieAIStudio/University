import { expect, test, type Locator, type Page } from "@playwright/test";

import { LOCAL_ORIGIN } from "./ports.js";
import { assertImagesStayInViewport, assertVisibleText } from "./harness/assert.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { namedStep } from "./harness/step.js";

/**
 * The authoring shell is being rewritten in another worktree. Assertions
 * follow what this checkout actually renders, not a frozen mockup.
 */
async function firstVisible(page: Page, locators: Locator[]): Promise<Locator> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    for (const locator of locators) {
      if (await locator.first().isVisible().catch(() => false)) return locator.first();
    }
    await page.waitForTimeout(200);
  }
  throw new Error("落地页上看不到「开始学习 / 继续学习」");
}

test.describe("D 本地端", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("落地 → 进一节课 → 课文末尾有完成本次更新和练习", async ({ page }) => {
    const consoleErrors = watchConsole(page);

    await namedStep(page, "打开本地端落地页", async () => {
      await page.goto(`${LOCAL_ORIGIN}/`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("第一项学习还没有准备好。")).toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByText(/正在打开校园档案/)).toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByRole("button", { name: /开始学习|继续学习/ }).first()).toBeVisible({
        timeout: 30_000,
      });
      await page.waitForTimeout(600);
    });

    await namedStep(page, "进一节课", async () => {
      const start = await firstVisible(page, [
                page.locator(".campus-main").getByRole("button", { name: /开始学习/ }),
        page.getByRole("button", { name: /开始学习/ }),
        page.getByRole("button", { name: /继续学习/ }),
      ]);
      await humanClick(page, start, (await start.innerText()).trim());
    });

    await namedStep(page, "课文渲染出来", async () => {
      await expect(page.getByRole("article")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("heading").first()).toBeVisible();
      await assertImagesStayInViewport(page);
    });

    await namedStep(page, "滚到末尾：完成本次更新和练习", async () => {
      const confirm = page.getByRole("button", { name: /完成本次更新|再次确认本次更新/ });
      await confirm.scrollIntoViewIfNeeded();
      await expect(confirm).toBeVisible({ timeout: 20_000 });
      const exercise = page.locator("section.lesson-completion, .exercise-panel, .choice-block");
      await exercise.first().scrollIntoViewIfNeeded();
      await expect(exercise.first()).toBeVisible();
      await assertVisibleText(page, /完成本次更新|再次确认本次更新/);
    });

    consoleErrors.assertClean();
  });
});
