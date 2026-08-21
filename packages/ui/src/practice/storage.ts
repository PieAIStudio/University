import {
  EMPTY_PRACTICE_RECENT,
  parsePracticeRecent,
  type PracticeRecentState,
} from "@pieai/university-core";

/**
 * Where a sitting's recent question ids live, for now.
 *
 * The ring itself is a fact about this person — which term quizzes they just
 * saw — not a way of rendering a question, so it belongs on the account. The
 * account store does not exist yet. This adapter is the stand-in: the same
 * document the model already speaks, the same `read`/`write` an account client
 * will implement, so swapping storage later does not rewrite the stream.
 *
 * The bytes sit in the browser until that swap. A blocked or full store still
 * gets the next question; it just may repeat one. That is the same contract
 * as the favourites star, for the same reason: a preference control that
 * throws takes the page down with it.
 *
 * The key is product-level, not `university-local`, because both shells will
 * read this list and the account adapter will keep the same document
 * identity. The version lives *inside* the JSON so a migration branches on
 * `version` rather than growing `university.practice.recent.v2`.
 */
export const PRACTICE_RECENT_STORAGE_KEY = "university.practice.recent";

/**
 * The only thing a UI or a shell is allowed to ask of a practice-recent backend.
 *
 * Narrow on purpose. Picking, remembering and assembling questions are the
 * model's job; this interface is how the document crosses a process boundary.
 */
export interface PracticeRecentStore {
  read(): PracticeRecentState;
  write(state: PracticeRecentState): void;
}

export function readLocalPracticeRecent(): PracticeRecentState {
  try {
    const raw = window.localStorage.getItem(PRACTICE_RECENT_STORAGE_KEY);
    if (!raw) return EMPTY_PRACTICE_RECENT;
    return parsePracticeRecent(JSON.parse(raw) as unknown);
  } catch {
    return EMPTY_PRACTICE_RECENT;
  }
}

export function writeLocalPracticeRecent(state: PracticeRecentState): void {
  try {
    window.localStorage.setItem(PRACTICE_RECENT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A browser with storage disabled still gets the stream, just not the memory.
  }
}

export function createLocalPracticeRecentStore(): PracticeRecentStore {
  return {
    read: readLocalPracticeRecent,
    write: writeLocalPracticeRecent,
  };
}
