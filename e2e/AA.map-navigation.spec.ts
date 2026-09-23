import { test, expect, type Page, type Locator } from "@playwright/test";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";
import { CATALOGUE_ROLES, coursePathOf } from "./harness/catalogue.js";
import { humanClick } from "./harness/click.js";
import { enterSelectedMapObject } from "./harness/map-actions.js";

const course = CATALOGUE_ROLES.settlement.course;
const lessons = course.units.flatMap((unit) => unit.lessons);
const first = lessons[0]!;
const second = lessons[1]!;
const last = lessons.at(-1)!;
const coursePath = coursePathOf(course);
const entry = (page: Page) =>
  page.locator('button[data-map-entry="true"]:visible, [data-map-entry="true"] button:visible');
const titleFor = (lesson: typeof first, language: string) => {
  const locales = lesson.packageLesson.locales as { en?: { title?: string } } | undefined;
  return language === "en" ? (locales?.en?.title ?? lesson.title) : lesson.title;
};
// The current lesson has a real Start label instead of a duplicate kind icon.
const marker = (page: Page, id: string) =>
  page
    .locator(
      `button[data-map-marker="kind:${id}"].is-visible, button[data-map-marker="${id}"].is-visible`,
    )
    .first();

async function palette(page: Page): Promise<Locator> {
  await page.locator('[data-map-surface="true"]:visible').first().focus();
  await page.keyboard.press("Space");
  const result = page.locator(".map-quick-actions");
  await expect(result).toBeVisible();
  return result;
}
async function ready(page: Page, surface: "course" | "world") {
  await page.waitForFunction((which) => {
    const state = window as unknown as {
      __avatarMotion?: Record<string, { inFlight: boolean }>;
      three?: { scene?: { getObjectByName(name: string): unknown } };
    };
    return (
      state.__avatarMotion?.[which]?.inFlight === false &&
      state.three?.scene?.getObjectByName(
        which === "course" ? "island-dressing-course" : "remote-island-terrain",
      )
    );
  }, surface);
}
async function pose(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __avatarMotion: { course: { target: number[] } } }).__avatarMotion
        .course.target,
  );
}
async function pointerHit(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  expect(
    await target.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const at = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return (
        element.contains(at) &&
        rect.left >= 0 &&
        rect.right <= innerWidth &&
        rect.top >= 0 &&
        rect.bottom <= innerHeight
      );
    }),
  ).toBe(true);
  // `target.click()` was a second implementation of the pointer, and it carried
  // Playwright's own stability precondition: two consecutive frames whose boxes
  // are bit-identical. A control bound to a map object never supplies that —
  // it reprojects every frame and keeps a sub-pixel jitter after it has
  // arrived. Pinning this walk to a 36-lesson course hid it; asking the
  // catalogue for a role landed it on an 8-lesson island and the click spent
  // 45 seconds retrying "element is not stable". `humanClick` is the one
  // pointer this suite has, and it already settles the way this project's own
  // checks do.
  await humanClick(page, target, "地图上的目标");
}

test.beforeEach(async ({ context }) => {
  // Only test-owned isolated browsers. No real account, analytics, mail or grading requests.
  await context.route("**/*", (route) =>
    /(?:supabase\.co|posthog\.com)$/.test(new URL(route.request().url()).hostname)
      ? route.abort()
      : route.continue(),
  );
  await context.routeWebSocket(/supabase\.co/, (socket) => socket.close());
});

