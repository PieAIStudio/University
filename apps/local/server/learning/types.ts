import type {
  ReaderMark,
  ReaderMarkKind,
  TextQuote,
} from "@pieai/university-core/domain/reader-marks.js";
import type { Card, FSRSParameters, Grade } from "ts-fsrs";

export type { ReaderMarkKind, TextQuote } from "@pieai/university-core/domain/reader-marks.js";

const CONTENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTENT_ID_MAX_LENGTH = 64;

declare const lessonContentKeyBrand: unique symbol;
declare const cardContentKeyBrand: unique symbol;
declare const exerciseContentKeyBrand: unique symbol;
declare const reviewContentKeyBrand: unique symbol;

export type LessonContentKey = string & { readonly [lessonContentKeyBrand]: true };
export type ReviewContentKey = string & { readonly [reviewContentKeyBrand]: true };
export type CardContentKey = ReviewContentKey & { readonly [cardContentKeyBrand]: true };
export type ExerciseContentKey = string & { readonly [exerciseContentKeyBrand]: true };

interface LessonContentIdentity {
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
}

interface CardContentIdentity extends LessonContentIdentity {
  readonly cardId: string;
}

interface ExerciseContentIdentity extends LessonContentIdentity {
  readonly exerciseId: string;
}

interface KnowledgeCardContentIdentity {
  readonly noteId: string;
  readonly cardId: string;
}

type ReviewContentIdentity =
  | ({ readonly kind: "course-card" } & CardContentIdentity)
  | ({ readonly kind: "knowledge-card" } & KnowledgeCardContentIdentity);

function validateContentId(value: string, label: string): void {
  if (value.length < 2 || value.length > CONTENT_ID_MAX_LENGTH || !CONTENT_ID_PATTERN.test(value)) {
    throw new Error(`${label} must be a stable lowercase kebab-case content ID`);
  }
}

function createScopedContentKey(
  parts: readonly (readonly [value: string, label: string])[],
): string {
  for (const [value, label] of parts) validateContentId(value, label);
  return parts.map(([value]) => value).join("/");
}

function parseScopedContentKey(value: string, labels: readonly string[]): readonly string[] {
  const parts = value.split("/");
  if (parts.length !== labels.length) {
    throw new Error(`Invalid scoped content key: expected ${labels.join("/")}`);
  }
  for (const [index, label] of labels.entries()) validateContentId(parts[index] ?? "", label);
  return parts;
}

export function lessonContentKey(identity: LessonContentIdentity): LessonContentKey {
  return createScopedContentKey([
    [identity.courseId, "Course ID"],
    [identity.unitId, "Unit ID"],
    [identity.lessonId, "Lesson ID"],
  ]) as LessonContentKey;
}

export function cardContentKey(identity: CardContentIdentity): CardContentKey {
  return createScopedContentKey([
    [identity.courseId, "Course ID"],
    [identity.unitId, "Unit ID"],
    [identity.lessonId, "Lesson ID"],
    [identity.cardId, "Card ID"],
  ]) as CardContentKey;
}

export function knowledgeCardContentKey(identity: KnowledgeCardContentIdentity): ReviewContentKey {
  return createScopedContentKey([
    ["knowledge", "Knowledge scope"],
    [identity.noteId, "Knowledge note ID"],
    [identity.cardId, "Card ID"],
  ]) as ReviewContentKey;
}

export function exerciseContentKey(identity: ExerciseContentIdentity): ExerciseContentKey {
  return createScopedContentKey([
    [identity.courseId, "Course ID"],
    [identity.unitId, "Unit ID"],
    [identity.lessonId, "Lesson ID"],
    [identity.exerciseId, "Exercise ID"],
  ]) as ExerciseContentKey;
}

export function parseLessonContentKey(value: string): LessonContentIdentity {
  const [courseId, unitId, lessonId] = parseScopedContentKey(value, [
    "Course ID",
    "Unit ID",
    "Lesson ID",
  ]);
  return { courseId: courseId!, unitId: unitId!, lessonId: lessonId! };
}

function parseCardContentKey(value: string): CardContentIdentity {
  const [courseId, unitId, lessonId, cardId] = parseScopedContentKey(value, [
    "Course ID",
    "Unit ID",
    "Lesson ID",
    "Card ID",
  ]);
  return { courseId: courseId!, unitId: unitId!, lessonId: lessonId!, cardId: cardId! };
}

export function parseReviewContentKey(value: string): ReviewContentIdentity {
  const parts = value.split("/");
  if (parts.length === 4) {
    return { kind: "course-card", ...parseCardContentKey(value) };
  }
  if (parts.length === 3 && parts[0] === "knowledge") {
    const [, noteId, cardId] = parseScopedContentKey(value, [
      "Knowledge scope",
      "Knowledge note ID",
      "Card ID",
    ]);
    return { kind: "knowledge-card", noteId: noteId!, cardId: cardId! };
  }
  throw new Error(
    "Invalid review content key: expected course/unit/lesson/card or knowledge/note/card",
  );
}

export function reviewContentKey(value: string): ReviewContentKey {
  parseReviewContentKey(value);
  return value as ReviewContentKey;
}

