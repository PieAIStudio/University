import { join } from "node:path";
import { StableId } from "@pieai/university-core/domain/schemas.js";
export function getStudyPaths(studiesRoot, candidateId) {
    const id = StableId.parse(candidateId);
    const root = join(studiesRoot, id);
    const sourceRoot = join(root, "source");
    const learnerRoot = join(root, "learner");
    return {
        root,
        manifest: join(root, "study.json"),
        source: {
            root: sourceRoot,
            registration: join(sourceRoot, "registration.json"),
            repository: join(sourceRoot, "repository.git"),
            snapshots: join(sourceRoot, "snapshots"),
            checkouts: join(sourceRoot, "checkouts"),
        },
        ua: join(root, "ua"),
        courses: join(root, "courses"),
        language: join(root, "language"),
        notes: join(root, "notes"),
        learner: {
            root: learnerRoot,
            database: join(learnerRoot, "learning.sqlite"),
            backups: join(learnerRoot, "backups"),
        },
    };
}
export function getSnapshotPaths(studiesRoot, studyId, snapshotId) {
    const id = StableId.parse(snapshotId);
    return { manifest: join(getStudyPaths(studiesRoot, studyId).source.snapshots, `${id}.json`) };
}
export function getUaAnalysisPaths(studiesRoot, studyId, analysisId) {
    const id = StableId.parse(analysisId);
    const root = join(getStudyPaths(studiesRoot, studyId).ua, id);
    return {
        root,
        manifest: join(root, "manifest.json"),
        workspace: join(root, "workspace"),
        data: join(root, "data"),
    };
}
export function getCoursePaths(studiesRoot, studyId, courseId) {
    const id = StableId.parse(courseId);
    const root = join(getStudyPaths(studiesRoot, studyId).courses, id);
    return { root, manifest: join(root, "course.json"), units: join(root, "units") };
}
export function getUnitPaths(studiesRoot, studyId, courseId, unitId) {
    const id = StableId.parse(unitId);
    const root = join(getCoursePaths(studiesRoot, studyId, courseId).units, id);
    return { root, manifest: join(root, "unit.json"), lessons: join(root, "lessons") };
}
export function getLessonPaths(studiesRoot, studyId, courseId, unitId, lessonId) {
    const id = StableId.parse(lessonId);
    const root = join(getUnitPaths(studiesRoot, studyId, courseId, unitId).lessons, id);
    return {
        root,
        latest: join(root, "latest.json"),
        revisions: join(root, "revisions"),
        exercises: join(root, "exercises"),
        cards: join(root, "cards"),
    };
}
export function getKnowledgeNotePaths(studiesRoot, studyId, noteId) {
    const id = StableId.parse(noteId);
    const root = join(getStudyPaths(studiesRoot, studyId).notes, id);
    return {
        root,
        latest: join(root, "latest.json"),
        revisions: join(root, "revisions"),
    };
}
//# sourceMappingURL=paths.js.map