import { expect, test, type Page } from "@playwright/test";

import { SHIPPED_COURSES, coursePathOf } from "./harness/catalogue.js";
import { humanClick } from "./harness/click.js";
import { ONLINE_ORIGIN } from "./ports.js";

/**
 * 涟, the map guide (ADR-0012, V5 #map-guide). The bottom centre of the map is
 * the guide's alone, and "where do I start" flies the droplet to the stone that
 * says 「开始」 — the place the map registered, not a coordinate.
 */
const course = SHIPPED_COURSES.find(
  (item) => item.studyId === "ai-literacy" && item.id === "understanding-ai",
)!;

async function openCourse(page: Page) {
  await page.goto(`${ONLINE_ORIGIN}${coursePathOf(course)}?lang=zh-CN`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
  const live = page.locator('button.label--lesson.is-visible[data-lesson-state="live"]');
  await expect(live).toBeVisible({ timeout: 60_000 });
  return live;
}

const centre = (box: { x: number; y: number; width: number; height: number }) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

for (const viewport of [
  { id: "desktop", width: 1280, height: 800 },
  { id: "phone", width: 390, height: 844 },
]) {
  test(`map guide ${viewport.id}: owns the bottom centre and points at the stone to start on`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const live = await openCourse(page);

    // The droplet sits at the bottom centre; the gesture cue moved to the top.
    const body = page.locator(".map-guide__body");
    const seat = (await body.boundingBox())!;
    expect(Math.abs(centre(seat).x - viewport.width / 2)).toBeLessThan(24);
    expect(viewport.height - (seat.y + seat.height)).toBeLessThan(48);
    const controls = (await page.locator(".hint--controls").boundingBox())!;
    expect(controls.y + controls.height).toBeLessThan(viewport.height / 4);
    // The map's first sentence is the guide's, directly above it.
    const opening = (await page.locator(".map-guide__opening").boundingBox())!;
    expect(opening.y + opening.height).toBeLessThanOrEqual(seat.y);

    await humanClick(page, body, "问涟");
    await humanClick(page, page.locator('[data-guide-question="start"]'), "我该从哪开始");
    const title = (await live.getAttribute("aria-description"))!.split(" · ")[0]!;
    await expect(page.locator(".map-guide__say")).toContainText(title);

    // The droplet's label names the lesson and lands beside its stone.
    // The label is shown once the droplet has landed, not during the flight.
    const label = page.locator(".game-ui-liquid-presence-label");
    await expect(label).toBeVisible({ timeout: 10_000 });
    await expect(label).toHaveText(title);
    await expect
      .poll(
        async () => {
          const a = await label.boundingBox();
          const b = await live.boundingBox();
          if (!a || !b) return Infinity;
          return Math.hypot(centre(a).x - centre(b).x, centre(a).y - centre(b).y);
        },
        { timeout: 10_000 },
      )
      .toBeLessThan(200);

    // The one action is the stone's own: it selects the lesson, it does not enter it.
    await humanClick(page, page.getByRole("button", { name: "帮我选中它" }), "帮我选中它");
    await expect(page.locator(".map-entry-action.is-visible")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${coursePathOf(course)}(\\?|$)`));
  });
}
