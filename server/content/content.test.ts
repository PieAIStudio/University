import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import type { EvidenceReference } from "../../src/domain/schemas.js";
import { getCoursePaths, getLessonPaths, getUnitPaths } from "../studies/paths.js";
import { createStudy, registerLocalGitSource } from "../studies/repository.js";
import { createCleanSnapshot } from "../studies/snapshots.js";
import { evaluateEvidenceFreshness, validateEvidence } from "./evidence.js";
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
} from "./repository.js";

const COURSE_ID = "founder-engineer";
const UNIT_ID = "auth-architecture";
const LESSON_ID = "auth-owner";
const CARD_ID = "auth-owner-card";
const EXERCISE_ID = "auth-owner-recall";
const CREATED_AT = "2026-07-20T00:00:00.000Z";

function git(repository: string, args: string[]): string {
  return execFileSync("git", ["-C", repository, ...args], { encoding: "utf8" }).trim();
}

function setup() {
  const container = mkdtempSync(join(tmpdir(), "university-local-content-"));
  const studiesRoot = join(container, "studies");
  const sourceRoot = join(container, "source");
  execFileSync("git", ["init", "-q", sourceRoot]);
  git(sourceRoot, ["config", "user.name", "UniversityLocal Test"]);
  git(sourceRoot, ["config", "user.email", "test@university.local"]);
  writeFileSync(join(sourceRoot, "auth.ts"), "export const owner = 'session-service';\n");
  git(sourceRoot, ["add", "auth.ts"]);
  git(sourceRoot, ["commit", "-q", "-m", "Initial"]);
  createStudy(studiesRoot, { id: "sample", title: "Sample" });
  registerLocalGitSource(studiesRoot, "sample", sourceRoot);
  const snapshot = createCleanSnapshot(studiesRoot, "sample");
  const evidence: EvidenceReference = {
    kind: "fact",
    snapshotId: snapshot.id,
    sourceCommit: snapshot.sourceCommit,
    sourcePath: "auth.ts",
    lineStart: 1,
    lineEnd: 1,
    nodeIds: [],
  };
  return { container, studiesRoot, sourceRoot, snapshot, evidence };
}

function writeHierarchy(studiesRoot: string): void {
  writeCourse(studiesRoot, "sample", {
    schemaVersion: 1,
    id: COURSE_ID,
    title: "Founder Engineer",
    description: "Understand the product as its technical owner.",
    audience: "The product founder",
    objectives: ["Explain the authentication ownership boundary"],
    unitIds: [UNIT_ID],
    status: "draft",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });
  writeUnit(studiesRoot, "sample", COURSE_ID, {
    schemaVersion: 1,
    id: UNIT_ID,
    title: "Authentication architecture",
    objective: "Identify the module that owns authentication.",
    prerequisiteUnitIds: [],
    lessonIds: [LESSON_ID],
    status: "draft",
  });
}

function lessonManifest(evidence: EvidenceReference, revision = 1) {
  return {
    schemaVersion: 1 as const,
    id: LESSON_ID,
    title: "Who owns authentication?",
    courseId: COURSE_ID,
    unitId: UNIT_ID,
    exerciseIds: [EXERCISE_ID],
    cardIds: [CARD_ID],
    contentRevision: revision,
    status: "draft" as const,
    evidence: [evidence],
    createdAt: CREATED_AT,
    updatedAt: revision === 1 ? CREATED_AT : "2026-07-20T01:00:00.000Z",
  };
}

function writeFirstLesson(studiesRoot: string, evidence: EvidenceReference) {
  return writeLessonRevision(studiesRoot, "sample", {
    manifest: lessonManifest(evidence),
    content: "# Authentication\n\nThe session service owns authentication.\n",
  });
}

function cardCandidate(evidence: EvidenceReference, revision = 1) {
  return {
    schemaVersion: 1 as const,
    id: CARD_ID,
    kind: "basic" as const,
    courseId: COURSE_ID,
    unitId: UNIT_ID,
    lessonId: LESSON_ID,
    front: "Which module owns authentication?",
    back: "The session service.",
    contentRevision: revision,
    status: "draft" as const,
    tags: ["auth"],
    evidence: [evidence],
  };
}

