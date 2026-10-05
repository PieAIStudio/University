import { join } from "node:path";
import { listCourseIds, orderCoursesByPrerequisite, readCourse, readLatestCard, readLatestLesson, readUnit, } from "../content/repository.js";
import { isPublishableStatus } from "../content/course-status.js";
import { readActiveKnowledgeCard } from "../knowledge/repository.js";
import { lessonContentKey, parseReviewContentKey, } from "../learning/types.js";
import { getLessonPaths } from "../studies/paths.js";
import { inspectStudyShelf } from "../studies/repository.js";
function activeCourses(studiesRoot, study, issues, focusedCourseIds = []) {
    const courses = [];
    for (const courseId of listCourseIds(studiesRoot, study.id)) {
        try {
            const course = readCourse(studiesRoot, study.id, courseId);
            if (isPublishableStatus(course.status))
                courses.push(course);
        }
        catch (error) {
            // Keep healthy courses usable, but never turn a malformed manifest into
            // a silent omission: the host needs a repairable reason for the gap.
            issues.push(`${study.id}/${courseId}: course manifest: ${error instanceof Error ? error.message : "invalid course manifest"}`);
        }
    }
    const focusPosition = new Map(focusedCourseIds.map((courseId, index) => [courseId, index]));
    const focusRank = (courseId) => focusPosition.get(courseId) ?? focusedCourseIds.length;
    return orderCoursesByPrerequisite(courses, (left, right) => focusRank(left.id) - focusRank(right.id));
}
function resolveAuthoringFocus(studiesRoot, studies, authoringFocus, issues) {
    if (!authoringFocus)
        return null;
    const study = studies.find((candidate) => candidate.id === authoringFocus.studyId);
    if (!study) {
        issues.push(`Authoring focus study is unavailable: ${authoringFocus.studyId}`);
        return null;
    }
    if (study.status !== "active") {
        issues.push(`Authoring focus study is not active: ${study.id} is ${study.status}`);
        return null;
    }
    for (const courseId of authoringFocus.courseIds) {
        try {
            const course = readCourse(studiesRoot, study.id, courseId);
            if (course.status !== "active") {
                issues.push(`Authoring focus course is not active: ${study.id}/${course.id} is ${course.status}`);
                return null;
            }
        }
        catch (error) {
            issues.push(`Authoring focus course is unavailable: ${study.id}/${courseId}: ${error instanceof Error ? error.message : "invalid course manifest"}`);
            return null;
        }
    }
    return authoringFocus;
}
function serializeProgress(progress, readConfirmed) {
    if (!progress)
        return null;
    return {
        contentRevision: progress.contentRevision,
        status: progress.status,
        progress: progress.progress,
        updatedAt: progress.updatedAt.toISOString(),
        readConfirmed,
    };
}
function requireCurrentCourseCard(studiesRoot, studyId, coursesById, identity) {
    const course = coursesById.get(identity.courseId);
    if (!course)
        throw new Error(`Course is not active: ${identity.courseId}`);
    if (!course.unitIds.includes(identity.unitId)) {
        throw new Error(`Unit is not in course: ${identity.unitId}`);
    }
    const unit = readUnit(studiesRoot, studyId, course.id, identity.unitId);
    if (unit.status !== "active" || !unit.lessonIds.includes(identity.lessonId)) {
        throw new Error(`Lesson is not active in unit: ${identity.lessonId}`);
    }
    const lesson = readLatestLesson(studiesRoot, studyId, course.id, unit.id, identity.lessonId).manifest;
    if (lesson.status !== "active" || !lesson.cardIds.includes(identity.cardId)) {
        throw new Error(`Card is not active in lesson: ${identity.cardId}`);
    }
    const card = readLatestCard(studiesRoot, studyId, course.id, unit.id, lesson.id, identity.cardId);
    if (card.status !== "active")
        throw new Error(`Card is not active: ${identity.cardId}`);
    return card;
}
/**
 * One read model for both the browser and AI hosts.
 *
 * Keeping this walk here prevents the web home page and `teach next` from
 * answering the same question with two subtly different curriculum orders.
 */