export function parseExerciseContentKey(value: string): ExerciseContentIdentity {
  const [courseId, unitId, lessonId, exerciseId] = parseScopedContentKey(value, [
    "Course ID",
    "Unit ID",
    "Lesson ID",
    "Exercise ID",
  ]);
  return {
    courseId: courseId!,
    unitId: unitId!,
    lessonId: lessonId!,
    exerciseId: exerciseId!,
  };
}

export interface StoredCardState extends Card {
  readonly cardKey: ReviewContentKey;
  readonly contentRevision: number;
  readonly schedulerVersion: string;
  readonly schedulerConfigHash: string;
  readonly updatedAt: Date;
}

export interface ReviewCardInput {
  readonly commandId: string;
  readonly cardKey: ReviewContentKey;
  readonly contentRevision: number;
  readonly rating: Grade;
  readonly reviewedAt?: Date;
}

export interface ReviewReceipt {
  readonly eventId: string;
  readonly state: StoredCardState;
}

export interface CardProjectionReplayResult {
  readonly replayedEventCount: number;
  readonly eventBackedCardCount: number;
  readonly rebuiltCardCount: number;
  readonly untouchedCardCount: number;
}

export type LessonProgressStatus = "not-started" | "in-progress" | "completed";

export interface StoredLessonProgress {
  readonly lessonKey: LessonContentKey;
  readonly contentRevision: number;
  readonly status: LessonProgressStatus;
  readonly progress: number;
  readonly updatedAt: Date;
}

export interface RecordLessonProgressInput {
  readonly lessonKey: LessonContentKey;
  readonly contentRevision: number;
  readonly status: LessonProgressStatus;
  readonly progress: number;
  readonly occurredAt?: Date;
}

export interface RecordLessonCompletionInput {
  readonly commandId: string;
  readonly lessonKey: LessonContentKey;
  readonly contentRevision: number;
  readonly occurredAt?: Date;
}

export interface LessonCompletionReceipt {
  readonly eventId: string;
  readonly idempotent: boolean;
}

export interface RecordExerciseAttemptInput {
  readonly commandId: string;
  readonly exerciseKey: ExerciseContentKey;
  readonly contentRevision: number;
  readonly score: number;
  readonly maxScore: number;
  readonly response?: unknown;
  readonly occurredAt?: Date;
}

/** A raw exercise event used only by the one-time browser migration. */
export interface StoredExerciseAttempt {
  readonly attemptId: string;
  readonly commandId: string;
  readonly exerciseKey: ExerciseContentKey;
  readonly contentRevision: number;
  readonly score: number;
  readonly maxScore: number;
  readonly response: unknown;
  readonly occurredAt: Date;
}

/** Latest host (AI) grade written back for an exercise at one content revision. */
export interface StoredHostExerciseGrade {
  readonly passed: boolean;
  readonly evaluation: string;
  readonly extensions: readonly string[];
  readonly host: string | null;
  readonly learnerAnswer: string | null;
  readonly occurredAt: Date;
  readonly attemptId: string;
}

export interface StoredLearnerSubmission {
  readonly attemptId: string;
  readonly answer: string;
  readonly occurredAt: Date;
}

/**
 * One thing the learner actually wrote, with enough context to talk about it.
 *
 * The coaching material for expression is not authored: it is what the learner
 * already typed. The system has stored every one of these since the exercise
 * log existed and has never had a way to read them back.
 */
export interface WrittenAttempt {
  readonly attemptId: string;
  readonly exerciseKey: ExerciseContentKey;
  readonly contentRevision: number;
  readonly answer: string;
  readonly occurredAt: Date;
}

export interface RecordRetrievalAttemptInput {
  readonly commandId: string;
  readonly cardKey: ReviewContentKey;
  readonly contentRevision: number;
  readonly answer: string;
  readonly startedAt: Date;
  readonly revealedAt: Date;
  readonly durationMs?: number;
  readonly usedHint: boolean;
  readonly confidence?: number;
  readonly sessionId?: string;
}

export interface StoredRetrievalAttempt {
  readonly attemptId: string;
  readonly commandId: string;
  readonly cardKey: ReviewContentKey;
  readonly contentRevision: number;
  readonly answer: string;
  readonly startedAt: Date;
  readonly revealedAt: Date;
  readonly durationMs: number;
  readonly usedHint: boolean;
  readonly confidence?: number;
  readonly sessionId?: string;
}

export interface LearningSessionMetadata {
  readonly host?: string;
  readonly objective?: string;
}

export interface StoredLearningSession {
  readonly sessionId: string;
  readonly startedAt: Date;
  readonly endedAt?: Date;
  readonly host?: string;
  readonly objective?: string;
}

export interface LearningSessionSummary extends StoredLearningSession {
  readonly reviewCount: number;
  readonly retrievalAttemptCount: number;
  readonly exerciseAttemptCount: number;
  readonly lessonProgressEventCount: number;
  readonly exerciseScore: number;
  readonly exerciseMaxScore: number;
}

