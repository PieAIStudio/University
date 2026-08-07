import { join } from "node:path";

import { StableId } from "../../src/domain/schemas.js";

export interface StudyPaths {
  readonly root: string;
  readonly manifest: string;
  readonly source: {
    readonly root: string;
    readonly registration: string;
    readonly repository: string;
    readonly snapshots: string;
  };
  readonly ua: string;
  readonly courses: string;
  /**
   * The English layer, kept beside the courses rather than inside them.
   *
   * A lesson revision is create-once, and its `contentHash` covers only
   * `content.md`. Annotations live here so that turning English mode on never
   * produces a new revision — which would send every completed lesson back to
   * unfinished.
   */
  readonly language: string;
  readonly notes: string;
  readonly learner: {
    readonly root: string;
    readonly database: string;
    readonly backups: string;
  };
}

interface SnapshotPaths {
  readonly manifest: string;
}

interface UaAnalysisPaths {
  readonly root: string;
  readonly manifest: string;
  readonly workspace: string;
  readonly data: string;
}

interface CoursePaths {
  readonly root: string;
  readonly manifest: string;
  readonly units: string;
}

interface UnitPaths {
  readonly root: string;
  readonly manifest: string;
  readonly lessons: string;
}

interface LessonPaths {
  readonly root: string;
  readonly latest: string;
  readonly revisions: string;
  readonly exercises: string;
  readonly cards: string;
}

interface KnowledgeNotePaths {
  readonly root: string;
  readonly latest: string;
  readonly revisions: string;
}

export function getStudyPaths(studiesRoot: string, candidateId: string): StudyPaths {
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

export function getSnapshotPaths(
  studiesRoot: string,
  studyId: string,
  snapshotId: string,
): SnapshotPaths {
  const id = StableId.parse(snapshotId);
  return { manifest: join(getStudyPaths(studiesRoot, studyId).source.snapshots, `${id}.json`) };
}

export function getUaAnalysisPaths(
  studiesRoot: string,
  studyId: string,
  analysisId: string,
): UaAnalysisPaths {
  const id = StableId.parse(analysisId);
  const root = join(getStudyPaths(studiesRoot, studyId).ua, id);
  return {
    root,
    manifest: join(root, "manifest.json"),
    workspace: join(root, "workspace"),
    data: join(root, "data"),
  };
}

export function getCoursePaths(
  studiesRoot: string,
  studyId: string,
  courseId: string,
): CoursePaths {
  const id = StableId.parse(courseId);
  const root = join(getStudyPaths(studiesRoot, studyId).courses, id);
  return { root, manifest: join(root, "course.json"), units: join(root, "units") };
}

export function getUnitPaths(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unitId: string,
): UnitPaths {
  const id = StableId.parse(unitId);
  const root = join(getCoursePaths(studiesRoot, studyId, courseId).units, id);
  return { root, manifest: join(root, "unit.json"), lessons: join(root, "lessons") };
}

export function getLessonPaths(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unitId: string,
  lessonId: string,
): LessonPaths {
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

export function getKnowledgeNotePaths(
  studiesRoot: string,
  studyId: string,
  noteId: string,
): KnowledgeNotePaths {
  const id = StableId.parse(noteId);
  const root = join(getStudyPaths(studiesRoot, studyId).notes, id);
  return {
    root,
    latest: join(root, "latest.json"),
    revisions: join(root, "revisions"),
  };
}
