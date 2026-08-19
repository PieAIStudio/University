import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { EvidenceReference, SnapshotManifest } from "@pieai/university-core/domain/schemas.js";
import {
  readCourse,
  readLatestCard,
  readLatestExercise,
  readLatestLesson,
  readUnit,
} from "../content/repository.js";
import { getCoursePaths } from "../studies/paths.js";
import { createStudy, registerLocalGitSource } from "../studies/repository.js";
import { createCleanSnapshot } from "../studies/snapshots.js";
import { createCourse } from "./create-course.js";

const STUDY_ID = "sample";
const COURSE_ID = "solo-founder";

function git(repository: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", repository, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function evidence(snapshot: SnapshotManifest, sourcePath = "truth.ts"): EvidenceReference {
  return {
    kind: "fact",
    snapshotId: snapshot.id,
    sourceCommit: snapshot.sourceCommit,
    sourcePath,
    lineStart: 1,
    lineEnd: 1,
    nodeIds: [],
  };
}

function setup() {
  const container = mkdtempSync(join(tmpdir(), "university-local-course-create-"));
  const studiesRoot = join(container, "studies");
  const sourceRoot = join(container, "source");
  execFileSync("git", ["init", "-q", "-b", "main", sourceRoot]);
  git(sourceRoot, ["config", "user.name", "UniversityLocal Test"]);
  git(sourceRoot, ["config", "user.email", "test@university.local"]);
  writeFileSync(join(sourceRoot, "truth.ts"), "export const truth = 'value';\n");
  writeFileSync(join(sourceRoot, "other.ts"), "export const other = 1;\n");
  git(sourceRoot, ["add", "."]);
  git(sourceRoot, ["commit", "-q", "-m", "Initial"]);
  createStudy(studiesRoot, { id: STUDY_ID, title: "Sample" });
  registerLocalGitSource(studiesRoot, STUDY_ID, sourceRoot);
  const snapshot = createCleanSnapshot(studiesRoot, STUDY_ID, "HEAD");
  return { studiesRoot, snapshot };
}

