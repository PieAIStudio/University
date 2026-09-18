import type { ActivityBase } from "./types.js";

/**
 * One place things can go, including "not this at all".
 *
 * A lesson that draws a boundary — a vector is not an arrow, not a compression,
 * not a summary — is sorting into buckets where one of them is the negative
 * case. That is why buckets are authored rather than derived from the items:
 * the empty bucket, and the bucket everything wrong lands in, are both part of
 * what the lesson is teaching.
 */
export interface SortBucket {
  readonly id: string;
  readonly label: string;
  readonly note: string;
}

export interface SortItem {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  /** Where it actually belongs. */
  readonly bucketId: string;
  /** Why it belongs there, in the reader's language. Shown once placed right. */
  readonly why: string;
  /**
   * The bucket somebody would reasonably reach for first, and why that does
   * not hold.
   *
   * Optional, but it is what separates this from a quiz. A generic "wrong, try
   * again" teaches nothing about the boundary; naming the tempting answer and
   * saying what breaks it is the whole lesson. The same rule already governs
   * choice exercises, for the same reason.
   */
  readonly tempting?: { readonly bucketId: string; readonly whyNot: string };
}

export interface SortActivity extends ActivityBase {
  readonly kind: "sort";
  readonly buckets: readonly SortBucket[];
  readonly items: readonly SortItem[];
  /** What the reader is sorting by, said once above the board. */
  readonly question: string;
}

export interface SortState {
  /** itemId → bucketId, for items already placed correctly. */
  readonly placed: Readonly<Record<string, string>>;
  readonly misses: number;
}

/** The pure sorting mechanism also serves PRIMM's text cards. */
export interface SortRules {
  readonly buckets: readonly Pick<SortBucket, "id">[];
  readonly items: readonly Pick<SortItem, "id" | "bucketId" | "why" | "tempting">[];
}

export type SortVerdict =
  | { readonly kind: "unknown-item" }
  | { readonly kind: "unknown-bucket" }
  | { readonly kind: "already-placed" }
  | { readonly kind: "right"; readonly why: string; readonly state: SortState }
  | {
      readonly kind: "wrong";
      /** The item's own reason this bucket does not hold, when it was the tempting one. */
      readonly whyNot: string | null;
      readonly state: SortState;
    };

export function createSortState(): SortState {
  return { placed: {}, misses: 0 };
}

/**
 * Place one item. A miss costs an attempt and leaves the item where it was, so
 * the reader can try again — the point is arriving at the boundary, not being
 * scored on the first guess.
 */
export function placeSortItem(
  activity: SortRules,
  state: SortState,
  itemId: string,
  bucketId: string,
): SortVerdict {
  const item = activity.items.find((candidate) => candidate.id === itemId);
  if (!item) return { kind: "unknown-item" };
  if (!activity.buckets.some((bucket) => bucket.id === bucketId)) return { kind: "unknown-bucket" };
  if (state.placed[itemId]) return { kind: "already-placed" };
  if (item.bucketId === bucketId) {
    return {
      kind: "right",
      why: item.why,
      state: { placed: { ...state.placed, [itemId]: bucketId }, misses: state.misses },
    };
  }
  return {
    kind: "wrong",
    whyNot: item.tempting?.bucketId === bucketId ? item.tempting.whyNot : null,
    state: { placed: state.placed, misses: state.misses + 1 },
  };
}

export function isSortComplete(activity: SortRules, state: SortState): boolean {
  return activity.items.every((item) => state.placed[item.id] === item.bucketId);
}

/**
 * Whether this activity can be finished at all, and whether it teaches a
 * boundary or merely a lookup.
 *
 * `isValidProgramActivity` sets the precedent: an engine knows what it accepts,
 * and saying so here is cheaper than discovering an unwinnable board in front
 * of a learner. The two-bucket floor is not pedantry — one bucket is not a
 * sorting task, it is a list.
 */
export function isValidSortActivity(activity: SortRules): boolean {
  const bucketIds = new Set(activity.buckets.map((bucket) => bucket.id));
  if (bucketIds.size !== activity.buckets.length) return false;
  if (bucketIds.size < 2) return false;
  const itemIds = new Set(activity.items.map((item) => item.id));
  if (itemIds.size !== activity.items.length) return false;
  if (activity.items.length < bucketIds.size) return false;
  for (const item of activity.items) {
    if (!bucketIds.has(item.bucketId)) return false;
    if (!item.tempting) continue;
    if (!bucketIds.has(item.tempting.bucketId)) return false;
    // A tempting bucket that is the right one is not a temptation, it is a typo
    // that would show the learner a contradiction.
    if (item.tempting.bucketId === item.bucketId) return false;
  }
  // Every bucket has to receive something. An always-empty bucket is a
  // distractor the reader can eliminate without understanding anything.
  return activity.buckets.every((bucket) =>
    activity.items.some((item) => item.bucketId === bucket.id),
  );
}
