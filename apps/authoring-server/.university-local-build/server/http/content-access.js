import { existsSync, readFileSync, readdirSync } from "node:fs";
import { SnapshotManifestSchema, UaAnalysisManifestSchema, } from "@pieai/university-core/domain/schemas.js";
import { listCourseIds, orderCoursesByPrerequisite, readCourse, readLatestCard, readLatestExercise, readLatestLesson, readUnit, } from "../content/repository.js";
import { isPublishableStatus } from "../content/course-status.js";
import { readActiveKnowledgeCard } from "../knowledge/repository.js";
import { cardContentKey, knowledgeCardContentKey, } from "../learning/types.js";
import { getCoursePaths } from "../studies/paths.js";
import { readStudy } from "../studies/repository.js";
import { HttpError } from "./errors.js";
import { serializeCardState } from "./serialize.js";
import { sendJson } from "./wire.js";
function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}
function countSnapshotManifests(directory) {
    if (!existsSync(directory))
        return 0;
    return readdirSync(directory, { withFileTypes: true }).filter((entry) => {
        if (!entry.isFile() || !entry.name.endsWith(".json"))
            return false;
        try {
            SnapshotManifestSchema.parse(readJson(`${directory}/${entry.name}`));
            return true;
        }
        catch {
            return false;
        }
    }).length;
}
function countUaAnalyses(directory) {
    if (!existsSync(directory))
        return { total: 0, ready: 0 };
    let total = 0;
    let ready = 0;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue;
        const path = `${directory}/${entry.name}/manifest.json`;
        if (!existsSync(path))
            continue;
        try {
            const manifest = UaAnalysisManifestSchema.parse(readJson(path));
            total += 1;
            // Only a `ready` analysis can back evidence: `validateEvidence` rejects
            // everything else, and the CLI's `readyIds` agrees. Counting
            // `legacy-import` here made Studies promise analyses that would then be
            // refused at binding time with a 422 — the display was the thing that
            // was wrong, not the integrity rule.
            if (manifest.status === "ready")
                ready += 1;
        }
        catch {
            // Invalid analysis directories are isolated from the usable count.
        }
    }
    return { total, ready };
}
function countCourseManifests(directory) {
    if (!existsSync(directory))
        return 0;
    return readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(`${directory}/${entry.name}/course.json`)).length;
}
/**
 * `defaultCourseId` decides which course a study opens on, not which course a
 * study is allowed to teach. Gating every route on it turned a study into a
 * single-course container: a second course was written, validated and stored,
 * and then answered 404 on every read. Membership is already established by the
 * path — `StableId` rejects traversal in both `parseRoute` and `getCoursePaths`
 * — so the only questions left are whether the course exists and is publishable.
 */
function requireActiveCourse(studiesRoot, studyId, courseId) {
    if (readStudy(studiesRoot, studyId).status !== "active")
        throw new HttpError(410, "Study has been retired; learner history is preserved");
    if (!existsSync(getCoursePaths(studiesRoot, studyId, courseId).manifest)) {
        throw new HttpError(404, "Course does not exist in this study");
    }
    const course = readCourse(studiesRoot, studyId, courseId);
    if (!isPublishableStatus(course.status)) {
        throw new HttpError(409, "Course is not publishable");
    }
    return course;
}
/**
 * The study's publishable courses, in prerequisite order. Ordering is what makes
 * "next lesson" meaningful across a shelf: without it the learner's next step
 * would hop between courses by whatever order the filesystem happened to
 * return. `study.defaultCourseId` picks which course the study opens on, not
 * this order — see `requireActiveCourse` above — so it plays no part here.
 */
