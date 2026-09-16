import { expect, test, type Page } from "@playwright/test";
import {
  ACCOUNT_ORIGIN,
  accountProof,
  clickAccountSubmitSurface,
  expectAccountFieldsContained,
  type AccountProof,
} from "./harness/account-kit.js";

async function openPanel(page: Page) {
  const panel = page.locator(".account-panel");
  const summary = panel.locator(".account-panel__form > summary");
  if (await summary.count()) await summary.click();
  return panel;
}

test("Z en+desktop: sign-up, code entry, recovery and return-to-lesson", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${ACCOUNT_ORIGIN}/e2e-fixtures/account-feedback.html?lang=en&scenario=register`);
  const panel = await openPanel(page);
  await panel
    .locator(".swimmer-auth__modes")
    .getByRole("button", { name: /Register/ })
    .click();
  await expect(panel).toContainText(/at least 8 characters/i);
  await panel.locator('input[type="email"]').fill("new-learner@example.test");
  await panel.locator('input[type="password"]').fill("synthetic-password12");
  await clickAccountSubmitSurface(page);
  await page.evaluate(() =>
    (
      window as unknown as { __ACCOUNT_FEEDBACK_PROOF__: AccountProof }
    ).__ACCOUNT_FEEDBACK_PROOF__.requireConfirmation(),
  );
  await expect(panel).toContainText(/confirmation email/i);
  await expectAccountFieldsContained(page);
  await page.screenshot({ path: info.outputPath("desktop-register.png"), fullPage: true });
});

test("Z email code: failure first, then success, and the code is not retained", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${ACCOUNT_ORIGIN}/e2e-fixtures/account-feedback.html?lang=en&scenario=code`);
  const panel = await openPanel(page);
  await panel
    .locator(".swimmer-auth__modes")
    .getByRole("button", { name: /Email code/ })
    .click();
  await expect(panel.locator('input[type="password"]')).toHaveCount(0);
  await panel.locator('input[type="email"]').fill("learner@example.test");
  await clickAccountSubmitSurface(page);
  await expect(panel).toContainText(/Email request accepted/i);
  const before = await accountProof(page);
  expect(before.codeRequests).toBe(1);
  await panel.getByRole("button", { name: /Enter code/ }).click();
  await panel.locator('input[autocomplete="one-time-code"]').fill("000000");
  await clickAccountSubmitSurface(page);
  await expect(panel).toContainText(/unavailable|invalid/i);
  await expect(panel).not.toContainText("synthetic-private-provider-body");
  await expect(panel.locator('input[autocomplete="one-time-code"]')).toHaveValue("");
  await panel.locator('input[autocomplete="one-time-code"]').fill("123456");
  await clickAccountSubmitSurface(page);
  await expect(panel.locator(".account-panel__signed-in")).toContainText("learner@example.test");
  expect(page.url()).not.toContain("123456");
  expect(await page.content()).not.toContain("123456");
  const after = await accountProof(page);
  expect(after.status).toMatchObject({ kind: "signed_in", user: { id: "synthetic-member" } });
  await page.screenshot({ path: info.outputPath("code-success.png"), fullPage: true });
});

