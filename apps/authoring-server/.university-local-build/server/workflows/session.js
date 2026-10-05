import { existsSync } from "node:fs";
import { SqliteLearningStore } from "../learning/sqlite-learning-store.js";
import { getStudyPaths } from "../studies/paths.js";
import { readStudy } from "../studies/repository.js";
function serializeSession(session) {
    return {
        sessionId: session.sessionId,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt?.toISOString() ?? null,
        host: session.host ?? null,
        objective: session.objective ?? null,
    };
}
function serializeSessionSummary(summary) {
    return {
        ...serializeSession(summary),
        reviewCount: summary.reviewCount,
        retrievalAttemptCount: summary.retrievalAttemptCount,
        exerciseAttemptCount: summary.exerciseAttemptCount,
        lessonProgressEventCount: summary.lessonProgressEventCount,
        exerciseScore: summary.exerciseScore,
        exerciseMaxScore: summary.exerciseMaxScore,
    };
}
function requireSessionSummary(store, sessionId) {
    const summary = store.getSessionSummary(sessionId);
    if (!summary)
        throw new Error(`Learning session summary not found: ${sessionId}`);
    return summary;
}
export function startLearningSession(input) {
    readStudy(input.studiesRoot, input.studyId);
    const database = getStudyPaths(input.studiesRoot, input.studyId).learner.database;
    const store = new SqliteLearningStore(database);
    try {
        const existing = store.getOpenSession();
        if (existing) {
            throw new Error(`A learning session is already open: ${existing.sessionId}. End it before starting another.`);
        }
        const sessionId = store.startSession({ host: input.host, objective: input.objective });
        return {
            schemaVersion: 1,
            operation: "session-start",
            studyId: input.studyId,
            sessionId,
            session: serializeSessionSummary(requireSessionSummary(store, sessionId)),
        };
    }
    finally {
        store.close();
    }
}
export function inspectLearningSession(input) {
    readStudy(input.studiesRoot, input.studyId);
    const database = getStudyPaths(input.studiesRoot, input.studyId).learner.database;
    if (!existsSync(database)) {
        return {
            schemaVersion: 1,
            operation: "session-status",
            studyId: input.studyId,
            databaseExists: false,
            openSession: null,
            recentSessions: [],
        };
    }
    const store = new SqliteLearningStore(database);
    try {
        const open = store.getOpenSession();
        const recent = store
            .listSessions(10)
            .map((session) => serializeSessionSummary(requireSessionSummary(store, session.sessionId)));
        return {
            schemaVersion: 1,
            operation: "session-status",
            studyId: input.studyId,
            databaseExists: true,
            openSession: open
                ? serializeSessionSummary(requireSessionSummary(store, open.sessionId))
                : null,
            recentSessions: recent,
        };
    }
    finally {
        store.close();
    }
}
export function endLearningSession(input) {
    readStudy(input.studiesRoot, input.studyId);
    const database = getStudyPaths(input.studiesRoot, input.studyId).learner.database;
    if (!existsSync(database)) {
        throw new Error(`No learner database or open learning session exists for study: ${input.studyId}`);
    }
    const store = new SqliteLearningStore(database);
    try {
        const open = store.getOpenSession();
        if (!open)
            throw new Error(`No open learning session exists for study: ${input.studyId}`);
        if (input.sessionId && input.sessionId !== open.sessionId) {
            throw new Error(`Requested session ${input.sessionId} is not open; the only open session is ${open.sessionId}`);
        }
        const summary = store.endSession(input.sessionId ?? open.sessionId);
        return {
            schemaVersion: 1,
            operation: "session-end",
            studyId: input.studyId,
            summary: serializeSessionSummary(summary),
        };
    }
    finally {
        store.close();
    }
}
//# sourceMappingURL=session.js.map