function listActiveCourses(studiesRoot, study) {
    const courses = [];
    for (const courseId of listCourseIds(studiesRoot, study.id)) {
        try {
            const course = readCourse(studiesRoot, study.id, courseId);
            if (isPublishableStatus(course.status))
                courses.push(course);
        }
        catch {
            // A course that cannot be parsed is reported by the route that reads it,
            // not by every shelf listing that walks past it.
        }
    }
    return orderCoursesByPrerequisite(courses);
}
function requireActiveUnit(studiesRoot, route, course) {
    if (!course.unitIds.includes(route.unitId))
        throw new HttpError(404, "Unit is not in the course");
    const unit = readUnit(studiesRoot, route.studyId, route.courseId, route.unitId);
    if (unit.status !== "active")
        throw new HttpError(409, "Unit is not active");
    return unit;
}
function requireActiveLesson(studiesRoot, route) {
    const course = requireActiveCourse(studiesRoot, route.studyId, route.courseId);
    const unit = requireActiveUnit(studiesRoot, route, course);
    if (!unit.lessonIds.includes(route.lessonId)) {
        throw new HttpError(404, "Lesson is not in the unit");
    }
    const result = readLatestLesson(studiesRoot, route.studyId, route.courseId, route.unitId, route.lessonId);
    if (result.manifest.status !== "active")
        throw new HttpError(409, "Lesson is not active");
    return { lesson: result.manifest, content: result.content };
}
function requireActiveCard(studiesRoot, route) {
    if (!route.contentId)
        throw new HttpError(404, "Card ID is missing");
    const lesson = requireActiveLesson(studiesRoot, route).lesson;
    if (!lesson.cardIds.includes(route.contentId))
        throw new HttpError(404, "Card is not in lesson");
    const card = readLatestCard(studiesRoot, route.studyId, route.courseId, route.unitId, route.lessonId, route.contentId);
    if (card.status !== "active")
        throw new HttpError(409, "Card is not active");
    return card;
}
function requireActiveExercise(studiesRoot, route) {
    if (!route.contentId)
        throw new HttpError(404, "Exercise ID is missing");
    const lesson = requireActiveLesson(studiesRoot, route).lesson;
    if (!lesson.exerciseIds.includes(route.contentId)) {
        throw new HttpError(404, "Exercise is not in lesson");
    }
    const exercise = readLatestExercise(studiesRoot, route.studyId, route.courseId, route.unitId, route.lessonId, route.contentId);
    if (exercise.status !== "active")
        throw new HttpError(409, "Exercise is not active");
    return exercise;
}
function courseReviewableCard(studiesRoot, route) {
    const card = requireActiveCard(studiesRoot, route);
    return {
        key: cardContentKey({
            courseId: route.courseId,
            unitId: route.unitId,
            lessonId: route.lessonId,
            cardId: card.id,
        }),
        contentRevision: card.contentRevision,
        front: card.front,
        back: card.back,
        ...(card.locales ? { locales: card.locales } : {}),
    };
}
function knowledgeReviewableCard(studiesRoot, route) {
    let result;
    try {
        result = readActiveKnowledgeCard(studiesRoot, route.studyId, route.noteId, route.cardId);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Knowledge card is unavailable";
        if (message.startsWith("Knowledge note is not active:"))
            throw new HttpError(409, message);
        if (message.startsWith("Knowledge note does not declare card:")) {
            throw new HttpError(404, message);
        }
        throw error;
    }
    return {
        key: knowledgeCardContentKey({ noteId: result.note.id, cardId: result.card.id }),
        contentRevision: result.note.contentRevision,
        front: result.card.front,
        back: result.card.back,
    };
}
/**
 * How many earlier answers travel back with a reveal. Enough to see whether an
 * understanding moved; not so many that the panel becomes a transcript.
 */
const PRIOR_ATTEMPT_LIMIT = 3;
/**
 * What the learner wrote for this card before today.
 *
 * Deliberately part of the *reveal* response and of no other endpoint. A review
 * card only works if the recall is real, so the page must not be able to show
 * a previous answer while the question is still open — not as a default, not
 * behind a flag. Sending it at reveal makes the timing a property of the API
 * rather than a rule the UI has to keep remembering.
 */