test("Z password recovery request is distinct from a signed-in change", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${ACCOUNT_ORIGIN}/e2e-fixtures/account-feedback.html?lang=zh-CN&scenario=reset`);
  const panel = await openPanel(page);
  await panel.getByRole("button", { name: "找回密码" }).click();
  await expect(panel.locator('input[type="password"]')).toHaveCount(0);
  await panel.locator('input[type="email"]').fill("learner@example.test");
  await clickAccountSubmitSurface(page);
  await expect(panel).toContainText("邮件请求已提交");
  const requested = await accountProof(page);
  expect(requested.resetRequests).toBe(1);
  expect(requested.lastAction).toEqual({ type: "request-reset" });
  await page.screenshot({ path: info.outputPath("zh-recovery-request.png"), fullPage: true });

  await page.goto(
    `${ACCOUNT_ORIGIN}/e2e-fixtures/account-feedback.html?lang=en&scenario=reset-ready`,
  );
  const reset = page.locator(".account-panel");
  await expect(reset.locator('input[autocomplete="new-password"]')).toHaveCount(2);
  await expect(reset.locator('input[autocomplete="current-password"]')).toHaveCount(0);
  await reset.locator('input[autocomplete="new-password"]').nth(0).fill("new-password12");
  await reset.locator('input[autocomplete="new-password"]').nth(1).fill("new-password12");
  await clickAccountSubmitSurface(page);
  const updated = await accountProof(page);
  expect(updated.passwordUpdates).toBe(1);
  expect(updated.lastAction).toEqual({ type: "update-password" });
  await page.screenshot({ path: info.outputPath("recovery-update.png"), fullPage: true });
});

test("Z callback: invalid session stays retryable; verified user returns to the lesson", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `${ACCOUNT_ORIGIN}/e2e-fixtures/account-feedback.html?lang=en&scenario=callback-invalid&code=not-authorization`,
  );
  const invalid = page.locator(".account-panel");
  await expect(invalid).toContainText(/invalid or has expired/i);
  await expect(invalid.locator(".swimmer-auth")).toBeVisible();
  await expect(invalid.getByRole("button", { name: /Continue learning/ })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("callback-invalid.png"), fullPage: true });

  await page.goto(`${ACCOUNT_ORIGIN}/e2e-fixtures/account-feedback.html?lang=en&scenario=callback`);
  const valid = page.locator(".account-panel");
  await expect(valid.getByRole("button", { name: /Continue learning/ })).toBeVisible();
  await valid.getByRole("button", { name: /Continue learning/ }).click();
  await expect
    .poll(async () => page.locator("main").getAttribute("data-returned-to"))
    .toBe("/ai-literacy/understanding-ai/first-useful-step/ask-about-a-picture");
  await page.screenshot({ path: info.outputPath("callback-valid.png"), fullPage: true });
});

test("Z reset query flags grant no password form; logout clears a ready recovery", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `${ACCOUNT_ORIGIN}/e2e-fixtures/account-feedback.html?lang=en&scenario=reset-check&type=recovery`,
  );
  const panel = page.locator(".account-panel");
  await expect(panel).toContainText(/invalid or has expired/i);
  await expect(panel.locator('input[autocomplete="new-password"]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("reset-query-only.png"), fullPage: true });

  await page.goto(
    `${ACCOUNT_ORIGIN}/e2e-fixtures/account-feedback.html?lang=en&scenario=reset-ready`,
  );
  await expect(page.locator('input[autocomplete="new-password"]')).toHaveCount(2);
  await page.evaluate(() =>
    (
      window as unknown as { __ACCOUNT_FEEDBACK_PROOF__: AccountProof }
    ).__ACCOUNT_FEEDBACK_PROOF__.emitSignOut(),
  );
  await expect(page.locator('input[autocomplete="new-password"]')).toHaveCount(0);
  await expect(page.locator(".account-panel")).toContainText(/invalid or has expired/i);
});

test("Z successful login offers the stored lesson, not an auth parameter", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${ACCOUNT_ORIGIN}/e2e-fixtures/account-feedback.html?lang=en&scenario=return`);
  const panel = await openPanel(page);
  await panel.locator('input[type="email"]').fill("learner@example.test");
  await panel.locator('input[type="password"]').fill("synthetic-password12");
  await clickAccountSubmitSurface(page);
  await page.evaluate(() =>
    (
      window as unknown as { __ACCOUNT_FEEDBACK_PROOF__: AccountProof }
    ).__ACCOUNT_FEEDBACK_PROOF__.rejectLogin(),
  );
  await panel.locator('input[type="password"]').fill("synthetic-password12");
  await clickAccountSubmitSurface(page);
  await expect(panel.locator(".account-panel__signed-in")).toContainText("learner@example.test");
  await expect(panel.getByRole("button", { name: /Continue learning/ })).toBeVisible();
  await panel.getByRole("button", { name: /Continue learning/ }).click();
  await expect
    .poll(async () => page.locator("main").getAttribute("data-returned-to"))
    .toBe("/ai-literacy/understanding-ai/first-useful-step/ask-about-a-picture");
  expect(page.url()).not.toMatch(/access_token|code=|password/);
  await page.screenshot({ path: info.outputPath("return-to-lesson.png"), fullPage: true });
});

test("Z controlled double click does not duplicate an email request", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${ACCOUNT_ORIGIN}/e2e-fixtures/account-feedback.html?lang=en&scenario=code`);
  const panel = await openPanel(page);
  await panel
    .locator(".swimmer-auth__modes")
    .getByRole("button", { name: /Email code/ })
    .click();
  await panel.locator('input[type="email"]').fill("learner@example.test");
  const submit = panel.locator('button[type="submit"]');
  await submit.click({ clickCount: 2 });
  const proof = await accountProof(page);
  expect(proof.codeRequests).toBe(1);
});
