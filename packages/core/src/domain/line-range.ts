/**
 * How a cited span of lines is written, in one place.
 *
 * There were two copies of this before an activity receipt needed a third, and
 * they had already drifted: the evidence rail's copy assumed both numbers were
 * present, while the locator-only card had grown a guard for the case where
 * they were not. Two spellings of the same citation on two surfaces of the same
 * lesson is the kind of difference a reader notices and cannot explain.
 *
 * The `L` prefix belongs to the caller. The rail and the locator card wear it;
 * the activity receipt writes `path:38–43@7bdf9a52` and would not.
 */
export function formatLineRange(start: number, end?: number | null): string {
  const last = end && end >= start ? end : start;
  return start === last ? `${start}` : `${start}–${last}`;
}
