import { listCourseIds, readCourse } from "../content/repository.js";
import { readStudy } from "../studies/repository.js";
import { listSnapshots } from "../studies/snapshots.js";

/**
 * The third clock: what commit the courses are actually teaching from.
 *
 * The first two clocks answer "where is the repository" and "where is the
 * airlock". Neither answers the question a learner cares about, which is
 * whether the lesson in front of them describes code that still exists. A study
 * can sit behind a perfectly sealed airlock and still serve courses pinned to a
 * snapshot two promotions old, and from the outside that looks identical to a
 * study that is completely up to date.
 *
 * Courses deliberately pinned to history are counted separately rather than
 * folded into "behind". They are not lagging; they are finished.
 */
export interface CourseClock {
  readonly studyId: string;
  /** The newest snapshot the study has taken, or null when it has none. */
  readonly latestSnapshotId: string | null;
  readonly latestSnapshotCommit: string | null;
  /** True when the study's newest snapshot is the commit the airlock is sealed at. */
  readonly matchesAirlock: boolean | null;
  readonly courses: readonly CourseCurrencyRow[];
}

export interface CourseCurrencyRow {
  readonly courseId: string;
  readonly status: string;
  readonly currency: "follow-ref" | "pinned-history";
}

export function readCourseClock(
  studiesRoot: string,
  studyId: string,
  airlockPromotedCommit: string,
): CourseClock {
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
