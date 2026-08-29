import type { LexiconEntry } from "@pieai/university-core/domain/schemas.js";
import type { RatingName } from "@pieai/university-core";

import type { PriorAttempt, ReviewCardLocator } from "../view/lesson-view.js";

/** The network/host-independent actions a shared review card needs. */
export type ReviewRatingPreview = Readonly<Record<RatingName, number>>;

export interface ReviewCardPort {
  /**
   * Returns the existing scheduler's read-only interval for each rating, in
   * milliseconds from now. A missing card has no safe preview to show.
   */
  preview(card: ReviewCardLocator): ReviewRatingPreview | null;
  reveal(
    card: ReviewCardLocator,
    input: {
      readonly commandId: string;
      readonly contentRevision: number;
      readonly answer: string;
      readonly startedAt?: string;
    },
  ): Promise<{
    readonly back: string | null;
    readonly priorAttempts?: readonly PriorAttempt[];
  }>;
  rate(card: ReviewCardLocator, rating: 1 | 2 | 3 | 4): Promise<{ readonly dueAt: string }>;
}

export interface VocabularyDueWord {
  readonly senseId: string;
  readonly stage: string;
  readonly entry: LexiconEntry;
}

/** The shared vocabulary panel's storage/scheduler boundary. */
export interface VocabularyReviewPort {
  load(): Promise<{
    readonly due: readonly VocabularyDueWord[];
    readonly reviewedToday: number;
  }>;
  rate(senseId: string, rating: 1 | 2 | 3 | 4): Promise<void>;
}
