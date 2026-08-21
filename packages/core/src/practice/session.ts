import {
  pickPracticeQuestionId,
  rememberPracticeQuestion,
  type PracticeRecentState,
} from "./recent.js";

/**
 * One sitting at the endless stream.
 *
 * `ordinal` is the only number this surface is allowed to show, and it dies
 * with the sitting. There is no total, no score, and no progress bar on
 * purpose: those belong to a test, and this is a pocket drill. Persistence
 * is the recent-id ring, not this object.
 */
export interface PracticeSession {
  readonly ordinal: number;
  readonly currentId: string | null;
  readonly unlocked: boolean;
}

export function startPracticeSession(
  questionIds: readonly string[],
  recent: PracticeRecentState,
  random: () => number = Math.random,
): PracticeSession {
  return {
    ordinal: 1,
    currentId: pickPracticeQuestionId(questionIds, recent.ids, random),
    unlocked: false,
  };
}

/**
 * Reveal the reward. A session with no current question has nothing to
 * unlock; a second call is a no-op so a double-fire from the choice block
 * cannot change the sitting.
 */
export function unlockPracticeSession(session: PracticeSession): PracticeSession {
  if (session.currentId === null || session.unlocked) return session;
  return { ordinal: session.ordinal, currentId: session.currentId, unlocked: true };
}

/**
 * Serve the next question only after this one is unlocked.
 *
 * Remembering happens here, not on a wrong pick, because a miss is still
 * *this* question — the learner has to get it right before the ring moves.
 */
export function advancePracticeSession(
  session: PracticeSession,
  questionIds: readonly string[],
  recent: PracticeRecentState,
  random: () => number = Math.random,
): { readonly session: PracticeSession; readonly recent: PracticeRecentState } {
  if (!session.unlocked || session.currentId === null) {
    return { session, recent };
  }
  const nextRecent = rememberPracticeQuestion(recent, session.currentId);
  return {
    recent: nextRecent,
    session: {
      ordinal: session.ordinal + 1,
      currentId: pickPracticeQuestionId(questionIds, nextRecent.ids, random),
      unlocked: false,
    },
  };
}
