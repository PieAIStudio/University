import { randomUUID } from "node:crypto";
import { chmodSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, renameSync, rmSync, } from "node:fs";
import { basename, dirname, join } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { FSRSVersion, Rating, createEmptyCard, fsrs, generatorParameters, } from "ts-fsrs";
import { SCHEDULER_PARAMETERS } from "@pieai/university-core";
import { LEARNING_SCHEMA_VERSION, migrate } from "./schema.js";
import { cardToStoredState, deserializeCardState, hashParameters, normalizeSessionMetadata, retrievalTiming, rowToLearningSession, rowToLearningSessionSummary, rowToRetrievalAttempt, rowToState, sameSerializedCardState, serializeCardState, serializeResponse, stableJson, timestamp, toFsrsCard, validateId, validateRetrievalAnswer, validateRetrievalConfidence, validateRevision, } from "./rows.js";
import { exerciseContentKey, parseExerciseContentKey, parseLessonContentKey, reviewContentKey, } from "./types.js";
import { LESSON_STATUS_ORDER, validateLessonProgress } from "./lesson-progress.js";
export { LEARNING_SCHEMA_VERSION };
/**
 * node:sqlite exposes rows as untyped records. Keep that one unavoidable
 * boundary cast here; every caller immediately runs the row through its
 * named converter or validates the selected columns.
 */
function rowsAs(rows) {
    return rows;
}
/**
 * The parameters are not this store's to choose any more.
 *
 * They moved to `@pieai/university-core` so the online shell schedules a card
 * with the same algorithm this one does — two answers to "what is due
 * tomorrow" was the drift worth closing first. What stays here is everything
 * this store actually owns: the event log, the replay check, and the hash that
 * proves a stored row was scheduled under the parameters it claims.
 */
