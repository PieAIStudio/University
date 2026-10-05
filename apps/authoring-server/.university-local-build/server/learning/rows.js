import { createHash } from "node:crypto";
import { reviewContentKey, } from "./types.js";
const MAX_RETRIEVAL_ANSWER_LENGTH = 100_000;
export function stableJson(value) {
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
export function hashParameters(value) {
    return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}
export function rowToState(row) {
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
        state: row.state,
        ...(row.last_review_at === null ? {} : { last_review: new Date(row.last_review_at) }),
        schedulerVersion: row.scheduler_version,
        schedulerConfigHash: row.scheduler_config_hash,
        updatedAt: new Date(row.updated_at),
    };
}
export function toFsrsCard(state) {
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
export function cardToStoredState(cardKey, contentRevision, card, schedulerVersion, schedulerConfigHash, updatedAt) {
    return {
        cardKey,
        contentRevision,
        ...card,
        schedulerVersion,
        schedulerConfigHash,
        updatedAt,
    };
}
export function serializeCardState(state) {
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
export function deserializeCardState(value) {
    const due = new Date(value.dueAt);
    const updatedAt = new Date(value.updatedAt);
    const lastReview = value.lastReviewAt ? new Date(value.lastReviewAt) : undefined;
    if (!Number.isFinite(due.getTime()) ||
        !Number.isFinite(updatedAt.getTime()) ||
        (lastReview && !Number.isFinite(lastReview.getTime()))) {
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
        state: value.state,
        ...(lastReview ? { last_review: lastReview } : {}),
        schedulerVersion: value.schedulerVersion,
        schedulerConfigHash: value.schedulerConfigHash,
        updatedAt,
    };
}
export function sameSerializedCardState(left, right) {
    return JSON.stringify(sortJsonValue(left)) === JSON.stringify(sortJsonValue(right));
}
export function validateId(value, label) {
    if (typeof value !== "string" || value.trim().length === 0 || value.length > 200) {
        throw new Error(`${label} must contain between 1 and 200 characters`);
    }
}
function optionalSessionText(value, label, maximumLength) {
    if (value === undefined)
        return undefined;
    if (typeof value !== "string")
        throw new Error(`${label} must be a string`);
    const normalized = value.trim();
    if (normalized.length === 0 || normalized.length > maximumLength) {
        throw new Error(`${label} must contain between 1 and ${maximumLength} characters`);
    }
    return normalized;
}
export function normalizeSessionMetadata(metadata) {
    const host = optionalSessionText(metadata?.host, "Session host", 100);
    const objective = optionalSessionText(metadata?.objective, "Session objective", 2_000);
    return {
        ...(host === undefined ? {} : { host }),
        ...(objective === undefined ? {} : { objective }),
    };
}
export function validateRevision(value) {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error("Content revision must be a positive integer");
    }
}
export function timestamp(value, label) {
    if (!(value instanceof Date))
        throw new Error(`${label} must be a valid date`);
    const result = value.getTime();
    if (!Number.isFinite(result))
        throw new Error(`${label} must be a valid date`);
    return result;
}
export function validateRetrievalAnswer(value) {
    if (typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length > MAX_RETRIEVAL_ANSWER_LENGTH) {
        throw new Error(`Retrieval answer must contain between 1 and ${MAX_RETRIEVAL_ANSWER_LENGTH} characters`);
    }
}
export function validateRetrievalConfidence(value) {
    if (value === undefined)
        return;
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error("Retrieval confidence must be between 0 and 1");
    }
}
export function retrievalTiming(startedAt, revealedAt, requestedDurationMs) {
    const startedAtMs = timestamp(startedAt, "Retrieval start time");
    const revealedAtMs = timestamp(revealedAt, "Retrieval reveal time");
    const durationMs = revealedAtMs - startedAtMs;
    if (!Number.isSafeInteger(durationMs) || durationMs < 0) {
        throw new Error("Retrieval reveal time must not be earlier than its start time");
    }
    if (requestedDurationMs !== undefined &&
        (!Number.isSafeInteger(requestedDurationMs) || requestedDurationMs !== durationMs)) {
        throw new Error("Retrieval duration must equal revealedAt minus startedAt in milliseconds");
    }
    return { startedAtMs, revealedAtMs, durationMs };
}
export function rowToRetrievalAttempt(row) {
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
    if (row.session_id !== null)
        validateId(row.session_id, "Session ID");
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
export function rowToLearningSession(row) {
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
export function rowToLearningSessionSummary(row) {
    const session = rowToLearningSession(row);
    for (const [value, label] of [
        [row.review_count, "review count"],
        [row.retrieval_attempt_count, "retrieval-attempt count"],
        [row.exercise_attempt_count, "exercise-attempt count"],
        [row.lesson_progress_event_count, "lesson-progress-event count"],
    ]) {
        if (!Number.isSafeInteger(value) || value < 0) {
            throw new Error(`Learning session ${row.session_id} contains an invalid ${label}`);
        }
    }
    if (!Number.isFinite(row.exercise_score) ||
        !Number.isFinite(row.exercise_max_score) ||
        row.exercise_score < 0 ||
        row.exercise_max_score < 0 ||
        row.exercise_score > row.exercise_max_score) {
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
function sortJsonValue(value) {
    if (Array.isArray(value))
        return value.map(sortJsonValue);
    if (value !== null && typeof value === "object") {
        const source = value;
        return Object.fromEntries(Object.keys(source)
            .sort()
            .map((key) => [key, sortJsonValue(source[key])]));
    }
    return value;
}
export function serializeResponse(value) {
    if (value === undefined)
        return null;
    let serialized;
    try {
        serialized = JSON.stringify(value);
    }
    catch {
        throw new Error("Exercise response must be JSON-serializable");
    }
    if (serialized === undefined)
        throw new Error("Exercise response must be JSON-serializable");
    return JSON.stringify(sortJsonValue(JSON.parse(serialized)));
}
//# sourceMappingURL=rows.js.map