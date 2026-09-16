import { expect, test } from "@playwright/test";
import {
  ACCOUNT_ORIGIN,
  accountFixture,
  accountProof,
  clickAccountSubmitSurface,
  expectAccountFieldsContained,
  type AccountProof,
} from "./harness/account-kit.js";

for (const locale of ["en", "zh-CN"] as const) {
  test(`Z ${locale}: pending guest login keeps its form, reports failure and permits one retry`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(accountFixture(`lang=${locale}`));
    const panel = page.locator(".account-panel");
    await panel.locator(".account-panel__form > summary").click();
    await panel.locator('input[type="email"]').fill("learner@example.test");
    await panel.locator('input[type="password"]').fill("synthetic-password12");
    await clickAccountSubmitSurface(page);
    await expect(panel).toHaveAttribute("aria-busy", "true");
    await expect(panel.locator("form")).toBeVisible();
    await expect(panel.locator('input[type="email"]')).toHaveValue("learner@example.test");
    await expect(panel.locator('input[type="email"]')).toBeDisabled();
    await expect(panel.locator('button[type="submit"]')).toBeDisabled();
    for (const mode of await panel.locator(".swimmer-auth__modes button").all()) {
      await expect(mode).toBeDisabled();
    }
    await expectAccountFieldsContained(page);
    await page.screenshot({ path: info.outputPath("pending.png"), fullPage: true });
    await page.evaluate(() =>
      (
        window as unknown as { __ACCOUNT_FEEDBACK_PROOF__: AccountProof }
      ).__ACCOUNT_FEEDBACK_PROOF__.rejectLogin(),
    );
    await expect(panel).toHaveAttribute("aria-busy", "false");
    await expect(panel).toContainText(
      locale === "en" ? /unavailable|did not finish/i : /暂时不可用|登录没有完成/,
    );
    await expect(panel).not.toContainText("synthetic-private-provider-body");
    await expect(panel.locator('input[type="password"]')).toHaveValue("");
    const before = await accountProof(page);
    expect(before).toMatchObject({
      loginRequests: 1,
      status: { kind: "anonymous", user: { id: "synthetic-guest" } },
    });
    await expectAccountFieldsContained(page);
    await page.screenshot({ path: info.outputPath("failure.png"), fullPage: true });
    await panel.locator('input[type="password"]').fill("synthetic-password12");
    await clickAccountSubmitSurface(page);
    await expect(panel.locator(".account-panel__signed-in")).toContainText("learner@example.test");
    const after = await accountProof(page);
    expect(after).toMatchObject({
      loginRequests: 2,
      status: { kind: "signed_in", user: { id: "synthetic-member" } },
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  });
}

test("Z registration retains its confirmation instead of remounting an empty login form", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${ACCOUNT_ORIGIN}/e2e-fixtures/account-feedback.html?lang=en&scenario=register`);
  const panel = page.locator(".account-panel");
  await panel.locator(".account-panel__form > summary").click();
  await panel
    .locator(".swimmer-auth__modes")
    .getByRole("button", { name: /Register|注册/ })
    .click();
  await panel.locator('input[type="email"]').fill("new-learner@example.test");
  await panel.locator('input[type="password"]').fill("synthetic-password12");
  await clickAccountSubmitSurface(page);
  await expect(panel.locator("form")).toBeVisible();
  await expect(panel.locator('button[type="submit"]')).toBeDisabled();
  await page.evaluate(() =>
    (
      window as unknown as { __ACCOUNT_FEEDBACK_PROOF__: AccountProof }
    ).__ACCOUNT_FEEDBACK_PROOF__.requireConfirmation(),
  );
  await expect(panel).toContainText(/confirm|confirmation/i);
  await expect(panel.locator('input[type="email"]')).toHaveValue("new-learner@example.test");
  await expect(panel.locator('input[type="password"]')).toHaveValue("");
  await expect(
    panel.locator(".swimmer-auth__modes").getByRole("button", { name: /Register|注册/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expectAccountFieldsContained(page);
  await page.screenshot({ path: info.outputPath("confirmation.png"), fullPage: true });
});