for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  for (const language of ["zh-CN", "en"] as const) {
    test(`AA ${mode}/${language}: selection, unique action, idle avatar and exact reader return`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${origin}${coursePath}?lang=${language}`);
      await ready(page, "course");
      const idle = await pose(page);
      await expect(entry(page)).toHaveCount(0);
      await expect(page.locator(".map-framing-tools button")).toHaveCount(0);
      await pointerHit(page, marker(page, first.id));
      await expect(page.locator(".map-shell__heading h2")).toHaveText(titleFor(first, language));
      await expect(entry(page)).toHaveCount(1);
      await expect.poll(() => pose(page)).not.toEqual(idle);
      await ready(page, "course");
      const firstPose = await pose(page);
      await expect(page.locator('[aria-modal="true"], .path-card__scrim, main[inert]')).toHaveCount(
        0,
      );
      await expect(page.locator("#app-shell-aside button, #app-shell-aside a")).toHaveCount(0);
      // V5 §12 C′: on a fresh profile the second lesson is locked. Selecting it
      // names it and explains the way on, with no Enter, and the avatar stays.
      await pointerHit(page, marker(page, second.id));
      await expect(page.locator(".map-shell__heading h2")).toHaveText(titleFor(second, language));
      const locked = page.locator('[data-map-entry="locked"]');
      await expect(locked).toBeVisible();
      await expect(entry(page)).toHaveCount(0);
      await ready(page, "course");
      expect(await pose(page)).toEqual(firstPose);
      // "Go to the current lesson" is the way back to what can be entered.
      await pointerHit(page, locked.getByRole("button").first());
      await expect(page.locator(".map-shell__heading h2")).toHaveText(titleFor(first, language));
      await expect(entry(page)).toHaveCount(1);
      await ready(page, "course");
      expect(await pose(page)).toEqual(firstPose);
      // The camera eases back to the current lesson; press once the button settles.
      await enterSelectedMapObject(page, "current lesson after a locked choice");
      await expect(page.locator(".lesson-reader")).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${coursePath}/${first.unitId}/${first.id}`));
      await page.locator(".lesson-toolbar__close").click();
      await ready(page, "course");
      await expect.poll(() => pose(page)).toEqual(firstPose);
      await expect(entry(page)).toHaveCount(1);
      await page.locator('[data-map-surface="true"]').focus();
      await page.keyboard.press("Escape");
      await ready(page, "course");
      await expect.poll(() => pose(page)).toEqual(idle);
      await expect(entry(page)).toHaveCount(0);
      await page.reload();
      await ready(page, "course");
      expect(await pose(page)).toEqual(idle);
      await expect(entry(page)).toHaveCount(0);
      expect(errors).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`${mode}-${language}-idle.png`) });
    });
  }
}

test("AA Space is scoped; search preserves spaces, Escape and IME; directory focuses the actual last lesson", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${ONLINE_ORIGIN}${coursePath}?lang=zh-CN`);
  await ready(page, "course");
  const firstMarker = marker(page, first.id);
  await firstMarker.focus();
  await page.keyboard.press("Space");
  await expect(entry(page)).toBeVisible();
  // The brand dialog remains mounted (to preserve search), but is not open.
  await expect(page.locator(".map-quick-actions")).toBeHidden();
  let panel = await palette(page);
  await panel.locator('[data-map-command="directory"]').click();
  const search = panel.locator('input[type="search"]');
  await search.fill("没有这个课");
  await search.press("Space");
  await expect(search).toHaveValue("没有这个课 ");
  await expect(panel.getByRole("status")).toBeVisible();
  await search.dispatchEvent("keydown", {
    key: "Escape",
    code: "Escape",
    isComposing: true,
    bubbles: true,
    cancelable: true,
  });
  await expect(panel).toBeVisible();
  await search.press("Escape");
  await expect(panel).toBeHidden();
  await expect(page.locator('[data-map-surface="true"]')).toBeFocused();
  panel = await palette(page);
  await panel.locator('[data-map-command="directory"]').click();
  await expect(panel.locator('input[type="search"]')).toHaveValue("没有这个课 ");
  await panel.locator('input[type="search"]').fill(last.title);
  await panel.locator(`[data-map-destination="${last.id}"]`).click();
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${coursePath}(?:\\?|$)`));
  await expect(page.locator(".map-shell__heading h2")).toHaveText(last.title);
  // The last lesson is locked on a fresh profile (V5 §12 C′): the directory
  // still focuses it, and its card explains the way on instead of entering.
  await expect(page.locator('[data-map-entry="locked"]')).toBeVisible();
  await expect(entry(page)).toHaveCount(0);
});

