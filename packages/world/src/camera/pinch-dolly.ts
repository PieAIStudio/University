/**
 * Two-finger MapControls uses `TOUCH.DOLLY_PAN`: pan and zoom share one
 * gesture. A steady map move jitters the finger span by a few percent and
 * reads as a dolly. Arm zoom only after the span has changed enough that the
 * learner is actually pinching.
 */
export const PINCH_DOLLY_THRESHOLD = 0.18;

export function pinchDollyArmed(
  originSpan: number,
  currentSpan: number,
  alreadyArmed: boolean,
  threshold = PINCH_DOLLY_THRESHOLD,
): boolean {
  if (alreadyArmed) return true;
  if (!(originSpan > 0) || !(currentSpan > 0)) return false;
  const ratio = currentSpan / originSpan;
  return ratio <= 1 - threshold || ratio >= 1 + threshold;
}