export interface LearningStore {
  readonly schedulerVersion: string;
  readonly schedulerParameters: FSRSParameters;
  readonly schedulerConfigHash: string;
  ensureCard(cardKey: ReviewContentKey, contentRevision: number, now?: Date): StoredCardState;
  getCard(cardKey: ReviewContentKey): StoredCardState | null;
  listCards(limit?: number): readonly StoredCardState[];
  listDueCards(asOf?: Date, limit?: number): readonly StoredCardState[];
  reviewCard(input: ReviewCardInput): ReviewReceipt;
  rebuildCardStateFromReviewEvents(): CardProjectionReplayResult;
  getLessonProgress(lessonKey: LessonContentKey): StoredLessonProgress | null;
  listLessonProgress(limit?: number): readonly StoredLessonProgress[];
  hasLessonCompletion(lessonKey: LessonContentKey, contentRevision: number): boolean;
  recordLessonCompletion(input: RecordLessonCompletionInput): LessonCompletionReceipt;
  recordLessonProgress(input: RecordLessonProgressInput): string;
  recordExerciseAttempt(input: RecordExerciseAttemptInput): string;
  listExerciseAttempts(limit?: number): readonly StoredExerciseAttempt[];
  countExerciseAttempts(exerciseKey: ExerciseContentKey, contentRevision: number): number;
  countLearnerSubmissions(exerciseKey: ExerciseContentKey, contentRevision: number): number;
  getLatestLearnerSubmission(
    exerciseKey: ExerciseContentKey,
    contentRevision: number,
  ): StoredLearnerSubmission | null;
  listRecentWrittenAttempts(limit?: number): readonly WrittenAttempt[];
  hasCorrectExerciseAttempt(exerciseKey: ExerciseContentKey, contentRevision: number): boolean;
  getLatestHostExerciseGrade(
    exerciseKey: ExerciseContentKey,
    contentRevision: number,
  ): StoredHostExerciseGrade | null;
  transaction<T>(operation: () => T): T;
  recordRetrievalAttempt(input: RecordRetrievalAttemptInput): StoredRetrievalAttempt;
  getRetrievalAttempt(attemptId: string): StoredRetrievalAttempt | null;
  getRetrievalAttemptByCommandId(commandId: string): StoredRetrievalAttempt | null;
  /**
   * Recent answers the learner typed for this card, newest first.
   *
   * `recordRetrievalAttempt` has been storing every answer since the table
   * existed; nothing has read them back until now. The UI wants "what you
   * wrote last time" under the revealed answer. Returns attempts across ALL
   * content revisions — each row already carries `contentRevision`, so the
   * caller can tell an older-content answer from a current one. Filtering
   * revisions here would hide exactly the history that shows how the
   * learner's understanding changed.
   */
  listRetrievalAttempts(
    cardKey: ReviewContentKey,
    limit?: number,
  ): readonly StoredRetrievalAttempt[];
  retrievalAttemptCount(): number;
  startSession(
    startedAtOrMetadata?: Date | LearningSessionMetadata,
    metadata?: LearningSessionMetadata,
  ): string;
  getSession(sessionId: string): StoredLearningSession | null;
  getOpenSession(): StoredLearningSession | null;
  listSessions(limit?: number): readonly StoredLearningSession[];
  getSessionSummary(sessionId: string): LearningSessionSummary | null;
  endSession(sessionId: string, endedAt?: Date): LearningSessionSummary;
  /**
   * Most recent moment this learner did anything in this study, or null if
   * they never have.
   *
   * Derived from existing events rather than a stored "last opened" field —
   * a stored field would be a second source of truth that can disagree with
   * the events. Lets the shelf surface recently-studied projects instead of
   * always opening whichever study sorts first alphabetically.
   */
  getLastActivityAt(): Date | null;
  reviewEventCount(): number;
  recordReaderMark(input: RecordReaderMarkInput): StoredReaderMark;
  listReaderMarks(options?: ListReaderMarksOptions): readonly StoredReaderMark[];
  resolveReaderMark(markId: string, resolvedAt?: Date): boolean;
  deleteReaderMark(markId: string): boolean;
  backup(destination: string): Promise<number>;
  close(): void;
}

/**
 * Why the reader stopped on this passage.
 *
 * Two kinds, kept apart because they lead somewhere different: a `question`
 * wants an answer and belongs in the batch you hand to an assistant, while a
 * `highlight` is "this mattered" and wants nothing. Folding them into one list
 * would mean either pestering the reader about passages they understood
 * perfectly, or burying the ones they did not.
 */
export interface RecordReaderMarkInput {
  readonly lessonKey: string;
  readonly contentRevision: number;
  readonly kind: ReaderMarkKind;
  readonly quote: TextQuote;
  /** Nearest heading above the selection, so a batched question reads in context. */
  readonly sectionTitle?: string | undefined;
  readonly note?: string | undefined;
  readonly createdAt?: Date | undefined;
}

export type StoredReaderMark = ReaderMark;

export interface ListReaderMarksOptions {
  readonly lessonKey?: string | undefined;
  readonly kind?: ReaderMarkKind | undefined;
  readonly includeResolved?: boolean | undefined;
  readonly limit?: number | undefined;
}