function minimalProposal(snapshot: SnapshotManifest) {
  return {
    schemaVersion: 1,
    proposalId: "create-solo-founder",
    targetSnapshotId: snapshot.id,
    course: {
      id: COURSE_ID,
      title: "Solo Founder Engineering",
      description: "What a one-person company must hold in its head",
      audience: "Solo developer",
      objectives: ["Name the boundary that keeps a system honest"],
      units: [
        {
          id: "boundaries",
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
  };
}

describe("course creation workflow", () => {
  it("creates a single-unit course and activates it once every piece is on disk", () => {
    const { studiesRoot, snapshot } = setup();
    const result = createCourse({
      studiesRoot,
      studyId: STUDY_ID,
      proposal: minimalProposal(snapshot),
    });

    expect(result.outcome).toBe("created");
    expect(result.courseStatus).toBe("active");
    expect(result.lessonIds).toEqual(["why-boundaries"]);

    const course = readCourse(studiesRoot, STUDY_ID, COURSE_ID);
    expect(course.status).toBe("active");
    expect(course.unitIds).toEqual(["boundaries"]);
    expect(readUnit(studiesRoot, STUDY_ID, COURSE_ID, "boundaries").status).toBe("active");

    const lesson = readLatestLesson(
      studiesRoot,
      STUDY_ID,
      COURSE_ID,
      "boundaries",
      "why-boundaries",
    );
    expect(lesson.manifest.contentRevision).toBe(1);
    expect(lesson.content).toContain("A boundary is a promise you can check.");

    const card = readLatestCard(
      studiesRoot,
      STUDY_ID,
      COURSE_ID,
      "boundaries",
      "why-boundaries",
      "boundary-card",
    );
    expect(card.contentRevision).toBe(1);
    expect(card.kind).toBe("basic");

    const exercise = readLatestExercise(
      studiesRoot,
      STUDY_ID,
      COURSE_ID,
      "boundaries",
      "why-boundaries",
      "boundary-recall",
    );
    expect(exercise.kind).toBe("short-answer");
  });

  it("creates a multi-unit course with several lessons", () => {
    const { studiesRoot, snapshot } = setup();
    const proposal = minimalProposal(snapshot);
    proposal.course.units.push({
      id: "verification",
      title: "Verification",
      objective: "Explain what makes a claim checkable",
      lessons: [
        {
          id: "checkable-claims",
          title: "Checkable claims",
          content: "# Checkable claims\n\nEvery claim needs a way to fail.\n",
          evidence: [evidence(snapshot, "other.ts")],
          cards: [],
          exercises: [],
        },
      ],
    } as (typeof proposal.course.units)[number]);

    const result = createCourse({ studiesRoot, studyId: STUDY_ID, proposal });
    expect(result.unitIds).toEqual(["boundaries", "verification"]);
    expect(result.lessonIds).toEqual(["why-boundaries", "checkable-claims"]);
    expect(readUnit(studiesRoot, STUDY_ID, COURSE_ID, "verification").status).toBe("active");
  });

  it("accepts a lesson that carries neither cards nor exercises", () => {
    const { studiesRoot, snapshot } = setup();
    const proposal = minimalProposal(snapshot);
    proposal.course.units[0]!.lessons[0]!.cards = [];
    proposal.course.units[0]!.lessons[0]!.exercises = [];
    const result = createCourse({ studiesRoot, studyId: STUDY_ID, proposal });
    expect(result.cardIds).toEqual([]);
    expect(result.exerciseIds).toEqual([]);
    expect(result.courseStatus).toBe("active");
  });

  it("refuses a lesson that has cards but no exercise to unlock them", () => {
    const { studiesRoot, snapshot } = setup();
    const proposal = minimalProposal(snapshot);
    // Cards are enrolled for review when their lesson completes, and a lesson
    // completes by answering its exercises. Without one, these cards would be
    // stored and never scheduled.
    proposal.course.units[0]!.lessons[0]!.exercises = [];
    expect(() => createCourse({ studiesRoot, studyId: STUDY_ID, proposal })).toThrow(
      /at least one exercise/,
    );
  });

  it("creates an explain exercise with a rubric", () => {
    const { studiesRoot, snapshot } = setup();
    const proposal = minimalProposal(snapshot);
    proposal.course.units[0]!.lessons[0]!.exercises = [
      {
        id: "boundary-explain",
        title: "Explain the boundary",
        kind: "explain",
        prompt: "解释为什么不可检查的边界等于没有边界。",
        rubric: ["指出检查手段", "说明失败时会发生什么"],
        evidence: [evidence(snapshot)],
      },
    ] as unknown as (typeof proposal.course.units)[number]["lessons"][number]["exercises"];

    createCourse({ studiesRoot, studyId: STUDY_ID, proposal });
    const exercise = readLatestExercise(
      studiesRoot,
      STUDY_ID,
      COURSE_ID,
      "boundaries",
      "why-boundaries",
      "boundary-explain",
    );
    expect(exercise.kind).toBe("explain");
    if (exercise.kind === "explain") expect(exercise.rubric).toHaveLength(2);
  });

  it("refuses to create over an existing active course", () => {
    const { studiesRoot, snapshot } = setup();
    createCourse({ studiesRoot, studyId: STUDY_ID, proposal: minimalProposal(snapshot) });
    expect(() =>
      createCourse({ studiesRoot, studyId: STUDY_ID, proposal: minimalProposal(snapshot) }),
    ).toThrow(/already exists and is active/);
  });

  it("rejects duplicate unit, lesson and card IDs inside one proposal", () => {
    const { studiesRoot, snapshot } = setup();

    const duplicateUnits = minimalProposal(snapshot);
    duplicateUnits.course.units.push({
      ...duplicateUnits.course.units[0]!,
      lessons: [
        {
          ...duplicateUnits.course.units[0]!.lessons[0]!,
          id: "another-lesson",
          cards: [],
          exercises: [],
        },
      ],
    });
    expect(() =>
      createCourse({ studiesRoot, studyId: STUDY_ID, proposal: duplicateUnits }),
    ).toThrow(/Units must not contain duplicate IDs/);

    const duplicateLessons = minimalProposal(snapshot);
    duplicateLessons.course.units.push({
      ...duplicateLessons.course.units[0]!,
      id: "second-unit",
      lessons: [{ ...duplicateLessons.course.units[0]!.lessons[0]!, cards: [], exercises: [] }],
    });
    expect(() =>
      createCourse({ studiesRoot, studyId: STUDY_ID, proposal: duplicateLessons }),
    ).toThrow(/Lessons must not contain duplicate IDs/);

    const duplicateCards = minimalProposal(snapshot);
    const firstCard = duplicateCards.course.units[0]!.lessons[0]!.cards[0]!;
    duplicateCards.course.units[0]!.lessons[0]!.cards.push({ ...firstCard });
    expect(() =>
      createCourse({ studiesRoot, studyId: STUDY_ID, proposal: duplicateCards }),
    ).toThrow(/Cards must not contain duplicate IDs/);
  });

  it("rejects evidence pointing outside the snapshot without leaving a partial course", () => {
    const { studiesRoot, snapshot } = setup();
    const proposal = minimalProposal(snapshot);
    proposal.course.units[0]!.lessons[0]!.evidence = [evidence(snapshot, "missing.ts")];

    expect(() => createCourse({ studiesRoot, studyId: STUDY_ID, proposal })).toThrow();
    expect(existsSync(getCoursePaths(studiesRoot, STUDY_ID, COURSE_ID).manifest)).toBe(false);
  });

  it("carries a lesson's teaching variant into the manifest it writes", () => {
    // Without this, a course created through the workflow arrives with no
    // variant, and `scripts/lint-lessons.mjs` skips variant-less lessons by
    // design — so a brand-new course written in the house shape would be the
    // one thing the shape checker never inspected.
    const { studiesRoot, snapshot } = setup();
    const proposal = minimalProposal(snapshot);
    const unit = proposal.course.units[0]!;
    unit.lessons[0] = { ...unit.lessons[0]!, variant: "对比" } as (typeof unit.lessons)[number];

    createCourse({ studiesRoot, studyId: STUDY_ID, proposal });

    const manifestPath = join(
      studiesRoot,
      STUDY_ID,
      "courses",
      COURSE_ID,
      "units",
      proposal.course.units[0]!.id,
      "lessons",
      "why-boundaries",
      "revisions",
      "1",
      "manifest.json",
    );
    expect(JSON.parse(readFileSync(manifestPath, "utf8")).variant).toBe("对比");
  });

  it("writes nothing on a dry run", () => {
    const { studiesRoot, snapshot } = setup();
    const result = createCourse({
      studiesRoot,
      studyId: STUDY_ID,
      proposal: minimalProposal(snapshot),
      dryRun: true,
    });
    expect(result.mode).toBe("dry-run");
    expect(result.outcome).toBe("validated");
    expect(existsSync(getCoursePaths(studiesRoot, STUDY_ID, COURSE_ID).manifest)).toBe(false);
  });
});
