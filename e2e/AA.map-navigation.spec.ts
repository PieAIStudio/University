import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";

const { course } = JSON.parse(
  readFileSync(
    new URL("../apps/university/content/ai-literacy/understanding-ai.json", import.meta.url),
    "utf8",
  ),
);
const lessons: {
  id: string;
  title: string;
  locales?: { en?: { title: string } };
  unitId: string;
}[] = course.units.flatMap((unit: { id: string; lessons: { id: string; title: string }[] }) =>
  unit.lessons.map((lesson) => ({ ...lesson, unitId: unit.id })),
);
const first = lessons[0]!;
const second = lessons[1]!;
const last = lessons.at(-1)!;
const coursePath = "/ai-literacy/understanding-ai";
const entry = (page: Page) =>
  page.locator('button[data-map-entry="true"]:visible, [data-map-entry="true"] button:visible');
const titleFor = (lesson: typeof first, language: string) =>
  language === "en" ? (lesson.locales?.en?.title ?? lesson.title) : lesson.title;
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
  await target.click();
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
      await pointerHit(page, marker(page, second.id));
      // DOM selection precedes the renderer frame; don't mistake the previous
      // completed movement report for this click's completed movement.
      await expect.poll(() => pose(page)).not.toEqual(firstPose);
      await ready(page, "course");
      const secondPose = await pose(page);
      await expect(page.locator(".map-shell__heading h2")).toHaveText(titleFor(second, language));
      await pointerHit(page, entry(page));
      await expect(page.locator(".lesson-reader")).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${coursePath}/${second.unitId}/${second.id}`));
      await page.locator(".lesson-toolbar__close").click();
      await ready(page, "course");
      await expect.poll(() => pose(page)).toEqual(secondPose);
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
  await pointerHit(page, entry(page));
  await expect(page).toHaveURL(new RegExp(`${last.unitId}/${last.id}`));
});

test("AA shared expanded/folded frame remains symmetric and the path stays viewport-centered", async ({
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
  await page.locator(".app-shell__collapse--rail").click();
  await expect.poll(async () => Math.abs((await geometry()).center - 720)).toBeLessThan(2);
  await page.locator(".app-shell__collapse--aside").click();
  await expect
    .poll(async () => Math.abs((await geometry()).left.height - (await geometry()).right.height))
    .toBeLessThan(2);
  measured = await geometry();
  expect(Math.abs(measured.left.centerY - measured.right.centerY)).toBeLessThan(2);
  await page.screenshot({ path: test.info().outputPath("folded-frame.png") });
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
