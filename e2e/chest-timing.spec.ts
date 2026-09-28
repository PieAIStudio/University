import { expect, test } from "@playwright/test";

import { openOnline, waitForMapReady } from "./harness/online-learner.js";
import { CATALOGUE_ROLES, coursePathOf } from "./harness/catalogue.js";
import { ONLINE_ORIGIN } from "./ports.js";

/**
 * V7 decision J2: every opening plays in full, its length set by the chest —
 * wood about 2.5 s, blue 3.5, purple 4.5, gold 6. Measured in the page's own
 * clock from the tap to the settled chest, through the development seam
 * `?v7open=<tier>` on the chest the learner can take now. Timing lane only: a
 * shared machine cannot promise a frame budget.
 */
const TARGETS = { wood: 2.5, rare: 3.5, epic: 4.5, legendary: 6 } as const;
/** Either side of the target: the tier's feel, not a frame count. */
const TOLERANCE = 0.75;

test.describe("V7 chest opening length", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const [tier, target] of Object.entries(TARGETS)) {
    test(`${tier} opens in about ${target}s`, async ({ page }) => {
      await openOnline(page);
      await waitForMapReady(page);
      await page.goto(
        `${ONLINE_ORIGIN}${coursePathOf(CATALOGUE_ROLES.settlement.course)}?v7open=${tier}`,
      );
      await page.waitForFunction(() => Boolean((globalThis as any).__v7OpenStart), undefined, {
        timeout: 60_000,
      });
      // Let the island settle into its steady frame before timing anything.
      await page.waitForTimeout(1500);
      await page.evaluate(() => (globalThis as any).__v7OpenStart());
      const seconds = await page
        .waitForFunction(
          () => {
            const timeline = (globalThis as any).__v7Timeline;
            const settled = timeline?.phases.find(
              (entry: { phase: string }) => entry.phase === "settled",
            );
            return settled && timeline.started !== null
              ? (settled.at - timeline.started) / 1000
              : false;
          },
          undefined,
          { timeout: 20_000 },
        )
        .then((handle) => handle.jsonValue() as Promise<number>);
      test
        .info()
        .annotations.push({ type: "measured", description: `${tier}: ${seconds.toFixed(2)}s` });
      console.log(`chest ${tier}: ${seconds.toFixed(2)}s (target ${target}s)`);
      expect(seconds).toBeGreaterThan(target - TOLERANCE);
      expect(seconds).toBeLessThan(target + TOLERANCE);
    });
  }
});
