/**
 * The shared feedback contract.
 *
 * Feedback is a learner signal, not a report about another person's content
 * and not part of the mergeable progress document. Both shells render the
 * same control and pass the same allowlisted context; only the transport is
 * selected by the app's port assembly.
 */

import type { LessonRef } from "../progress/contract.js";

export type FeedbackTransport = "clipboard" | "swimmer-backend" | "unavailable";

/** Context that can make one learner note actionable without learner secrets. */
export interface FeedbackContext {
  readonly locator: LessonRef | null;
  readonly contentRevision: number | null;
  /** Attempts in the current lesson revision; answer text is never included. */
  readonly exerciseAttemptCount: number;
  readonly signedIn: boolean;
  readonly route: string;
  readonly viewport: readonly [number, number];
}

export interface FeedbackSubmission {
  readonly message: string;
  readonly context: FeedbackContext;
}

/** A stored note, intentionally without email, answer, or lesson prose. */
export interface FeedbackRecord extends FeedbackSubmission {
  readonly id: string;
  readonly createdAt: string;
}

export interface FeedbackReceipt {
  readonly id: string | null;
  readonly submittedAt: string;
  readonly transport: Exclude<FeedbackTransport, "unavailable">;
}

/** Learner-side actions. `readMine` is empty for an anonymous learner. */
export interface FeedbackPort {
  readonly transport: FeedbackTransport;
  submit(input: FeedbackSubmission): Promise<FeedbackReceipt>;
  readMine(): Promise<readonly FeedbackRecord[]>;
}

/**
 * The aggregate answer facts the owner may compare with a feedback group.
 *
 * `firstAttemptCount` is the number of learner/exercise pairs with a recorded
 * first attempt, not the number of exercises in the lesson. The UI can then
 * show both the first-pass rate and how much of the lesson has real coverage.
 * No answer text or raw learner document crosses this boundary.
 */
export interface FeedbackAnswerAggregate {
  readonly locator: LessonRef;
  readonly contentRevision: number;
  readonly exerciseCount: number;
  readonly firstAttemptCount: number;
  readonly firstPassCount: number;
  readonly totalAttempts: number;
}

/**
 * Author-only read model. It is separate so learners can never ask for all
 * notes or answer aggregates.
 */
export interface FeedbackReviewSource {
  listAll(): Promise<readonly FeedbackRecord[]>;
  listAnswerAggregates(studyId: string): Promise<readonly FeedbackAnswerAggregate[]>;
}
