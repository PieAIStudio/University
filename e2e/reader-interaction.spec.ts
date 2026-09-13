import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import {
  EXPERIENCE_ROUTES,
  EXPERIENCE_VIEWPORTS,
  getExperienceFixture,
  openExperienceRoute,
} from "./harness/experience.js";
import { ONLINE_ORIGIN } from "./ports.js";

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
  const fixture = await getExperienceFixture(page);
  const consoleErrors = watchConsole(page);
  await page.goto(`${ONLINE_ORIGIN}${fixture.lessonPath}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: fixture.lessonTitle })).toBeVisible({
    timeout: 30_000,
  });
  await assertBottomExerciseIsReachable(page, label);
  consoleErrors.assertClean();
}

async function runSourceEvidenceJourney(page: Page): Promise<void> {
  const fixture = await getExperienceFixture(page);
  const viewport = EXPERIENCE_VIEWPORTS[0]!;
  const route = EXPERIENCE_ROUTES.find((candidate) => candidate.id === "lesson")!;
  const evidenceRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/content\/.*\/evidence\/[a-f0-9]{64}\.json$/u.test(new URL(request.url()).pathname)) {
      evidenceRequests.push(request.url());
    }
  });

  await openExperienceRoute(page, route, viewport);
  await expect(page.getByRole("heading", { name: fixture.lessonTitle })).toBeVisible({
    timeout: 30_000,
  });

  // A source range is not part of the first render. It is a learner-initiated
  // resource, so the request must begin only after the real pointer opens it.
  const captureMode = process.env.EVIDENCE2_CAPTURE;
  await expect.poll(() => evidenceRequests.length).toBe(0);

  const trigger = page.locator(".evidence-inline-source__open:visible").first();
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await humanClick(page, trigger, "看完整文件");
  const dialog = page
    .locator('dialog:visible, [role="dialog"]:visible, [role="alertdialog"]:visible')
    .last();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.locator(".evidence-code")).toBeVisible();
  await expect(dialog.locator('[data-evidence-state="locator-only"]')).toHaveCount(0);
  expect(evidenceRequests, "源码请求必须在真实点击后发生").not.toHaveLength(0);

  if (captureMode) {
    const captureDir = resolve(".scratch/evidence2");
    mkdirSync(captureDir, { recursive: true });
    await page.screenshot({
      path: resolve(captureDir, `source-${captureMode}-desktop.png`),
      fullPage: false,
    });
  }
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

test.describe("L 源码证据发布闸门", () => {
  test.use({ viewport: { width: 1280, height: 640 }, hasTouch: false });

  test("真实打开一条引用后看到固定源码，且源码只在点击后加载", async ({ page }) => {
    await runSourceEvidenceJourney(page);
  });
});
