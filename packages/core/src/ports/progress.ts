/**
 * Where a learner's progress lives, as far as this package is concerned.
 *
 * The bytes sit behind two injected ports: a local `Persistence` used as the
 * durable offline cache/outbox and an optional `ProgressRemoteStore` (the
 * browser app injects its University/SwimmerBackend adapter; tests use an
 * in-memory fake).
 * Neither lives in this file. This package has no `fetch`, no `fs`, and no
 * React; a store that imported any of them would stop being something the
 * authoring server and the delivery shell could share. The browser adapter
 * is `createBrowserPersistence` in `@pieai/university-ui/progress` — next to
 * favourites and practice — because `localStorage` is the same kind of
 * platform I/O as `fs`, and putting it here would be the rule broken.
 *
 * The document itself is `progress/document.ts`. Merge is `progress/merge.ts`.
 * The one implementation both shells are supposed to call is
 * `createProgressPort` in `progress/port.ts`.
 */

import type { VocabularyState } from "../language/layer.js";
import type { RatingName, StoredCard } from "../scheduling/fsrs.js";
import type { ReaderMark } from "../domain/reader-marks.js";
import type { LessonRef } from "../progress/contract.js";
import type { HostExerciseGrade } from "./grading.js";
import type { AccountData, AccountPreferences } from "./account-data.js";
import type { FavouritesState } from "../favourites/model.js";
import type { PracticeRecentState } from "../practice/recent.js";

export interface LessonProgress {
  /** 0 to 1. Never moves backwards — a failed attempt cannot undo progress. */
  progress: number;
  completedAt: number | null;
  attempts: number;
  /** The learner separately confirmed reading this lesson revision. */
  readonly readConfirmed?: boolean;
  /** The authored revision the confirmation belongs to. */
  readonly readConfirmedRevision?: number;
}

export interface CardProgress {
  readonly cardKey: string;
  readonly studyId: string;
  readonly courseId: string;
  readonly lessonId: string;
  /** Revision of the authored card content this scheduler state belongs to. */
  readonly contentRevision?: number;
  /** Milliseconds since epoch. The due queue is `dueAt <= now`, nothing more. */
  dueAt: number;
  /** The scheduler's own state, stored verbatim so nothing here interprets it. */
  fsrs: StoredCard;
}

/**
 * What the learner has said about one English word.
 *
 * A word the learner is learning carries a real scheduler card, not a bare
 * flag, because the layer composer treats an overdue learning word as a reason
 * to stop introducing new ones.
 */
export interface WordProgress {
  readonly senseId: string;
  stage: "learning" | "familiar" | "paused";
  /** Milliseconds. Only meaningful while `stage` is `learning`. */
  dueAt: number | null;
  lapses: number;
  fsrs: StoredCard | null;
}

/**
 * A reader mark with an explicit deletion tombstone.
 *
 * A cloud document is merged as a union. Removing a mark from one device must
 * therefore leave a small, mergeable fact behind; otherwise the mark would
 * reappear the next time another device uploads its older copy.
 */
export interface StoredReaderMark extends ReaderMark {
  readonly deletedAt: string | null;
}

/**
 * The learner answer/host verdict record that has to survive a device change.
 * `commandId` is the idempotency key, not merely an HTTP detail: a retry must
 * never create a second copy of one answer in the cloud document.
 */
export interface ExerciseAttemptRecord {
  readonly commandId: string;
  readonly locator: LessonRef;
  readonly exerciseId: string;
  readonly contentRevision: number;
  readonly answer: string;
  readonly score: number;
  readonly maxScore: number;
  readonly hostGrade: HostExerciseGrade | null;
  readonly occurredAt: string;
}

/** A recalled answer for a review card, kept with the account for later coaching. */
export interface RetrievalAttemptRecord {
  readonly commandId: string;
  readonly cardKey: string;
  readonly contentRevision: number;
  readonly answer: string;
  readonly revealedAt: string;
  readonly durationMs: number;
  readonly usedHint: boolean;
  readonly confidence?: number;
}