function exerciseCandidate(evidence: EvidenceReference, revision = 1) {
  return {
    schemaVersion: 1 as const,
    id: EXERCISE_ID,
    kind: "short-answer" as const,
    title: "Recall the auth owner",
    courseId: COURSE_ID,
    unitId: UNIT_ID,
    lessonId: LESSON_ID,
    prompt: "Name the module that owns authentication.",
    expectedAnswer: "session-service",
    contentRevision: revision,
    status: "draft" as const,
    evidence: [evidence],
  };
}

function writeActiveLearningContent(studiesRoot: string, evidence: EvidenceReference): void {
  writeLessonRevision(studiesRoot, "sample", {
    manifest: { ...lessonManifest(evidence), status: "active" },
    content: "# Authentication\n\nThe session service owns authentication.\n",
  });
  writeCardRevision(studiesRoot, "sample", {
    ...cardCandidate(evidence),
    status: "active",
  });
  writeExerciseRevision(studiesRoot, "sample", {
    ...exerciseCandidate(evidence),
    status: "active",
  });
}

describe("course content repository", () => {
  it("ignores crash-left staging directories when creating course and unit roots", () => {
    const { studiesRoot } = setup();
    const coursePaths = getCoursePaths(studiesRoot, "sample", COURSE_ID);
    const staleCourseStaging = join(dirname(coursePaths.root), `.creating-${COURSE_ID}-crash`);
    mkdirSync(staleCourseStaging, { recursive: true });
    writeFileSync(join(staleCourseStaging, "marker"), "unfinished course");

    writeCourse(studiesRoot, "sample", {
      schemaVersion: 1,
      id: COURSE_ID,
      title: "Founder Engineer",
      description: "Understand the product as its technical owner.",
      audience: "The product founder",
      objectives: ["Explain the authentication ownership boundary"],
      unitIds: [UNIT_ID],
      status: "draft",
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });

    const unitPaths = getUnitPaths(studiesRoot, "sample", COURSE_ID, UNIT_ID);
    const staleUnitStaging = join(dirname(unitPaths.root), `.creating-${UNIT_ID}-crash`);
    mkdirSync(staleUnitStaging, { recursive: true });
    writeFileSync(join(staleUnitStaging, "marker"), "unfinished unit");
    writeUnit(studiesRoot, "sample", COURSE_ID, {
      schemaVersion: 1,
      id: UNIT_ID,
      title: "Authentication architecture",
      objective: "Identify the module that owns authentication.",
      prerequisiteUnitIds: [],
      lessonIds: [LESSON_ID],
      status: "draft",
    });

    expect(readCourse(studiesRoot, "sample", COURSE_ID).id).toBe(COURSE_ID);
    expect(readUnit(studiesRoot, "sample", COURSE_ID, UNIT_ID).id).toBe(UNIT_ID);
    expect(readFileSync(join(staleCourseStaging, "marker"), "utf8")).toBe("unfinished course");
    expect(readFileSync(join(staleUnitStaging, "marker"), "utf8")).toBe("unfinished unit");
  });

  it("stores immutable lesson revisions inside course/unit/lesson and validates hashes", () => {
    const { studiesRoot, evidence } = setup();
    writeHierarchy(studiesRoot);
    const first = writeFirstLesson(studiesRoot, evidence);
    const secondContent = "# Authentication\n\nThe session service is the authentication owner.\n";
    const second = writeLessonRevision(studiesRoot, "sample", {
      manifest: lessonManifest(evidence, 2),
      content: secondContent,
    });

    const lessonPaths = getLessonPaths(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID);
    expect(first.contentHash).not.toBe(second.contentHash);
    expect(existsSync(join(lessonPaths.revisions, "1", "content.md"))).toBe(true);
    expect(existsSync(join(lessonPaths.revisions, "2", "content.md"))).toBe(true);
    expect(readLatestLesson(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID)).toEqual({
      manifest: second,
      content: secondContent,
    });
    expect(() =>
      writeLessonRevision(studiesRoot, "sample", {
        manifest: lessonManifest(evidence, 2),
        content: "overwrite",
      }),
    ).toThrow(/must be 3/);

    writeFileSync(join(lessonPaths.revisions, "2", "content.md"), "tampered\n");
    expect(() => readLatestLesson(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID)).toThrow(
      /hash mismatch/,
    );
  });

  it("enforces course -> unit -> lesson -> practice declarations", () => {
    const { studiesRoot, evidence } = setup();
    writeCourse(studiesRoot, "sample", {
      schemaVersion: 1,
      id: COURSE_ID,
      title: "Founder Engineer",
      description: "",
      audience: "Founder",
      objectives: ["Understand authentication"],
      unitIds: [UNIT_ID],
      status: "draft",
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });
    expect(() =>
      writeUnit(studiesRoot, "sample", COURSE_ID, {
        schemaVersion: 1,
        id: "undeclared-unit",
        title: "Undeclared",
        objective: "Should fail",
        prerequisiteUnitIds: [],
        lessonIds: [],
        status: "draft",
      }),
    ).toThrow(/Course does not declare unit/);

    writeUnit(studiesRoot, "sample", COURSE_ID, {
      schemaVersion: 1,
      id: UNIT_ID,
      title: "Authentication",
      objective: "Understand authentication",
      prerequisiteUnitIds: [],
      lessonIds: [],
      status: "draft",
    });
    expect(() => writeFirstLesson(studiesRoot, evidence)).toThrow(/Unit does not declare lesson/);

    const second = setup();
    writeHierarchy(second.studiesRoot);
    writeFirstLesson(second.studiesRoot, second.evidence);
    expect(() =>
      writeCardRevision(second.studiesRoot, "sample", {
        ...cardCandidate(second.evidence),
        id: "undeclared-card",
      }),
    ).toThrow(/Lesson does not declare card/);
    expect(() =>
      writeExerciseRevision(second.studiesRoot, "sample", {
        ...exerciseCandidate(second.evidence),
        id: "undeclared-exercise",
      }),
    ).toThrow(/Lesson does not declare exercise/);
  });

  it("rejects path traversal and duplicate relationship IDs before writing", () => {
    const { container, studiesRoot } = setup();
    expect(() =>
      writeCourse(studiesRoot, "sample", {
        schemaVersion: 1,
        id: "../escape",
        title: "Escape",
        description: "",
        audience: "Nobody",
        objectives: ["Escape"],
        unitIds: [],
        status: "draft",
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      }),
    ).toThrow();
    expect(existsSync(join(container, "escape"))).toBe(false);

    expect(() =>
      writeCourse(studiesRoot, "sample", {
        schemaVersion: 1,
        id: COURSE_ID,
        title: "Duplicate",
        description: "",
        audience: "Founder",
        objectives: ["Detect duplicates"],
        unitIds: [UNIT_ID, UNIT_ID],
        status: "draft",
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      }),
    ).toThrow(/duplicate IDs/);
    expect(() => readCourse(studiesRoot, "sample", "../escape")).toThrow();
  });

  it("rejects tampered latest pointers and manifest/pointer mismatches", () => {
    const { studiesRoot, evidence } = setup();
    writeHierarchy(studiesRoot);
    writeFirstLesson(studiesRoot, evidence);
    const paths = getLessonPaths(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID);

    writeFileSync(
      paths.latest,
      `${JSON.stringify({ schemaVersion: 1, id: "another-lesson", contentRevision: 1 })}\n`,
    );
    expect(() => readLatestLesson(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID)).toThrow(
      /pointer ID mismatch/,
    );
    expect(() =>
      writeLessonRevision(studiesRoot, "sample", {
        manifest: lessonManifest(evidence, 2),
        content: "must not repair a tampered pointer",
      }),
    ).toThrow(/pointer ID mismatch/);

    writeFileSync(
      paths.latest,
      `${JSON.stringify({ schemaVersion: 1, id: LESSON_ID, contentRevision: 1 })}\n`,
    );
    const manifestPath = join(paths.revisions, "1", "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, contentRevision: 2 })}\n`);
    expect(() => readLatestLesson(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID)).toThrow(
      /pointer does not match/,
    );

    writeFileSync(
      paths.latest,
      `${JSON.stringify({ schemaVersion: 1, id: LESSON_ID, contentRevision: 1, extra: true })}\n`,
    );
    expect(() => readLatestLesson(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID)).toThrow();
  });

  it("never overwrites crash-left revision directories", () => {
    const lessonContext = setup();
    writeHierarchy(lessonContext.studiesRoot);
    const lessonPaths = getLessonPaths(
      lessonContext.studiesRoot,
      "sample",
      COURSE_ID,
      UNIT_ID,
      LESSON_ID,
    );
    const orphanLesson = join(lessonPaths.revisions, "1");
    mkdirSync(orphanLesson, { recursive: true });
    writeFileSync(join(orphanLesson, "marker"), "preserve");
    expect(() => writeFirstLesson(lessonContext.studiesRoot, lessonContext.evidence)).toThrow(
      /already exists/,
    );
    expect(readFileSync(join(orphanLesson, "marker"), "utf8")).toBe("preserve");

    const practiceContext = setup();
    writeHierarchy(practiceContext.studiesRoot);
    writeFirstLesson(practiceContext.studiesRoot, practiceContext.evidence);
    const practicePaths = getLessonPaths(
      practiceContext.studiesRoot,
      "sample",
      COURSE_ID,
      UNIT_ID,
      LESSON_ID,
    );
    const orphanCard = join(practicePaths.cards, CARD_ID, "revisions", "1");
    const orphanExercise = join(practicePaths.exercises, EXERCISE_ID, "revisions", "1");
    mkdirSync(orphanCard, { recursive: true });
    mkdirSync(orphanExercise, { recursive: true });
    writeFileSync(join(orphanCard, "marker"), "card");
    writeFileSync(join(orphanExercise, "marker"), "exercise");
    expect(() =>
      writeCardRevision(
        practiceContext.studiesRoot,
        "sample",
        cardCandidate(practiceContext.evidence),
      ),
    ).toThrow(/already exists/);
    expect(() =>
      writeExerciseRevision(
        practiceContext.studiesRoot,
        "sample",
        exerciseCandidate(practiceContext.evidence),
      ),
    ).toThrow(/already exists/);
    expect(readFileSync(join(orphanCard, "marker"), "utf8")).toBe("card");
    expect(readFileSync(join(orphanExercise, "marker"), "utf8")).toBe("exercise");
  });

  it("ignores crash-left revision staging directories for lessons, cards, and exercises", () => {
    const { studiesRoot, evidence } = setup();
    writeHierarchy(studiesRoot);
    const paths = getLessonPaths(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID);
    const lessonStaging = join(paths.revisions, ".creating-1-crash");
    const cardStaging = join(paths.cards, CARD_ID, "revisions", ".creating-1-crash");
    const exerciseStaging = join(paths.exercises, EXERCISE_ID, "revisions", ".creating-1-crash");
    for (const staging of [lessonStaging, cardStaging, exerciseStaging]) {
      mkdirSync(staging, { recursive: true });
      writeFileSync(join(staging, "marker"), "unfinished");
    }

    expect(writeFirstLesson(studiesRoot, evidence).contentRevision).toBe(1);
    expect(writeCardRevision(studiesRoot, "sample", cardCandidate(evidence)).contentRevision).toBe(
      1,
    );
    expect(
      writeExerciseRevision(studiesRoot, "sample", exerciseCandidate(evidence)).contentRevision,
    ).toBe(1);
    for (const staging of [lessonStaging, cardStaging, exerciseStaging]) {
      expect(readFileSync(join(staging, "marker"), "utf8")).toBe("unfinished");
    }
  });

  it("recovers a lesson revision installed before its latest pointer only for identical input", () => {
    const { studiesRoot, evidence } = setup();
    writeHierarchy(studiesRoot);
    const content = "# Authentication\n\nThe session service owns authentication.\n";
    const first = writeFirstLesson(studiesRoot, evidence);
    const paths = getLessonPaths(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID);

    rmSync(paths.latest);
    expect(() =>
      writeLessonRevision(studiesRoot, "sample", {
        manifest: lessonManifest(evidence),
        content: `${content}Conflicting claim.\n`,
      }),
    ).toThrow(/already exists and conflicts/);
    expect(existsSync(paths.latest)).toBe(false);
    expect(
      writeLessonRevision(studiesRoot, "sample", {
        manifest: lessonManifest(evidence),
        content,
      }),
    ).toEqual(first);
    expect(readLatestLesson(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID)).toEqual({
      manifest: first,
      content,
    });

    const secondContent = "# Authentication\n\nThe session service remains the owner.\n";
    const second = writeLessonRevision(studiesRoot, "sample", {
      manifest: lessonManifest(evidence, 2),
      content: secondContent,
    });
    writeFileSync(
      paths.latest,
      `${JSON.stringify({ schemaVersion: 1, id: LESSON_ID, contentRevision: 1 })}\n`,
    );
    expect(
      writeLessonRevision(studiesRoot, "sample", {
        manifest: lessonManifest(evidence, 2),
        content: secondContent,
      }),
    ).toEqual(second);
    expect(readLatestLesson(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID).manifest).toEqual(
      second,
    );
  });

  it("recovers card and exercise revisions installed before latest without overwriting conflicts", () => {
    const { studiesRoot, evidence } = setup();
    writeHierarchy(studiesRoot);
    writeFirstLesson(studiesRoot, evidence);
    const card = writeCardRevision(studiesRoot, "sample", cardCandidate(evidence));
    const exercise = writeExerciseRevision(studiesRoot, "sample", exerciseCandidate(evidence));
    const paths = getLessonPaths(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID);
    const cardLatest = join(paths.cards, CARD_ID, "latest.json");
    const exerciseLatest = join(paths.exercises, EXERCISE_ID, "latest.json");

    rmSync(cardLatest);
    expect(() =>
      writeCardRevision(studiesRoot, "sample", {
        ...cardCandidate(evidence),
        back: "A conflicting answer.",
      }),
    ).toThrow(/already exists and conflicts/);
    expect(existsSync(cardLatest)).toBe(false);
    expect(writeCardRevision(studiesRoot, "sample", cardCandidate(evidence))).toEqual(card);

    rmSync(exerciseLatest);
    expect(() =>
      writeExerciseRevision(studiesRoot, "sample", {
        ...exerciseCandidate(evidence),
        expectedAnswer: "a-conflicting-service",
      }),
    ).toThrow(/already exists and conflicts/);
    expect(existsSync(exerciseLatest)).toBe(false);
    expect(writeExerciseRevision(studiesRoot, "sample", exerciseCandidate(evidence))).toEqual(
      exercise,
    );
    expect(readLatestCard(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID, CARD_ID)).toEqual(
      card,
    );
    expect(
      readLatestExercise(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID, EXERCISE_ID),
    ).toEqual(exercise);
  });

  it("stores and verifies card/exercise revisions beneath their lesson", () => {
    const { studiesRoot, evidence } = setup();
    writeHierarchy(studiesRoot);
    writeFirstLesson(studiesRoot, evidence);
    const card = writeCardRevision(studiesRoot, "sample", cardCandidate(evidence));
    const exercise = writeExerciseRevision(studiesRoot, "sample", exerciseCandidate(evidence));
    const paths = getLessonPaths(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID);

    expect(card.contentHash).toMatch(/^sha256:/);
    expect(exercise.contentHash).toMatch(/^sha256:/);
    expect(existsSync(join(paths.cards, CARD_ID, "revisions", "1", "card.json"))).toBe(true);
    expect(existsSync(join(paths.exercises, EXERCISE_ID, "revisions", "1", "exercise.json"))).toBe(
      true,
    );
    expect(readLatestCard(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID, CARD_ID)).toEqual(
      card,
    );
    expect(
      readLatestExercise(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID, EXERCISE_ID),
    ).toEqual(exercise);
    expect(() =>
      writeCardRevision(studiesRoot, "sample", { ...cardCandidate(evidence), contentRevision: 1 }),
    ).toThrow(/must be 2/);

    const cardPath = join(paths.cards, CARD_ID, "revisions", "1", "card.json");
    const storedCard = JSON.parse(readFileSync(cardPath, "utf8")) as Record<string, unknown>;
    writeFileSync(cardPath, `${JSON.stringify({ ...storedCard, front: "tampered" })}\n`);
    expect(() =>
      readLatestCard(studiesRoot, "sample", COURSE_ID, UNIT_ID, LESSON_ID, CARD_ID),
    ).toThrow(/hash mismatch/);
  });

  it("activates only complete, evidence-valid content and preserves hierarchy status", () => {
    const { studiesRoot, evidence } = setup();
    writeHierarchy(studiesRoot);
    expect(() => updateCourseStatus(studiesRoot, "sample", COURSE_ID, "stale")).toThrow(
      /draft -> stale/,
    );
    expect(readCourse(studiesRoot, "sample", COURSE_ID).status).toBe("draft");

    expect(() => updateCourseStatus(studiesRoot, "sample", COURSE_ID, "active")).toThrow(
      /unit is draft/,
    );
    expect(() => updateUnitStatus(studiesRoot, "sample", COURSE_ID, UNIT_ID, "active")).toThrow(
      /without lessons|latest/i,
    );

    writeActiveLearningContent(studiesRoot, evidence);
    expect(updateUnitStatus(studiesRoot, "sample", COURSE_ID, UNIT_ID, "active").status).toBe(
      "active",
    );

    const activeCourse = updateCourseStatus(
      studiesRoot,
      "sample",
      COURSE_ID,
      "active",
      new Date("2026-07-20T02:00:00.000Z"),
    );
    expect(activeCourse.status).toBe("active");
    expect(activeCourse.updatedAt).toBe("2026-07-20T02:00:00.000Z");
    expect(() => updateUnitStatus(studiesRoot, "sample", COURSE_ID, UNIT_ID, "stale")).toThrow(
      /Course must be marked stale/,
    );
    expect(updateCourseStatus(studiesRoot, "sample", COURSE_ID, "stale").status).toBe("stale");
    expect(updateUnitStatus(studiesRoot, "sample", COURSE_ID, UNIT_ID, "stale").status).toBe(
      "stale",
    );
    expect(() => updateCourseStatus(studiesRoot, "sample", COURSE_ID, "active")).toThrow(
      /unit is stale/,
    );
    expect(updateUnitStatus(studiesRoot, "sample", COURSE_ID, UNIT_ID, "active").status).toBe(
      "active",
    );
    expect(updateCourseStatus(studiesRoot, "sample", COURSE_ID, "active").status).toBe("active");
    expect(updateCourseStatus(studiesRoot, "sample", COURSE_ID, "retired").status).toBe("retired");
    expect(() => updateCourseStatus(studiesRoot, "sample", COURSE_ID, "active")).toThrow(
      /retired -> active/,
    );
  });

  it("rejects pre-activated containers and edits under active containers", () => {
    const { studiesRoot, evidence } = setup();
    expect(() =>
      writeCourse(studiesRoot, "sample", {
        schemaVersion: 1,
        id: COURSE_ID,
        title: "Invalid active course",
        description: "",
        audience: "Founder",
        objectives: ["Remain valid"],
        unitIds: [UNIT_ID],
        status: "active",
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      }),
    ).toThrow(/must be created as draft/);

    writeHierarchy(studiesRoot);
    writeActiveLearningContent(studiesRoot, evidence);
    updateUnitStatus(studiesRoot, "sample", COURSE_ID, UNIT_ID, "active");
    updateCourseStatus(studiesRoot, "sample", COURSE_ID, "active");
    expect(() =>
      writeLessonRevision(studiesRoot, "sample", {
        manifest: { ...lessonManifest(evidence, 2), status: "active" },
        content: "A revision that must wait until the course is stale.\n",
      }),
    ).toThrow(/Course must be draft or stale/);
  });

  it("validates Git-backed evidence and detects changed source", () => {
    const { studiesRoot, sourceRoot, snapshot, evidence } = setup();
    expect(validateEvidence(studiesRoot, "sample", evidence)).toEqual(evidence);
    expect(() =>
      validateEvidence(studiesRoot, "sample", { ...evidence, sourcePath: "../outside" }),
    ).toThrow(/normalized repository-relative/);

    writeFileSync(join(sourceRoot, "auth.ts"), "export const owner = 'identity-service';\n");
    git(sourceRoot, ["add", "auth.ts"]);
    git(sourceRoot, ["commit", "-q", "-m", "Move auth"]);
    const nextSnapshot = createCleanSnapshot(studiesRoot, "sample", "HEAD");
    const freshness = evaluateEvidenceFreshness(studiesRoot, "sample", evidence, nextSnapshot.id);

    expect(nextSnapshot.sourceCommit).not.toBe(snapshot.sourceCommit);
    expect(freshness.status).toBe("stale");
    expect(freshness.reasons[0]).toContain("auth.ts");
  });
});
