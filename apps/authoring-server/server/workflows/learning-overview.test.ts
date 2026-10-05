import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  updateCourseStatus,
  updateUnitStatus,
  writeCourse,
  writeLessonRevision,
  writeUnit,
} from "../content/repository.js";
import { isPublishableStatus } from "../content/course-status.js";
import { lessonContentKey } from "../learning/types.js";
import { SqliteLearningStore } from "../learning/sqlite-learning-store.js";
import { getCoursePaths, getStudyPaths } from "../studies/paths.js";
import { createStudy, setStudyStatus } from "../studies/repository.js";
import { buildLearningOverview } from "./learning-overview.js";

function setup() {
  const container = mkdtempSync(join(tmpdir(), "university-local-overview-"));
  const studiesRoot = join(container, "studies");
  return { container, studiesRoot };
}

function openSessionStore(
  studiesRoot: string,
  studyId: string,
  startedAt: string,
): SqliteLearningStore {
  const store = new SqliteLearningStore(getStudyPaths(studiesRoot, studyId).learner.database);
  store.startSession(new Date(startedAt), {
    host: "test-host",
    objective: `Continue ${studyId}`,
  });
  return store;
}

describe("learning overview", () => {
  it("maps every course status to the publishable boundary", () => {
    expect(isPublishableStatus("draft")).toBe(false);
    expect(isPublishableStatus("active")).toBe(true);
    expect(isPublishableStatus("stale")).toBe(true);
    expect(isPublishableStatus("retired")).toBe(false);
  });

  it("includes a stale course in the authoring shelf with learner facts", () => {
    const { studiesRoot } = setup();
    const courseId = "stale-course";
    const unitId = "stale-unit";
    const lessonId = "stale-lesson";
    const createdAt = "2026-08-17T00:00:00.000Z";
    const progressAt = "2026-08-17T01:00:00.000Z";
    createStudy(studiesRoot, { id: "sample", title: "Sample" });

    writeCourse(studiesRoot, "sample", {
      schemaVersion: 1,
      id: courseId,
      title: "Stale course",
      description: "A course being rewritten without disappearing from the shelf.",
      audience: "Learner",
      objectives: ["Keep learning facts while content is rewritten"],
      unitIds: [unitId],
      status: "draft",
      createdAt,
      updatedAt: createdAt,
    });
    writeUnit(studiesRoot, "sample", courseId, {
      schemaVersion: 1,
      id: unitId,
      title: "Stale unit",
      objective: "Continue a course while its source is being rewritten.",
      prerequisiteUnitIds: [],
      lessonIds: [lessonId],
      status: "draft",
    });
    writeLessonRevision(studiesRoot, "sample", {
      manifest: {
        schemaVersion: 1,
        id: lessonId,
        title: "Stale lesson",
        courseId,
        unitId,
        exerciseIds: [],
        cardIds: [],
        contentRevision: 1,
        status: "active",
        evidence: [
          {
            kind: "fact",
            sourceUrl: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
            sourceTitle: "JavaScript | MDN",
            sourceAuthority: "mdn",
          },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      content: "# Stale lesson\n\nThe lesson remains available while its course is rewritten.\n",
    });
    updateUnitStatus(studiesRoot, "sample", courseId, unitId, "active");
    updateCourseStatus(studiesRoot, "sample", courseId, "active");
    updateCourseStatus(studiesRoot, "sample", courseId, "stale");

    const store = new SqliteLearningStore(getStudyPaths(studiesRoot, "sample").learner.database);
    const lessonKey = lessonContentKey({ courseId, unitId, lessonId });
    store.recordLessonProgress({
      lessonKey,
      contentRevision: 1,
      status: "in-progress",
      progress: 0.5,
      occurredAt: new Date(progressAt),
    });

    try {
      const overview = buildLearningOverview({
        studiesRoot,
        getStore: (studyId) => (studyId === "sample" ? store : null),
      });

      expect(overview.issues).toEqual([]);
      expect(overview.nextLesson).toMatchObject({
        studyId: "sample",
        courseId,
        courseTitle: "Stale course",
        unitId,
        lessonId,
        progress: {
          contentRevision: 1,
          status: "in-progress",
          progress: 0.5,
          updatedAt: progressAt,
          readConfirmed: false,
        },
      });
    } finally {
      store.close();
    }
  });

  it("reports an archived authoring focus and falls back to the active shelf", () => {
    const { studiesRoot } = setup();
    createStudy(studiesRoot, { id: "archived", title: "Archived" });
    setStudyStatus(studiesRoot, "archived", "archived");
    createStudy(studiesRoot, { id: "active", title: "Active" });

    const overview = buildLearningOverview({
      studiesRoot,
      authoringFocus: { studyId: "archived", courseIds: [] },
      getStore: () => null,
    });

    expect(overview.focus).toBeNull();
    expect(overview.teachingStudyId).toBe("active");
    expect(overview.issues).toContain("Authoring focus study is not active: archived is archived");
  });

  it("reports stale authoring focus and malformed course manifests instead of hiding them", () => {
    const { studiesRoot } = setup();
    createStudy(studiesRoot, { id: "sample", title: "Sample" });
    const staleCourse = {
      schemaVersion: 1 as const,
      id: "stale-course",
      title: "Stale course",
      description: "",
      audience: "Learner",
      objectives: ["Understand stale data"],
      unitIds: [],
      status: "draft" as const,
      createdAt: "2026-08-17T00:00:00.000Z",
      updatedAt: "2026-08-17T00:00:00.000Z",
    };
    writeCourse(studiesRoot, "sample", staleCourse);
    const stale = getCoursePaths(studiesRoot, "sample", "stale-course");
    writeFileSync(
      stale.manifest,
      `${JSON.stringify({ ...staleCourse, status: "stale" }, null, 2)}\n`,
    );
    const broken = getCoursePaths(studiesRoot, "sample", "broken-course");
    mkdirSync(broken.root, { recursive: true });
    writeFileSync(broken.manifest, "{ not valid course json }\n");

    const staleFocus = buildLearningOverview({
      studiesRoot,
      authoringFocus: { studyId: "sample", courseIds: ["stale-course"] },
      getStore: () => null,
    });
    expect(staleFocus.focus).toBeNull();
    expect(staleFocus.teachingStudyId).toBe("sample");
    expect(staleFocus.issues).toContain(
      "Authoring focus course is not active: sample/stale-course is stale",
    );
    expect(staleFocus.issues.join(" ")).toContain("sample/broken-course: course manifest:");

    const noFocus = buildLearningOverview({ studiesRoot, getStore: () => null });
    expect(noFocus.issues.join(" ")).toContain("sample/broken-course: course manifest:");
  });

  it("resumes the newest open session from any active study when focus is absent", () => {
    const { studiesRoot } = setup();
    createStudy(studiesRoot, { id: "alpha-study", title: "Alpha" });
    createStudy(studiesRoot, { id: "beta-study", title: "Beta" });
    const stores = new Map([
      ["alpha-study", openSessionStore(studiesRoot, "alpha-study", "2026-08-17T01:00:00.000Z")],
      ["beta-study", openSessionStore(studiesRoot, "beta-study", "2026-08-17T02:00:00.000Z")],
    ]);

    try {
      const overview = buildLearningOverview({
        studiesRoot,
        getStore: (studyId) => stores.get(studyId) ?? null,
      });

      expect(overview.teachingStudyId).toBe("beta-study");
      expect(overview.openSession).toMatchObject({
        studyId: "beta-study",
        host: "test-host",
        objective: "Continue beta-study",
      });
    } finally {
      for (const store of stores.values()) store.close();
    }
  });

  it("lets an active authoring focus win deterministically when several studies have open sessions", () => {
    const { studiesRoot } = setup();
    createStudy(studiesRoot, { id: "alpha-study", title: "Alpha" });
    createStudy(studiesRoot, { id: "beta-study", title: "Beta" });
    const stores = new Map([
      ["alpha-study", openSessionStore(studiesRoot, "alpha-study", "2026-08-17T01:00:00.000Z")],
      ["beta-study", openSessionStore(studiesRoot, "beta-study", "2026-08-17T02:00:00.000Z")],
    ]);

    try {
      const overview = buildLearningOverview({
        studiesRoot,
        authoringFocus: { studyId: "alpha-study", courseIds: [] },
        getStore: (studyId) => stores.get(studyId) ?? null,
      });

      expect(overview.teachingStudyId).toBe("alpha-study");
      expect(overview.openSession?.studyId).toBe("alpha-study");
    } finally {
      for (const store of stores.values()) store.close();
    }
  });
});