export function buildLearningOverview(input) {
    const shelf = inspectStudyShelf(input.studiesRoot);
    const now = input.now ?? new Date();
    const authoringFocusCourseTitles = new Map();
    const dueCards = [];
    const issues = [];
    let nextLesson = null;
    const authoringFocus = resolveAuthoringFocus(input.studiesRoot, shelf.studies, input.authoringFocus, issues);
    const focusedStudies = shelf.studies
        .filter((study) => study.status === "active")
        .sort((left, right) => {
        const rank = (id) => (id === authoringFocus?.studyId ? 0 : 1);
        return rank(left.id) - rank(right.id) || left.id.localeCompare(right.id);
    });
    // A session is a stronger continuation signal than the first unfinished
    // lesson on the shelf. Inspect every active study before choosing the work
    // item so a session in a non-focused study cannot disappear from `teach
    // next`. There is one open session per learner database, not globally, so a
    // deterministic tie-break is required when old work left more than one
    // active study open.
    const storesByStudy = new Map();
    const openSessionCandidates = [];
    for (const study of focusedStudies) {
        const store = input.getStore(study.id);
        storesByStudy.set(study.id, store);
        const session = store?.getOpenSession();
        if (session)
            openSessionCandidates.push({ studyId: study.id, session });
    }
    openSessionCandidates.sort((left, right) => {
        const focusRank = (studyId) => (studyId === authoringFocus?.studyId ? 0 : 1);
        return (focusRank(left.studyId) - focusRank(right.studyId) ||
            right.session.startedAt.getTime() - left.session.startedAt.getTime() ||
            left.studyId.localeCompare(right.studyId) ||
            left.session.sessionId.localeCompare(right.session.sessionId));
    });
    const resumedSession = openSessionCandidates[0] ?? null;
    const studyOrder = resumedSession
        ? [
            focusedStudies.find((study) => study.id === resumedSession.studyId),
            ...focusedStudies.filter((study) => study.id !== resumedSession.studyId),
        ]
        : focusedStudies;
    for (const study of studyOrder) {
        const store = storesByStudy.get(study.id) ?? null;
        storesByStudy.set(study.id, store);
        const focusedCourseIds = study.id === authoringFocus?.studyId ? authoringFocus.courseIds : [];
        const courses = activeCourses(input.studiesRoot, study, issues, focusedCourseIds);
        const coursesById = new Map(courses.map((course) => [course.id, course]));
        if (study.id === authoringFocus?.studyId) {
            for (const courseId of authoringFocus.courseIds) {
                const title = coursesById.get(courseId)?.title;
                if (title)
                    authoringFocusCourseTitles.set(courseId, title);
            }
        }
        for (const course of courses) {
            try {
                for (const unitId of course.unitIds) {
                    const unit = readUnit(input.studiesRoot, study.id, course.id, unitId);
                    if (unit.status !== "active")
                        continue;
                    for (const lessonId of unit.lessonIds) {
                        const lesson = readLatestLesson(input.studiesRoot, study.id, course.id, unit.id, lessonId).manifest;
                        if (lesson.status !== "active")
                            continue;
                        const key = lessonContentKey({ courseId: course.id, unitId: unit.id, lessonId });
                        const progress = store?.getLessonProgress(key) ?? null;
                        const readConfirmed = store?.hasLessonCompletion(key, lesson.contentRevision) ?? false;
                        const finished = readConfirmed &&
                            progress?.status === "completed" &&
                            progress.contentRevision === lesson.contentRevision;
                        if (!nextLesson && !finished) {
                            const paths = getLessonPaths(input.studiesRoot, study.id, course.id, unit.id, lessonId);
                            const revisionRoot = join(paths.revisions, String(lesson.contentRevision));
                            nextLesson = {
                                studyId: study.id,
                                studyTitle: study.title,
                                courseId: course.id,
                                courseTitle: course.title,
                                unitId: unit.id,
                                lessonId,
                                lessonTitle: lesson.title,
                                contentRevision: lesson.contentRevision,
                                progress: serializeProgress(progress, readConfirmed),
                                evidence: lesson.evidence,
                                artifact: {
                                    manifestPath: join(revisionRoot, "manifest.json"),
                                    contentPath: join(revisionRoot, "content.md"),
                                },
                            };
                        }
                    }
                }
            }
            catch (error) {
                issues.push(`${study.id}/${course.id}: course: ${error instanceof Error ? error.message : "invalid course learning data"}`);
            }
        }
        let states = [];
        try {
            states = store?.listDueCards(now, 1_000) ?? [];
        }
        catch (error) {
            issues.push(`${study.id}: due queue: ${error instanceof Error ? error.message : "invalid learner data"}`);
        }
        for (const state of states) {
            try {
                const identity = parseReviewContentKey(state.cardKey);
                if (identity.kind !== "course-card") {
                    // Knowledge cards remain part of the notes authoring/API surface, but
                    // the learner review surface has no designed flow for them. Validate
                    // the row so missing notes still appear in diagnostics, then keep the
                    // unsupported kind out of today's queue.
                    readActiveKnowledgeCard(input.studiesRoot, study.id, identity.noteId, identity.cardId);
                    continue;
                }
                const card = requireCurrentCourseCard(input.studiesRoot, study.id, coursesById, identity);
                if (card.contentRevision !== state.contentRevision)
                    continue;
                dueCards.push({
                    kind: "course-card",
                    studyId: study.id,
                    courseId: identity.courseId,
                    unitId: identity.unitId,
                    lessonId: identity.lessonId,
                    cardId: identity.cardId,
                    front: card.front,
                    contentRevision: card.contentRevision,
                    dueAt: state.due.toISOString(),
                });
            }
            catch (error) {
                // Retired notes are expected to leave old scheduler rows behind. They
                // are unavailable work, not a broken overview.
                if (error instanceof Error && error.message.startsWith("Knowledge note is not active:")) {
                    continue;
                }
                issues.push(`${study.id}: due ${state.cardKey}: ${error instanceof Error ? error.message : "invalid review item"}`);
            }
        }
    }
    dueCards.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
    const activeStudyIds = new Set(studyOrder.map((study) => study.id));
    // An existing session is the strongest continuation signal. Otherwise keep
    // the locator aligned with the first available work item.
    const teachingStudyId = resumedSession?.studyId ??
        nextLesson?.studyId ??
        dueCards[0]?.studyId ??
        (authoringFocus && activeStudyIds.has(authoringFocus.studyId)
            ? authoringFocus.studyId
            : null) ??
        studyOrder[0]?.id ??
        null;
    const session = resumedSession?.session ??
        (teachingStudyId ? storesByStudy.get(teachingStudyId)?.getOpenSession() : null);
    return {
        dueCount: dueCards.length,
        card: dueCards[0] ?? null,
        nextLesson,
        focus: authoringFocus
            ? {
                ...authoringFocus,
                courses: authoringFocus.courseIds.map((id) => ({
                    id,
                    title: authoringFocusCourseTitles.get(id) ?? id,
                })),
            }
            : null,
        teachingStudyId,
        openSession: teachingStudyId && session
            ? {
                studyId: teachingStudyId,
                sessionId: session.sessionId,
                startedAt: session.startedAt.toISOString(),
                host: session.host ?? null,
                objective: session.objective ?? null,
            }
            : null,
        issues,
    };
}
//# sourceMappingURL=learning-overview.js.map