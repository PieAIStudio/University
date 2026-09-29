import { expect, type Page } from "@playwright/test";

/** Explicit first-arrival action, also used by the keyboard onboarding checks. */
export async function enterOpening(page: Page, keyboard = false): Promise<void> {
  const splash = page.locator(".game-ui-splash--opening");
  await expect(splash).toBeVisible();
  await expect(splash).toHaveAttribute("data-splash-ready", "true", { timeout: 90_000 });
  const start = splash.getByRole("button");
  await expect(start).toBeEnabled();
  if (keyboard) await start.press("Enter");
  else await start.click();
  await expect(splash).toHaveCount(0);
}

/** DOM visibility precedes the kit's material entrance. Screenshots need the painted frame. */
export async function waitForGuidePaint(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const frames = [...document.querySelectorAll<HTMLElement>(".game-ui-liquid-reveal")];
    if (frames.length > 0)
      return frames.every(
        (frame) =>
          ["settled", "static"].includes(frame.dataset.revealMotion ?? "") &&
          getComputedStyle(frame).visibility !== "hidden",
      );
    // A guided destination uses the kit's plain status/action outlet, not a
    // LiquidReveal. Require those real painted controls rather than waiting
    // forever for an entrance wrapper this presentation does not mount.
    const controls = document.querySelector<HTMLElement>('[data-welcome-page="3"]');
    const status = document.querySelector<HTMLElement>(".swimmer-nerve-liquid__status");
    return Boolean(
      controls &&
      status &&
      controls.getClientRects().length &&
      status.getClientRects().length &&
      getComputedStyle(controls).visibility !== "hidden" &&
      getComputedStyle(status).visibility !== "hidden",
    );
  });
}

/** A new learner in an isolated authoring browser has no old SQLite progress.
 * Strip only legacy record fields from HTTP responses; keep real lesson content
 * and do not write, clear or migrate the owner's actual database. */
export async function isolateNewAuthoringLearner(page: Page): Promise<void> {
  await page.route(/\/api\/studies\/[^/?]+(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const view = await response.json();
    for (const course of view.courses ?? [])
      for (const unit of course.units ?? [])
        for (const lesson of unit.lessons ?? []) lesson.progress = null;
    await route.fulfill({ response, json: view });
  });
  await page.route(
    /\/api\/studies\/[^/?]+\/courses\/[^/?]+\/units\/[^/?]+\/lessons\/[^/?]+(?:\?.*)?$/,
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      const view = await response.json();
      if (view.lesson) {
        view.lesson.progress = null;
        for (const exercise of view.lesson.exercises ?? []) {
          exercise.latestSubmission = null;
          exercise.hostGrade = null;
        }
      }
      await route.fulfill({ response, json: view });
    },
  );
}