test("AA expanded frame stays symmetric; folded rails keep the avatar and selected title", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${ONLINE_ORIGIN}/planet?lang=en`);
  await expect(page.locator('button[data-domain-id="ai-foundations"]')).toBeVisible();
  const geometry = () =>
    page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const path = box(".map-breadcrumbs > ol"),
        left = box("#app-shell-rail"),
        right = box(".app-shell__east-stack");
      return {
        center: path.x + path.width / 2,
        viewport: innerWidth / 2,
        left: { width: left.width, height: left.height, centerY: left.y + left.height / 2 },
        right: { width: right.width, height: right.height, centerY: right.y + right.height / 2 },
      };
    });
  let measured = await geometry();
  expect(Math.abs(measured.center - measured.viewport)).toBeLessThan(2);
  expect(Math.abs(measured.left.width - measured.right.width)).toBeLessThan(2);
  expect(Math.abs(measured.left.height - measured.right.height)).toBeLessThan(2);
  await page.locator('button[data-domain-id="ai-foundations"]').click();
  const selectedTitle = (await page.locator(".map-shell__heading h2").textContent())?.trim();
  expect(selectedTitle).toBeTruthy();

  await page.locator(".app-shell__collapse--rail").click();
  await expect.poll(async () => Math.abs((await geometry()).center - 720)).toBeLessThan(2);
  await page.locator(".app-shell__collapse--aside").click();

  const avatar = page.locator("#app-shell-rail .nav-rail__identity .avatar-chip");
  const compactTitle = page.locator(".app-shell__collapse--aside .map-shell__compact-title");
  await expect(avatar).toBeVisible();
  await expect(page.locator(".app-shell__collapse--rail .map-shell__compact-label")).toHaveCount(0);
  await expect(compactTitle).toHaveText(selectedTitle!);
  expect(await compactTitle.evaluate((element) => getComputedStyle(element).writingMode)).toBe(
    "vertical-rl",
  );
  await expect(page.locator(".app-shell__collapse--aside")).toHaveAttribute(
    "title",
    selectedTitle!,
  );
  measured = await geometry();
  expect(measured.left.width).toBeGreaterThan(measured.right.width);
  expect(Math.abs(measured.center - measured.viewport)).toBeLessThan(2);
  await page.screenshot({ path: test.info().outputPath("folded-avatar-and-title.png") });
});

test("AA scene labels share one complete surface and keep their object-relative offset", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${ONLINE_ORIGIN}/planet?lang=zh-CN`);

  const unpublished = page.locator('button[data-domain-id="ai-games"].scene-label');
  await expect(unpublished).toBeVisible();
  await expect(unpublished.locator(".label__course-status")).toContainText("未发布");
  expect(
    await unpublished.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const note = element.querySelector(".label__course-status")!.getBoundingClientRect();
      return (
        note.left >= box.left - 1 &&
        note.right <= box.right + 1 &&
        note.top >= box.top - 1 &&
        note.bottom <= box.bottom + 1
      );
    }),
  ).toBe(true);

  await page.locator('button[data-domain-id="ai-foundations"]').click();
  await pointerHit(page, entry(page));
  await ready(page, "world");
  const firstLabel = page.locator("button.label--course.scene-label.is-visible").first();
  await expect(firstLabel).toHaveAttribute("data-label-bound", "true");
  const courseId = await firstLabel.getAttribute("data-map-marker");
  expect(courseId).toBeTruthy();
  const boundLabel = page.locator(
    `button.label--course.scene-label[data-map-marker=${JSON.stringify(courseId)}]`,
  );
  const readOffset = () =>
    boundLabel.evaluate((element) => [
      element.getAttribute("data-label-offset-x"),
      element.getAttribute("data-label-offset-y"),
    ]);
  const before = await readOffset();

  const canvas = page.locator(".stagewrap canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("地图没有可拖动的画布");
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55 + 24, box.y + box.height * 0.5 + 12, {
    steps: 4,
  });
  await page.mouse.up();
  await page.waitForTimeout(350);
  await expect.poll(readOffset).toEqual(before);

  await pointerHit(page, boundLabel);
  await pointerHit(page, entry(page));
  await ready(page, "course");
  await expect(page.locator("button.label--lesson.scene-label.is-visible").first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("unified-and-bound-scene-labels.png") });
});

