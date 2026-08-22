import { test } from "@playwright/test";

import { watchConsole } from "./harness/console.js";
import { walkFirstOnlineLesson } from "./harness/online-learner.js";

test.describe("A 新学习者 · 在线端 · 手机宽度", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: false });

  test("清空 storage → 落地 → 第一节 → 结算 1/41", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    await walkFirstOnlineLesson(page);
    consoleErrors.assertClean();
  });
});
