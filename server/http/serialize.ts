import type { StoredCardState, StoredLessonProgress } from "../learning/types.js";

/**
 * Stored learning rows, as the browser is allowed to see them.
 *
 * These belong to neither the view builders nor the content-access helpers,
 * and both need them — putting them in either one made the two import each
 * other, which is the repository's only import cycle. They depend on nothing
 * but the stored shapes, so they sit below both.
 *
 * Dates cross the wire as ISO strings: `JSON.stringify` would do that anyway,
 * but doing it here means the boundary is written down rather than inherited
 * from whatever the serializer happens to do.
 */

export function serializeProgress(
  progress: StoredLessonProgress | null,
  readConfirmed = false,
): unknown {
  if (!progress) return null;
  return {
    contentRevision: progress.contentRevision,
    status: progress.status,
    progress: progress.progress,
    updatedAt: progress.updatedAt.toISOString(),
    readConfirmed,
  };
}

export function serializeCardState(state: StoredCardState): unknown {
  return {
    contentRevision: state.contentRevision,
    dueAt: state.due.toISOString(),
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    lastReviewAt: state.last_review?.toISOString() ?? null,
  };
}