test("AA touch-sized navigation has one modal drawer, preserves map selection and opens the same quick actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${ONLINE_ORIGIN}${coursePath}?lang=en`);
  await ready(page, "course");
  await pointerHit(page, marker(page, first.id));
  await page.locator(".app-shell__collapse--rail").click();
  const drawer = page.locator('.app-shell__west[role="dialog"]');
  await expect(drawer).toHaveAttribute("aria-modal", "true");
  await expect(page.locator("main")).toHaveAttribute("inert", "");
  await page.locator(".app-shell__collapse--rail").focus();
  await page.keyboard.press("Shift+Tab");
  expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(page.locator(".app-shell__collapse--rail")).toBeFocused();
  await expect(entry(page)).toHaveCount(1);
  await page.locator(".app-shell__collapse--aside").click();
  await expect(page.locator('.app-shell__east[role="dialog"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".app-shell__collapse--aside")).toBeFocused();
  await expect(entry(page)).toHaveCount(1);
  await page.locator(".app-shell__collapse--rail").click();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: "Quick actions", exact: true }).click();
  await expect(page.locator(".map-quick-actions")).toBeVisible();
  await expect(page.locator(".app-shell[data-mobile-panel]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("main[inert]")).toHaveCount(0);
  await expect(entry(page)).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  // Removing the overview control also removes its old 72px empty toolbar.
  const canvasFillsStage = () =>
    page.evaluate(() => {
      const stage = document.querySelector(".stagewrap:not([hidden])")!.getBoundingClientRect();
      const canvas = document
        .querySelector(".stagewrap:not([hidden]) canvas")!
        .getBoundingClientRect();
      return (
        Math.abs(stage.bottom - canvas.bottom) < 2 && Math.abs(stage.height - canvas.height) < 2
      );
    });
  expect(await canvasFillsStage()).toBe(true);
  // Touch cancellation must stay reachable even when there is no empty sky
  // to tap. This replaces the old modal card's close control (ledger d6cab639f3e9).
  await page.locator(".app-shell__collapse--rail").click();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: "Quick actions", exact: true }).click();
  await pointerHit(page, page.locator('[data-map-command="clear"]'));
  await expect(page.locator(".map-quick-actions")).toBeHidden();
  await expect(entry(page)).toHaveCount(0);
  await expect(page.locator("main[inert]")).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("mobile-entry.png") });
  await page.setViewportSize({ width: 900, height: 390 });
  await expect.poll(canvasFillsStage).toBe(true);
});

test("AA overview is a real repeatable command, not a persistent button, in both map layers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of ["/", coursePath]) {
    await page.goto(`${ONLINE_ORIGIN}${path}?lang=zh-CN`);
    await ready(page, path === "/" ? "world" : "course");
    await expect(page.getByRole("button", { name: "总览", exact: true })).toHaveCount(0);
    for (let attempt = 0; attempt < 2; attempt++) {
      const panel = await palette(page);
      await panel.locator('[data-map-command="overview"]').click();
      await expect(panel).toBeHidden();
      await expect(page.locator(".stagewrap")).toHaveAttribute("data-map-framing", "overview");
      expect(
        await page.evaluate(() => {
          const state = (
            window as unknown as {
              three: { camera: { position: { x: number; y: number; z: number } } };
            }
          ).three;
          return [state.camera.position.x, state.camera.position.y, state.camera.position.z].every(
            Number.isFinite,
          );
        }),
      ).toBe(true);
    }
    const panel = await palette(page);
    await panel.locator('[data-map-command="learning-view"]').click();
    await expect(page.locator(".stagewrap")).toHaveAttribute("data-map-framing", "learning");
  }
});
