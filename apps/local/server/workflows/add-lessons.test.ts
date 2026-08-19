import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { EvidenceReference, SnapshotManifest } from "@pieai/university-core/domain/schemas.js";
import { readCourse, readLatestLesson, readUnit } from "../content/repository.js";
import { createStudy, registerLocalGitSource } from "../studies/repository.js";
import { createCleanSnapshot } from "../studies/snapshots.js";
import { addCourseLessons } from "./add-lessons.js";
import { createCourse } from "./create-course.js";
import { openCourseForEdit, reactivateCourse } from "./revise-course.js";

const STUDY_ID = "sample";
const COURSE_ID = "solo-founder";
const UNIT_ID = "boundaries";

function git(repository: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", repository, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function evidence(snapshot: SnapshotManifest): EvidenceReference {
  return {
    kind: "fact",
    snapshotId: snapshot.id,
    sourceCommit: snapshot.sourceCommit,
    sourcePath: "truth.ts",
    lineStart: 1,
    lineEnd: 1,
    nodeIds: [],
  };
}

/** A published, active course — the state in which a curriculum actually grows. */
function setup() {
  const container = mkdtempSync(join(tmpdir(), "university-local-add-lessons-"));
  const studiesRoot = join(container, "studies");
  const sourceRoot = join(container, "source");
  execFileSync("git", ["init", "-q", "-b", "main", sourceRoot]);
  git(sourceRoot, ["config", "user.name", "UniversityLocal Test"]);
  git(sourceRoot, ["config", "user.email", "test@university.local"]);
  writeFileSync(join(sourceRoot, "truth.ts"), "export const truth = 'value';\n");
  git(sourceRoot, ["add", "."]);
  git(sourceRoot, ["commit", "-q", "-m", "Initial"]);
  createStudy(studiesRoot, { id: STUDY_ID, title: "Sample" });
  registerLocalGitSource(studiesRoot, STUDY_ID, sourceRoot);
  const snapshot = createCleanSnapshot(studiesRoot, STUDY_ID, "HEAD");

  createCourse({
    studiesRoot,
    studyId: STUDY_ID,
    proposal: {
      schemaVersion: 1,
      proposalId: "create-solo-founder",
      targetSnapshotId: snapshot.id,
      course: {
        id: COURSE_ID,
        title: "Solo Founder Engineering",
        audience: "Solo developer",
        objectives: ["Name the boundary that keeps a system honest"],
        units: [
          {
            id: UNIT_ID,
            title: "Boundaries",
            objective: "Explain why layers exist",
            lessons: [
              {
                id: "why-boundaries",
                title: "Why boundaries",
                content: "# Why boundaries\n\nA boundary is a promise you can check.\n",
                evidence: [evidence(snapshot)],
                cards: [
                  {
                    id: "boundary-card",
                    front: "什么让边界可信？",
                    back: "可以被检查的承诺。",
                    evidence: [evidence(snapshot)],
                  },
                ],
                exercises: [
                  {
                    id: "boundary-recall",
                    title: "Boundary recall",
                    prompt: "用一句话说明边界为什么必须可检查。",
                    expectedAnswer: "不可检查的边界等于没有边界。",
                    evidence: [evidence(snapshot)],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  });
  return { studiesRoot, snapshot };
}

function lessonProposal(snapshot: SnapshotManifest, id: string) {
  return {
    id,
    title: `Lesson ${id}`,
    content: `# ${id}\n\nSomething true about the source.\n`,
    evidence: [evidence(snapshot)],
    cards: [
      {
        id: `${id}-card`,
        front: `${id} 的问题？`,
        back: `${id} 的答案。`,
        evidence: [evidence(snapshot)],
      },
    ],
    exercises: [
      {
        id: `${id}-drill`,
        title: `${id} drill`,
        kind: "explain" as const,
        prompt: "解释一下。",
        rubric: ["说出要点"],
        evidence: [evidence(snapshot)],
      },
    ],
  };
}

function proposal(snapshot: SnapshotManifest, overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    proposalId: "add-second-lesson",
    targetSnapshotId: snapshot.id,
    courseId: COURSE_ID,
    unit: { id: UNIT_ID },
    lessons: [lessonProposal(snapshot, "checkable-promises")],
    ...overrides,
  };
}

describe("course lesson addition workflow", () => {
  it("appends a lesson to an existing unit and reactivates as fresh", () => {
    const { studiesRoot, snapshot } = setup();
    expect(readCourse(studiesRoot, STUDY_ID, COURSE_ID).status).toBe("active");

    // An active course is closed to content changes; that is the same gate a
    // revision meets, and the same command opens it.
    expect(() =>
      addCourseLessons({ studiesRoot, studyId: STUDY_ID, proposal: proposal(snapshot) }),
    ).toThrow(/open-for-edit/);

    openCourseForEdit({ studiesRoot, studyId: STUDY_ID, courseId: COURSE_ID });
    const preview = addCourseLessons({
      studiesRoot,
      studyId: STUDY_ID,
      proposal: proposal(snapshot),
      dryRun: true,
    });
    expect(preview).toMatchObject({ outcome: "validated", unitCreated: false });
    expect(readUnit(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID).lessonIds).toEqual([
      "why-boundaries",
    ]);

    const added = addCourseLessons({
      studiesRoot,
      studyId: STUDY_ID,
      proposal: proposal(snapshot),
    });
    expect(added).toMatchObject({
      outcome: "added",
      unitCreated: false,
      lessonIds: ["checkable-promises"],
      cardIds: ["checkable-promises-card"],
      exerciseIds: ["checkable-promises-drill"],
    });
    expect(readUnit(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID).lessonIds).toEqual([
      "why-boundaries",
      "checkable-promises",
    ]);

    const closed = reactivateCourse({
      studiesRoot,
      studyId: STUDY_ID,
      courseId: COURSE_ID,
      targetSnapshotId: snapshot.id,
    });
    expect(closed.courseStatus).toBe("active");
    const lesson = readLatestLesson(
      studiesRoot,
      STUDY_ID,
      COURSE_ID,
      UNIT_ID,
      "checkable-promises",
    );
    expect(lesson.manifest.contentRevision).toBe(1);
    expect(lesson.manifest.status).toBe("active");
  });

  it("creates a new unit alongside its lessons", () => {
    const { studiesRoot, snapshot } = setup();
    openCourseForEdit({ studiesRoot, studyId: STUDY_ID, courseId: COURSE_ID });

    const added = addCourseLessons({
      studiesRoot,
      studyId: STUDY_ID,
      proposal: proposal(snapshot, {
        proposalId: "add-second-unit",
        unit: { id: "drift", title: "Drift", objective: "Stop silent divergence" },
        lessons: [lessonProposal(snapshot, "detect-drift"), lessonProposal(snapshot, "fix-drift")],
      }),
    });
    expect(added).toMatchObject({
      unitCreated: true,
      unitId: "drift",
      lessonIds: ["detect-drift", "fix-drift"],
    });
    expect(readCourse(studiesRoot, STUDY_ID, COURSE_ID).unitIds).toEqual([UNIT_ID, "drift"]);
    expect(readUnit(studiesRoot, STUDY_ID, COURSE_ID, "drift").lessonIds).toEqual([
      "detect-drift",
      "fix-drift",
    ]);

    // The new unit arrives as a draft and reactivation is what activates it, so
    // the audit still decides whether the course may be published.
    expect(readUnit(studiesRoot, STUDY_ID, COURSE_ID, "drift").status).toBe("draft");
    reactivateCourse({
      studiesRoot,
      studyId: STUDY_ID,
      courseId: COURSE_ID,
      targetSnapshotId: snapshot.id,
    });
    expect(readUnit(studiesRoot, STUDY_ID, COURSE_ID, "drift").status).toBe("active");
  });

  it("refuses a proposal whose unit claim disagrees with the course", () => {
    const { studiesRoot, snapshot } = setup();
    openCourseForEdit({ studiesRoot, studyId: STUDY_ID, courseId: COURSE_ID });

    expect(() =>
      addCourseLessons({
        studiesRoot,
        studyId: STUDY_ID,
        proposal: proposal(snapshot, {
          unit: { id: UNIT_ID, title: "Boundaries", objective: "Explain why layers exist" },
        }),
      }),
    ).toThrow(/already exists; drop title and objective/);

    expect(() =>
      addCourseLessons({
        studiesRoot,
        studyId: STUDY_ID,
        proposal: proposal(snapshot, { unit: { id: "brand-new" } }),
      }),
    ).toThrow(/does not exist; supply title and objective/);

    expect(readCourse(studiesRoot, STUDY_ID, COURSE_ID).unitIds).toEqual([UNIT_ID]);
  });

  it("refuses a lesson ID the course already uses anywhere", () => {
    const { studiesRoot, snapshot } = setup();
    openCourseForEdit({ studiesRoot, studyId: STUDY_ID, courseId: COURSE_ID });

    expect(() =>
      addCourseLessons({
        studiesRoot,
        studyId: STUDY_ID,
        proposal: proposal(snapshot, { lessons: [lessonProposal(snapshot, "why-boundaries")] }),
      }),
    ).toThrow(/already has a lesson named why-boundaries/);

    // Lesson IDs are directory names under one course root, so a collision in a
    // different unit is the same collision.
    addCourseLessons({
      studiesRoot,
      studyId: STUDY_ID,
      proposal: proposal(snapshot, {
        proposalId: "add-drift-unit",
        unit: { id: "drift", title: "Drift", objective: "Stop silent divergence" },
        lessons: [lessonProposal(snapshot, "detect-drift")],
      }),
    });
    expect(() =>
      addCourseLessons({
        studiesRoot,
        studyId: STUDY_ID,
        proposal: proposal(snapshot, { lessons: [lessonProposal(snapshot, "detect-drift")] }),
      }),
    ).toThrow(/already has a lesson named detect-drift/);
  });

  it("refuses a lesson carrying cards but no exercise, exactly as course create does", () => {
    const { studiesRoot, snapshot } = setup();
    openCourseForEdit({ studiesRoot, studyId: STUDY_ID, courseId: COURSE_ID });

    const inert = lessonProposal(snapshot, "inert");
    expect(() =>
      addCourseLessons({
        studiesRoot,
        studyId: STUDY_ID,
        proposal: proposal(snapshot, { lessons: [{ ...inert, exercises: [] }] }),
      }),
    ).toThrow(/at least one exercise/);
  });

  it("refuses evidence that does not belong to the target snapshot", () => {
    const { studiesRoot, snapshot } = setup();
    openCourseForEdit({ studiesRoot, studyId: STUDY_ID, courseId: COURSE_ID });

    const lesson = lessonProposal(snapshot, "unbacked");
    expect(() =>
      addCourseLessons({
        studiesRoot,
        studyId: STUDY_ID,
        proposal: proposal(snapshot, {
          lessons: [
            {
              ...lesson,
              evidence: [{ ...evidence(snapshot), sourcePath: "not-a-real-file.ts" }],
            },
          ],
        }),
      }),
    ).toThrow();
    expect(readUnit(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID).lessonIds).toEqual([
      "why-boundaries",
    ]);
  });
});
