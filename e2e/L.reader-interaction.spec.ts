import { expect, test, type Page } from "@playwright/test";

import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { ONLINE_ORIGIN } from "./ports.js";

const LONG_LESSON = "/turing-pact/foundations-terrain/what-a-project-is/scripts-are-the-doors";

async function assertBottomExerciseIsReachable(page: Page, label: string): Promise<void> {
  const reader = page.locator("main.reader");
  const exercise = page.locator(".exercise-panel").first();
  const answer = exercise.getByRole("textbox", { name: "你的答案" });
  const submit = exercise.getByRole("button", { name: "提交" });

  await expect(reader).toBeVisible();
  await expect(exercise).toBeVisible();

  // Start from the actual bottom position where the sticky toolbar used to
  // cover the first exercise's controls.
  await reader.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect
    .poll(() =>
      reader.evaluate((node) => node.scrollTop >= node.scrollHeight - node.clientHeight - 1),
    )
    .toBe(true);

  // Every learner-facing target gets a safe landing zone, not just the lesson
  // completion button. These are real pointer clicks, so a toolbar overlay
  // still fails the test even if an element is present in the DOM.
  await answer.scrollIntoViewIfNeeded();
  await expect(answer).toBeVisible();
  await humanClick(page, answer, `${label}输入框`);
  await page.keyboard.type("verify");
  await humanClick(page, submit, `${label}提交按钮`);
}

async function runBottomExerciseJourney(page: Page, label: string): Promise<void> {
  const consoleErrors = watchConsole(page);
  await page.goto(`${ONLINE_ORIGIN}${LONG_LESSON}`, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "package.json 里的 scripts，到底是什么意思？" }),
  ).toBeVisible({
    timeout: 30_000,
  });
  await assertBottomExerciseIsReachable(page, label);
  consoleErrors.assertClean();
}

test.describe("L 长课底部的练习动作", () => {
  test.describe("桌面宽度", () => {
    test.use({ viewport: { width: 1280, height: 640 }, hasTouch: false });

    test("首道题的输入框和提交按钮都能点到", async ({ page }) => {
      await runBottomExerciseJourney(page, "桌面端长课");
    });
  });

  test.describe("手机宽度", () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: false });

    test("首道题的输入框和提交按钮都能点到", async ({ page }) => {
      await runBottomExerciseJourney(page, "手机端长课");
    });
  });
});
