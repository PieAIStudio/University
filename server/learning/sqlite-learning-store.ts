import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";

import {
  FSRSVersion,
  Rating,
  State,
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type FSRSParameters,
  type Grade,
} from "ts-fsrs";

import { LEARNING_SCHEMA_VERSION, migrate } from "./schema.js";
import {
  exerciseContentKey,
  parseExerciseContentKey,
  parseLessonContentKey,
  reviewContentKey,
  type CardProjectionReplayResult,
  type ExerciseContentKey,
  type LearningSessionMetadata,
  type LearningSessionSummary,
  type LessonContentKey,
  type LearningStore,
  type RecordExerciseAttemptInput,
  type RecordLessonProgressInput,
  type RecordRetrievalAttemptInput,
  type ReviewContentKey,
  type ReviewCardInput,
  type ReviewReceipt,
  type StoredCardState,
  type StoredHostExerciseGrade,
  type StoredLearnerSubmission,
  type WrittenAttempt,
  type StoredLessonProgress,
  type StoredLearningSession,
  type StoredRetrievalAttempt,
} from "./types.js";
import { LESSON_STATUS_ORDER, validateLessonProgress } from "./lesson-progress.js";

export { LEARNING_SCHEMA_VERSION };
const MAX_RETRIEVAL_ANSWER_LENGTH = 100_000;
const DEFAULT_PARAMETERS = generatorParameters({
  request_retention: 0.9,
  enable_fuzz: false,
});

interface CardStateRow {
  card_id: string;
  content_revision: number;
  due_at: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review_at: number | null;
  scheduler_version: string;
  scheduler_config_hash: string;
  updated_at: number;
}

interface SchedulerProfileRow {
  scheduler_version: string;
  parameters_json: string;
  scheduler_config_hash: string;
}

interface ReviewCommandRow {
  event_id: string;
  card_id: string;
  content_revision: number;
  rating: number;
  reviewed_at: number;
  payload_json: string;
}

interface ReviewEventRow {
  event_id: string;
  card_id: string;
  content_revision: number;
  rating: number;
  reviewed_at: number;
  previous_due_at: number;
  resulting_due_at: number;
  scheduler_version: string;
  scheduler_config_hash: string;
  payload_json: string;
}

interface ExerciseCommandRow {
  attempt_id: string;
  exercise_id: string;
  content_revision: number;
  score: number;
  max_score: number;
  response_json: string | null;
  occurred_at: number;
}

interface RetrievalAttemptRow {
  attempt_id: string;
  command_id: string;
  card_key: string;
  content_revision: number;
  answer: string;
  started_at: number;
  revealed_at: number;
  duration_ms: number;
  used_hint: number;
  confidence: number | null;
  session_id: string | null;
}

interface LessonProgressRow {
  content_revision: number;
  status: string;
  progress: number;
  updated_at: number;
}

interface LearningSessionRow {
  session_id: string;
  started_at: number;
  ended_at: number | null;
  host: string | null;
  objective: string | null;
}

interface LearningSessionSummaryRow extends LearningSessionRow {
  review_count: number;
  retrieval_attempt_count: number;
  exercise_attempt_count: number;
  lesson_progress_event_count: number;
  exercise_score: number;
  exercise_max_score: number;
}

interface SerializedCardState {
  cardKey: string;
  contentRevision: number;
  dueAt: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReviewAt?: string;
  schedulerVersion: string;
  schedulerConfigHash: string;
  updatedAt: string;
}

function stableJson(value: FSRSParameters): string {
  return JSON.stringify({
    request_retention: value.request_retention,
    maximum_interval: value.maximum_interval,
    w: [...value.w],
    enable_fuzz: value.enable_fuzz,
    enable_short_term: value.enable_short_term,
    learning_steps: [...value.learning_steps],
    relearning_steps: [...value.relearning_steps],
  });
}

function hashParameters(value: FSRSParameters): string {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function rowToState(row: CardStateRow): StoredCardState {
  const cardKey = reviewContentKey(row.card_id);
  return {
    cardKey,
    contentRevision: row.content_revision,
    due: new Date(row.due_at),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    ...(row.last_review_at === null ? {} : { last_review: new Date(row.last_review_at) }),
    schedulerVersion: row.scheduler_version,
    schedulerConfigHash: row.scheduler_config_hash,
    updatedAt: new Date(row.updated_at),
  };
}

function toFsrsCard(state: StoredCardState): Card {
  return {
    due: state.due,
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsed_days,
    scheduled_days: state.scheduled_days,
    learning_steps: state.learning_steps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    ...(state.last_review ? { last_review: state.last_review } : {}),
  };
}

function cardToStoredState(
  cardKey: ReviewContentKey,
  contentRevision: number,
  card: Card,
  schedulerVersion: string,
  schedulerConfigHash: string,
  updatedAt: Date,
): StoredCardState {
  return {
    cardKey,
    contentRevision,
    ...card,
    schedulerVersion,
    schedulerConfigHash,
    updatedAt,
  };
}

function serializeCardState(state: StoredCardState): SerializedCardState {
  return {
    cardKey: state.cardKey,
    contentRevision: state.contentRevision,
    dueAt: state.due.toISOString(),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsedDays: state.elapsed_days,
    scheduledDays: state.scheduled_days,
    learningSteps: state.learning_steps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    ...(state.last_review ? { lastReviewAt: state.last_review.toISOString() } : {}),
    schedulerVersion: state.schedulerVersion,
    schedulerConfigHash: state.schedulerConfigHash,
    updatedAt: state.updatedAt.toISOString(),
  };
}

function deserializeCardState(value: SerializedCardState): StoredCardState {
  const due = new Date(value.dueAt);
  const updatedAt = new Date(value.updatedAt);
  const lastReview = value.lastReviewAt ? new Date(value.lastReviewAt) : undefined;
  if (
    !Number.isFinite(due.getTime()) ||
    !Number.isFinite(updatedAt.getTime()) ||
    (lastReview && !Number.isFinite(lastReview.getTime()))
  ) {
    throw new Error("Stored review receipt contains an invalid date");
  }
  return {
    cardKey: reviewContentKey(value.cardKey),
    contentRevision: value.contentRevision,
    due,
    stability: value.stability,
    difficulty: value.difficulty,
    elapsed_days: value.elapsedDays,
    scheduled_days: value.scheduledDays,
    learning_steps: value.learningSteps,
    reps: value.reps,
    lapses: value.lapses,
    state: value.state as State,
    ...(lastReview ? { last_review: lastReview } : {}),
    schedulerVersion: value.schedulerVersion,
    schedulerConfigHash: value.schedulerConfigHash,
    updatedAt,
  };
}

function sameSerializedCardState(left: SerializedCardState, right: SerializedCardState): boolean {
  return JSON.stringify(sortJsonValue(left)) === JSON.stringify(sortJsonValue(right));
}

function validateId(value: string, label: string): void {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 200) {
    throw new Error(`${label} must contain between 1 and 200 characters`);
  }
}

