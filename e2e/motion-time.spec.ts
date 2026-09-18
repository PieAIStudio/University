import { expect, test } from "@playwright/test";
import { FAST_TRAVEL_UPPER_BOUND_MS } from "../packages/world/src/avatar/hop.js";
import { armPointerPress, landingTiming } from "./harness/motion-time.js";

test("pointer timing ignores fabricated events but retains the actual press and hold", async ({
  page,
}) => {
  await page.setContent('<button type="button">A real target</button>');
  const clock = await armPointerPress(page);
  try {
    await page.evaluate(() => {
      document
        .querySelector("button")!
        .dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, button: 0, isPrimary: true }),
        );
    });
    await expect(clock.read()).rejects.toThrow("real primary pointer");
    const box = await page.locator("button").boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down({ button: "right" });
    await page.mouse.up({ button: "right" });
    await expect(clock.read()).rejects.toThrow("real primary pointer");
    await page.mouse.down();
    const pressedAt = await clock.read();
    await page.waitForTimeout(90);
    await page.mouse.up();
    expect(await clock.read()).toBe(pressedAt);
    const observedAt = await page.evaluate(() => performance.now());
    expect(observedAt - pressedAt).toBeGreaterThanOrEqual(90);
  } finally {
    await clock.dispose();
  }
});

test("landing timing excludes delayed observation, not actual visible travel", () => {
  expect(landingTiming(1000, 1480, 1670)).toEqual({ elapsedMs: 480, observationDelayMs: 190 });
});

test("a real slow landing cannot be hidden by the frame-timestamp measurement", () => {
  const timing = landingTiming(1000, 1541, 1670);
  expect(FAST_TRAVEL_UPPER_BOUND_MS).toBe(540);
  expect(timing.elapsedMs).toBeGreaterThan(FAST_TRAVEL_UPPER_BOUND_MS);
});

test("the actual pointer press is included before the animation starts", () => {
  // Ninety milliseconds before motion + 420ms of motion must still count as 510ms.
  expect(landingTiming(1000, 1510, 1518).elapsedMs).toBe(510);
});

test("missing, stale, future and non-finite frame clocks fail instead of passing", () => {
  for (const [press, finish, observed] of [
    [1000, null, 1500],
    [1000, 999, 1500],
    [1000, 1501, 1500],
    [Number.NaN, 1450, 1500],
    [1000, Number.NaN, 1500],
    [1000, 1450, Number.POSITIVE_INFINITY],
  ] as const) {
    expect(() => landingTiming(press, finish, observed)).toThrow("same browser clock");
  }
});
