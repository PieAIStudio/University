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
import { LessonCreationProposalSchema } from "./lesson-proposal.js";
import {
  CourseRevisionProposalSchema,
  openCourseForEdit,
  reactivateCourse,
} from "./revise-course.js";

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

const LESSON_BODY = [
  "## 学习目标",
  "读完你能说出一张图片在程序里变成了什么。",
  "",
  "## 先给结论",
  "它变成一长串数字。",
  "",
  "## 一个类比",
  "就像把一幅画拆成一格一格的方格纸，每格记一个数。",
  "",
  "## 工作示例",
  "把一张照片放大到看得见小方块，每个小方块就是一个数。",
  "",
  "## 自检",
  "做对了你会看到一格一格的颜色块。做错了你会以为它还是一张画。",
  "",
  "## 重点",
  "- 图片在程序里是一串数字。",
  "",
].join("\n");

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

  /*
   * A general course — a study with no repository — is created against no
   * snapshot and cites public authority pages instead. `create-course` has
   * always allowed that; `add-lessons` required `targetSnapshotId` until an
   * AI course written for the `general` study was created successfully and
   * then could not be given its second unit. The lesson shape is shared
   * between the two workflows precisely so a rule cannot hold at one entry
   * point and not the other, and this one had forked without a test to notice.
   */
  it("grows a course that was created against no snapshot at all", () => {
    const { studiesRoot } = setup();
    const generalCourseId = "url-cited-course";
    const urlEvidence: EvidenceReference = {
      kind: "fact",
      sourceUrl: "https://developer.mozilla.org/en-US/docs/Web/API/ImageData/data",
      sourceTitle: "MDN · ImageData.data",
      sourceAuthority: "mdn",
      note: "A picture reaching a program is a run of pixel numbers.",
    };
    createCourse({
      studiesRoot,
      studyId: STUDY_ID,
      proposal: {
        schemaVersion: 1,
        proposalId: "create-url-cited-course",
        course: {
          id: generalCourseId,
          title: "What a computer sees",
          audience: "Someone with a phone and no computer",
          objectives: ["Say what a picture becomes inside a program"],
          units: [
            {
              id: "first-unit",
              title: "First unit",
              objective: "Open the subject",
              lessons: [
                {
                  id: "picture-is-numbers",
                  title: "A picture is numbers",
                  content: LESSON_BODY,
                  evidence: [urlEvidence],
                },
              ],
            },
          ],
        },
      },
    });
    openCourseForEdit({ studiesRoot, studyId: STUDY_ID, courseId: generalCourseId });

    const result = addCourseLessons({
      studiesRoot,
      studyId: STUDY_ID,
      proposal: {
        schemaVersion: 1,
        proposalId: "add-second-unit",
        courseId: generalCourseId,
        unit: { id: "second-unit", title: "Second unit", objective: "Keep going" },
        lessons: [
          {
            id: "sound-is-numbers",
            title: "Sound is numbers too",
            content: LESSON_BODY,
            evidence: [urlEvidence],
          },
        ],
      },
    });

    expect(result.outcome).toBe("added");
    expect(result.targetSnapshotId).toBeNull();
    expect(result.unitCreated).toBe(true);
    expect(readUnit(studiesRoot, STUDY_ID, generalCourseId, "second-unit").lessonIds).toEqual([
      "sound-is-numbers",
    ]);
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
  /*
    A lesson is born through this workflow and changed through `course revise`.
    When the revision proposal can set a field that the creation proposal cannot
    express, a new lesson is structurally unable to be born with it — the field
    is not merely inconvenient to supply, it is unsayable, because the creation
    schema is `.strict()`.

    That has now happened twice, silently, and both times the symptom was the
    same: revision 1 of a brand-new lesson was a version of itself with a part
    missing, and nothing anywhere went red. `variant` went that way first, which
    meant a course written in the house shape from its first line was the one
    thing the shape linter skipped. `activities` went the same way after it, so
    every one of the nine activities that has ever shipped was bolted on by a
    later revision whose only purpose was to carry it.

    Comparing the two shapes is what neither of those defects could survive. The
    exceptions are listed by name rather than by count, so adding a third is a
    decision someone writes down here instead of a thing that happens.
  */
  it("lets a lesson be born with every field a revision can give it", () => {
    /*
      `.refine()` keeps the object's `shape` in this zod version rather than
      wrapping it. If that ever changes, `shape` becomes undefined and this
      throws — which is the loud failure, not the silent pass this test exists
      to prevent.
    */
    const born = new Set(Object.keys(LessonCreationProposalSchema.shape));
    const revised = Object.keys(CourseRevisionProposalSchema.shape.lesson.shape);

    /** Fields a revision addresses that have no meaning at birth. */
    const notABirthField = new Set([
      "courseId", // the proposal says where the lesson goes; a revision says where it is
      "unitId",
      "expectedRevision", // there is no revision to expect yet
      "assetFiles", // paths copied in during a revision; creation has no source to copy from
    ]);
    /*
      Nobody has needed to be born with these yet. Fixing them unexercised would
      be a fix nobody has checked, so they stay named here until a lesson wants
      one — at which point this list is where the argument happens.
    */
    const knownUnborn = new Set(["sections", "assets"]);

    const missing = revised.filter(
      (field) => !born.has(field) && !notABirthField.has(field) && !knownUnborn.has(field),
    );
    expect(missing).toEqual([]);
    expect(born.has("activities")).toBe(true);
    expect(born.has("variant")).toBe(true);
  });

  it("keeps an activity a new lesson was born with", () => {
    const { studiesRoot, snapshot } = setup();
    openCourseForEdit({ studiesRoot, studyId: STUDY_ID, courseId: COURSE_ID });

    const lesson = lessonProposal(snapshot, "reachable-parts");
    addCourseLessons({
      studiesRoot,
      studyId: STUDY_ID,
      proposal: proposal(snapshot, {
        lessons: [
          {
            ...lesson,
            content: `${lesson.content}\n::play{#reachable-parts-connect}\n`,
            activities: [
              {
                id: "reachable-parts-connect",
                kind: "connect",
                role: "apply",
                difficulty: "intro",
                title: "谁能碰到谁",
                brief: "把左边的东西连到它真能碰到的那一样。",
                goal: "连出真实的可达关系。",
                takeaway: "能碰到什么，是由边界决定的，不是由名字决定的。",
                hint: "先问：这一边真的够得着那一边吗？",
                source: { label: "边界写在这里", path: "truth.ts", line: 1, lineEnd: 1 },
                nodes: [
                  { id: "caller", label: "调用方", note: "发出请求的那一边", x: 0, y: 0 },
                  { id: "boundary", label: "边界", note: "可以被检查的承诺", x: 1, y: 0 },
                ],
                edges: [{ from: "caller", to: "boundary", why: "请求先到边界" }],
                probes: [{ label: "一次请求", path: ["caller", "boundary"] }],
              },
            ],
          },
        ],
      }),
    });

    const written = readLatestLesson(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, "reachable-parts");
    expect(written.manifest.activities.map((activity) => activity.id)).toEqual([
      "reachable-parts-connect",
    ]);
    expect(written.manifest.contentRevision).toBe(1);
  });
});
