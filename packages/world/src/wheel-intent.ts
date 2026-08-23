/**
 * Classify a `wheel` event as zoom or pan.
 *
 * Mouse wheel and a two-finger trackpad swipe are the same DOM event, so the
 * split is a fingerprint, not a device API. Measured on this machine
 * (macOS, Chrome via Playwright `channel: "chrome"`) with
 * `/tmp/wheel-probe.html`:
 *
 *  - `page.mouse.wheel(0, 120)`: `deltaMode === 0`, `deltaX === 0`,
 *    `deltaY === 120`, `wheelDeltaY === -120`. That is *not* the −3×
 *    relationship. A mouse notch is large, discrete, and axis-locked.
 *  - `new WheelEvent({ deltaY: 100, deltaMode: 0 })` (what e2e dispatches):
 *    Chrome copies `deltaY` into `wheelDeltaY` with the same sign.
 *  - `new WheelEvent({ deltaX: 6, deltaY: 14 })`: both deltas survive;
 *    `wheelDeltaY ≈ 14`. A two-finger pan always has a horizontal component
 *    or a small pixel delta.
 *  - Pinch: Chrome sets `ctrlKey` (Apple Maps / Mapbox convention).
 *
 * A real Mac trackpad two-finger swipe could not be synthesised headless.
 * Chrome's native fingerprint for that gesture is `wheelDeltaY === -3 * deltaY`
 * with `deltaMode === 0` and small dense pixel deltas; a vertical-only swipe
 * has `deltaX === 0` and still matches −3×, which is why magnitude alone is
 * not enough and why that check sits above the `|deltaY| >= 40` mouse rule.
 */
export type WheelIntent = "zoom" | "pan";

export interface WheelLike {
  readonly ctrlKey: boolean;
  readonly metaKey?: boolean;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaMode: number;
  readonly wheelDeltaY?: number;
}

export function wheelIntent(event: WheelLike): WheelIntent {
  if (event.ctrlKey || event.metaKey) return "zoom";
  // DOM_DELTA_LINE / PAGE — a mouse wheel on Firefox and some Windows setups.
  if (event.deltaMode !== 0) return "zoom";

  const absX = Math.abs(event.deltaX);
  const absY = Math.abs(event.deltaY);
  const wheelDeltaY = event.wheelDeltaY;

  // Chrome trackpad: wheelDeltaY is −3× the pixel deltaY.
  if (typeof wheelDeltaY === "number" && event.deltaY !== 0 && wheelDeltaY === -3 * event.deltaY) {
    return "pan";
  }

  // Two-finger travel has a horizontal component. A mouse notch does not.
  if (absX > 0) return "pan";

  // Pixel-mode mouse: large discrete |deltaY|, no deltaX.
  if (absY >= 40) return "zoom";

  return "pan";
}
