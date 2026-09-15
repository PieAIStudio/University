import { expect, test, type Page } from "@playwright/test";
import { ONLINE_ORIGIN } from "./ports.js";

type AccountProof = {
  read(): {
    loginRequests: number;
    registrationRequests: number;
    status: { kind: string; user?: { id: string } };
  };
  rejectLogin(): void;
  requireConfirmation(): void;
};

async function expectAccountFieldsContained(page: Page) {
  const result = await page.locator(".account-panel").evaluate((panel) => {
    const bounds = panel.getBoundingClientRect();
    return [...panel.querySelectorAll<HTMLInputElement>("input")].map((input) => {
      const box = input.getBoundingClientRect();
      return {
        type: input.type,
        left: box.left,
        right: box.right,
        panelLeft: bounds.left,
        panelRight: bounds.right,
        viewport: innerWidth,
      };
    });
  });
  expect(result.length).toBeGreaterThan(0);
  for (const field of result) {
    expect(field.left, `${field.type} left edge`).toBeGreaterThanOrEqual(field.panelLeft - 1);
    expect(field.right, `${field.type} right edge`).toBeLessThanOrEqual(field.panelRight + 1);
    expect(field.right, `${field.type} viewport edge`).toBeLessThanOrEqual(field.viewport + 1);
  }
}

async function clickAccountSubmitSurface(page: Page) {
  const surface = page.locator(
    '.account-panel__form .game-ui-button-liquid:has(button[type="submit"])',
  );
  const native = surface.locator('button[type="submit"]');
  await expect(native).toBeEnabled();
  await surface.scrollIntoViewIfNeeded();
  const geometry = await surface.evaluate((element) => {
    const button = element.querySelector('button[type="submit"]')!;
    const outer = element.getBoundingClientRect();
    const hit = button.getBoundingClientRect();
    const x = outer.right - 20;
    const y = outer.top + outer.height / 2;
    return {
      visibleWidth: outer.width,
      nativeWidth: hit.width,
      x,
      y,
      hits: button.contains(document.elementFromPoint(x, y)),
    };
  });
  expect(
    Math.abs(geometry.visibleWidth - geometry.nativeWidth),
    "the visible account button is its native hit area",
  ).toBeLessThan(2);
  expect(geometry.hits, "the visible far-right surface really hits the submit button").toBe(true);
  await page.mouse.click(geometry.x, geometry.y);
}

for (const locale of ["en", "zh-CN"] as const) {
  test(`Z ${locale}: pending guest login keeps its form, reports failure and permits one retry`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${ONLINE_ORIGIN}/e2e-fixtures/account-feedback.html?lang=${locale}`);
    const panel = page.locator(".account-panel");
    await panel.locator("summary").click();
    await panel.locator('input[type="email"]').fill("learner@example.test");
    await panel.locator('input[type="password"]').fill("synthetic-password12");
    await clickAccountSubmitSurface(page);
    await expect(panel).toHaveAttribute("aria-busy", "true");
    await expect(panel.locator("form")).toBeVisible();
    await expect(panel.locator('input[type="email"]')).toHaveValue("learner@example.test");
    await expect(panel.locator('input[type="email"]')).toBeDisabled();
    await expect(panel.locator('button[type="submit"]')).toBeDisabled();
    for (const tab of await panel.getByRole("tab").all()) await expect(tab).toBeDisabled();
    await expectAccountFieldsContained(page);
    await page.screenshot({ path: info.outputPath("pending.png"), fullPage: true });
    await page.evaluate(() =>
      (
        window as unknown as { __ACCOUNT_FEEDBACK_PROOF__: AccountProof }
      ).__ACCOUNT_FEEDBACK_PROOF__.rejectLogin(),
    );
    await expect(panel).toHaveAttribute("aria-busy", "false");
    await expect(panel).toContainText(locale === "en" ? "Sign-in did not finish" : "登录没有完成");
    await expect(panel).not.toContainText("synthetic-private-provider-body");
    await expect(panel.locator('input[type="password"]')).toHaveValue("");
    const before = await page.evaluate(() =>
      (
        window as unknown as { __ACCOUNT_FEEDBACK_PROOF__: AccountProof }
      ).__ACCOUNT_FEEDBACK_PROOF__.read(),
    );
    expect(before).toMatchObject({
      loginRequests: 1,
      status: { kind: "anonymous", user: { id: "synthetic-guest" } },
    });
    await expectAccountFieldsContained(page);
    await page.screenshot({ path: info.outputPath("failure.png"), fullPage: true });
    await panel.locator('input[type="password"]').fill("synthetic-password12");
    await clickAccountSubmitSurface(page);
    await expect(panel.locator(".account-panel__signed-in")).toContainText("learner@example.test");
    const after = await page.evaluate(() =>
      (
        window as unknown as { __ACCOUNT_FEEDBACK_PROOF__: AccountProof }
      ).__ACCOUNT_FEEDBACK_PROOF__.read(),
    );
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
  await page.goto(`${ONLINE_ORIGIN}/e2e-fixtures/account-feedback.html?lang=en&scenario=register`);
  const panel = page.locator(".account-panel");
  await panel.locator("summary").click();
  await panel.getByRole("tab").nth(1).click();
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
  await expect(panel.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
  await expectAccountFieldsContained(page);
  await page.screenshot({ path: info.outputPath("confirmation.png"), fullPage: true });
});