function optionalSessionText(
  value: string | undefined,
  label: string,
  maximumLength: number,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximumLength) {
    throw new Error(`${label} must contain between 1 and ${maximumLength} characters`);
  }
  return normalized;
}

function normalizeSessionMetadata(metadata: LearningSessionMetadata | undefined): {
  readonly host?: string;
  readonly objective?: string;
} {
  const host = optionalSessionText(metadata?.host, "Session host", 100);
  const objective = optionalSessionText(metadata?.objective, "Session objective", 2_000);
  return {
    ...(host === undefined ? {} : { host }),
    ...(objective === undefined ? {} : { objective }),
  };
}

function validateRevision(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Content revision must be a positive integer");
  }
}

function timestamp(value: Date, label: string): number {
  if (!(value instanceof Date)) throw new Error(`${label} must be a valid date`);
  const result = value.getTime();
  if (!Number.isFinite(result)) throw new Error(`${label} must be a valid date`);
  return result;
}

function validateRetrievalAnswer(value: string): void {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > MAX_RETRIEVAL_ANSWER_LENGTH
  ) {
    throw new Error(
      `Retrieval answer must contain between 1 and ${MAX_RETRIEVAL_ANSWER_LENGTH} characters`,
    );
  }
}

function validateRetrievalConfidence(value: number | undefined): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Retrieval confidence must be between 0 and 1");
  }
}

function retrievalTiming(
  startedAt: Date,
  revealedAt: Date,
  requestedDurationMs: number | undefined,
): { readonly startedAtMs: number; readonly revealedAtMs: number; readonly durationMs: number } {
  const startedAtMs = timestamp(startedAt, "Retrieval start time");
  const revealedAtMs = timestamp(revealedAt, "Retrieval reveal time");
  const durationMs = revealedAtMs - startedAtMs;
  if (!Number.isSafeInteger(durationMs) || durationMs < 0) {
    throw new Error("Retrieval reveal time must not be earlier than its start time");
  }
  if (
    requestedDurationMs !== undefined &&
    (!Number.isSafeInteger(requestedDurationMs) || requestedDurationMs !== durationMs)
  ) {
    throw new Error("Retrieval duration must equal revealedAt minus startedAt in milliseconds");
  }
  return { startedAtMs, revealedAtMs, durationMs };
}

function rowToRetrievalAttempt(row: RetrievalAttemptRow): StoredRetrievalAttempt {
  validateId(row.attempt_id, "Attempt ID");
  validateId(row.command_id, "Command ID");
  const cardKey = reviewContentKey(row.card_key);
  validateRevision(row.content_revision);
  validateRetrievalAnswer(row.answer);
  if (row.used_hint !== 0 && row.used_hint !== 1) {
    throw new Error(`Retrieval attempt ${row.attempt_id} contains an invalid used-hint value`);
  }
  const confidence = row.confidence ?? undefined;
  validateRetrievalConfidence(confidence);
  if (row.session_id !== null) validateId(row.session_id, "Session ID");
  const startedAt = new Date(row.started_at);
  const revealedAt = new Date(row.revealed_at);
  const timing = retrievalTiming(startedAt, revealedAt, row.duration_ms);
  return {
    attemptId: row.attempt_id,
    commandId: row.command_id,
    cardKey,
    contentRevision: row.content_revision,
    answer: row.answer,
    startedAt,
    revealedAt,
    durationMs: timing.durationMs,
    usedHint: row.used_hint === 1,
    ...(confidence === undefined ? {} : { confidence }),
    ...(row.session_id === null ? {} : { sessionId: row.session_id }),
  };
}

function rowToLearningSession(row: LearningSessionRow): StoredLearningSession {
  validateId(row.session_id, "Session ID");
  const startedAt = new Date(row.started_at);
  const endedAt = row.ended_at === null ? undefined : new Date(row.ended_at);
  timestamp(startedAt, "Session start time");
  if (endedAt) {
    timestamp(endedAt, "Session end time");
    if (endedAt.getTime() < startedAt.getTime()) {
      throw new Error(`Learning session ${row.session_id} ends before it starts`);
    }
  }
  const metadata = normalizeSessionMetadata({
    ...(row.host === null ? {} : { host: row.host }),
    ...(row.objective === null ? {} : { objective: row.objective }),
  });
  return {
    sessionId: row.session_id,
    startedAt,
    ...(endedAt ? { endedAt } : {}),
    ...metadata,
  };
}

