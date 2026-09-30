/**
 * Which first-use guides a learner has been walked through (Owner 2026-09-30:
 * no screen of rules; 涟 shows the way the first time, once).
 *
 * Presentation history only, like `journey`: it says what was shown, never
 * what was learned, earned or allowed. Ids are the guide's own stable names
 * (`game:links`, `step:sort`). Devices merge by union, so a guide finished on
 * the phone is not shown again on the laptop.
 */
export type GuidedHistory = readonly string[];

/** Enough for every component and game several times over; bounded against a bad writer. */
const MAX_GUIDES = 64;
const GUIDE_ID = /^[a-z][a-z0-9-]*:[a-z0-9-]{1,40}$/;

export function parseGuidedHistory(value: unknown): GuidedHistory | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = [
    ...new Set(value.filter((id): id is string => typeof id === "string" && GUIDE_ID.test(id))),
  ];
  return ids.sort().slice(0, MAX_GUIDES);
}

export function mergeGuidedHistory(
  left: GuidedHistory | undefined,
  right: GuidedHistory | undefined,
): GuidedHistory | undefined {
  if (!left && !right) return undefined;
  return parseGuidedHistory([...(left ?? []), ...(right ?? [])]);
}

export function hasBeenGuided(history: GuidedHistory | undefined, id: string): boolean {
  return Boolean(history?.includes(id));
}

export function recordGuided(history: GuidedHistory | undefined, id: string): GuidedHistory {
  return parseGuidedHistory([...(history ?? []), id]) ?? [];
}
