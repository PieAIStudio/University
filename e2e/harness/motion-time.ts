import type { Locator, Page } from "@playwright/test";
import { humanClick } from "./click.js";

/** Observe the input event itself. A timestamp taken before a CDP command
 * includes Node scheduling/transport that precedes the browser's pointer.
 * Event.timeStamp shares the page's time origin with performance.now(); it
 * also retains time spent queued before our listener runs.
 */
export async function armPointerPress(page: Page) {
  const clock = await page.evaluateHandle(() => {
    const armedAt = performance.now();
    let pressedAt: number | null = null;
    const record = (event: PointerEvent) => {
      if (!event.isTrusted || event.button !== 0 || !event.isPrimary) return;
      pressedAt = event.timeStamp;
      document.removeEventListener("pointerdown", record, true);
    };
    document.addEventListener("pointerdown", record, true);
    return {
      read: () => ({ armedAt, pressedAt, observedAt: performance.now() }),
      cancel: () => document.removeEventListener("pointerdown", record, true),
    };
  });
  return {
    async read(): Promise<number> {
      const { armedAt, pressedAt, observedAt } = await clock.evaluate((value) => value.read());
      if (
        typeof pressedAt !== "number" ||
        !Number.isFinite(pressedAt) ||
        pressedAt < armedAt ||
        pressedAt > observedAt
      ) {
        throw new Error("A real primary pointer press on the current page clock is required");
      }
      return pressedAt;
    },
    async dispose(): Promise<void> {
      await clock.evaluate((value) => value.cancel());
      await clock.dispose();
    },
  };
}

export async function timedPointerClick(page: Page, target: Locator, label: string) {
  let clock: Awaited<ReturnType<typeof armPointerPress>> | undefined;
  try {
    await humanClick(page, target, label, {
      beforePress: async () => {
        clock = await armPointerPress(page);
      },
    });
    if (!clock) throw new Error("The click never reached a hittable target");
    return await clock.read();
  } finally {
    await clock?.dispose();
  }
}

/** Browser-clock evidence, not the time when Node eventually receives a poll.
 * `finishedAt` is recorded in the actual landing-frame update in Maps.tsx;
 * it does not claim to measure compositor presentation or physical display latency.
 * Missing/stale reports fail closed; there is no timing fallback or clamp.
 */
export function landingTiming(
  pressedAt: number,
  finishedAt: number | null,
  observedAt: number,
): { readonly elapsedMs: number; readonly observationDelayMs: number } {
  if (
    !Number.isFinite(pressedAt) ||
    !Number.isFinite(observedAt) ||
    typeof finishedAt !== "number" ||
    !Number.isFinite(finishedAt) ||
    pressedAt < 0 ||
    finishedAt < pressedAt ||
    observedAt < finishedAt
  ) {
    throw new Error(
      "A current landing frame and pointer press on the same browser clock are required",
    );
  }
  return { elapsedMs: finishedAt - pressedAt, observationDelayMs: observedAt - finishedAt };
}
