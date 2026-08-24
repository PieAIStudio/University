/**
 * The learner's progress as a JSON document.
 *
 * This is the shape `university.progress.v2` already stores in the delivery
 * shell. The key stays the same so a machine that has been learning without
 * an account does not wake up empty the day sync lands. A version bump that
 * guessed at v1 cards already happened once; we are not doing it again.
 *
 * The document is the unit of merge. There is no per-card API on the remote
 * side yet, and inventing one before University has a schema would be a
 * second storage model that then has to be migrated.
 */

import { cloneAccountData, emptyAccountData, parseAccountData } from "../ports/account-data.js";
import type { ProgressDocument } from "../ports/progress.js";

/** Keep this string. Changing it orphans everyone who has already learned a lesson. */
export const PROGRESS_STORAGE_KEY = "university.progress.v2";

export const emptyProgress = (): ProgressDocument => ({
  lessons: {},
  cards: {},
  words: {},
  streak: { days: 0, lastDay: null },
  readerMarks: {},
  exerciseAttempts: {},
  retrievalAttempts: {},
  account: emptyAccountData(),
});

/**
 * How this document names a lesson. Three segments, no unit.
 *
 * Not the same string as `lessonRefKey`, which carries the unit as well and is
 * what *shared surfaces* use to talk about a lesson. Both are legitimate — a
 * store may key its rows however it likes — and that is exactly why they have
 * to stop being interchangeable at the door of this module.
 *
 * They were not. `confirmLessonRead` was reached through a reader port that
 * built its argument with `lessonRefKey`, so the read confirmation landed on a
 * four-segment key while every reader of this document looked under the
 * three-segment one. Nothing threw: both are strings, both are valid keys, and
 * the document simply grew a row nobody read. The visible result was that a
 * lesson could not be finished in either shell — the confirm button never
 * changed, the settlement never came, and the map never moved.
 */
/**
 * A key in *this document's* `lessons` map, and nothing else.
 *
 * Branded so it cannot be confused with `lessonRefKey`'s four-segment name at
 * a call site. That is not hypothetical caution: the two were passed to the
 * same function, and because both are strings the compiler had nothing to say.
 */
export type LessonDocumentKey = string & { readonly __lessonDocumentKey: unique symbol };

export const lessonKey = (studyId: string, courseId: string, lessonId: string) =>
  `${studyId}/${courseId}/${lessonId}` as LessonDocumentKey;

/**
 * The same key, from a locator.
 *
 * Exists so a caller holding a `LessonRef` never has to decide which of the
 * two key builders in this repository it wanted. Deciding is what went wrong.
 */
export const lessonKeyOf = (ref: {
  readonly studyId: string;
  readonly courseId: string;
  readonly lessonId: string;
}): LessonDocumentKey => lessonKey(ref.studyId, ref.courseId, ref.lessonId);

export function parseProgress(raw: string | null): ProgressDocument {
  if (!raw) return emptyProgress();
  try {
    const parsed = JSON.parse(raw) as Partial<ProgressDocument>;
    return {
      lessons: parsed.lessons ?? {},
      cards: parsed.cards ?? {},
      // Added after v2 shipped. Absent is the normal case for anyone who read a
      // lesson before the language layer existed, not a corrupt store.
      words: parsed.words ?? {},
      streak: parsed.streak ?? { days: 0, lastDay: null },
      // Reader annotations and answer records were added after v2. An absent
      // field is an older device, not a corrupt document.
      readerMarks: parsed.readerMarks ?? {},
      exerciseAttempts: parsed.exerciseAttempts ?? {},
      retrievalAttempts: parsed.retrievalAttempts ?? {},
      account: parseAccountData(parsed.account),
    };
  } catch {
    // A corrupt local store must not lock a learner out of their own campus.
    return emptyProgress();
  }
}

export function cloneProgress(document: ProgressDocument): ProgressDocument {
  return {
    lessons: { ...document.lessons },
    cards: { ...document.cards },
    words: { ...document.words },
    streak: { ...document.streak },
    readerMarks: { ...document.readerMarks },
    exerciseAttempts: { ...document.exerciseAttempts },
    retrievalAttempts: { ...document.retrievalAttempts },
    account: cloneAccountData(document.account),
  };
}
