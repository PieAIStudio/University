/**
 * Smooth a 20 Hz cursor so it does not jump between samples.
 *
 * Researched before writing: Liveblocks' cursor tutorial and
 * `perfect-cursors` (steveruizok, MIT, last published 1.0.5 in 2022) both
 * exist to solve this. We did not take the library. It is a spline class
 * built for tldraw's many-cursor canvas; a three-seat study group never
 * has more than two remote pointers, and a four-year-old package with
 * five dependents is not a thing we want to carry. We did take the
 * diagnosis from its README: snapping to each sample jumps, CSS
 * `transition` looks artificial because the samples are not on an exact
 * interval, and the right move is to interpolate toward the latest point
 * over the throttle window.
 *
 * What we refused: Liveblocks' `throttle={16}` (60 fps). V4 §07.4 is
 * explicit that this is not a game. 20 Hz is the send rate; this function
 * only fills the frames *between* those sends.
 */
import { CURSOR_BROADCAST_INTERVAL_MS } from "@pieai/university-core";

export function stepCursor(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  dtMs: number,
  intervalMs: number = CURSOR_BROADCAST_INTERVAL_MS,
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const t = Math.min(1, Math.max(0, dtMs / intervalMs));
  const k = 1 - (1 - t) * (1 - t);
  return { x: from.x + dx * k, y: from.y + dy * k };
}
