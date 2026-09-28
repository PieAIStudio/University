import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

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

async function measureOpening(page: Page, tier: string, label = tier): Promise<number> {
  await openOnline(page);
  await waitForMapReady(page);
  await page.goto(
    `${ONLINE_ORIGIN}${coursePathOf(CATALOGUE_ROLES.settlement.course)}?v7open=${tier}`,
  );
  await page.waitForFunction(
    (kind) => {
      const bag = window as any;
      return Boolean(bag.__v7OpenStart && bag.three?.scene.getObjectByName(`hero-chest-${kind}`));
    },
    tier,
    { timeout: 60_000 },
  );
  // Keep the existing steady-frame preparation; readiness also names the actual chest.
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
    .annotations.push({ type: "measured", description: `${label}: ${seconds.toFixed(2)}s` });
  console.log(`chest ${label}: ${seconds.toFixed(2)}s`);
  const evidence = process.env.V7_CHEST_EVIDENCE;
  if (evidence) {
    mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: join(evidence, `${label}.png`) });
    writeFileSync(
      join(evidence, `${label}.json`),
      JSON.stringify({ url: page.url(), viewport: page.viewportSize(), seconds }, null, 2),
    );
  }
  return seconds;
}

test.describe("V7 chest opening length", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const [tier, target] of Object.entries(TARGETS)) {
    test(`${tier} opens in about ${target}s`, async ({ page }) => {
      const seconds = await measureOpening(page, tier);
      expect(seconds).toBeGreaterThan(target - TOLERANCE);
      expect(seconds).toBeLessThan(target + TOLERANCE);
    });
  }

  test("slow frames do not turn a wood chest into a longer celebration", async ({ page }) => {
    // A deterministic low-cadence renderer, not a claim about physical-device FPS.
    // Both scheduling and cancellation use the same timer owner for this page only.
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) =>
        window.setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
    });
    const seconds = await measureOpening(page, "wood", "wood-slow-frames");
    expect(seconds).toBeGreaterThan(TARGETS.wood - TOLERANCE);
    expect(seconds).toBeLessThan(TARGETS.wood + TOLERANCE);
  });

  test("a phone keeps the wood chest's duration", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const seconds = await measureOpening(page, "wood", "wood-phone");
    expect(seconds).toBeGreaterThan(TARGETS.wood - TOLERANCE);
    expect(seconds).toBeLessThan(TARGETS.wood + TOLERANCE);
  });
});