function priorAttemptsOf(store, card, currentAttemptId) {
    return store
        .listRetrievalAttempts(card.key, PRIOR_ATTEMPT_LIMIT + 1)
        .filter((attempt) => attempt.attemptId !== currentAttemptId)
        .slice(0, PRIOR_ATTEMPT_LIMIT)
        .map((attempt) => ({
        answer: attempt.answer,
        revealedAt: attempt.revealedAt.toISOString(),
        contentRevision: attempt.contentRevision,
    }));
}
function revealReviewableCard(response, body, card, store) {
    if (card.contentRevision !== body.contentRevision) {
        throw new HttpError(409, "Card content revision changed; reload before revealing");
    }
    if (!store.getCard(card.key)) {
        throw new HttpError(409, "Card is not enrolled in the learning schedule");
    }
    const startedAt = new Date(body.startedAt);
    const duplicate = store.getRetrievalAttemptByCommandId(body.commandId);
    if (duplicate) {
        if (duplicate.cardKey !== card.key ||
            duplicate.contentRevision !== body.contentRevision ||
            duplicate.answer !== body.answer ||
            duplicate.startedAt.getTime() !== startedAt.getTime() ||
            duplicate.usedHint !== body.usedHint ||
            duplicate.confidence !== body.confidence) {
            throw new HttpError(409, "Command ID was already used for another card reveal");
        }
        sendJson(response, 200, {
            attemptId: duplicate.attemptId,
            submittedAnswer: duplicate.answer,
            back: card.back,
            durationMs: duplicate.durationMs,
            priorAttempts: priorAttemptsOf(store, card, duplicate.attemptId),
        });
        return;
    }
    const revealedAt = new Date();
    if (startedAt.getTime() > revealedAt.getTime()) {
        throw new HttpError(400, "Card retrieval start time cannot be in the future");
    }
    let attempt;
    try {
        attempt = store.recordRetrievalAttempt({
            commandId: body.commandId,
            cardKey: card.key,
            contentRevision: body.contentRevision,
            answer: body.answer,
            startedAt,
            revealedAt,
            usedHint: body.usedHint,
            ...(body.confidence === undefined ? {} : { confidence: body.confidence }),
        });
    }
    catch (error) {
        if (error instanceof Error && error.message.startsWith("Command ID conflict:")) {
            throw new HttpError(409, "Command ID was already used for another card reveal");
        }
        throw error;
    }
    sendJson(response, 200, {
        attemptId: attempt.attemptId,
        submittedAnswer: body.answer,
        back: card.back,
        durationMs: attempt.durationMs,
        priorAttempts: priorAttemptsOf(store, card, attempt.attemptId),
    });
}
function reviewReviewableCard(response, body, card, store) {
    if (card.contentRevision !== body.contentRevision) {
        throw new HttpError(409, "Card content revision changed; reload before reviewing");
    }
    if (!store.getCard(card.key)) {
        throw new HttpError(409, "Card is not enrolled in the learning schedule");
    }
    try {
        const receipt = store.reviewCard({
            commandId: body.commandId,
            cardKey: card.key,
            contentRevision: body.contentRevision,
            rating: body.rating,
        });
        sendJson(response, 200, {
            eventId: receipt.eventId,
            state: serializeCardState(receipt.state),
        });
    }
    catch (error) {
        if (error instanceof Error && error.message.startsWith("Command ID conflict:")) {
            throw new HttpError(409, "Command ID was already used for another card review");
        }
        throw error;
    }
}
/**
 * Reusing a command ID with a different body is a client conflict, not a
 * server fault. The card paths already mapped it to 409; the exercise path
 * let it escape as a generic 500, which tells a retrying client nothing.
 */
function runWithCommandConflictMapped(message, operation) {
    try {
        return operation();
    }
    catch (error) {
        if (error instanceof Error && error.message.startsWith("Command ID conflict:")) {
            throw new HttpError(409, message);
        }
        throw error;
    }
}
export { countSnapshotManifests, countUaAnalyses, countCourseManifests, listActiveCourses, requireActiveLesson, requireActiveCard, requireActiveExercise, courseReviewableCard, knowledgeReviewableCard, revealReviewableCard, reviewReviewableCard, runWithCommandConflictMapped, };
//# sourceMappingURL=content-access.js.map