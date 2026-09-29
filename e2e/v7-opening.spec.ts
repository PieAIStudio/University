import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";
import { enterOpening, isolateNewAuthoringLearner, waitForGuidePaint } from "./harness/opening.js";
import { waitForCourseFraming } from "./harness/course-overview.js";

const OUTPUT = "SCRATCH/e2e/v7-opening";
for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  for (const [width, height, locale] of [
    [1440, 900, "zh-CN"],
    [390, 844, "en"],
    [320, 740, "en"],
  ] as const) {
    test.describe(`V7 first meeting ${mode} ${locale} ${width}`, () => {
      test.use({
        viewport: { width, height },
        locale,
        deviceScaleFactor: 1,
        hasTouch: width < 768,
        isMobile: width < 768,
        storageState: { cookies: [], origins: [] },
      });
      test("two real paths, one opening across help pages, one registered stone, no learning written", async ({
        page,
      }) => {
        mkdirSync(OUTPUT, { recursive: true });
        const capture = `${OUTPUT}/${mode}-${locale}-${width}`;
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const writes: string[] = [];
        page.on("request", (request) => {
          if (
            request.method() === "POST" &&
            /\/api\/grade|\/functions\/|\/chat\/completions/.test(request.url())
          )
            writes.push(request.url());
        });
        if (mode === "authoring") await isolateNewAuthoringLearner(page);
        await page.goto(`${origin}/?lang=${locale}`);
        const splash = page.locator(".game-ui-splash--opening");
        await expect(splash).toBeVisible();
        await expect(splash).not.toContainText(/最强的几家|strongest AI/i);
        await expect(page.locator("[data-welcome]")).toHaveCount(0);
        await page.screenshot({ path: `${capture}-splash.png` });
        await enterOpening(page);
        const opening = page.locator('[data-opening-topic="welcome"]');
        await expect(opening).toBeVisible();
        const key = await opening.getAttribute("data-opening-key");
        await expect(opening.locator("[data-welcome-choice]")).toHaveCount(2);
        if (locale === "en") await expect(opening).not.toContainText(/[\u4e00-\u9fff]/u);
        await expect(page.locator("dialog[open]")).toHaveCount(0);
        await waitForGuidePaint(page);
        // Secondary exits are part of the first screen too, especially at 320px.
        const buttons = await opening
          .locator("[data-welcome-start], [data-welcome-signin], [data-welcome-browse]")
          .all();
        for (const button of buttons) {
          const box = await button.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.y).toBeGreaterThanOrEqual(0);
          expect(box!.y + box!.height).toBeLessThanOrEqual(height);
        }
        await waitForGuidePaint(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await page.screenshot({ path: `${capture}-paths.png` });
        await opening.locator("[data-welcome-help]").click();
        await expect(page.locator('[data-welcome-page="2"]')).toBeVisible();
        await expect(opening).toHaveAttribute("data-opening-key", key!);
        await page.locator('[data-welcome-experience="never"]').click();
        await expect(page.locator("[data-welcome-recommended]")).toHaveCount(0);
        await page.locator('[data-welcome-goal="work"]').click();
        await waitForGuidePaint(page);
        await page.screenshot({ path: `${capture}-help.png` });
        await page.locator("[data-welcome-recommended]").click();
        await expect(page.locator('[data-welcome-page="3"]')).toBeVisible({ timeout: 90_000 });
        await expect(page.locator('[data-opening-topic="welcome"]')).toHaveCount(0);
        await waitForCourseFraming(page);
        await expect(page.locator('[data-welcome-page="3"]')).toHaveAttribute(
          "data-first-stone-state",
          "showing",
        );
        const target = page.locator('[data-map-marker="ask-about-a-picture"]');
        await expect(target).toHaveClass(/is-visible/);
        await expect(target).toBeVisible();
        const overlap = await target.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const sample = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          return sample === element || (sample !== null && element.contains(sample));
        });
        expect(overlap, "the named first stone remains a real unobstructed destination").toBe(true);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(
          0,
        );
        const progress = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("university.progress.v2") ?? "null"),
        );
        expect(progress?.totalXp ?? 0).toBe(0);
        expect(Object.keys(progress?.lessons ?? {})).toHaveLength(0);
        expect(writes).toEqual([]);
        await waitForGuidePaint(page);
        await page.screenshot({ path: `${capture}-stone.png` });
        await page.locator("[data-welcome-enter]").click();
        await expect(page.locator(".lesson-reader")).toBeVisible();
        expect(new URL(page.url()).pathname).toBe(
          "/ai-literacy/understanding-ai/first-useful-step/ask-about-a-picture",
        );
        expect(errors).toEqual([]);
      });
    });
  }
}

test.describe("V7 first meeting recovery", () => {
  test.use({
    viewport: { width: 320, height: 740 },
    locale: "en",
    hasTouch: true,
    isMobile: true,
    storageState: { cookies: [], origins: [] },
  });

  test("a restored canvas earns a new framing receipt before the same first-stone guide returns", async ({
    page,
  }) => {
    await page.goto(`${ONLINE_ORIGIN}/?lang=en`);
    await enterOpening(page);
    await page.locator('[data-welcome-start="ai-literacy"]').click();
    const guide = page.locator('[data-welcome-page="3"]');
    await expect(guide).toHaveAttribute("data-first-stone-state", "showing", { timeout: 90_000 });

    // Exercise the browser recovery boundary already used by recovery.spec,
    // without clearing the learner's selection or changing the readiness flag.
    await page.locator(".stagewrap canvas").evaluate((canvas) => {
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
      canvas.dispatchEvent(new Event("webglcontextrestored"));
    });
    await expect(guide).toHaveCount(0);
    await expect(guide).toHaveAttribute("data-first-stone-state", "showing", { timeout: 90_000 });
    const atPresentation = await page.evaluate(
      () => (window as any).three.camera.position.toArray() as number[],
    );
    await waitForCourseFraming(page);
    const afterSettling = await page.evaluate(
      () => (window as any).three.camera.position.toArray() as number[],
    );
    expect(
      Math.hypot(...afterSettling.map((value, index) => value - atPresentation[index]!)),
      "guidance waits for this canvas's framing, not the previous canvas's receipt",
    ).toBeLessThan(0.03);
    await expect(page.locator('[data-recovery-state="context-lost"]')).toHaveCount(0);
    await waitForGuidePaint(page);
    mkdirSync(OUTPUT, { recursive: true });
    await page.screenshot({ path: `${OUTPUT}/delivery-en-320-restored-stone.png` });
    await page.locator("[data-welcome-enter]").click();
    await expect(page.locator(".lesson-reader")).toBeVisible();
  });
});

test.describe("V7 web re-entry", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    storageState: { cookies: [], origins: [] },
  });
  test("Escape acknowledges the welcome; reload still needs a real launch tap but never welcomes again", async ({
    page,
  }) => {
    await page.goto(ONLINE_ORIGIN);
    await enterOpening(page, true);
    await expect(page.locator('[data-opening-topic="welcome"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-opening-topic="welcome"]')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("university.welcome.v1"))).toBe(
      "acknowledged",
    );
    await page.reload();
    await expect(page.locator(".game-ui-splash--opening")).toBeVisible();
    await enterOpening(page, true);
    await expect(page.locator("[data-welcome]")).toHaveCount(0);
    await expect(page.locator(".app[inert]")).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
