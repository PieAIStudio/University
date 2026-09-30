import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "./harness/learner-test.js";
import { humanClick } from "./harness/click.js";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";
import { interfaceI18n } from "../packages/ui/src/i18n/core.js";

const SHOTS = join(process.cwd(), "SCRATCH/e2e/before-charging");

for (const locale of ["zh-CN", "en"] as const) {
  test(`synthetic management ${locale}: the actual two entries, one request and account-safe response`, async ({
    page,
  }) => {
    mkdirSync(SHOTS, { recursive: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${ONLINE_ORIGIN}/e2e-fixtures/subscription-management.html?lang=${locale}`);
    await expect(page.locator("[data-synthetic-subscription]")).toBeVisible();
    await humanClick(
      page,
      page.locator('[data-me-door="membership"]'),
      "the real Me membership entry",
    );
    const management = page.locator("[data-subscription-management]");
    await expect(management).toBeEnabled();
    await humanClick(page, management, "open subscription management, not cancel automatically");
    await expect(management).toBeDisabled();
    expect(await page.evaluate(() => (window as any).__subscriptionFixture.requests())).toBe(1);
    await page.evaluate(() => (window as any).__subscriptionFixture.complete());
    const portal = page.locator('a[href="https://payments.example.test/synthetic-account"]');
    await expect(portal).toBeVisible();
    await expect(management).toBeEnabled();
    await expect(portal).toHaveAttribute("target", "_blank");
    await page.screenshot({ path: join(SHOTS, `synthetic-${locale}-portal.png`), fullPage: true });
    await humanClick(page, management, "start another explicit management request");
    await expect(management).toBeDisabled();
    await page.evaluate(() => (window as any).__subscriptionFixture.leave());
    await expect(management).toHaveCount(0);
    await page.evaluate(() => (window as any).__subscriptionFixture.complete());
    await expect(portal).toHaveCount(0);
    await expect(page.locator("[data-current-membership]")).toHaveCount(0);
  });
}

for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  for (const locale of ["zh-CN", "en"] as const) {
    test(`V7 before charging ${mode} ${locale}: real help routes and honest management`, async ({
      page,
    }) => {
      mkdirSync(SHOTS, { recursive: true });
      const t = interfaceI18n.translator(locale);
      await page.setViewportSize({ width: 320, height: 740 });
      await page.goto(`${origin}/me?lang=${locale}`);
      await humanClick(page, page.locator('[data-me-door="about"]'), "open About from Me");
      await expect(page.locator('[data-support-page="about"]')).toBeVisible();
      for (const policy of ["privacy", "terms", "refunds"]) {
        await humanClick(
          page,
          page.locator(`[data-policy-link="${policy}"]`),
          "read the actual policy publication state",
        );
        await expect(page.locator('[data-policy-status="unpublished"]')).toBeVisible();
        await expect(page.locator("h1")).toHaveText(
          t.t(`support.${policy as "privacy" | "terms" | "refunds"}.title`),
        );
        await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
        await page.reload();
        await expect(page.locator(`[data-support-page="${policy}"]`)).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          321,
        );
        if (policy === "refunds")
          await page.screenshot({
            path: join(SHOTS, `${mode}-${locale}-refunds.png`),
            fullPage: true,
          });
        await humanClick(
          page,
          page.locator(`.support-screen a[href="/about?lang=${locale}"]`),
          "return to About",
        );
      }
      await humanClick(
        page,
        page.locator(`.support-screen a[href="/me?lang=${locale}"]`),
        "return to Me",
      );
      await humanClick(
        page,
        page.locator('[data-me-door="help"]'),
        "open the existing help and feedback section",
      );
      await humanClick(page, page.locator("[data-help-faq]"), "open common questions");
      const faq = page.locator('[data-faq="save"]');
      await humanClick(page, faq.locator("summary"), "read where progress is really saved");
      await expect(faq).toHaveAttribute("open", "");
      expect((await faq.locator("summary").boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        321,
      );
      await page.screenshot({ path: join(SHOTS, `${mode}-${locale}-help.png`), fullPage: true });
      await humanClick(
        page,
        page.locator("[data-support-feedback]"),
        "return to the real feedback entry",
      );
      await expect(page.locator("#profile-feedback-host button")).toBeVisible();
      await humanClick(
        page,
        page.locator('[data-me-door="membership"]'),
        "find membership from Me",
      );
      await expect(page.locator(".plans-screen")).toHaveAttribute(
        "data-payment-availability",
        "unavailable",
      );
      await expect(page.locator(".shell-screen__lede")).toHaveText(t.t("product.value.whyAi"));
      await expect(
        page.locator("[data-subscription-management],[data-plan-cancellation]"),
      ).toHaveCount(0);
      await expect(page.locator("[data-billing-refunds]")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        321,
      );
      await page.screenshot({
        path: join(SHOTS, `${mode}-${locale}-plans-phone.png`),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({
        path: join(SHOTS, `${mode}-${locale}-plans-desktop.png`),
        fullPage: true,
      });
    });
  }
}
