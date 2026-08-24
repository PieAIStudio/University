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

export const lessonKey = (studyId: string, courseId: string, lessonId: string) =>
  `${studyId}/${courseId}/${lessonId}`;

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
