import { expect, type Page } from "@playwright/test";
import { ONLINE_ORIGIN } from "../ports.js";

export const ACCOUNT_ORIGIN = process.env.ACCOUNT_FLOW_ORIGIN ?? ONLINE_ORIGIN;

export type AccountProof = {
  read(): {
    loginRequests: number;
    registrationRequests: number;
    codeRequests: number;
    resetRequests: number;
    passwordUpdates: number;
    lastAction: { type: string } | null;
    returnedTo: string | null;
    status: { kind: string; user?: { id: string } };
  };
  rejectLogin(): void;
  requireConfirmation(): void;
  emitMember(): void;
  emitSignOut(): void;
  clearCurrentUser(): void;
};

export function accountProof(
  page: Page,
): Promise<AccountProof["read"] extends () => infer R ? R : never> {
  return page.evaluate(() =>
    (
      window as unknown as { __ACCOUNT_FEEDBACK_PROOF__: AccountProof }
    ).__ACCOUNT_FEEDBACK_PROOF__.read(),
  );
}

export async function expectAccountFieldsContained(page: Page) {
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

export async function clickAccountSubmitSurface(page: Page) {
  const surface = page
    .locator('.account-panel .game-ui-button-liquid:has(button[type="submit"])')
    .last();
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

export function accountFixture(pathQuery: string): string {
  const prefix = pathQuery.startsWith("?") ? pathQuery : `?${pathQuery}`;
  return `${ACCOUNT_ORIGIN}/e2e-fixtures/account-feedback.html${prefix}`;
}
