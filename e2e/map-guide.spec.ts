import { expect, test, type Page } from "@playwright/test";

import { SHIPPED_COURSES, coursePathOf } from "./harness/catalogue.js";
import { humanClick } from "./harness/click.js";
import { navigateMapBreadcrumb } from "./harness/map-actions.js";
import { ONLINE_ORIGIN } from "./ports.js";

/**
 * 涟, the map guide (ADR-0012, V5 #map-guide). The bottom centre of the map is
 * the guide's alone, and "where do I start" flies the droplet to the stone that
 * says 「开始」 — the place the map registered, not a coordinate. Since
 * SwimmerNerveKit 0.4 the entry is the kit's NerveLiquidInteraction; these
 * checks key on its structure (the seat's one button, the question group, the
 * status line), never on its copy.
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

const body = (page: Page) => page.locator(".map-guide__seat button").first();
const outlet = (page: Page) => page.locator(".swimmer-nerve-liquid__outlet");
const said = (page: Page) => outlet(page).locator('[role="status"]');
async function ask(page: Page, index: number) {
  await humanClick(page, body(page), "涟");
  const question = outlet(page).locator(".swimmer-nerve-liquid__questions button").nth(index);
  await humanClick(page, question, `涟的第 ${index + 1} 个问题`);
}

const centre = (box: { x: number; y: number; width: number; height: number }) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});
const overlaps = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

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
    const seat = (await body(page).boundingBox())!;
    expect(Math.abs(centre(seat).x - viewport.width / 2)).toBeLessThan(24);
    expect(viewport.height - (seat.y + seat.height)).toBeLessThan(48);
    const controls = (await page.locator(".hint--controls").boundingBox())!;
    expect(controls.y + controls.height).toBeLessThan(viewport.height / 4);
    // The map's first sentence is the guide's, directly above it.
    const opening = (await page.locator(".map-guide__opening").boundingBox())!;
    expect(opening.y + opening.height).toBeLessThanOrEqual(seat.y);

    // No model is connected: no free-text box pretends otherwise.
    await humanClick(page, body(page), "涟");
    // Three questions first; the fourth waits behind the kit's disclosure.
    await expect(outlet(page).locator(".swimmer-nerve-liquid__questions > button")).toHaveCount(3);
    await expect(outlet(page).locator("textarea")).toHaveCount(0);
    // While the questions are open, no scene label sits under them.
    const panel = (await outlet(page).boundingBox())!;
    await expect
      .poll(async () => {
        const boxes = await page.locator(".labels .label.is-visible").evaluateAll((labels) =>
          labels.map((label) => {
            const r = label.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          }),
        );
        return boxes.filter((box) => overlaps(box, panel)).length;
      })
      .toBe(0);

    await humanClick(
      page,
      outlet(page).locator(".swimmer-nerve-liquid__questions button").first(),
      "我该从哪开始",
    );
    const title = (await live.getAttribute("aria-description"))!.split(" · ")[0]!;
    await expect(said(page)).toContainText(title);

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
    await humanClick(page, page.locator(".map-guide__go button"), "帮我选中它");
    await expect(page.locator(".map-entry-action.is-visible")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${coursePathOf(course)}(\\?|$)`));
  });
}

test("map guide: a gesture never lands on the next course, and reduced motion still answers", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  const live = await openCourse(page);
  await ask(page, 0);
  const title = (await live.getAttribute("aria-description"))!.split(" · ")[0]!;
  await expect(said(page)).toContainText(title);
  // Without travel the explanation still appears at the place.
  await expect(page.locator(".game-ui-liquid-presence-label")).toHaveText(title, {
    timeout: 10_000,
  });

  // Straight out to the archipelago, in the app: a new map is a new scope.
  // Nothing said about the old map survives and no gesture lands on the new one.
  await navigateMapBreadcrumb(page, "/");
  await expect(said(page)).toHaveCount(0);
  await expect(page.locator(".game-ui-liquid-presence-label")).toBeHidden();
  await expect(page.locator("button.label--course.is-visible").first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator(".game-ui-liquid-presence-label")).toBeHidden();
});

test("map guide: two islands side by side, chosen in order, read-only", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openCourse(page);
  await navigateMapBreadcrumb(page, "/");
  await expect(page.locator("button.label--course.is-visible").nth(1)).toBeVisible({
    timeout: 60_000,
  });
  // The saved learning record, read before and after (PROGRESS_STORAGE_KEY).
  const record = () => page.evaluate(() => localStorage.getItem("university.progress.v2"));
  const before = await record();

  // The third question on the archipelago.
  await ask(page, 2);
  const candidates = page.locator(".map-guide__candidates button");
  await expect(candidates.nth(1)).toBeVisible({ timeout: 10_000 });
  const first = (await candidates.nth(1).textContent())!.trim();
  const second = (await candidates.nth(0).textContent())!.trim();
  await humanClick(page, candidates.nth(1), "第一座岛");
  await expect(said(page)).toContainText(first);
  await humanClick(page, candidates.nth(0), "第二座岛");

  // In the learner's order, each with only what University decided about it.
  const pair = page.locator(".map-guide__pair li");
  await expect(pair).toHaveCount(2);
  await expect(pair.nth(0)).toContainText(first);
  await expect(pair.nth(1)).toContainText(second);
  for (const item of await pair.all()) await expect(item.locator("span")).not.toBeEmpty();
  // Reading a comparison opens nothing and records nothing.
  await expect(page).toHaveURL(new RegExp(`${ONLINE_ORIGIN}/(\\?|$)`));
  expect(await record()).toBe(before);

  // Another question retires the comparison.
  await ask(page, 0);
  await expect(page.locator(".map-guide__pair")).toHaveCount(0);
});
