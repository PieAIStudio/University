import { test, expect } from "@playwright/test";
import { ONLINE_ORIGIN } from "./ports.js";

import { scrollIntoView } from "./harness/click.js";
const origin = process.env.ACCOUNT_FLOW_ORIGIN ?? ONLINE_ORIGIN;
for (const locale of ["en", "zh-CN"] as const) {
  test(`Z account deletion request ${locale}: reauthenticate, confirm, submit once, preserve account`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/e2e-fixtures/account-closure.html?lang=${locale}`);
    await page.locator("details > summary").first().click();
    await page
      .getByRole("button", {
        name: locale === "en" ? "Request account deletion" : "申请删除账号",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const auth = dialog.locator(".swimmer-auth");
    await auth.locator("input[type=email]").fill("synthetic@example.test");
    await auth.locator("input[type=password]").fill("synthetic-password12");
    await auth.locator("button[type=submit]").click();
    const confirm = dialog.locator("input[autocomplete=off]");
    const submit = dialog.locator("button[type=submit]");
    await expect(submit).toBeDisabled();
    await confirm.fill("REQUEST ACCOUNT DELETION");
    await expect(submit).toBeEnabled();
    await scrollIntoView(submit);
    const box = await submit.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width - 15, box!.y + box!.height / 2);
    await expect(submit).toBeDisabled();
    await expect
      .poll(() => page.evaluate(() => (window as any).__CLOSURE_PROOF__.snapshot().requestCount))
      .toBe(1);
    const proof = await page.evaluate(() => (window as any).__CLOSURE_PROOF__.snapshot());
    expect(proof.authRequests).toBe(1);
    expect(proof.lastArgs.p_expected_user_id).toBe("764fc275-4116-4b6a-a98b-b942234f4167");
    await page.evaluate(() => (window as any).__CLOSURE_PROOF__.release());
    await expect(dialog.getByRole("status")).toContainText(
      locale === "en" ? "have not been deleted" : "尚未删除",
    );
    expect(
      (await page.evaluate(() => (window as any).__CLOSURE_PROOF__.snapshot())).accountPresent,
    ).toBe(true);
    const rect = await dialog.boundingBox();
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(391);
    await page.screenshot({ path: info.outputPath(`account-request-${locale}.png`) });
  });
}

test("Z cancel account request never sends or erases data", async ({ page }) => {
  await page.goto(`${origin}/e2e-fixtures/account-closure.html?lang=en`);
  await page.locator("details > summary").first().click();
  await page.getByRole("button", { name: "Request account deletion", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__CLOSURE_PROOF__.snapshot())).toMatchObject({
    authRequests: 0,
    requestCount: 0,
    accountPresent: true,
  });
});
