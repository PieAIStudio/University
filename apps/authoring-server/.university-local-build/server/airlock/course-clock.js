import { listCourseIds, readCourse } from "../content/repository.js";
import { readStudy } from "../studies/repository.js";
import { listSnapshots } from "../studies/snapshots.js";
export function readCourseClock(studiesRoot, studyId, airlockPromotedCommit) {
    readStudy(studiesRoot, studyId);
    // listSnapshots is newest-first.
    const latest = listSnapshots(studiesRoot, studyId)[0] ?? null;
    const courses = listCourseIds(studiesRoot, studyId).map((courseId) => {
        const course = readCourse(studiesRoot, studyId, courseId);
        return { courseId, status: course.status, currency: course.currency };
    });
    return {
        studyId,
        latestSnapshotId: latest?.id ?? null,
        latestSnapshotCommit: latest?.sourceCommit ?? null,
        matchesAirlock: latest ? latest.sourceCommit === airlockPromotedCommit : null,
        courses,
    };
}
//# sourceMappingURL=course-clock.js.map