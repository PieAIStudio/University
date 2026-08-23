/**
 * Where a learner's progress lives, as far as this package is concerned.
 *
 * The bytes sit behind two injected ports: a local `Persistence` (today a
 * `localStorage` key, tomorrow a file) and an optional `ProgressRemoteStore`
 * (the browser app may inject its University/SwimmerBackend adapter; tests
 * use an in-memory fake).
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

export interface LessonProgress {
  /** 0 to 1. Never moves backwards — a failed attempt cannot undo progress. */
  progress: number;
  completedAt: number | null;
  attempts: number;
}

export interface CardProgress {
  readonly cardKey: string;
  readonly studyId: string;
  readonly courseId: string;
  readonly lessonId: string;
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

export interface ProgressDocument {
  lessons: Record<string, LessonProgress>;
  cards: Record<string, CardProgress>;
  words: Record<string, WordProgress>;
  streak: { days: number; lastDay: string | null };
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
  dropCards(studyId: string, courseId: string, lessonId: string, cardIds: readonly string[]): void;
  dueCards(asOf?: number): readonly CardProgress[];
  dueTomorrow(asOf?: number): number;
  gradeCard(cardKey: string, rating: RatingName): void;
  stageWord(senseId: string, stage: WordProgress["stage"]): void;
  vocabularyStates(): readonly VocabularyState[];
  wordStages(): ReadonlyMap<string, string>;
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