const DEFAULT_PARAMETERS = SCHEDULER_PARAMETERS;
function createPrivateFile(path) {
    const descriptor = openSync(path, "a", 0o600);
    closeSync(descriptor);
    chmodSync(path, 0o600);
}
function protectSqliteFiles(path) {
    for (const candidate of [path, `${path}-wal`, `${path}-shm`]) {
        if (existsSync(candidate))
            chmodSync(candidate, 0o600);
    }
}
/** Make a rename's directory entry durable, the way `atomic-json` does. */
function syncDirectory(directory) {
    const descriptor = openSync(directory, "r");
    try {
        fsyncSync(descriptor);
    }
    finally {
        closeSync(descriptor);
    }
}
export class SqliteLearningStore {
    schedulerVersion = FSRSVersion;
    schedulerParameters;
    schedulerConfigHash;
    #database;
    #scheduler;
    /** 0 = no open transaction; >0 = nesting level, driving SAVEPOINT naming. */
    #transactionDepth = 0;
    constructor(path, parameters = {}) {
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
            if (fileBacked)
                protectSqliteFiles(path);
        }
        catch (error) {
            this.#database.close();
            throw error;
        }
    }
    #validateSchedulerProfile() {
        const row = this.#database
            .prepare(`
        SELECT scheduler_version, parameters_json, scheduler_config_hash
        FROM scheduler_profile WHERE singleton_id = 1
      `)
            .get();
        if (!row)
            throw new Error("Learning database is missing its scheduler profile");
        let storedParameters;
        try {
            storedParameters = JSON.parse(row.parameters_json);
            if (hashParameters(storedParameters) !== row.scheduler_config_hash) {
                throw new Error("stored scheduler parameter hash is invalid");
            }
        }
        catch {
            throw new Error("Learning database contains an invalid scheduler profile");
        }
        if (row.scheduler_version !== this.schedulerVersion ||
            row.scheduler_config_hash !== this.schedulerConfigHash ||
            stableJson(storedParameters) !== stableJson(this.schedulerParameters)) {
            throw new Error(`Scheduler profile mismatch: database uses ${row.scheduler_version} / ${row.scheduler_config_hash}, requested ${this.schedulerVersion} / ${this.schedulerConfigHash}`);
        }
    }
    #validateCardSchedulerMetadata() {
        const mismatch = this.#database
            .prepare(`
        SELECT card_id, scheduler_version, scheduler_config_hash
        FROM card_state
        WHERE scheduler_version <> ? OR scheduler_config_hash <> ?
        LIMIT 1
      `)
            .get(this.schedulerVersion, this.schedulerConfigHash);
        if (mismatch) {
            throw new Error(`Card scheduler metadata mismatch for ${mismatch.card_id}: database row uses ${mismatch.scheduler_version} / ${mismatch.scheduler_config_hash}`);
        }
    }
    #validateScopedContentKeys() {
        const cardRows = rowsAs(this.#database
            .prepare(`
          SELECT card_id AS content_key FROM card_state
          UNION
          SELECT card_id AS content_key FROM review_event
        `)
            .all());
        for (const row of cardRows)
            reviewContentKey(row.content_key);
        const lessonRows = rowsAs(this.#database
            .prepare("SELECT lesson_id AS content_key, status, progress FROM lesson_progress")
            .all());
        for (const row of lessonRows) {
            parseLessonContentKey(row.content_key);
            validateLessonProgress(row.status, row.progress);
        }
        const lessonEventRows = rowsAs(this.#database
            .prepare("SELECT lesson_id AS content_key, content_revision, status, progress FROM lesson_progress_event")
            .all());
        for (const row of lessonEventRows) {
            parseLessonContentKey(row.content_key);
            validateRevision(row.content_revision);
            validateLessonProgress(row.status, row.progress);
        }
        const exerciseRows = rowsAs(this.#database.prepare("SELECT exercise_id AS content_key FROM exercise_attempt").all());
        for (const row of exerciseRows)
            parseExerciseContentKey(row.content_key);
        const retrievalRows = rowsAs(this.#database.prepare("SELECT * FROM retrieval_attempt").all());
        for (const row of retrievalRows)
            rowToRetrievalAttempt(row);
        const sessionRows = rowsAs(this.#database
            .prepare("SELECT session_id, started_at, ended_at, host, objective FROM learning_session")
            .all());
        for (const row of sessionRows)
            rowToLearningSession(row);
    }
    /**
     * Re-entrant unit of work. The outermost call is a real `BEGIN IMMEDIATE`;
     * anything nested inside it becomes a SAVEPOINT, so a caller can compose
     * several already-transactional store methods into one all-or-nothing
     * write without the inner `BEGIN` failing. Recording an exercise attempt,
     * advancing lesson progress, and enrolling the lesson's cards are one
     * outcome and must not be able to half-happen.
     */
    #transaction(operation) {
        if (this.#transactionDepth > 0) {
            const savepoint = `university_local_sp_${this.#transactionDepth}`;
            this.#database.exec(`SAVEPOINT ${savepoint}`);
            this.#transactionDepth += 1;
            try {
                const result = operation();
                this.#database.exec(`RELEASE ${savepoint}`);
                return result;
            }
            catch (error) {
                this.#database.exec(`ROLLBACK TO ${savepoint}`);
                this.#database.exec(`RELEASE ${savepoint}`);
                throw error;
            }
            finally {
                this.#transactionDepth -= 1;
            }
        }
        this.#database.exec("BEGIN IMMEDIATE");
        this.#transactionDepth = 1;
        try {
            const result = operation();
            this.#database.exec("COMMIT");
            return result;
        }
        catch (error) {
            if (this.#database.isTransaction)
                this.#database.exec("ROLLBACK");
            throw error;
        }
        finally {
            this.#transactionDepth = 0;
        }
    }
    /**
     * Run several store writes as one unit. Nested store calls join this
     * transaction rather than starting their own; if `operation` throws, every
     * write inside it is rolled back together.
     */
    transaction(operation) {
        return this.#transaction(operation);
    }
    #getCard(cardKey) {
        const row = this.#database
            .prepare("SELECT * FROM card_state WHERE card_id = ?")
            .get(cardKey);
        return row ? rowToState(row) : null;
    }
    #getOpenSessionId() {
        const row = this.#database
            .prepare("SELECT session_id FROM learning_session WHERE ended_at IS NULL")
            .get();
        return row?.session_id ?? null;
    }
    #saveCard(cardKey, contentRevision, card, updatedAt) {
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
            .run(cardKey, contentRevision, card.due.getTime(), card.stability, card.difficulty, card.elapsed_days, card.scheduled_days, card.learning_steps, card.reps, card.lapses, card.state, card.last_review?.getTime() ?? null, this.schedulerVersion, this.schedulerConfigHash, updatedAt.getTime());
    }
    ensureCard(cardKey, contentRevision, now = new Date()) {
        reviewContentKey(cardKey);
        validateRevision(contentRevision);
        const nowMs = timestamp(now, "Card update time");
        return this.#transaction(() => {
            const existing = this.#getCard(cardKey);
            if (!existing) {
                const card = createEmptyCard(now);
                this.#saveCard(cardKey, contentRevision, card, now);
                return cardToStoredState(cardKey, contentRevision, card, this.schedulerVersion, this.schedulerConfigHash, now);
            }
            if (contentRevision < existing.contentRevision) {
                throw new Error(`Content revision cannot move backward for card ${cardKey}: ${contentRevision} < ${existing.contentRevision}`);
            }
            if (contentRevision === existing.contentRevision)
                return existing;
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
    getCard(cardKey) {
        reviewContentKey(cardKey);
        return this.#getCard(cardKey);
    }
    listCards(limit = 10_000) {
        const capped = Math.max(1, Math.min(Math.trunc(limit), 10_000));
        const rows = rowsAs(this.#database
            .prepare("SELECT * FROM card_state ORDER BY updated_at DESC, card_id LIMIT ?")
            .all(capped));
        return rows.map(rowToState);
    }
    listDueCards(asOf = new Date(), limit = 100) {
        const asOfMs = timestamp(asOf, "Due-card cutoff");
        if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
            throw new Error("Due-card limit must be an integer between 1 and 1000");
        }
        const rows = rowsAs(this.#database
            .prepare("SELECT * FROM card_state WHERE due_at <= ? ORDER BY due_at, card_id LIMIT ?")
            .all(asOfMs, limit));
        return rows.map(rowToState);
    }
    reviewCard(input) {
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
                .get(input.commandId);
            if (duplicate)
                return this.#duplicateReviewReceipt(duplicate, input, requestedReviewTime);
            const reviewedAt = input.reviewedAt ?? new Date();
            const reviewedAtMs = requestedReviewTime ?? timestamp(reviewedAt, "Review time");
            let previous = this.#getCard(input.cardKey);
            if (!previous) {
                const emptyCard = createEmptyCard(reviewedAt);
                this.#saveCard(input.cardKey, input.contentRevision, emptyCard, reviewedAt);
                previous = cardToStoredState(input.cardKey, input.contentRevision, emptyCard, this.schedulerVersion, this.schedulerConfigHash, reviewedAt);
            }
            else if (previous.contentRevision !== input.contentRevision) {
                throw new Error(`Card ${input.cardKey} is bound to content revision ${previous.contentRevision}; call ensureCard explicitly before reviewing revision ${input.contentRevision}`);
            }
            if (reviewedAtMs < previous.updatedAt.getTime()) {
                throw new Error(`Review time cannot move backward for card ${input.cardKey}`);
            }
            const result = this.#scheduler.next(toFsrsCard(previous), reviewedAt, input.rating);
            const resultingState = cardToStoredState(input.cardKey, input.contentRevision, result.card, this.schedulerVersion, this.schedulerConfigHash, reviewedAt);
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
                .run(eventId, input.commandId, input.cardKey, input.contentRevision, input.rating, reviewedAtMs, previous.due.getTime(), result.card.due.getTime(), this.schedulerVersion, this.schedulerConfigHash, JSON.stringify({ log: result.log, resultingState: serializeCardState(resultingState) }), sessionId);
            this.#saveCard(input.cardKey, input.contentRevision, result.card, reviewedAt);
            return { eventId, state: resultingState };
        });
    }
    #duplicateReviewReceipt(duplicate, input, requestedReviewTime) {
        if (duplicate.card_id !== input.cardKey ||
            duplicate.content_revision !== input.contentRevision ||
            duplicate.rating !== input.rating ||
            (requestedReviewTime !== undefined && duplicate.reviewed_at !== requestedReviewTime)) {
            throw new Error(`Command ID conflict: ${input.commandId} was already used for another review`);
        }
        const payload = JSON.parse(duplicate.payload_json);
        if (!payload.resultingState) {
            throw new Error(`Stored review receipt is missing for command ${input.commandId}`);
        }
        return { eventId: duplicate.event_id, state: deserializeCardState(payload.resultingState) };
    }
    rebuildCardStateFromReviewEvents() {
        return this.#transaction(() => {
            const events = rowsAs(this.#database
                .prepare(`
            SELECT event_id, card_id, content_revision, rating, reviewed_at,
                   previous_due_at, resulting_due_at, scheduler_version,
                   scheduler_config_hash, payload_json
            FROM review_event
            ORDER BY card_id, reviewed_at, rowid
          `)
                .all());
            const untouchedCardCount = this.#database
                .prepare(`
            SELECT COUNT(*) AS count
            FROM card_state AS state
            WHERE NOT EXISTS (
              SELECT 1 FROM review_event AS event WHERE event.card_id = state.card_id
            )
          `)
                .get().count;
            const replayedByCard = new Map();
            for (const event of events) {
                const cardKey = reviewContentKey(event.card_id);
                validateRevision(event.content_revision);
                if (![Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].includes(event.rating)) {
                    throw new Error(`Review event ${event.event_id} contains an invalid rating`);
                }
                if (event.scheduler_version !== this.schedulerVersion ||
                    event.scheduler_config_hash !== this.schedulerConfigHash) {
                    throw new Error(`Review event scheduler metadata mismatch for ${event.event_id}: event uses ${event.scheduler_version} / ${event.scheduler_config_hash}`);
                }
                const reviewedAt = new Date(event.reviewed_at);
                const previousDue = new Date(event.previous_due_at);
                timestamp(reviewedAt, `Review event ${event.event_id} time`);
                timestamp(previousDue, `Review event ${event.event_id} previous due time`);
                let previous = replayedByCard.get(cardKey);
                if (!previous) {
                    previous = cardToStoredState(cardKey, event.content_revision, createEmptyCard(previousDue), this.schedulerVersion, this.schedulerConfigHash, previousDue);
                }
                else {
                    if (event.content_revision < previous.contentRevision) {
                        throw new Error(`Review event content revision cannot move backward for card ${cardKey}`);
                    }
                    if (event.reviewed_at < previous.updatedAt.getTime()) {
                        throw new Error(`Review event time cannot move backward for card ${cardKey}`);
                    }
                }
                if (event.previous_due_at !== previous.due.getTime()) {
                    throw new Error(`Review event due chain is broken for ${event.event_id}`);
                }
                const result = this.#scheduler.next(toFsrsCard(previous), reviewedAt, event.rating);
                if (result.card.due.getTime() !== event.resulting_due_at) {
                    throw new Error(`Review event result does not match scheduler output for ${event.event_id}`);
                }
                const resultingState = cardToStoredState(cardKey, event.content_revision, result.card, this.schedulerVersion, this.schedulerConfigHash, reviewedAt);
                let payload;
                try {
                    payload = JSON.parse(event.payload_json);
                }
                catch {
                    throw new Error(`Review event payload is invalid for ${event.event_id}`);
                }
                if (!payload.resultingState ||
                    !sameSerializedCardState(serializeCardState(resultingState), payload.resultingState)) {
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
                if (current &&
                    sameSerializedCardState(serializeCardState(current), serializeCardState(projection))) {
                    continue;
                }
                this.#saveCard(cardKey, projection.contentRevision, toFsrsCard(projection), projection.updatedAt);
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
    getLessonProgress(lessonKey) {
        parseLessonContentKey(lessonKey);
        const row = this.#database
            .prepare(`
        SELECT content_revision, status, progress, updated_at
        FROM lesson_progress WHERE lesson_id = ?
      `)
            .get(lessonKey);
        if (!row)
            return null;
        validateRevision(row.content_revision);
        validateLessonProgress(row.status, row.progress);
        return {
            lessonKey,
            contentRevision: row.content_revision,
            status: row.status,
            progress: row.progress,
            updatedAt: new Date(row.updated_at),
        };
    }
    listLessonProgress(limit = 10_000) {
        const capped = Math.max(1, Math.min(Math.trunc(limit), 10_000));
        const rows = rowsAs(this.#database
            .prepare(`SELECT lesson_id, content_revision, status, progress, updated_at
           FROM lesson_progress ORDER BY updated_at DESC, lesson_id LIMIT ?`)
            .all(capped));
        return rows.map((row) => {
            const lessonKey = parseLessonContentKey(row.lesson_id);
            const key = `${lessonKey.courseId}/${lessonKey.unitId}/${lessonKey.lessonId}`;
            validateRevision(row.content_revision);
            validateLessonProgress(row.status, row.progress);
            return {
                lessonKey: key,
                contentRevision: row.content_revision,
                status: row.status,
                progress: row.progress,
                updatedAt: new Date(row.updated_at),
            };
        });
    }
    hasLessonCompletion(lessonKey, contentRevision) {
        parseLessonContentKey(lessonKey);
        validateRevision(contentRevision);
        const row = this.#database
            .prepare(`
        SELECT 1 AS completed
        FROM lesson_completion_event
        WHERE lesson_id = ? AND content_revision = ?
        LIMIT 1
      `)
            .get(lessonKey, contentRevision);
        return row !== undefined;
    }
    recordLessonCompletion(input) {
        validateId(input.commandId, "Command ID");
        parseLessonContentKey(input.lessonKey);
        validateRevision(input.contentRevision);
        const requestedOccurredAt = input.occurredAt
            ? timestamp(input.occurredAt, "Lesson completion time")
            : undefined;
        return this.#transaction(() => {
            const duplicate = this.#database
                .prepare(`
          SELECT event_id, command_id, lesson_id, content_revision, occurred_at
          FROM lesson_completion_event WHERE command_id = ?
        `)
                .get(input.commandId);
            if (duplicate) {
                if (duplicate.lesson_id !== input.lessonKey ||
                    duplicate.content_revision !== input.contentRevision ||
                    (requestedOccurredAt !== undefined && duplicate.occurred_at !== requestedOccurredAt)) {
                    throw new Error(`Command ID conflict: ${input.commandId} was already used for another lesson completion`);
                }
                return { eventId: duplicate.event_id, idempotent: true };
            }
            const occurredAtMs = requestedOccurredAt ?? Date.now();
            const eventId = randomUUID();
            this.#database
                .prepare(`
          INSERT INTO lesson_completion_event (
            event_id, command_id, lesson_id, content_revision, occurred_at, session_id
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
                .run(eventId, input.commandId, input.lessonKey, input.contentRevision, occurredAtMs, this.#getOpenSessionId());
            return { eventId, idempotent: false };
        });
    }
    /**
     * How many attempts the learner has already recorded against one exercise
     * at one content revision. Drives the reveal policy: the reference answer
     * is withheld on the first miss so the learner gets a second retrieval
     * attempt, which is the whole point of the exercise.
     */
    countExerciseAttempts(exerciseKey, contentRevision) {
        parseExerciseContentKey(exerciseKey);
        validateRevision(contentRevision);
        const row = this.#database
            .prepare(`
        SELECT COUNT(*) AS attempts
        FROM exercise_attempt WHERE exercise_id = ? AND content_revision = ?
      `)
            .get(exerciseKey, contentRevision);
        return row?.attempts ?? 0;
    }
    /**
     * How many times the learner has actually answered this exercise at this
     * revision. `countExerciseAttempts` counts every row, and a host grade is
     * also a row, so it advances without the learner trying again. The reference
     * answer is disclosed on a "you have really tried N times" rule, which only
     * this count can express.
     */
    countLearnerSubmissions(exerciseKey, contentRevision) {
        parseExerciseContentKey(exerciseKey);
        validateRevision(contentRevision);
        const row = this.#database
            .prepare(`
        SELECT COUNT(*) AS submissions
        FROM exercise_attempt
        WHERE exercise_id = ? AND content_revision = ?
          AND json_extract(response_json, '$.phase') = 'learner-submit'
      `)
            .get(exerciseKey, contentRevision);
        return row?.submissions ?? 0;
    }
    /**
     * Newest answer the learner submitted at this revision. The coaching packet
     * is built on the server so the disclosure rule lives in one place, which
     * means the server has to read the answer back rather than trust the client
     * to resend it.
     */
    getLatestLearnerSubmission(exerciseKey, contentRevision) {
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
            .get(exerciseKey, contentRevision);
        if (!row)
            return null;
        let response;
        try {
            response = JSON.parse(row.response_json);
        }
        catch {
            return null;
        }
        if (!response || typeof response !== "object")
            return null;
        const answer = response["answer"];
        if (typeof answer !== "string")
            return null;
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
    listRecentWrittenAttempts(limit = 20) {
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
            .all(capped);
        return rows.flatMap((row) => {
            let answer;
            try {
                answer = JSON.parse(row.response_json)["answer"];
            }
            catch {
                return [];
            }
            if (typeof answer !== "string")
                return [];
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
    hasCorrectExerciseAttempt(exerciseKey, contentRevision) {
        parseExerciseContentKey(exerciseKey);
        validateRevision(contentRevision);
        const row = this.#database
            .prepare(`
        SELECT 1 AS solved FROM exercise_attempt
        WHERE exercise_id = ? AND content_revision = ? AND score >= max_score
        LIMIT 1
      `)
            .get(exerciseKey, contentRevision);
        return row !== undefined;
    }
    /**
     * Newest host-grade attempt at this revision. Learner-submit rows (phase
     * learner-submit, score always 0) are skipped so the UI can show the AI
     * evaluation without inventing a second table.
     */
    getLatestHostExerciseGrade(exerciseKey, contentRevision) {
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
            .all(exerciseKey, contentRevision);
        for (const row of rows) {
            let response;
            try {
                response = JSON.parse(row.response_json);
            }
            catch {
                continue;
            }
            if (!response || typeof response !== "object")
                continue;
            const body = response;
            if (body.phase !== "host-grade")
                continue;
            const evaluation = typeof body.evaluation === "string" ? body.evaluation.trim() : "";
            if (!evaluation)
                continue;
            const extensions = Array.isArray(body.extensions)
                ? body.extensions.filter((item) => typeof item === "string" && item.trim().length > 0)
                : [];
            return {
                passed: row.score >= row.max_score,
                evaluation,
                extensions,
                host: typeof body.host === "string" && body.host.trim() ? body.host.trim() : null,
                learnerAnswer: typeof body.answer === "string"
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
    recordLessonProgress(input) {
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
                .get(input.lessonKey);
            if (existing && input.contentRevision < existing.content_revision) {
                throw new Error(`Content revision cannot move backward for lesson ${input.lessonKey}: ${input.contentRevision} < ${existing.content_revision}`);
            }
            if (existing && occurredAtMs < existing.updated_at) {
                throw new Error(`Lesson progress time cannot move backward for lesson ${input.lessonKey}`);
            }
            if (existing && input.contentRevision === existing.content_revision) {
                validateLessonProgress(existing.status, existing.progress);
                const previousStatus = existing.status;
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
                .run(eventId, input.lessonKey, input.contentRevision, input.status, input.progress, occurredAtMs, this.#getOpenSessionId());
            if (input.status === "completed" &&
                !this.hasLessonCompletion(input.lessonKey, input.contentRevision)) {
                const completionEventId = randomUUID();
                this.#database
                    .prepare(`
            INSERT INTO lesson_completion_event (
              event_id, command_id, lesson_id, content_revision, occurred_at, session_id
            ) VALUES (?, ?, ?, ?, ?, ?)
          `)
                    .run(completionEventId, `progress-completion-${completionEventId}`, input.lessonKey, input.contentRevision, occurredAtMs, this.#getOpenSessionId());
            }
        });
        return eventId;
    }
    recordExerciseAttempt(input) {
        validateId(input.commandId, "Command ID");
        parseExerciseContentKey(input.exerciseKey);
        validateRevision(input.contentRevision);
        if (!Number.isFinite(input.maxScore) ||
            !Number.isFinite(input.score) ||
            input.maxScore <= 0 ||
            input.score < 0 ||
            input.score > input.maxScore) {
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
                .get(input.commandId);
            if (duplicate) {
                if (duplicate.exercise_id !== input.exerciseKey ||
                    duplicate.content_revision !== input.contentRevision ||
                    duplicate.score !== input.score ||
                    duplicate.max_score !== input.maxScore ||
                    duplicate.response_json !== responseJson ||
                    (requestedOccurredAt !== undefined && duplicate.occurred_at !== requestedOccurredAt)) {
                    throw new Error(`Command ID conflict: ${input.commandId} was already used for another exercise attempt`);
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
                .run(attemptId, input.commandId, input.exerciseKey, input.contentRevision, input.score, input.maxScore, responseJson, occurredAtMs, sessionId);
            return attemptId;
        });
    }
    /** The exact persisted command, so a retry cannot receive a later answer's grade. */
    getExerciseAttemptByCommandId(commandId) {
        validateId(commandId, "Command ID");
        const row = this.#database
            .prepare(`SELECT attempt_id, command_id, exercise_id, content_revision,
              score, max_score, response_json, occurred_at
       FROM exercise_attempt WHERE command_id = ?`)
            .get(commandId);
        if (!row)
            return null;
        return {
            attemptId: row.attempt_id,
            commandId: row.command_id ?? row.attempt_id,
            exerciseKey: exerciseContentKey(parseExerciseContentKey(row.exercise_id)),
            contentRevision: row.content_revision,
            score: row.score,
            maxScore: row.max_score,
            response: row.response_json === null ? null : JSON.parse(row.response_json),
            occurredAt: new Date(row.occurred_at),
        };
    }
    listExerciseAttempts(limit = 10_000) {
        const capped = Math.max(1, Math.min(Math.trunc(limit), 10_000));
        const rows = rowsAs(this.#database
            .prepare(`SELECT attempt_id, command_id, exercise_id, content_revision,
                  score, max_score, response_json, occurred_at
           FROM exercise_attempt ORDER BY occurred_at ASC, rowid ASC LIMIT ?`)
            .all(capped));
        return rows.map((row) => ({
            attemptId: row.attempt_id,
            commandId: row.command_id ?? row.attempt_id,
            exerciseKey: exerciseContentKey(parseExerciseContentKey(row.exercise_id)),
            contentRevision: row.content_revision,
            score: row.score,
            maxScore: row.max_score,
            response: row.response_json === null ? null : JSON.parse(row.response_json),
            occurredAt: new Date(row.occurred_at),
        }));
    }
    recordRetrievalAttempt(input) {
        validateId(input.commandId, "Command ID");
        const cardKey = reviewContentKey(input.cardKey);
        validateRevision(input.contentRevision);
        validateRetrievalAnswer(input.answer);
        if (typeof input.usedHint !== "boolean") {
            throw new Error("Retrieval usedHint must be a boolean");
        }
        validateRetrievalConfidence(input.confidence);
        if (input.sessionId !== undefined)
            validateId(input.sessionId, "Session ID");
        const timing = retrievalTiming(input.startedAt, input.revealedAt, input.durationMs);
        return this.#transaction(() => {
            const sessionId = input.sessionId ?? this.#getOpenSessionId() ?? undefined;
            const duplicate = this.#database
                .prepare("SELECT * FROM retrieval_attempt WHERE command_id = ?")
                .get(input.commandId);
            if (duplicate) {
                if (duplicate.card_key !== cardKey ||
                    duplicate.content_revision !== input.contentRevision ||
                    duplicate.answer !== input.answer ||
                    duplicate.started_at !== timing.startedAtMs ||
                    duplicate.revealed_at !== timing.revealedAtMs ||
                    duplicate.duration_ms !== timing.durationMs ||
                    duplicate.used_hint !== (input.usedHint ? 1 : 0) ||
                    duplicate.confidence !== (input.confidence ?? null) ||
                    (input.sessionId !== undefined && duplicate.session_id !== input.sessionId)) {
                    throw new Error(`Command ID conflict: ${input.commandId} was already used for another retrieval attempt`);
                }
                return rowToRetrievalAttempt(duplicate);
            }
            if (sessionId !== undefined) {
                const session = this.#database
                    .prepare("SELECT session_id FROM learning_session WHERE session_id = ?")
                    .get(sessionId);
                if (!session)
                    throw new Error(`Learning session not found: ${sessionId}`);
            }
            const attemptId = randomUUID();
            this.#database
                .prepare(`
          INSERT INTO retrieval_attempt (
            attempt_id, command_id, card_key, content_revision, answer,
            started_at, revealed_at, duration_ms, used_hint, confidence, session_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
                .run(attemptId, input.commandId, cardKey, input.contentRevision, input.answer, timing.startedAtMs, timing.revealedAtMs, timing.durationMs, input.usedHint ? 1 : 0, input.confidence ?? null, sessionId ?? null);
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
    getRetrievalAttempt(attemptId) {
        validateId(attemptId, "Attempt ID");
        const row = this.#database
            .prepare("SELECT * FROM retrieval_attempt WHERE attempt_id = ?")
            .get(attemptId);
        return row ? rowToRetrievalAttempt(row) : null;
    }
    getRetrievalAttemptByCommandId(commandId) {
        validateId(commandId, "Command ID");
        const row = this.#database
            .prepare("SELECT * FROM retrieval_attempt WHERE command_id = ?")
            .get(commandId);
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
    listRetrievalAttempts(cardKey, limit = 5) {
        const key = reviewContentKey(cardKey);
        if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
            throw new Error("Retrieval-attempt limit must be an integer between 1 and 1000");
        }
        const rows = rowsAs(this.#database
            .prepare(`
          SELECT * FROM retrieval_attempt
          WHERE card_key = ?
          ORDER BY started_at DESC, rowid DESC
          LIMIT ?
        `)
            .all(key, limit));
        return rows.map(rowToRetrievalAttempt);
    }
    retrievalAttemptCount() {
        return this.#database.prepare("SELECT COUNT(*) AS count FROM retrieval_attempt").get().count;
    }
    startSession(startedAtOrMetadata = new Date(), requestedMetadata) {
        let startedAt;
        let metadata;
        if (startedAtOrMetadata instanceof Date) {
            startedAt = startedAtOrMetadata;
            metadata = requestedMetadata;
        }
        else {
            if (startedAtOrMetadata === null ||
                typeof startedAtOrMetadata !== "object" ||
                Array.isArray(startedAtOrMetadata)) {
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
                .prepare("INSERT INTO learning_session(session_id, started_at, host, objective) VALUES (?, ?, ?, ?)")
                .run(sessionId, startedAtMs, normalized.host ?? null, normalized.objective ?? null);
        }
        catch (error) {
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
    getSession(sessionId) {
        validateId(sessionId, "Session ID");
        const row = this.#database
            .prepare("SELECT session_id, started_at, ended_at, host, objective FROM learning_session WHERE session_id = ?")
            .get(sessionId);
        return row ? rowToLearningSession(row) : null;
    }
    getOpenSession() {
        const row = this.#database
            .prepare("SELECT session_id, started_at, ended_at, host, objective FROM learning_session WHERE ended_at IS NULL")
            .get();
        return row ? rowToLearningSession(row) : null;
    }
    listSessions(limit = 100) {
        if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
            throw new Error("Session limit must be an integer between 1 and 1000");
        }
        const rows = rowsAs(this.#database
            .prepare(`
          SELECT session_id, started_at, ended_at, host, objective
          FROM learning_session
          ORDER BY started_at DESC, session_id DESC
          LIMIT ?
        `)
            .all(limit));
        return rows.map(rowToLearningSession);
    }
    getSessionSummary(sessionId) {
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
            .get(sessionId);
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
    getLastActivityAt() {
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
            .get();
        if (row?.last_activity_at === null || row?.last_activity_at === undefined)
            return null;
        return new Date(row.last_activity_at);
    }
    endSession(sessionId, endedAt = new Date()) {
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
                .prepare("UPDATE learning_session SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL")
                .run(endedAtMs, sessionId);
            if (result.changes !== 1)
                throw new Error(`Open learning session not found: ${sessionId}`);
            const summary = this.getSessionSummary(sessionId);
            if (!summary)
                throw new Error(`Learning session not found after closing: ${sessionId}`);
            return summary;
        });
    }
    reviewEventCount() {
        return this.#database.prepare("SELECT COUNT(*) AS count FROM review_event").get().count;
    }
    async backup(destination) {
        mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
        const temporaryDestination = join(dirname(destination), `.${basename(destination)}.${randomUUID()}.tmp`);
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
        }
        catch (error) {
            rmSync(temporaryDestination, { force: true });
            throw error;
        }
    }
    /**
     * Records something the reader marked while reading.
     *
     * The quote is trimmed to a bounded length on the way in. A selection is
     * whatever the reader's mouse happened to cover, which can be a whole
     * section; storing that verbatim would turn a "I don't follow this" note into
     * a duplicate of the lesson.
     */
    recordReaderMark(input) {
        const exact = input.quote.exact.trim();
        if (exact.length === 0)
            throw new Error("A reader mark needs a non-empty selection");
        const markId = randomUUID();
        const createdAt = (input.createdAt ?? new Date()).getTime();
        const row = {
            mark_id: markId,
            lesson_id: input.lessonKey,
            content_revision: input.contentRevision,
            kind: input.kind,
            quote_exact: exact.slice(0, MAX_QUOTE_CHARS),
            quote_prefix: input.quote.prefix.slice(-QUOTE_CONTEXT_CHARS),
            quote_suffix: input.quote.suffix.slice(0, QUOTE_CONTEXT_CHARS),
            section_title: input.sectionTitle ?? null,
            note: input.note ?? null,
            created_at: createdAt,
            resolved_at: null,
        };
        this.#database
            .prepare(`
        INSERT INTO reader_mark (
          mark_id, lesson_id, content_revision, kind,
          quote_exact, quote_prefix, quote_suffix,
          section_title, note, created_at, resolved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `)
            .run(row.mark_id, row.lesson_id, row.content_revision, row.kind, row.quote_exact, row.quote_prefix, row.quote_suffix, row.section_title, row.note, row.created_at);
        return rowToReaderMark(row);
    }
    /**
     * Open marks, newest last.
     *
     * Ascending, unlike every other listing here, because these are read as a
     * batch and handed to someone to answer in order — and the order a reader met
     * their own confusions in is the order that makes the batch legible.
     */
    listReaderMarks(options = {}) {
        const capped = Math.max(1, Math.min(Math.trunc(options.limit ?? 200), 1_000));
        const clauses = [];
        const parameters = [];
        if (options.lessonKey !== undefined) {
            clauses.push("lesson_id = ?");
            parameters.push(options.lessonKey);
        }
        if (options.kind !== undefined) {
            clauses.push("kind = ?");
            parameters.push(options.kind);
        }
        if (!options.includeResolved)
            clauses.push("resolved_at IS NULL");
        const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
        parameters.push(capped);
        const rows = rowsAs(this.#database
            .prepare(`
          SELECT mark_id, lesson_id, content_revision, kind,
                 quote_exact, quote_prefix, quote_suffix,
                 section_title, note, created_at, resolved_at
          FROM reader_mark
          ${where}
          ORDER BY created_at ASC, rowid ASC
          LIMIT ?
        `)
            .all(...parameters));
        return rows.map(rowToReaderMark);
    }
    /**
     * Marks one as dealt with. Kept rather than deleted: "I did not understand
     * this once" is the whole signal this table exists to accumulate, and a row
     * removed the moment it is answered erases exactly the history that would
     * show which lessons keep producing questions.
     */
    resolveReaderMark(markId, resolvedAt = new Date()) {
        validateId(markId, "Mark ID");
        const result = this.#database
            .prepare("UPDATE reader_mark SET resolved_at = ? WHERE mark_id = ? AND resolved_at IS NULL")
            .run(resolvedAt.getTime(), markId);
        return Number(result.changes) > 0;
    }
    /** Removes one outright, for a mark made by accident. */
    deleteReaderMark(markId) {
        validateId(markId, "Mark ID");
        const result = this.#database.prepare("DELETE FROM reader_mark WHERE mark_id = ?").run(markId);
        return Number(result.changes) > 0;
    }
    close() {
        this.#database.close();
    }
}
/** Long enough for a paragraph, short enough that a mark is not a transcript. */
const MAX_QUOTE_CHARS = 600;
/** Enough surrounding text to find the quote again after the lesson is edited. */
const QUOTE_CONTEXT_CHARS = 60;
function rowToReaderMark(row) {
    return {
        markId: row.mark_id,
        lessonKey: row.lesson_id,
        contentRevision: row.content_revision,
        kind: row.kind,
        quote: { exact: row.quote_exact, prefix: row.quote_prefix, suffix: row.quote_suffix },
        sectionTitle: row.section_title,
        note: row.note,
        createdAt: new Date(row.created_at).toISOString(),
        resolvedAt: row.resolved_at === null ? null : new Date(row.resolved_at).toISOString(),
    };
}
//# sourceMappingURL=sqlite-learning-store.js.map