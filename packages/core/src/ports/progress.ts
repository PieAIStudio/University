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
import type { LessonDocumentKey } from "../progress/document.js";

/** Learner-facing cards that share the one ProgressDocument scheduler. */
export type LearnerCardKind = "course-card" | "recap-card";

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
  /** Absent on cards written before card kinds became explicit. */
  readonly kind?: LearnerCardKind;
  readonly studyId: string;
  readonly courseId: string;
  /** Required for recap cards; old course-card rows did not store the unit. */
  readonly unitId?: string;
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

/** The one learner write that turns a typed teach-back into a scheduled card. */
export interface RecapCardInput {
  readonly locator: LessonRef;
  readonly contentRevision: number;
  readonly commandId: string;
  readonly answer: string;
}

export interface ProgressDocument {
  lessons: Record<string, LessonProgress>;
  cards: Record<string, CardProgress>;
  words: Record<string, WordProgress>;
  streak: { days: number; lastDay: string | null };
  /** Total XP is shared learner data, not a browser-only display cache. */
  totalXp: number;
  /** Immutable event id to XP amount; the merge is a set union followed by a sum. */
  xpEvents: Record<string, number>;
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
  /*
    `LessonDocumentKey`, not `string`. `lessonRefKey` also produces a lesson
    key, for shared surfaces, with the unit in it — and it was handed to
    `confirmLessonRead`, which writes into the document. Both are strings, so
    nothing complained; the confirmation landed under a name no reader used and
    a lesson could not be finished in either shell. The brand is what makes
    that a compile error instead of a silent row.
  */
  lessonState(key: LessonDocumentKey): LessonProgress;
  advanceLesson(key: LessonDocumentKey, progress: number): void;
  confirmLessonRead(key: LessonDocumentKey, contentRevision: number): void;
  /** Record one idempotent XP event in the shared learner document. */
  addXp(eventId: string, amount: number): void;
  dropCards(studyId: string, courseId: string, lessonId: string, cardIds: readonly string[]): void;
  /** Store one learner-authored teach-back and schedule its return. */
  createRecapCard(input: RecapCardInput): void;
  /** Read the recap card for a lesson without exposing the document key builder. */
  recapCard(locator: LessonRef): CardProgress | null;
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
