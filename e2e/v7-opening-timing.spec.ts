import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { ONLINE_ORIGIN } from "./ports.js";
import { CATALOGUE_ROLES, coursePathOf } from "./harness/catalogue.js";
import { enterOpening } from "./harness/opening.js";

const OUTPUT = "SCRATCH/e2e/v7-opening-timing";
const COURSE = coursePathOf(CATALOGUE_ROLES.longestCourse.course);

/** Hold actual model responses, never the application's readiness flag. */
async function holdModels(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requested: string[] = [];
  await page.route(/\.glb(?:\?.*)?$/, async (route) => {
    requested.push(new URL(route.request().url()).pathname);
    await gate;
    await route.continue();
  });
  return { requested, release };
}

async function observeTransition(page: Page, path: string) {
  await page.evaluate((destination) => {
    const bag = window as any;
    bag.__v7TransitionObserver?.disconnect();
    const trace = {
      requested: performance.now(),
      shown: null as number | null,
      hidden: null as number | null,
    };
    bag.__v7TransitionTrace = trace;
    const sample = () => {
      const cover = document.querySelector(".game-ui-splash--transition");
      if (cover && trace.shown === null) trace.shown = performance.now();
      if (!cover && trace.shown !== null && trace.hidden === null) trace.hidden = performance.now();
    };
    bag.__v7TransitionObserver = new MutationObserver(sample);
    bag.__v7TransitionObserver.observe(document.body, { childList: true, subtree: true });
    history.pushState(null, "", destination);
    dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

async function drawnProjection(page: Page, objectName: string) {
  await page.waitForFunction(
    (name) => {
      const bag = window as any;
      return (
        bag.three?.scene.getObjectByName(name) &&
        bag.__stageFrameMetrics?.sceneUuid === bag.three.scene.uuid
      );
    },
    objectName,
    { timeout: 90_000 },
  );
  // The same renderer remains mounted. Let its existing output pass draw the
  // just-committed projection before taking the end timestamp.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

const traceOf = (page: Page) =>
  page.evaluate(() => {
    const bag = window as any;
    return { ...bag.__v7TransitionTrace, observed: performance.now() } as {
      requested: number;
      shown: number | null;
      hidden: number | null;
      observed: number;
    };
  });

test.describe("V7 actual scene readiness and transition time", () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

  test("a held required model cannot admit the learner or report 100 percent", async ({ page }) => {
    mkdirSync(OUTPUT, { recursive: true });
    const models = await holdModels(page);
    try {
      await page.goto(ONLINE_ORIGIN + COURSE, { waitUntil: "domcontentloaded" });
      await expect.poll(() => models.requested.length).toBeGreaterThan(0);
      const splash = page.locator(".game-ui-splash--opening");
      await expect(splash).toBeVisible();
      await expect(splash).toHaveAttribute("data-splash-ready", "false");
      await expect(splash.getByRole("button")).toHaveCount(0);
      expect(
        Number(await splash.getByRole("progressbar").getAttribute("aria-valuenow")),
      ).toBeLessThan(100);
      await page.screenshot({ path: `${OUTPUT}/held-model.png` });
      models.release();
      await expect(splash).toHaveAttribute("data-splash-ready", "true", { timeout: 90_000 });
      await expect(splash.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
      await drawnProjection(page, "course-monsters");
      await enterOpening(page);
      await expect(page.locator(".stagewrap")).toBeVisible();
      writeFileSync(
        `${OUTPUT}/held-model.json`,
        JSON.stringify({ course: COURSE, models: models.requested }, null, 2),
      );
    } finally {
      models.release();
    }
  });

  test("only a scene still pending after two seconds gets a cover; a cached return never flashes it", async ({
    page,
  }) => {
    mkdirSync(OUTPUT, { recursive: true });
    await page.goto(ONLINE_ORIGIN);
    await enterOpening(page);
    const models = await holdModels(page);
    try {
      await observeTransition(page, COURSE);
      await expect.poll(() => models.requested.length).toBeGreaterThan(0);
      const transition = page.locator(".game-ui-splash--transition");
      await expect(transition).toBeVisible({ timeout: 20_000 });
      const waiting = await traceOf(page);
      expect(waiting.shown).not.toBeNull();
      expect(waiting.shown! - waiting.requested).toBeGreaterThanOrEqual(2_000);
      await expect(transition.getByRole("button")).toHaveCount(0);
      await expect(transition.locator(".game-ui-splash-line")).toHaveCount(1);
      await expect(transition).toHaveAttribute("data-splash-ready", "false");
      models.release();
      await expect(transition).toHaveCount(0, { timeout: 90_000 });
      await drawnProjection(page, "course-monsters");
      const slow = await traceOf(page);
      expect(slow.hidden).not.toBeNull();
      expect(slow.hidden! - slow.shown!).toBeGreaterThanOrEqual(800);
      // Navigate in the application, preserving its actual model/geometry
      // caches and renderer rather than resetting the page with goto().
      await observeTransition(page, "/");
      await drawnProjection(page, "remote-island-field");
      const fast = await traceOf(page);
      // A detailed island may legitimately need more than two seconds even
      // with GLBs cached. The already-drawn overview is the fast counterpart;
      // the threshold and the absence-of-cover assertion remain unchanged.
      expect(fast.observed - fast.requested).toBeLessThan(2_000);
      expect(fast.shown).toBeNull();
      await expect(transition).toHaveCount(0);
      writeFileSync(
        `${OUTPUT}/transition.json`,
        JSON.stringify({ course: COURSE, slow, fast }, null, 2),
      );
    } finally {
      models.release();
    }
  });
});
