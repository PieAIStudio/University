import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { EvidenceReference, SnapshotManifest } from "../../src/domain/schemas.js";
import {
  readCourse,
  readLatestCard,
  readLatestExercise,
  readLatestLesson,
  readUnit,
  updateCourseStatus,
  updateUnitStatus,
  writeCardRevision,
  writeCourse,
  writeExerciseRevision,
  writeLessonRevision,
  writeUnit,
} from "../content/repository.js";
import { createStudy, registerLocalGitSource } from "../studies/repository.js";
import { createCleanSnapshot } from "../studies/snapshots.js";
import { auditStudyFreshness, inspectSourceStatus } from "./refresh-study.js";
import {
  CourseRevisionPartialError,
  openCourseForEdit,
  reactivateCourse,
  reviseCourseLesson,
} from "./revise-course.js";

const STUDY_ID = "sample";
const COURSE_ID = "founder-engineer";
const UNIT_ID = "architecture";
const LESSON_ID = "source-truth";
const CARD_ID = "source-truth-card";
const EXERCISE_ID = "source-truth-exercise";
const CREATED_AT = "2026-07-20T00:00:00.000Z";

function git(repository: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", repository, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sha256Bytes(value: Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
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

function setup() {
  const container = mkdtempSync(join(tmpdir(), "university-local-course-revise-"));
  const studiesRoot = join(container, "studies");
  const sourceRoot = join(container, "source");
  execFileSync("git", ["init", "-q", "-b", "main", sourceRoot]);
  git(sourceRoot, ["config", "user.name", "UniversityLocal Test"]);
  git(sourceRoot, ["config", "user.email", "test@university.local"]);
  writeFileSync(join(sourceRoot, "truth.ts"), "export const truth = 'old';\n");
  git(sourceRoot, ["add", "."]);
  git(sourceRoot, ["commit", "-q", "-m", "Initial truth"]);
  createStudy(studiesRoot, { id: STUDY_ID, title: "Sample" });
  registerLocalGitSource(studiesRoot, STUDY_ID, sourceRoot);
  const initialSnapshot = createCleanSnapshot(studiesRoot, STUDY_ID, "HEAD");
  const oldEvidence = evidence(initialSnapshot);

  writeCourse(studiesRoot, STUDY_ID, {
    schemaVersion: 1,
    id: COURSE_ID,
    title: "Founder Engineer",
    description: "Learn from immutable evidence",
    audience: "Founder",
    objectives: ["Follow current source truth"],
    unitIds: [UNIT_ID],
    status: "draft",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });
  writeUnit(studiesRoot, STUDY_ID, COURSE_ID, {
    schemaVersion: 1,
    id: UNIT_ID,
    title: "Architecture",
    objective: "Understand source truth",
    prerequisiteUnitIds: [],
    lessonIds: [LESSON_ID],
    status: "draft",
  });
  writeLessonRevision(studiesRoot, STUDY_ID, {
    manifest: {
      schemaVersion: 1,
      id: LESSON_ID,
      title: "Old source truth",
      courseId: COURSE_ID,
      unitId: UNIT_ID,
      exerciseIds: [EXERCISE_ID],
      cardIds: [CARD_ID],
      contentRevision: 1,
      status: "active",
      evidence: [oldEvidence],
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    },
    content: "# Old source truth\n\nThe old value is old.\n",
  });
  writeCardRevision(studiesRoot, STUDY_ID, {
    schemaVersion: 1,
    id: CARD_ID,
    kind: "basic",
    courseId: COURSE_ID,
    unitId: UNIT_ID,
    lessonId: LESSON_ID,
    front: "What is the old value?",
    back: "old",
    contentRevision: 1,
    status: "active",
    tags: ["source-truth"],
    evidence: [oldEvidence],
  });
  writeExerciseRevision(studiesRoot, STUDY_ID, {
    schemaVersion: 1,
    id: EXERCISE_ID,
    kind: "short-answer",
    title: "Recall source truth",
    courseId: COURSE_ID,
    unitId: UNIT_ID,
    lessonId: LESSON_ID,
    prompt: "What value does truth.ts export?",
    expectedAnswer: "old",
    contentRevision: 1,
    status: "active",
    evidence: [oldEvidence],
  });
  updateUnitStatus(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, "active");
  updateCourseStatus(studiesRoot, STUDY_ID, COURSE_ID, "active");

  writeFileSync(join(sourceRoot, "truth.ts"), "export const truth = 'new';\n");
  git(sourceRoot, ["add", "truth.ts"]);
  git(sourceRoot, ["commit", "-q", "-m", "Update truth"]);
  const targetSnapshot = createCleanSnapshot(studiesRoot, STUDY_ID, "HEAD");
  const stale = auditStudyFreshness({
    studiesRoot,
    studyId: STUDY_ID,
    targetSnapshotId: targetSnapshot.id,
    apply: true,
  });
  expect(stale.reports[0]?.status).toBe("stale");
  expect(readCourse(studiesRoot, STUDY_ID, COURSE_ID).status).toBe("stale");
  expect(readUnit(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID).status).toBe("stale");
  return { studiesRoot, sourceRoot, initialSnapshot, targetSnapshot };
}

function proposal(targetSnapshot: SnapshotManifest) {
  const targetEvidence = evidence(targetSnapshot);
  return {
    schemaVersion: 1,
    proposalId: "refresh-source-truth",
    targetSnapshotId: targetSnapshot.id,
    lesson: {
      courseId: COURSE_ID,
      unitId: UNIT_ID,
      id: LESSON_ID,
      expectedRevision: 1,
      title: "Current source truth",
      content: "# Current source truth\n\nThe committed value is new.\n",
      evidence: [targetEvidence],
      cards: [
        {
          id: CARD_ID,
          expectedRevision: 1,
          front: "What is the current committed value?",
          back: "new",
          evidence: [targetEvidence],
        },
      ],
      exercises: [
        {
          id: EXERCISE_ID,
          expectedRevision: 1,
          prompt: "What value does truth.ts export now?",
          expectedAnswer: "new",
          evidence: [targetEvidence],
        },
      ],
    },
  };
}

describe("course revision workflow", () => {
  it("closes stale → revise → fresh → reactivate without mutating the source checkout", () => {
    const { studiesRoot, sourceRoot, targetSnapshot } = setup();
    const sourceBefore = inspectSourceStatus(studiesRoot, STUDY_ID);
    const gitStatusBefore = git(sourceRoot, ["status", "--porcelain=v1"]);

    const preview = reviseCourseLesson({
      studiesRoot,
      studyId: STUDY_ID,
      proposal: proposal(targetSnapshot),
      dryRun: true,
      now: new Date("2026-07-20T12:00:00.000Z"),
    });
    expect(preview).toMatchObject({ disposition: "validated", mode: "dry-run" });
    expect(
      readLatestLesson(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID).manifest
        .contentRevision,
    ).toBe(1);

    const revised = reviseCourseLesson({
      studiesRoot,
      studyId: STUDY_ID,
      proposal: proposal(targetSnapshot),
      now: new Date("2026-07-20T12:00:00.000Z"),
    });
    const fresh = auditStudyFreshness({
      studiesRoot,
      studyId: STUDY_ID,
      targetSnapshotId: targetSnapshot.id,
    });
    const activated = reactivateCourse({
      studiesRoot,
      studyId: STUDY_ID,
      courseId: COURSE_ID,
      targetSnapshotId: targetSnapshot.id,
    });
    const retried = reviseCourseLesson({
      studiesRoot,
      studyId: STUDY_ID,
      proposal: proposal(targetSnapshot),
    });

    expect(revised).toMatchObject({ disposition: "created", mode: "apply" });
    expect(revised.revisions).toEqual({
      lesson: 2,
      cards: { [CARD_ID]: 2 },
      exercises: { [EXERCISE_ID]: 2 },
    });
    expect(fresh.reports[0]).toMatchObject({ status: "fresh", waitingForUa: false });
    expect(activated).toMatchObject({
      disposition: "activated",
      activatedUnitIds: [UNIT_ID],
      courseStatus: "active",
    });
    expect(retried.disposition).toBe("reused");
    expect(readCourse(studiesRoot, STUDY_ID, COURSE_ID).status).toBe("active");
    expect(readUnit(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID).status).toBe("active");
    expect(inspectSourceStatus(studiesRoot, STUDY_ID)).toEqual(sourceBefore);
    expect(git(sourceRoot, ["status", "--porcelain=v1"])).toBe(gitStatusBefore);
  });

  it("carries or changes a lesson teaching variant without touching evidence", () => {
    const { studiesRoot, targetSnapshot } = setup();
    const base = proposal(targetSnapshot);
    const candidate = {
      ...base,
      lesson: { ...base.lesson, variant: "对比" as const },
    };

    const revised = reviseCourseLesson({
      studiesRoot,
      studyId: STUDY_ID,
      proposal: candidate,
      now: new Date("2026-07-20T12:00:00.000Z"),
    });
    const stored = readLatestLesson(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID).manifest;

    expect(revised.disposition).toBe("created");
    expect(stored.variant).toBe("对比");
    expect(stored.evidence).toEqual(candidate.lesson.evidence);
  });

  it("rejects non-target evidence before writing any revision", () => {
    const { studiesRoot, initialSnapshot, targetSnapshot } = setup();
    const candidate = proposal(targetSnapshot);
    candidate.lesson.evidence = [evidence(initialSnapshot)];

    expect(() =>
      reviseCourseLesson({ studiesRoot, studyId: STUDY_ID, proposal: candidate }),
    ).toThrow(/target snapshot/);
    expect(
      readLatestLesson(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID).manifest
        .contentRevision,
    ).toBe(1);
    expect(
      readLatestCard(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID, CARD_ID).contentRevision,
    ).toBe(1);
    expect(
      readLatestExercise(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID, EXERCISE_ID)
        .contentRevision,
    ).toBe(1);
  });

  it("rejects expected-revision conflicts and dropped items", () => {
    const { studiesRoot, targetSnapshot } = setup();
    const wrongRevision = proposal(targetSnapshot);
    wrongRevision.lesson.expectedRevision = 7;
    expect(() =>
      reviseCourseLesson({ studiesRoot, studyId: STUDY_ID, proposal: wrongRevision }),
    ).toThrow(/expected current revision 7/);

    // Dropping a card would strand its scheduled review state, so a revision
    // may add items but never lose them.
    const missingCard = proposal(targetSnapshot);
    missingCard.lesson.cards = [];
    expect(() =>
      reviseCourseLesson({ studiesRoot, studyId: STUDY_ID, proposal: missingCard }),
    ).toThrow(/must still contain every existing ID/);
    expect(
      readLatestLesson(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID).manifest
        .contentRevision,
    ).toBe(1);
  });

  it("opens an active course for editing and closes it again", () => {
    const { studiesRoot, targetSnapshot } = setup();
    // Close the refresh cycle first, so the course is active and fresh — the
    // state in which content could previously never be touched.
    reviseCourseLesson({ studiesRoot, studyId: STUDY_ID, proposal: proposal(targetSnapshot) });
    reactivateCourse({
      studiesRoot,
      studyId: STUDY_ID,
      courseId: COURSE_ID,
      targetSnapshotId: targetSnapshot.id,
    });
    expect(readCourse(studiesRoot, STUDY_ID, COURSE_ID).status).toBe("active");

    const edit = proposal(targetSnapshot);
    edit.proposalId = "second-pass";
    edit.lesson.expectedRevision = 2;
    edit.lesson.cards[0]!.expectedRevision = 2;
    edit.lesson.exercises[0]!.expectedRevision = 2;
    edit.lesson.content = "# Source of truth\n\nA second pass over the same lesson.\n";
    expect(() => reviseCourseLesson({ studiesRoot, studyId: STUDY_ID, proposal: edit })).toThrow(
      /must both be stale/,
    );

    const opened = openCourseForEdit({ studiesRoot, studyId: STUDY_ID, courseId: COURSE_ID });
    expect(opened).toMatchObject({
      disposition: "opened",
      courseStatus: "stale",
      staleUnitIds: [UNIT_ID],
    });
    expect(readUnit(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID).status).toBe("stale");
    // Opening twice is a no-op, so an interrupted edit session can be resumed.
    expect(
      openCourseForEdit({ studiesRoot, studyId: STUDY_ID, courseId: COURSE_ID }).disposition,
    ).toBe("reused");

    reviseCourseLesson({ studiesRoot, studyId: STUDY_ID, proposal: edit });
    const closed = reactivateCourse({
      studiesRoot,
      studyId: STUDY_ID,
      courseId: COURSE_ID,
      targetSnapshotId: targetSnapshot.id,
    });
    expect(closed.courseStatus).toBe("active");
    const lesson = readLatestLesson(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID);
    expect(lesson.manifest.contentRevision).toBe(3);
    expect(lesson.content).toContain("A second pass");
  });

  it("adds a new card and exercise to an existing lesson", () => {
    const { studiesRoot, targetSnapshot } = setup();
    const candidate = proposal(targetSnapshot);
    candidate.lesson.cards.push({
      id: "added-card",
      front: "新增的卡片问题？",
      back: "新增的卡片答案。",
      evidence: [evidence(targetSnapshot)],
    } as (typeof candidate.lesson.cards)[number]);
    candidate.lesson.exercises.push({
      id: "added-exercise",
      title: "新增练习",
      kind: "explain",
      prompt: "解释一下。",
      rubric: ["说出要点"],
      evidence: [evidence(targetSnapshot)],
    } as unknown as (typeof candidate.lesson.exercises)[number]);

    reviseCourseLesson({ studiesRoot, studyId: STUDY_ID, proposal: candidate });

    const lesson = readLatestLesson(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID).manifest;
    expect(lesson.cardIds).toEqual([CARD_ID, "added-card"]);
    expect(lesson.exerciseIds).toEqual([EXERCISE_ID, "added-exercise"]);
    // A brand-new item starts at revision 1 while the revised one advances.
    expect(
      readLatestCard(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID, "added-card")
        .contentRevision,
    ).toBe(1);
    expect(
      readLatestCard(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID, CARD_ID).contentRevision,
    ).toBe(2);
    const added = readLatestExercise(
      studiesRoot,
      STUDY_ID,
      COURSE_ID,
      UNIT_ID,
      LESSON_ID,
      "added-exercise",
    );
    expect(added.kind).toBe("explain");
    expect(added.contentRevision).toBe(1);
  });

  it("installs new asset files and carries them into later revisions", () => {
    const { studiesRoot, targetSnapshot } = setup();
    const assetSource = join(studiesRoot, "capture.png");
    // A real 1×1 PNG, not the string "png test bytes". Ingest now checks that
    // an asset's leading bytes are the type it declares, because the serving
    // path always did — and a fixture that declares `image/png` over arbitrary
    // bytes is exactly the shape of the defect that check exists to stop.
    const assetBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    writeFileSync(assetSource, assetBytes);
    const candidate = proposal(targetSnapshot);
    candidate.proposalId = "asset-revision";
    Object.assign(candidate.lesson, {
      assets: [
        {
          id: "captured-screen",
          kind: "real-screenshot",
          path: "assets/captured-screen.png",
          sha256: sha256Bytes(assetBytes),
          mime: "image/png",
          bytes: assetBytes.byteLength,
          width: 1,
          height: 1,
          alt: "Test capture of the project folder.",
          source: {
            license: "Project-local captured evidence; no remote asset",
            attribution: "Local test capture",
          },
          capture: {
            sourceCommit: targetSnapshot.sourceCommit,
            route: "test-file-manager",
            state: "Project folder open.",
            viewport: { width: 1, height: 1 },
            locale: "en-US",
            captureRecipe: "Write a local fixture and pass it as an asset source.",
            capturedAt: CREATED_AT,
          },
        },
      ],
      assetFiles: [{ path: "assets/captured-screen.png", sourcePath: assetSource }],
    });

    expect(
      reviseCourseLesson({
        studiesRoot,
        studyId: STUDY_ID,
        proposal: candidate,
        dryRun: true,
      }),
    ).toMatchObject({ disposition: "validated", mode: "dry-run" });
    reviseCourseLesson({ studiesRoot, studyId: STUDY_ID, proposal: candidate });

    const lesson = readLatestLesson(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID);
    expect(lesson.manifest.assets).toHaveLength(1);
    expect(
      readFileSync(
        join(
          studiesRoot,
          STUDY_ID,
          "courses",
          COURSE_ID,
          "units",
          UNIT_ID,
          "lessons",
          LESSON_ID,
          "revisions",
          "2",
          "assets",
          "captured-screen.png",
        ),
      ),
    ).toEqual(assetBytes);

    const followUp = proposal(targetSnapshot);
    followUp.proposalId = "asset-revision-follow-up";
    followUp.lesson.expectedRevision = 2;
    followUp.lesson.cards[0]!.expectedRevision = 2;
    followUp.lesson.exercises[0]!.expectedRevision = 2;
    followUp.lesson.content = "# Follow-up source truth\n\nThe asset survives.\n";
    reviseCourseLesson({ studiesRoot, studyId: STUDY_ID, proposal: followUp });
    expect(
      readFileSync(
        join(
          studiesRoot,
          STUDY_ID,
          "courses",
          COURSE_ID,
          "units",
          UNIT_ID,
          "lessons",
          LESSON_ID,
          "revisions",
          "3",
          "assets",
          "captured-screen.png",
        ),
      ),
    ).toEqual(assetBytes);
  });

  it("refuses a revision whose newness claim disagrees with the lesson", () => {
    const { studiesRoot, targetSnapshot } = setup();

    const existingWithoutRevision = proposal(targetSnapshot);
    delete (existingWithoutRevision.lesson.cards[0] as { expectedRevision?: number })
      .expectedRevision;
    expect(() =>
      reviseCourseLesson({ studiesRoot, studyId: STUDY_ID, proposal: existingWithoutRevision }),
    ).toThrow(/already exists; declare its expectedRevision/);

    const newWithRevision = proposal(targetSnapshot);
    newWithRevision.lesson.cards.push({
      id: "not-yet-here",
      expectedRevision: 1,
      front: "问题？",
      back: "答案。",
      evidence: [evidence(targetSnapshot)],
    } as (typeof newWithRevision.lesson.cards)[number]);
    expect(() =>
      reviseCourseLesson({ studiesRoot, studyId: STUDY_ID, proposal: newWithRevision }),
    ).toThrow(/does not exist yet; omit expectedRevision/);

    expect(
      readLatestLesson(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID).manifest
        .contentRevision,
    ).toBe(1);
  });

  it("recovers an interrupted partial bundle only from the exact proposal", () => {
    const { studiesRoot, targetSnapshot } = setup();
    const candidate = proposal(targetSnapshot);
    let interrupted = false;
    let partial: unknown;
    try {
      reviseCourseLesson({
        studiesRoot,
        studyId: STUDY_ID,
        proposal: candidate,
        now: new Date("2026-07-20T12:00:00.000Z"),
        onComponentWritten(component) {
          if (!interrupted && component === `lesson:${LESSON_ID}`) {
            interrupted = true;
            throw new Error("simulated interruption");
          }
        },
      });
    } catch (error) {
      partial = error;
    }
    expect(partial).toBeInstanceOf(CourseRevisionPartialError);
    expect((partial as CourseRevisionPartialError).receipt).toMatchObject({
      status: "pending",
      proposalId: "refresh-source-truth",
      completedComponents: [`lesson:${LESSON_ID}`],
    });
    expect(
      readLatestLesson(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID).manifest
        .contentRevision,
    ).toBe(2);
    expect(
      readLatestCard(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID, CARD_ID).contentRevision,
    ).toBe(1);

    const conflicting = structuredClone(candidate);
    conflicting.lesson.content = "# Conflicting retry\n";
    expect(() =>
      reviseCourseLesson({ studiesRoot, studyId: STUDY_ID, proposal: conflicting }),
    ).toThrow(/already used for different content/);

    const recovered = reviseCourseLesson({
      studiesRoot,
      studyId: STUDY_ID,
      proposal: candidate,
    });
    expect(recovered.disposition).toBe("recovered");
    expect(recovered.completedComponents).toEqual([
      `lesson:${LESSON_ID}`,
      `card:${CARD_ID}`,
      `exercise:${EXERCISE_ID}`,
    ]);
    expect(
      readLatestCard(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID, CARD_ID).contentRevision,
    ).toBe(2);
    expect(
      readLatestExercise(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID, EXERCISE_ID)
        .contentRevision,
    ).toBe(2);
  });

  it("keeps stale containers unchanged when reactivation validation fails", () => {
    const { studiesRoot, targetSnapshot } = setup();
    expect(() =>
      reactivateCourse({
        studiesRoot,
        studyId: STUDY_ID,
        courseId: COURSE_ID,
        targetSnapshotId: targetSnapshot.id,
      }),
    ).toThrow(/remains stale/);
    expect(readCourse(studiesRoot, STUDY_ID, COURSE_ID).status).toBe("stale");
    expect(readUnit(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID).status).toBe("stale");
  });
});