export interface ProgressDocument {
  lessons: Record<string, LessonProgress>;
  cards: Record<string, CardProgress>;
  words: Record<string, WordProgress>;
  streak: { days: number; lastDay: string | null };
  /** Cloud-synchronised reader annotations, keyed by mark id. */
  readerMarks: Record<string, StoredReaderMark>;
  /** Cloud-synchronised learner answers and host evaluations, keyed by command id. */
  exerciseAttempts: Record<string, ExerciseAttemptRecord>;
  /** Cloud-synchronised recall answers for review-card coaching. */
  retrievalAttempts: Record<string, RetrievalAttemptRecord>;
  /** Account-owned library, practice and reading preferences. */
  account: AccountData;
}

export interface Persistence {
  read(): string | null;
  write(raw: string): void;
}

/**
 * Replaceable remote for one learner's progress document.
 *
 * The concrete network adapter is owned by the browser product because this
 * package must stay platform-neutral. SwimmerBackend owns the University
 * table and its migration; this port only describes the contract. `load`
 * returning `null` means "this user has no row", which is the first-login
 * case, not an error.
 */
export interface ProgressRemoteStore {
  load(userId: string): Promise<ProgressDocument | null>;
  save(userId: string, document: ProgressDocument): Promise<void>;
}

export type ProgressSyncStatus = "idle" | "syncing" | "offline";

export interface ProgressSyncState {
  readonly dirty: boolean;
  readonly status: ProgressSyncStatus;
  readonly userId: string | null;
}

export interface ProgressPort {
  snapshot(): ProgressDocument;
  subscribe(listener: () => void): () => void;
  lessonState(key: string): LessonProgress;
  advanceLesson(key: string, progress: number): void;
  confirmLessonRead(key: string, contentRevision: number): void;
  dropCards(studyId: string, courseId: string, lessonId: string, cardIds: readonly string[]): void;
  dueCards(asOf?: number): readonly CardProgress[];
  dueTomorrow(asOf?: number): number;
  gradeCard(cardKey: string, rating: RatingName): void;
  gradeWord(senseId: string, rating: RatingName): void;
  /** Merge a card recovered from an older local learner database. */
  importCard(card: CardProgress): void;
  /** Merge a word recovered from an older local learner database. */
  importWord(word: WordProgress): void;
  stageWord(senseId: string, stage: WordProgress["stage"]): void;
  vocabularyStates(): readonly VocabularyState[];
  wordStages(): ReadonlyMap<string, string>;
  readerMarks(studyId?: string): readonly ReaderMark[];
  saveReaderMark(mark: ReaderMark): void;
  resolveReaderMark(studyId: string, markId: string): void;
  deleteReaderMark(studyId: string, markId: string): void;
  recordExerciseAttempt(record: ExerciseAttemptRecord): void;
  exerciseAttempts(
    locator: LessonRef,
    exerciseId: string,
    contentRevision: number,
  ): readonly ExerciseAttemptRecord[];
  latestExerciseAttempt(
    locator: LessonRef,
    exerciseId: string,
    contentRevision: number,
  ): ExerciseAttemptRecord | null;
  recordRetrievalAttempt(record: RetrievalAttemptRecord): void;
  retrievalAttempts(cardKey: string): readonly RetrievalAttemptRecord[];
  accountData(): AccountData;
  setFavourites(state: FavouritesState): void;
  setPracticeRecent(state: PracticeRecentState): void;
  setAccountPreferences(next: AccountPreferences): void;
  resetAll(): void;
  /**
   * Start or stop cloud sync for this document.
   *
   * `userId` set: pull the remote row, merge it with what is already on this
   * machine so local work is not overwritten, write the result both places.
   * `userId` null: stop syncing. Local data stays. Signing out is not erase.
   */
  bindAccount(userId: string | null, remote: ProgressRemoteStore | null): Promise<void>;
  flush(): Promise<void>;
  syncState(): ProgressSyncState;
}