function rowToLearningSessionSummary(row: LearningSessionSummaryRow): LearningSessionSummary {
  const session = rowToLearningSession(row);
  for (const [value, label] of [
    [row.review_count, "review count"],
    [row.retrieval_attempt_count, "retrieval-attempt count"],
    [row.exercise_attempt_count, "exercise-attempt count"],
    [row.lesson_progress_event_count, "lesson-progress-event count"],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Learning session ${row.session_id} contains an invalid ${label}`);
    }
  }
  if (
    !Number.isFinite(row.exercise_score) ||
    !Number.isFinite(row.exercise_max_score) ||
    row.exercise_score < 0 ||
    row.exercise_max_score < 0 ||
    row.exercise_score > row.exercise_max_score
  ) {
    throw new Error(`Learning session ${row.session_id} contains an invalid exercise aggregate`);
  }
  return {
    ...session,
    reviewCount: row.review_count,
    retrievalAttemptCount: row.retrieval_attempt_count,
    exerciseAttemptCount: row.exercise_attempt_count,
    lessonProgressEventCount: row.lesson_progress_event_count,
    exerciseScore: row.exercise_score,
    exerciseMaxScore: row.exercise_max_score,
  };
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .map((key) => [key, sortJsonValue(source[key])]),
    );
  }
  return value;
}

function serializeResponse(value: unknown): string | null {
  if (value === undefined) return null;
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error("Exercise response must be JSON-serializable");
  }
  if (serialized === undefined) throw new Error("Exercise response must be JSON-serializable");
  return JSON.stringify(sortJsonValue(JSON.parse(serialized) as unknown));
}

function createPrivateFile(path: string): void {
  const descriptor = openSync(path, "a", 0o600);
  closeSync(descriptor);
  chmodSync(path, 0o600);
}

function protectSqliteFiles(path: string): void {
  for (const candidate of [path, `${path}-wal`, `${path}-shm`]) {
    if (existsSync(candidate)) chmodSync(candidate, 0o600);
  }
}

/** Make a rename's directory entry durable, the way `atomic-json` does. */
function syncDirectory(directory: string): void {
  const descriptor = openSync(directory, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

export class SqliteLearningStore implements LearningStore {
  readonly schedulerVersion = FSRSVersion;
  readonly schedulerParameters: FSRSParameters;
  readonly schedulerConfigHash: string;

  readonly #database: DatabaseSync;
  readonly #scheduler;
  /** 0 = no open transaction; >0 = nesting level, driving SAVEPOINT naming. */
  #transactionDepth = 0;

  constructor(path: string, parameters: Partial<FSRSParameters> = {}) {
    const fileBacked = path !== ":memory:";
    if (fileBacked) {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      createPrivateFile(path);
      protectSqliteFiles(path);
    }
    this.schedulerParameters = generatorParameters({ ...DEFAULT_PARAMETERS, ...parameters });
    this.schedulerConfigHash = hashParameters(this.schedulerParameters);
    this.#scheduler = fsrs(this.schedulerParameters);
    this.#database = new DatabaseSync(path, {
      enableForeignKeyConstraints: true,
      enableDoubleQuotedStringLiterals: false,
      allowExtension: false,
      timeout: 5_000,
      defensive: true,
    });

    try {
      this.#database.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;");
      migrate(this.#database, {
        schedulerVersion: this.schedulerVersion,
        parametersJson: stableJson(this.schedulerParameters),
        schedulerConfigHash: this.schedulerConfigHash,
      });
      this.#validateSchedulerProfile();
      this.#validateCardSchedulerMetadata();
      this.#validateScopedContentKeys();
      if (fileBacked) protectSqliteFiles(path);
    } catch (error) {
      this.#database.close();
      throw error;
    }
  }

  #validateSchedulerProfile(): void {
    const row = this.#database
      .prepare(`
        SELECT scheduler_version, parameters_json, scheduler_config_hash
        FROM scheduler_profile WHERE singleton_id = 1
      `)
      .get() as SchedulerProfileRow | undefined;
    if (!row) throw new Error("Learning database is missing its scheduler profile");

    let storedParameters: FSRSParameters;
    try {
      storedParameters = JSON.parse(row.parameters_json) as FSRSParameters;
      if (hashParameters(storedParameters) !== row.scheduler_config_hash) {
        throw new Error("stored scheduler parameter hash is invalid");
      }
    } catch {
      throw new Error("Learning database contains an invalid scheduler profile");
    }

    if (
      row.scheduler_version !== this.schedulerVersion ||
      row.scheduler_config_hash !== this.schedulerConfigHash ||
      stableJson(storedParameters) !== stableJson(this.schedulerParameters)
    ) {
      throw new Error(
        `Scheduler profile mismatch: database uses ${row.scheduler_version} / ${row.scheduler_config_hash}, requested ${this.schedulerVersion} / ${this.schedulerConfigHash}`,
      );
    }
  }

  #validateCardSchedulerMetadata(): void {
    const mismatch = this.#database
      .prepare(`
        SELECT card_id, scheduler_version, scheduler_config_hash
        FROM card_state
        WHERE scheduler_version <> ? OR scheduler_config_hash <> ?
        LIMIT 1
      `)
      .get(this.schedulerVersion, this.schedulerConfigHash) as
      | {
          card_id: string;
          scheduler_version: string;
          scheduler_config_hash: string;
        }
      | undefined;
    if (mismatch) {
      throw new Error(
        `Card scheduler metadata mismatch for ${mismatch.card_id}: database row uses ${mismatch.scheduler_version} / ${mismatch.scheduler_config_hash}`,
      );
    }
  }

  #validateScopedContentKeys(): void {
    const cardRows = this.#database
      .prepare(`
        SELECT card_id AS content_key FROM card_state
        UNION
        SELECT card_id AS content_key FROM review_event
      `)
      .all() as unknown as Array<{ content_key: string }>;
    for (const row of cardRows) reviewContentKey(row.content_key);

    const lessonRows = this.#database
      .prepare("SELECT lesson_id AS content_key, status, progress FROM lesson_progress")
      .all() as unknown as Array<{ content_key: string; status: string; progress: number }>;
    for (const row of lessonRows) {
      parseLessonContentKey(row.content_key);
      validateLessonProgress(row.status, row.progress);
    }

    const lessonEventRows = this.#database
      .prepare(
        "SELECT lesson_id AS content_key, content_revision, status, progress FROM lesson_progress_event",
      )
      .all() as unknown as Array<{
      content_key: string;
      content_revision: number;
      status: string;
      progress: number;
    }>;
    for (const row of lessonEventRows) {
      parseLessonContentKey(row.content_key);
      validateRevision(row.content_revision);
      validateLessonProgress(row.status, row.progress);
    }

    const exerciseRows = this.#database
      .prepare("SELECT exercise_id AS content_key FROM exercise_attempt")
      .all() as unknown as Array<{ content_key: string }>;
    for (const row of exerciseRows) parseExerciseContentKey(row.content_key);

    const retrievalRows = this.#database
      .prepare("SELECT * FROM retrieval_attempt")
      .all() as unknown as RetrievalAttemptRow[];
    for (const row of retrievalRows) rowToRetrievalAttempt(row);

    const sessionRows = this.#database
      .prepare("SELECT session_id, started_at, ended_at, host, objective FROM learning_session")
      .all() as unknown as LearningSessionRow[];
    for (const row of sessionRows) rowToLearningSession(row);
  }

  /**
   * Re-entrant unit of work. The outermost call is a real `BEGIN IMMEDIATE`;
   * anything nested inside it becomes a SAVEPOINT, so a caller can compose
   * several already-transactional store methods into one all-or-nothing
   * write without the inner `BEGIN` failing. Recording an exercise attempt,
   * advancing lesson progress, and enrolling the lesson's cards are one
   * outcome and must not be able to half-happen.
   */
  #transaction<T>(operation: () => T): T {
    if (this.#transactionDepth > 0) {
      const savepoint = `university_local_sp_${this.#transactionDepth}`;
      this.#database.exec(`SAVEPOINT ${savepoint}`);
      this.#transactionDepth += 1;
      try {
        const result = operation();
        this.#database.exec(`RELEASE ${savepoint}`);
        return result;
      } catch (error) {
        this.#database.exec(`ROLLBACK TO ${savepoint}`);
        this.#database.exec(`RELEASE ${savepoint}`);
        throw error;
      } finally {
        this.#transactionDepth -= 1;
      }
    }

    this.#database.exec("BEGIN IMMEDIATE");
    this.#transactionDepth = 1;
    try {
      const result = operation();
      this.#database.exec("COMMIT");
      return result;
    } catch (error) {
      if (this.#database.isTransaction) this.#database.exec("ROLLBACK");
      throw error;
    } finally {
      this.#transactionDepth = 0;
    }
  }

  /**
   * Run several store writes as one unit. Nested store calls join this
   * transaction rather than starting their own; if `operation` throws, every
   * write inside it is rolled back together.
   */
  transaction<T>(operation: () => T): T {
    return this.#transaction(operation);
  }

  #getCard(cardKey: ReviewContentKey): StoredCardState | null {
    const row = this.#database
      .prepare("SELECT * FROM card_state WHERE card_id = ?")
      .get(cardKey) as CardStateRow | undefined;
    return row ? rowToState(row) : null;
  }

  #getOpenSessionId(): string | null {
    const row = this.#database
      .prepare("SELECT session_id FROM learning_session WHERE ended_at IS NULL")
      .get() as { session_id: string } | undefined;
    return row?.session_id ?? null;
  }

  #saveCard(cardKey: ReviewContentKey, contentRevision: number, card: Card, updatedAt: Date): void {
    this.#database
      .prepare(`
        INSERT INTO card_state (
          card_id, content_revision, due_at, stability, difficulty, elapsed_days,
          scheduled_days, learning_steps, reps, lapses, state, last_review_at,
          scheduler_version, scheduler_config_hash, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(card_id) DO UPDATE SET
          content_revision = excluded.content_revision,
          due_at = excluded.due_at,
          stability = excluded.stability,
          difficulty = excluded.difficulty,
          elapsed_days = excluded.elapsed_days,
          scheduled_days = excluded.scheduled_days,
          learning_steps = excluded.learning_steps,
          reps = excluded.reps,
          lapses = excluded.lapses,
          state = excluded.state,
          last_review_at = excluded.last_review_at,
          scheduler_version = excluded.scheduler_version,
          scheduler_config_hash = excluded.scheduler_config_hash,
          updated_at = excluded.updated_at
      `)
      .run(
        cardKey,
        contentRevision,
        card.due.getTime(),
        card.stability,
        card.difficulty,
        card.elapsed_days,
        card.scheduled_days,
        card.learning_steps,
        card.reps,
        card.lapses,
        card.state,
        card.last_review?.getTime() ?? null,
        this.schedulerVersion,
        this.schedulerConfigHash,
        updatedAt.getTime(),
      );
  }

  ensureCard(
    cardKey: ReviewContentKey,
    contentRevision: number,
    now = new Date(),
  ): StoredCardState {
    reviewContentKey(cardKey);
    validateRevision(contentRevision);
    const nowMs = timestamp(now, "Card update time");
    return this.#transaction(() => {
      const existing = this.#getCard(cardKey);
      if (!existing) {
        const card = createEmptyCard(now);
        this.#saveCard(cardKey, contentRevision, card, now);
        return cardToStoredState(
          cardKey,
          contentRevision,
          card,
          this.schedulerVersion,
          this.schedulerConfigHash,
          now,
        );
      }
      if (contentRevision < existing.contentRevision) {
        throw new Error(
          `Content revision cannot move backward for card ${cardKey}: ${contentRevision} < ${existing.contentRevision}`,
        );
      }
      if (contentRevision === existing.contentRevision) return existing;
      if (nowMs < existing.updatedAt.getTime()) {
        throw new Error(`Card update time cannot move backward for card ${cardKey}`);
      }
      // Deliberate: a revision bump carries the FSRS state forward and only
      // advances the revision. `card_state` is a projection of the append-only
      // `review_event` log, and `rebuildCardStateFromReviewEvents` encodes the
      // same rule — a card whose stored revision is ahead of its events keeps
      // its replayed schedule. Resetting the schedule here would therefore be
      // undone by the next projection rebuild. Changing the policy means
      // recording the reset as an event, not editing the projection; see the
      // open question in docs/reference/execution/current-work.md.
      this.#database
        .prepare("UPDATE card_state SET content_revision = ?, updated_at = ? WHERE card_id = ?")
        .run(contentRevision, nowMs, cardKey);
      return { ...existing, contentRevision, updatedAt: now };
    });
  }

  getCard(cardKey: ReviewContentKey): StoredCardState | null {
    reviewContentKey(cardKey);
    return this.#getCard(cardKey);
  }

  listDueCards(asOf = new Date(), limit = 100): readonly StoredCardState[] {
    const asOfMs = timestamp(asOf, "Due-card cutoff");
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error("Due-card limit must be an integer between 1 and 1000");
    }
    const rows = this.#database
      .prepare("SELECT * FROM card_state WHERE due_at <= ? ORDER BY due_at, card_id LIMIT ?")
      .all(asOfMs, limit) as unknown as CardStateRow[];
    return rows.map(rowToState);
  }

  reviewCard(input: ReviewCardInput): ReviewReceipt {
    validateId(input.commandId, "Command ID");
    reviewContentKey(input.cardKey);
    validateRevision(input.contentRevision);
    if (![Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].includes(input.rating)) {
      throw new Error("A review rating must be Again, Hard, Good, or Easy");
    }
    const requestedReviewTime = input.reviewedAt
      ? timestamp(input.reviewedAt, "Review time")
      : undefined;

    return this.#transaction(() => {
      const duplicate = this.#database
        .prepare(`
          SELECT event_id, card_id, content_revision, rating, reviewed_at, payload_json
          FROM review_event WHERE command_id = ?
        `)
        .get(input.commandId) as ReviewCommandRow | undefined;
      if (duplicate) return this.#duplicateReviewReceipt(duplicate, input, requestedReviewTime);

      const reviewedAt = input.reviewedAt ?? new Date();
      const reviewedAtMs = requestedReviewTime ?? timestamp(reviewedAt, "Review time");
      let previous = this.#getCard(input.cardKey);
      if (!previous) {
        const emptyCard = createEmptyCard(reviewedAt);
        this.#saveCard(input.cardKey, input.contentRevision, emptyCard, reviewedAt);
        previous = cardToStoredState(
          input.cardKey,
          input.contentRevision,
          emptyCard,
          this.schedulerVersion,
          this.schedulerConfigHash,
          reviewedAt,
        );
      } else if (previous.contentRevision !== input.contentRevision) {
        throw new Error(
          `Card ${input.cardKey} is bound to content revision ${previous.contentRevision}; call ensureCard explicitly before reviewing revision ${input.contentRevision}`,
        );
      }
      if (reviewedAtMs < previous.updatedAt.getTime()) {
        throw new Error(`Review time cannot move backward for card ${input.cardKey}`);
      }

      const result = this.#scheduler.next(toFsrsCard(previous), reviewedAt, input.rating as Grade);
      const resultingState = cardToStoredState(
        input.cardKey,
        input.contentRevision,
        result.card,
        this.schedulerVersion,
        this.schedulerConfigHash,
        reviewedAt,
      );
      const eventId = randomUUID();
      const sessionId = this.#getOpenSessionId();
      this.#database
        .prepare(`
          INSERT INTO review_event (
            event_id, command_id, card_id, content_revision, rating, reviewed_at,
            previous_due_at, resulting_due_at, scheduler_version,
            scheduler_config_hash, payload_json, session_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          eventId,
          input.commandId,
          input.cardKey,
          input.contentRevision,
          input.rating,
          reviewedAtMs,
          previous.due.getTime(),
          result.card.due.getTime(),
          this.schedulerVersion,
          this.schedulerConfigHash,
          JSON.stringify({ log: result.log, resultingState: serializeCardState(resultingState) }),
          sessionId,
        );
      this.#saveCard(input.cardKey, input.contentRevision, result.card, reviewedAt);
      return { eventId, state: resultingState };
    });
  }

  #duplicateReviewReceipt(
    duplicate: ReviewCommandRow,
    input: ReviewCardInput,
    requestedReviewTime: number | undefined,
  ): ReviewReceipt {
    if (
      duplicate.card_id !== input.cardKey ||
      duplicate.content_revision !== input.contentRevision ||
      duplicate.rating !== input.rating ||
      (requestedReviewTime !== undefined && duplicate.reviewed_at !== requestedReviewTime)
    ) {
      throw new Error(
        `Command ID conflict: ${input.commandId} was already used for another review`,
      );
    }
    const payload = JSON.parse(duplicate.payload_json) as {
      resultingState?: SerializedCardState;
    };
    if (!payload.resultingState) {
      throw new Error(`Stored review receipt is missing for command ${input.commandId}`);
    }
    return { eventId: duplicate.event_id, state: deserializeCardState(payload.resultingState) };
  }

  rebuildCardStateFromReviewEvents(): CardProjectionReplayResult {
    return this.#transaction(() => {
      const events = this.#database
        .prepare(`
          SELECT event_id, card_id, content_revision, rating, reviewed_at,
                 previous_due_at, resulting_due_at, scheduler_version,
                 scheduler_config_hash, payload_json
          FROM review_event
          ORDER BY card_id, reviewed_at, rowid
        `)
        .all() as unknown as ReviewEventRow[];
      const untouchedCardCount = (
        this.#database
          .prepare(`
            SELECT COUNT(*) AS count
            FROM card_state AS state
            WHERE NOT EXISTS (
              SELECT 1 FROM review_event AS event WHERE event.card_id = state.card_id
            )
          `)
          .get() as { count: number }
      ).count;

      const replayedByCard = new Map<ReviewContentKey, StoredCardState>();
      for (const event of events) {
        const cardKey = reviewContentKey(event.card_id);
        validateRevision(event.content_revision);
        if (![Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].includes(event.rating)) {
          throw new Error(`Review event ${event.event_id} contains an invalid rating`);
        }
        if (
          event.scheduler_version !== this.schedulerVersion ||
          event.scheduler_config_hash !== this.schedulerConfigHash
        ) {
          throw new Error(
            `Review event scheduler metadata mismatch for ${event.event_id}: event uses ${event.scheduler_version} / ${event.scheduler_config_hash}`,
          );
        }

        const reviewedAt = new Date(event.reviewed_at);
        const previousDue = new Date(event.previous_due_at);
        timestamp(reviewedAt, `Review event ${event.event_id} time`);
        timestamp(previousDue, `Review event ${event.event_id} previous due time`);

        let previous = replayedByCard.get(cardKey);
        if (!previous) {
          previous = cardToStoredState(
            cardKey,
            event.content_revision,
            createEmptyCard(previousDue),
            this.schedulerVersion,
            this.schedulerConfigHash,
            previousDue,
          );
        } else {
          if (event.content_revision < previous.contentRevision) {
            throw new Error(
              `Review event content revision cannot move backward for card ${cardKey}`,
            );
          }
          if (event.reviewed_at < previous.updatedAt.getTime()) {
            throw new Error(`Review event time cannot move backward for card ${cardKey}`);
          }
        }
        if (event.previous_due_at !== previous.due.getTime()) {
          throw new Error(`Review event due chain is broken for ${event.event_id}`);
        }

        const result = this.#scheduler.next(
          toFsrsCard(previous),
          reviewedAt,
          event.rating as Grade,
        );
        if (result.card.due.getTime() !== event.resulting_due_at) {
          throw new Error(
            `Review event result does not match scheduler output for ${event.event_id}`,
          );
        }
        const resultingState = cardToStoredState(
          cardKey,
          event.content_revision,
          result.card,
          this.schedulerVersion,
          this.schedulerConfigHash,
          reviewedAt,
        );

        let payload: { resultingState?: SerializedCardState };
        try {
          payload = JSON.parse(event.payload_json) as { resultingState?: SerializedCardState };
        } catch {
          throw new Error(`Review event payload is invalid for ${event.event_id}`);
        }
        if (
          !payload.resultingState ||
          !sameSerializedCardState(serializeCardState(resultingState), payload.resultingState)
        ) {
          throw new Error(`Review event receipt does not match replay for ${event.event_id}`);
        }
        replayedByCard.set(cardKey, resultingState);
      }

      let rebuiltCardCount = 0;
      for (const [cardKey, replayedState] of replayedByCard) {
        const current = this.#getCard(cardKey);
        let projection = replayedState;
        if (current && current.contentRevision > replayedState.contentRevision) {
          if (current.updatedAt.getTime() < replayedState.updatedAt.getTime()) {
            throw new Error(`Card revision timestamp is inconsistent for ${cardKey}`);
          }
          projection = {
            ...replayedState,
            contentRevision: current.contentRevision,
            updatedAt: current.updatedAt,
          };
        }
        if (
          current &&
          sameSerializedCardState(serializeCardState(current), serializeCardState(projection))
        ) {
          continue;
        }
        this.#saveCard(
          cardKey,
          projection.contentRevision,
          toFsrsCard(projection),
          projection.updatedAt,
        );
        rebuiltCardCount += 1;
      }

      return {
        replayedEventCount: events.length,
        eventBackedCardCount: replayedByCard.size,
        rebuiltCardCount,
        untouchedCardCount,
      };
    });
  }

  getLessonProgress(lessonKey: LessonContentKey): StoredLessonProgress | null {
    parseLessonContentKey(lessonKey);
    const row = this.#database
      .prepare(`
        SELECT content_revision, status, progress, updated_at
        FROM lesson_progress WHERE lesson_id = ?
      `)
      .get(lessonKey) as LessonProgressRow | undefined;
    if (!row) return null;
    validateRevision(row.content_revision);
    validateLessonProgress(row.status, row.progress);
    return {
      lessonKey,
      contentRevision: row.content_revision,
      status: row.status as StoredLessonProgress["status"],
      progress: row.progress,
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * How many attempts the learner has already recorded against one exercise
   * at one content revision. Drives the reveal policy: the reference answer
   * is withheld on the first miss so the learner gets a second retrieval
   * attempt, which is the whole point of the exercise.
   */
  countExerciseAttempts(exerciseKey: ExerciseContentKey, contentRevision: number): number {
    parseExerciseContentKey(exerciseKey);
    validateRevision(contentRevision);
    const row = this.#database
      .prepare(`
        SELECT COUNT(*) AS attempts
        FROM exercise_attempt WHERE exercise_id = ? AND content_revision = ?
      `)
      .get(exerciseKey, contentRevision) as { readonly attempts: number } | undefined;
    return row?.attempts ?? 0;
  }

  /**
   * How many times the learner has actually answered this exercise at this
   * revision. `countExerciseAttempts` counts every row, and a host grade is
   * also a row, so it advances without the learner trying again. The reference
   * answer is disclosed on a "you have really tried N times" rule, which only
   * this count can express.
   */
  countLearnerSubmissions(exerciseKey: ExerciseContentKey, contentRevision: number): number {
    parseExerciseContentKey(exerciseKey);
    validateRevision(contentRevision);
    const row = this.#database
      .prepare(`
        SELECT COUNT(*) AS submissions
        FROM exercise_attempt
        WHERE exercise_id = ? AND content_revision = ?
          AND json_extract(response_json, '$.phase') = 'learner-submit'
      `)
      .get(exerciseKey, contentRevision) as { readonly submissions: number } | undefined;
    return row?.submissions ?? 0;
  }

  /**
   * Newest answer the learner submitted at this revision. The coaching packet
   * is built on the server so the disclosure rule lives in one place, which
   * means the server has to read the answer back rather than trust the client
   * to resend it.
   */
  getLatestLearnerSubmission(
    exerciseKey: ExerciseContentKey,
    contentRevision: number,
  ): StoredLearnerSubmission | null {
    parseExerciseContentKey(exerciseKey);
    validateRevision(contentRevision);
    const row = this.#database
      .prepare(`
        SELECT attempt_id, response_json, occurred_at
        FROM exercise_attempt
        WHERE exercise_id = ? AND content_revision = ?
          AND json_extract(response_json, '$.phase') = 'learner-submit'
        ORDER BY occurred_at DESC, rowid DESC
        LIMIT 1
      `)
      .get(exerciseKey, contentRevision) as
      | {
          readonly attempt_id: string;
          readonly response_json: string;
          readonly occurred_at: number;
        }
      | undefined;
    if (!row) return null;
    let response: unknown;
    try {
      response = JSON.parse(row.response_json) as unknown;
    } catch {
      return null;
    }
    if (!response || typeof response !== "object") return null;
    const answer = (response as Record<string, unknown>)["answer"];
    if (typeof answer !== "string") return null;
    return { attemptId: row.attempt_id, answer, occurredAt: new Date(row.occurred_at) };
  }

  /**
   * The learner's own recent writing, newest first.
   *
   * Every explain answer the learner has ever typed is already on disk; until
   * now nothing could read it back, so the one honest source of material for
   * coaching someone's expression was unreachable. Read-only and capped: this
   * is for looking at a handful of recent answers, not for exporting a life.
   */
  listRecentWrittenAttempts(limit = 20): readonly WrittenAttempt[] {
    const capped = Math.max(1, Math.min(Math.trunc(limit), 200));
    const rows = this.#database
      .prepare(`
        SELECT attempt_id, exercise_id, content_revision, response_json, occurred_at
        FROM exercise_attempt
        WHERE json_extract(response_json, '$.phase') = 'learner-submit'
          AND length(trim(coalesce(json_extract(response_json, '$.answer'), ''))) > 0
        ORDER BY occurred_at DESC, rowid DESC
        LIMIT ?
      `)
      .all(capped) as Array<{
      readonly attempt_id: string;
      readonly exercise_id: string;
      readonly content_revision: number;
      readonly response_json: string;
      readonly occurred_at: number;
    }>;
    return rows.flatMap((row) => {
      let answer: unknown;
      try {
        answer = (JSON.parse(row.response_json) as Record<string, unknown>)["answer"];
      } catch {
        return [];
      }
      if (typeof answer !== "string") return [];
      return [
        {
          attemptId: row.attempt_id,
          exerciseKey: exerciseContentKey(parseExerciseContentKey(row.exercise_id)),
          contentRevision: row.content_revision,
          answer,
          occurredAt: new Date(row.occurred_at),
        },
      ];
    });
  }

  /**
   * Whether this exercise has ever been answered fully correctly at this
   * content revision. Lesson completion is the AND of this across the
   * lesson's auto-gradable exercises, so answering one exercise cannot
   * complete a lesson that asks several questions.
   */
  hasCorrectExerciseAttempt(exerciseKey: ExerciseContentKey, contentRevision: number): boolean {
    parseExerciseContentKey(exerciseKey);
    validateRevision(contentRevision);
    const row = this.#database
      .prepare(`
        SELECT 1 AS solved FROM exercise_attempt
        WHERE exercise_id = ? AND content_revision = ? AND score >= max_score
        LIMIT 1
      `)
      .get(exerciseKey, contentRevision) as { readonly solved: number } | undefined;
    return row !== undefined;
  }

  /**
   * Newest host-grade attempt at this revision. Learner-submit rows (phase
   * learner-submit, score always 0) are skipped so the UI can show the AI
   * evaluation without inventing a second table.
   */
  getLatestHostExerciseGrade(
    exerciseKey: ExerciseContentKey,
    contentRevision: number,
  ): StoredHostExerciseGrade | null {
    parseExerciseContentKey(exerciseKey);
    validateRevision(contentRevision);
    const rows = this.#database
      .prepare(`
        SELECT attempt_id, score, max_score, response_json, occurred_at
        FROM exercise_attempt
        WHERE exercise_id = ? AND content_revision = ?
        ORDER BY occurred_at DESC
        LIMIT 40
      `)
      .all(exerciseKey, contentRevision) as Array<{
      readonly attempt_id: string;
      readonly score: number;
      readonly max_score: number;
      readonly response_json: string;
      readonly occurred_at: number;
    }>;
    for (const row of rows) {
      let response: unknown;
      try {
        response = JSON.parse(row.response_json) as unknown;
      } catch {
        continue;
      }
      if (!response || typeof response !== "object") continue;
      const body = response as Record<string, unknown>;
      if (body.phase !== "host-grade") continue;
      const evaluation = typeof body.evaluation === "string" ? body.evaluation.trim() : "";
      if (!evaluation) continue;
      const extensions = Array.isArray(body.extensions)
        ? body.extensions.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0,
          )
        : [];
      return {
        passed: row.score >= row.max_score,
        evaluation,
        extensions,
        host: typeof body.host === "string" && body.host.trim() ? body.host.trim() : null,
        learnerAnswer:
          typeof body.answer === "string"
            ? body.answer
            : typeof body.learnerAnswer === "string"
              ? body.learnerAnswer
              : null,
        occurredAt: new Date(row.occurred_at),
        attemptId: row.attempt_id,
      };
    }
    return null;
  }

  recordLessonProgress(input: RecordLessonProgressInput): string {
    parseLessonContentKey(input.lessonKey);
    validateRevision(input.contentRevision);
    validateLessonProgress(input.status, input.progress);
    const eventId = randomUUID();
    const occurredAt = input.occurredAt ?? new Date();
    const occurredAtMs = timestamp(occurredAt, "Lesson progress time");
    this.#transaction(() => {
      const existing = this.#database
        .prepare(`
          SELECT content_revision, status, progress, updated_at
          FROM lesson_progress WHERE lesson_id = ?
        `)
        .get(input.lessonKey) as LessonProgressRow | undefined;
      if (existing && input.contentRevision < existing.content_revision) {
        throw new Error(
          `Content revision cannot move backward for lesson ${input.lessonKey}: ${input.contentRevision} < ${existing.content_revision}`,
        );
      }
      if (existing && occurredAtMs < existing.updated_at) {
        throw new Error(`Lesson progress time cannot move backward for lesson ${input.lessonKey}`);
      }
      if (existing && input.contentRevision === existing.content_revision) {
        validateLessonProgress(existing.status, existing.progress);
        const previousStatus = existing.status as keyof typeof LESSON_STATUS_ORDER;
        if (LESSON_STATUS_ORDER[input.status] < LESSON_STATUS_ORDER[previousStatus]) {
          throw new Error(`Lesson status cannot move backward for lesson ${input.lessonKey}`);
        }
        if (input.progress < existing.progress) {
          throw new Error(`Lesson progress cannot move backward for lesson ${input.lessonKey}`);
        }
      }
      this.#database
        .prepare(`
          INSERT INTO lesson_progress (
            lesson_id, content_revision, status, progress, updated_at
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(lesson_id) DO UPDATE SET
            content_revision = excluded.content_revision,
            status = excluded.status,
            progress = excluded.progress,
            updated_at = excluded.updated_at
        `)
        .run(input.lessonKey, input.contentRevision, input.status, input.progress, occurredAtMs);
      this.#database
        .prepare(`
          INSERT INTO lesson_progress_event (
            event_id, lesson_id, content_revision, status, progress, occurred_at, session_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          eventId,
          input.lessonKey,
          input.contentRevision,
          input.status,
          input.progress,
          occurredAtMs,
          this.#getOpenSessionId(),
        );
    });
    return eventId;
  }

  recordExerciseAttempt(input: RecordExerciseAttemptInput): string {
    validateId(input.commandId, "Command ID");
    parseExerciseContentKey(input.exerciseKey);
    validateRevision(input.contentRevision);
    if (
      !Number.isFinite(input.maxScore) ||
      !Number.isFinite(input.score) ||
      input.maxScore <= 0 ||
      input.score < 0 ||
      input.score > input.maxScore
    ) {
      throw new Error("Exercise score must be between zero and maxScore");
    }
    const responseJson = serializeResponse(input.response);
    const requestedOccurredAt = input.occurredAt
      ? timestamp(input.occurredAt, "Exercise attempt time")
      : undefined;

    return this.#transaction(() => {
      const duplicate = this.#database
        .prepare(`
          SELECT attempt_id, exercise_id, content_revision, score, max_score,
                 response_json, occurred_at
          FROM exercise_attempt WHERE command_id = ?
        `)
        .get(input.commandId) as ExerciseCommandRow | undefined;
      if (duplicate) {
        if (
          duplicate.exercise_id !== input.exerciseKey ||
          duplicate.content_revision !== input.contentRevision ||
          duplicate.score !== input.score ||
          duplicate.max_score !== input.maxScore ||
          duplicate.response_json !== responseJson ||
          (requestedOccurredAt !== undefined && duplicate.occurred_at !== requestedOccurredAt)
        ) {
          throw new Error(
            `Command ID conflict: ${input.commandId} was already used for another exercise attempt`,
          );
        }
        return duplicate.attempt_id;
      }

      const attemptId = randomUUID();
      const occurredAtMs = requestedOccurredAt ?? Date.now();
      const sessionId = this.#getOpenSessionId();
      this.#database
        .prepare(`
          INSERT INTO exercise_attempt (
            attempt_id, command_id, exercise_id, content_revision, score, max_score,
            response_json, occurred_at, session_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          attemptId,
          input.commandId,
          input.exerciseKey,
          input.contentRevision,
          input.score,
          input.maxScore,
          responseJson,
          occurredAtMs,
          sessionId,
        );
      return attemptId;
    });
  }

  recordRetrievalAttempt(input: RecordRetrievalAttemptInput): StoredRetrievalAttempt {
    validateId(input.commandId, "Command ID");
    const cardKey = reviewContentKey(input.cardKey);
    validateRevision(input.contentRevision);
    validateRetrievalAnswer(input.answer);
    if (typeof input.usedHint !== "boolean") {
      throw new Error("Retrieval usedHint must be a boolean");
    }
    validateRetrievalConfidence(input.confidence);
    if (input.sessionId !== undefined) validateId(input.sessionId, "Session ID");
    const timing = retrievalTiming(input.startedAt, input.revealedAt, input.durationMs);

    return this.#transaction(() => {
      const sessionId = input.sessionId ?? this.#getOpenSessionId() ?? undefined;
      const duplicate = this.#database
        .prepare("SELECT * FROM retrieval_attempt WHERE command_id = ?")
        .get(input.commandId) as RetrievalAttemptRow | undefined;
      if (duplicate) {
        if (
          duplicate.card_key !== cardKey ||
          duplicate.content_revision !== input.contentRevision ||
          duplicate.answer !== input.answer ||
          duplicate.started_at !== timing.startedAtMs ||
          duplicate.revealed_at !== timing.revealedAtMs ||
          duplicate.duration_ms !== timing.durationMs ||
          duplicate.used_hint !== (input.usedHint ? 1 : 0) ||
          duplicate.confidence !== (input.confidence ?? null) ||
          (input.sessionId !== undefined && duplicate.session_id !== input.sessionId)
        ) {
          throw new Error(
            `Command ID conflict: ${input.commandId} was already used for another retrieval attempt`,
          );
        }
        return rowToRetrievalAttempt(duplicate);
      }

      if (sessionId !== undefined) {
        const session = this.#database
          .prepare("SELECT session_id FROM learning_session WHERE session_id = ?")
          .get(sessionId);
        if (!session) throw new Error(`Learning session not found: ${sessionId}`);
      }

      const attemptId = randomUUID();
      this.#database
        .prepare(`
          INSERT INTO retrieval_attempt (
            attempt_id, command_id, card_key, content_revision, answer,
            started_at, revealed_at, duration_ms, used_hint, confidence, session_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          attemptId,
          input.commandId,
          cardKey,
          input.contentRevision,
          input.answer,
          timing.startedAtMs,
          timing.revealedAtMs,
          timing.durationMs,
          input.usedHint ? 1 : 0,
          input.confidence ?? null,
          sessionId ?? null,
        );
      return {
        attemptId,
        commandId: input.commandId,
        cardKey,
        contentRevision: input.contentRevision,
        answer: input.answer,
        startedAt: new Date(timing.startedAtMs),
        revealedAt: new Date(timing.revealedAtMs),
        durationMs: timing.durationMs,
        usedHint: input.usedHint,
        ...(input.confidence === undefined ? {} : { confidence: input.confidence }),
        ...(sessionId === undefined ? {} : { sessionId }),
      };
    });
  }

  getRetrievalAttempt(attemptId: string): StoredRetrievalAttempt | null {
    validateId(attemptId, "Attempt ID");
    const row = this.#database
      .prepare("SELECT * FROM retrieval_attempt WHERE attempt_id = ?")
      .get(attemptId) as RetrievalAttemptRow | undefined;
    return row ? rowToRetrievalAttempt(row) : null;
  }

  getRetrievalAttemptByCommandId(commandId: string): StoredRetrievalAttempt | null {
    validateId(commandId, "Command ID");
    const row = this.#database
      .prepare("SELECT * FROM retrieval_attempt WHERE command_id = ?")
      .get(commandId) as RetrievalAttemptRow | undefined;
    return row ? rowToRetrievalAttempt(row) : null;
  }

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
  listRetrievalAttempts(cardKey: ReviewContentKey, limit = 5): readonly StoredRetrievalAttempt[] {
    const key = reviewContentKey(cardKey);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error("Retrieval-attempt limit must be an integer between 1 and 1000");
    }
    const rows = this.#database
      .prepare(`
        SELECT * FROM retrieval_attempt
        WHERE card_key = ?
        ORDER BY started_at DESC, rowid DESC
        LIMIT ?
      `)
      .all(key, limit) as unknown as RetrievalAttemptRow[];
    return rows.map(rowToRetrievalAttempt);
  }

  retrievalAttemptCount(): number {
    return (
      this.#database.prepare("SELECT COUNT(*) AS count FROM retrieval_attempt").get() as {
        count: number;
      }
    ).count;
  }

  startSession(
    startedAtOrMetadata: Date | LearningSessionMetadata = new Date(),
    requestedMetadata?: LearningSessionMetadata,
  ): string {
    let startedAt: Date;
    let metadata: LearningSessionMetadata | undefined;
    if (startedAtOrMetadata instanceof Date) {
      startedAt = startedAtOrMetadata;
      metadata = requestedMetadata;
    } else {
      if (
        startedAtOrMetadata === null ||
        typeof startedAtOrMetadata !== "object" ||
        Array.isArray(startedAtOrMetadata)
      ) {
        throw new Error("Session start input must be a Date or session metadata");
      }
      if (requestedMetadata !== undefined) {
        throw new Error("Session metadata must be provided only once");
      }
      startedAt = new Date();
      metadata = startedAtOrMetadata;
    }
    const startedAtMs = timestamp(startedAt, "Session start time");
    const normalized = normalizeSessionMetadata(metadata);
    const sessionId = randomUUID();
    try {
      this.#database
        .prepare(
          "INSERT INTO learning_session(session_id, started_at, host, objective) VALUES (?, ?, ?, ?)",
        )
        .run(sessionId, startedAtMs, normalized.host ?? null, normalized.objective ?? null);
    } catch (error) {
      const open = this.getOpenSession();
      if (open) {
        throw new Error(`A learning session is already open: ${open.sessionId}`, {
          cause: error,
        });
      }
      throw error;
    }
    return sessionId;
  }

  getSession(sessionId: string): StoredLearningSession | null {
    validateId(sessionId, "Session ID");
    const row = this.#database
      .prepare(
        "SELECT session_id, started_at, ended_at, host, objective FROM learning_session WHERE session_id = ?",
      )
      .get(sessionId) as LearningSessionRow | undefined;
    return row ? rowToLearningSession(row) : null;
  }

  getOpenSession(): StoredLearningSession | null {
    const row = this.#database
      .prepare(
        "SELECT session_id, started_at, ended_at, host, objective FROM learning_session WHERE ended_at IS NULL",
      )
      .get() as LearningSessionRow | undefined;
    return row ? rowToLearningSession(row) : null;
  }

  listSessions(limit = 100): readonly StoredLearningSession[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error("Session limit must be an integer between 1 and 1000");
    }
    const rows = this.#database
      .prepare(`
        SELECT session_id, started_at, ended_at, host, objective
        FROM learning_session
        ORDER BY started_at DESC, session_id DESC
        LIMIT ?
      `)
      .all(limit) as unknown as LearningSessionRow[];
    return rows.map(rowToLearningSession);
  }

  getSessionSummary(sessionId: string): LearningSessionSummary | null {
    validateId(sessionId, "Session ID");
    const row = this.#database
      .prepare(`
        SELECT session.session_id, session.started_at, session.ended_at,
               session.host, session.objective,
               (SELECT COUNT(*) FROM review_event
                 WHERE session_id = session.session_id) AS review_count,
               (SELECT COUNT(*) FROM retrieval_attempt
                 WHERE session_id = session.session_id) AS retrieval_attempt_count,
               (SELECT COUNT(*) FROM exercise_attempt
                 WHERE session_id = session.session_id) AS exercise_attempt_count,
               (SELECT COUNT(*) FROM lesson_progress_event
                 WHERE session_id = session.session_id) AS lesson_progress_event_count,
               COALESCE((SELECT SUM(score) FROM exercise_attempt
                 WHERE session_id = session.session_id), 0) AS exercise_score,
               COALESCE((SELECT SUM(max_score) FROM exercise_attempt
                 WHERE session_id = session.session_id), 0) AS exercise_max_score
        FROM learning_session AS session
        WHERE session.session_id = ?
      `)
      .get(sessionId) as LearningSessionSummaryRow | undefined;
    return row ? rowToLearningSessionSummary(row) : null;
  }

  /**
   * Most recent moment this learner did anything in this study, or null if
   * they never have.
   *
   * Derived from existing events rather than a stored "last opened" field —
   * a stored field would be a second source of truth that can disagree with
   * the events. Lets the shelf surface recently-studied projects instead of
   * always opening whichever study sorts first alphabetically.
   */
  getLastActivityAt(): Date | null {
    const row = this.#database
      .prepare(`
        SELECT MAX(last_at) AS last_activity_at FROM (
          SELECT MAX(reviewed_at) AS last_at FROM review_event
          UNION ALL
          SELECT MAX(occurred_at) AS last_at FROM lesson_progress_event
          UNION ALL
          SELECT MAX(occurred_at) AS last_at FROM exercise_attempt
          UNION ALL
          SELECT MAX(revealed_at) AS last_at FROM retrieval_attempt
        )
      `)
      .get() as { last_activity_at: number | null } | undefined;
    if (row?.last_activity_at === null || row?.last_activity_at === undefined) return null;
    return new Date(row.last_activity_at);
  }

  endSession(sessionId: string, endedAt = new Date()): LearningSessionSummary {
    validateId(sessionId, "Session ID");
    const endedAtMs = timestamp(endedAt, "Session end time");
    return this.#transaction(() => {
      const session = this.getSession(sessionId);
      if (!session || session.endedAt) {
        throw new Error(`Open learning session not found: ${sessionId}`);
      }
      if (endedAtMs < session.startedAt.getTime()) {
        throw new Error("Session end time must not be earlier than its start time");
      }
      const result = this.#database
        .prepare(
          "UPDATE learning_session SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL",
        )
        .run(endedAtMs, sessionId);
      if (result.changes !== 1) throw new Error(`Open learning session not found: ${sessionId}`);
      const summary = this.getSessionSummary(sessionId);
      if (!summary) throw new Error(`Learning session not found after closing: ${sessionId}`);
      return summary;
    });
  }

  reviewEventCount(): number {
    return (
      this.#database.prepare("SELECT COUNT(*) AS count FROM review_event").get() as {
        count: number;
      }
    ).count;
  }

  async backup(destination: string): Promise<number> {
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
    const temporaryDestination = join(
      dirname(destination),
      `.${basename(destination)}.${randomUUID()}.tmp`,
    );
    try {
      createPrivateFile(temporaryDestination);
      const pages = await backup(this.#database, temporaryDestination);
      protectSqliteFiles(temporaryDestination);
      renameSync(temporaryDestination, destination);
      protectSqliteFiles(destination);
      // A backup that is only reported as written is not a backup. The rename
      // is durable but the directory entry naming it is not until the parent
      // directory is synced — mirrors `writeTextAtomically`, which is what the
      // receipt beside this file already relies on.
      syncDirectory(dirname(destination));
      return pages;
    } catch (error) {
      rmSync(temporaryDestination, { force: true });
      throw error;
    }
  }

  close(): void {
    this.#database.close();
  }
}
