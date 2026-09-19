import { expect, test } from "@playwright/test";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";
import { CATALOGUE_ROLES, coursePathOf } from "./harness/catalogue.js";
import { openMapQuickActions } from "./harness/map-actions.js";

for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  test(`AB ${mode}: on-demand route preserves an unfinished placement questionnaire through close and reopen`, async ({
    page,
    context,
  }) => {
    await context.route("**/*", (route) =>
      /(?:supabase\.co|posthog\.com)$/.test(new URL(route.request().url()).hostname)
        ? route.abort()
        : route.continue(),
    );
    await page.goto(`${origin}${coursePathOf(CATALOGUE_ROLES.skipTest.course)}`);
    await expect(page.locator("button.label--lesson.is-visible").first()).toBeVisible();
    let palette = await openMapQuickActions(page);
    await palette.locator('[data-map-command="route"]').click();
    await page.locator("details.picked__route > summary").click();
    await page.locator("details.course-route-quiz > summary").click();
    await page.locator(".course-route-quiz__option").first().click();
    await expect(page.locator(".course-route-quiz")).toContainText(/第\s*2\s*\/\s*3\s*题/);
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
    palette = await openMapQuickActions(page);
    await palette.locator('[data-map-command="route"]').click();
    await expect(page.locator("details.picked__route")).toHaveAttribute("open", "");
    await expect(page.locator(".course-route-quiz")).toContainText(/第\s*2\s*\/\s*3\s*题/);
  });
}
