import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type {
  EvidenceReference,
  KnowledgeNote,
  SnapshotManifest,
} from "../../src/domain/schemas.js";
import {
  readCourse,
  readUnit,
  updateCourseStatus,
  updateUnitStatus,
  writeCardRevision,
  writeCourse,
  writeExerciseRevision,
  writeLessonRevision,
  writeUnit,
} from "../content/repository.js";
import { readLatestKnowledgeNote, writeKnowledgeNoteRevision } from "../knowledge/repository.js";
import { getCoursePaths, getKnowledgeNotePaths, getStudyPaths } from "../studies/paths.js";
import { createStudy, registerLocalGitSource } from "../studies/repository.js";
import { createCleanSnapshot } from "../studies/snapshots.js";
import { finalizeUaAnalysis, prepareUaAnalysis } from "../ua/adapter.js";
import { auditStudyFreshness, inspectSourceStatus } from "./refresh-study.js";

const CREATED_AT = "2026-07-20T00:00:00.000Z";

function git(repository: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", repository, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function setup() {
  const container = mkdtempSync(join(tmpdir(), "university-local-refresh-"));
  const studiesRoot = join(container, "studies");
  const sourceRoot = join(container, "source");
  execFileSync("git", ["init", "-q", "-b", "main", sourceRoot]);
  git(sourceRoot, ["config", "user.name", "UniversityLocal Test"]);
  git(sourceRoot, ["config", "user.email", "test@university.local"]);
  writeFileSync(join(sourceRoot, "changed.ts"), "export const owner = 'session';\n");
  writeFileSync(join(sourceRoot, "deleted.ts"), "export const legacy = true;\n");
  writeFileSync(join(sourceRoot, "unchanged.ts"), "export const stable = true;\n");
  git(sourceRoot, ["add", "."]);
  git(sourceRoot, ["commit", "-q", "-m", "Initial"]);
  createStudy(studiesRoot, { id: "sample", title: "Sample" });
  registerLocalGitSource(studiesRoot, "sample", sourceRoot);
  const initialSnapshot = createCleanSnapshot(studiesRoot, "sample", "HEAD");
  return { container, studiesRoot, sourceRoot, initialSnapshot };
}

function evidence(snapshot: SnapshotManifest, sourcePath: string): EvidenceReference {
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

interface LessonDefinition {
  readonly unitId: string;
  readonly lessonId: string;
  readonly lessonEvidence: EvidenceReference;
  readonly card?: { readonly id: string; readonly evidence: EvidenceReference };
  readonly exercise?: { readonly id: string; readonly evidence: EvidenceReference };
}

function createActiveCourse(
  studiesRoot: string,
  definitions: readonly LessonDefinition[],
  courseId = "founder-engineer",
): void {
  writeCourse(studiesRoot, "sample", {
    schemaVersion: 1,
    id: courseId,
    title: "Founder Engineer",
    description: "Evidence-backed architecture",
    audience: "Founder",
    objectives: ["Understand the project"],
    unitIds: definitions.map((definition) => definition.unitId),
    status: "draft",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });

  for (const definition of definitions) {
    writeUnit(studiesRoot, "sample", courseId, {
      schemaVersion: 1,
      id: definition.unitId,
      title: definition.unitId,
      objective: `Understand ${definition.unitId}`,
      prerequisiteUnitIds: [],
      lessonIds: [definition.lessonId],
      status: "draft",
    });
    writeLessonRevision(studiesRoot, "sample", {
      manifest: {
        schemaVersion: 1,
        id: definition.lessonId,
        title: definition.lessonId,
        courseId,
        unitId: definition.unitId,
        exerciseIds: definition.exercise ? [definition.exercise.id] : [],
        cardIds: definition.card ? [definition.card.id] : [],
        contentRevision: 1,
        status: "active",
        evidence: [definition.lessonEvidence],
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      },
      content: `# ${definition.lessonId}\n\nEvidence-backed lesson.\n`,
    });
    if (definition.card) {
      writeCardRevision(studiesRoot, "sample", {
        schemaVersion: 1,
        id: definition.card.id,
        kind: "basic",
        courseId,
        unitId: definition.unitId,
        lessonId: definition.lessonId,
        front: "What stays stable?",
        back: "The committed evidence.",
        contentRevision: 1,
        status: "active",
        tags: ["evidence"],
        evidence: [definition.card.evidence],
      });
    }
    if (definition.exercise) {
      writeExerciseRevision(studiesRoot, "sample", {
        schemaVersion: 1,
        id: definition.exercise.id,
        kind: "short-answer",
        title: "Locate evidence",
        courseId,
        unitId: definition.unitId,
        lessonId: definition.lessonId,
        prompt: "Which file is evidence?",
        expectedAnswer: "deleted.ts",
        contentRevision: 1,
        status: "active",
        evidence: [definition.exercise.evidence],
      });
    }
    updateUnitStatus(studiesRoot, "sample", courseId, definition.unitId, "active");
  }
  updateCourseStatus(studiesRoot, "sample", courseId, "active");
}

function createReadyUaAnalysis(
  studiesRoot: string,
  snapshot: SnapshotManifest,
  analysisId: string,
  node: Record<string, unknown>,
): { readonly id: string; readonly graphHash: string } {
  const invocation = prepareUaAnalysis({
    studiesRoot,
    studyId: "sample",
    snapshotId: snapshot.id,
    analysisId,
    engineVersion: "2.9.4",
    outputLanguage: "en",
    now: new Date("2026-07-20T00:00:00.000Z"),
  });
  const generatedAt = "2026-07-20T00:01:00.000Z";
  writeFileSync(
    join(invocation.dataDirectory, "knowledge-graph.json"),
    JSON.stringify({
      project: { gitCommitHash: snapshot.sourceCommit, analyzedAt: generatedAt },
      nodes: [node],
      edges: [],
      layers: [
        {
          id: "application",
          name: "Application",
          description: "Application files",
          nodeIds: [node["id"]],
        },
      ],
      tour: [
        {
          order: 1,
          title: "Start",
          description: "Start here",
          nodeIds: [node["id"]],
        },
      ],
    }),
  );
  writeFileSync(
    join(invocation.dataDirectory, "meta.json"),
    JSON.stringify({ gitCommitHash: snapshot.sourceCommit, lastAnalyzedAt: generatedAt }),
  );
  writeFileSync(
    join(invocation.dataDirectory, "fingerprints.json"),
    JSON.stringify({ gitCommitHash: snapshot.sourceCommit, generatedAt, files: {} }),
  );
  const ready = finalizeUaAnalysis(
    studiesRoot,
    "sample",
    analysisId,
    new Date("2026-07-20T00:02:00.000Z"),
  );
  if (ready.status !== "ready") throw new Error("Expected ready UA analysis");
  return { id: ready.id, graphHash: ready.graphHash };
}

function createKnowledgeNote(
  studiesRoot: string,
  input: {
    readonly id: string;
    readonly evidence?: readonly EvidenceReference[];
    readonly status?: KnowledgeNote["status"];
  },
): KnowledgeNote {
  const references = [...(input.evidence ?? [])];
  return writeKnowledgeNoteRevision(studiesRoot, "sample", {
    note: {
      schemaVersion: 1,
      id: input.id,
      title: `Knowledge ${input.id}`,
      question: `What should we remember about ${input.id}?`,
      summary: `A durable explanation for ${input.id}.`,
      claimType: references.length === 0 ? "personal-understanding" : "source-fact",
      status: input.status ?? "active",
      contentRevision: 1,
      tags: ["evidence"],
      evidence: references,
      origin: {
        kind: "ai-conversation",
        host: "Grok",
        capturedAt: CREATED_AT,
        captureId: `capture-${input.id}`,
      },
      cards: [
        {
          id: `${input.id}-card`,
          kind: "basic",
          front: `Recall ${input.id}?`,
          back: `Remember ${input.id}.`,
          tags: ["evidence"],
        },
      ],
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    },
    content: `# Knowledge ${input.id}\n\nA durable explanation for ${input.id}.\n`,
  });
}

describe("study refresh workflow", () => {
  it("reports a local unpushed HEAD and warns that dirty changes are outside snapshots", () => {
    const { studiesRoot, sourceRoot } = setup();
    writeFileSync(join(sourceRoot, "changed.ts"), "export const owner = 'identity';\n");
    git(sourceRoot, ["add", "changed.ts"]);
    git(sourceRoot, ["commit", "-q", "-m", "Local unpushed commit"]);
    const committedHead = git(sourceRoot, ["rev-parse", "HEAD"]);
    writeFileSync(join(sourceRoot, "changed.ts"), "export const owner = 'dirty-only';\n");
    writeFileSync(join(sourceRoot, "draft.ts"), "export const draft = true;\n");

    const before = git(sourceRoot, ["status", "--porcelain=v1"]);
    const status = inspectSourceStatus(studiesRoot, "sample");
    const snapshot = createCleanSnapshot(studiesRoot, "sample", "HEAD");
    const storedSource = execFileSync(
      "git",
      [
        "--git-dir",
        getStudyPaths(studiesRoot, "sample").source.repository,
        "show",
        `${snapshot.sourceCommit}:changed.ts`,
      ],
      { encoding: "utf8" },
    );

    expect(status).toMatchObject({
      branch: "main",
      headCommit: committedHead,
      dirty: true,
      snapshotBasis: "local-commit",
      localCommitSufficient: true,
      dirtyChangesIncluded: false,
    });
    expect(status.dirtyEntries).toEqual(expect.arrayContaining([" M changed.ts", "?? draft.ts"]));
    expect(snapshot.sourceCommit).toBe(committedHead);
    expect(storedSource).toBe("export const owner = 'identity';\n");
    expect(git(sourceRoot, ["status", "--porcelain=v1"])).toBe(before);
  });

  it("keeps unrelated committed changes fresh and leaves active containers unchanged", () => {
    const { studiesRoot, sourceRoot, initialSnapshot } = setup();
    createActiveCourse(studiesRoot, [
      {
        unitId: "stable-unit",
        lessonId: "stable-lesson",
        lessonEvidence: evidence(initialSnapshot, "unchanged.ts"),
      },
    ]);
    writeFileSync(join(sourceRoot, "unrelated.ts"), "export const unrelated = true;\n");
    git(sourceRoot, ["add", "unrelated.ts"]);
    git(sourceRoot, ["commit", "-q", "-m", "Unrelated change"]);
    const targetSnapshot = createCleanSnapshot(studiesRoot, "sample", "HEAD");
    const sourceBefore = inspectSourceStatus(studiesRoot, "sample");

    const result = auditStudyFreshness({
      studiesRoot,
      studyId: "sample",
      targetSnapshotId: targetSnapshot.id,
      apply: true,
    });

    expect(result.sourceStatus).toEqual(sourceBefore);
    expect(result.reports[0]).toMatchObject({ status: "fresh", waitingForUa: false });
    expect(result.reports[0]?.items).toMatchObject([{ status: "fresh", reasons: [] }]);
    expect(result.transitions).toEqual([]);
    expect(readCourse(studiesRoot, "sample", "founder-engineer").status).toBe("active");
    expect(inspectSourceStatus(studiesRoot, "sample")).toEqual(sourceBefore);
  });

  it("reports changed and deleted evidence, stales only affected active parents, and is idempotent", () => {
    const { studiesRoot, sourceRoot, initialSnapshot } = setup();
    createActiveCourse(studiesRoot, [
      {
        unitId: "affected-unit",
        lessonId: "affected-lesson",
        lessonEvidence: evidence(initialSnapshot, "changed.ts"),
        card: { id: "stable-card", evidence: evidence(initialSnapshot, "unchanged.ts") },
        exercise: { id: "deleted-exercise", evidence: evidence(initialSnapshot, "deleted.ts") },
      },
      {
        unitId: "unaffected-unit",
        lessonId: "unaffected-lesson",
        lessonEvidence: evidence(initialSnapshot, "unchanged.ts"),
      },
    ]);
    writeFileSync(join(sourceRoot, "changed.ts"), "export const owner = 'identity';\n");
    git(sourceRoot, ["rm", "deleted.ts"]);
    git(sourceRoot, ["add", "changed.ts"]);
    git(sourceRoot, ["commit", "-q", "-m", "Change evidence"]);
    const targetSnapshot = createCleanSnapshot(studiesRoot, "sample", "HEAD");
    const sourceBefore = inspectSourceStatus(studiesRoot, "sample");

    const first = auditStudyFreshness({
      studiesRoot,
      studyId: "sample",
      targetSnapshotId: targetSnapshot.id,
      apply: true,
    });
    const report = first.reports[0]!;
    const persistedPath = join(
      getCoursePaths(studiesRoot, "sample", "founder-engineer").root,
      "freshness",
      `${targetSnapshot.id}--none.json`,
    );
    const firstBytes = readFileSync(persistedPath, "utf8");
    const second = auditStudyFreshness({
      studiesRoot,
      studyId: "sample",
      targetSnapshotId: targetSnapshot.id,
      apply: true,
    });

    expect(report.status).toBe("stale");
    expect(report.items.find((item) => item.kind === "lesson")?.reasons).toContain(
      "Referenced source changed: changed.ts",
    );
    expect(report.items.find((item) => item.kind === "exercise")?.reasons).toContain(
      "Referenced source changed: deleted.ts",
    );
    expect(report.items.find((item) => item.kind === "card")?.status).toBe("fresh");
    expect(report.units).toMatchObject([
      { unitId: "affected-unit", status: "stale" },
      { unitId: "unaffected-unit", status: "fresh" },
    ]);
    expect(first.transitions).toEqual([
      { kind: "course", courseId: "founder-engineer", from: "active", to: "stale" },
      {
        kind: "unit",
        courseId: "founder-engineer",
        unitId: "affected-unit",
        from: "active",
        to: "stale",
      },
    ]);
    expect(readCourse(studiesRoot, "sample", "founder-engineer").status).toBe("stale");
    expect(readUnit(studiesRoot, "sample", "founder-engineer", "affected-unit").status).toBe(
      "stale",
    );
    expect(readUnit(studiesRoot, "sample", "founder-engineer", "unaffected-unit").status).toBe(
      "active",
    );
    expect(second.transitions).toEqual([]);
    expect(second.reports[0]?.reportHash).toBe(report.reportHash);
    expect(readFileSync(persistedPath, "utf8")).toBe(firstBytes);
    expect(inspectSourceStatus(studiesRoot, "sample")).toEqual(sourceBefore);
  });

  it("keeps unchanged and evidence-free personal knowledge fresh with deterministic reports", () => {
    const { studiesRoot, initialSnapshot } = setup();
    createKnowledgeNote(studiesRoot, {
      id: "stable-source-note",
      evidence: [evidence(initialSnapshot, "unchanged.ts")],
    });
    createKnowledgeNote(studiesRoot, { id: "personal-model" });

    const first = auditStudyFreshness({
      studiesRoot,
      studyId: "sample",
      targetSnapshotId: initialSnapshot.id,
      apply: true,
    });
    const second = auditStudyFreshness({
      studiesRoot,
      studyId: "sample",
      targetSnapshotId: initialSnapshot.id,
      apply: true,
    });

    expect(first.noteReports.map((report) => report.noteId)).toEqual([
      "personal-model",
      "stable-source-note",
    ]);
    expect(first.noteReports).toMatchObject([
      { noteId: "personal-model", status: "fresh", waitingForUa: false, reasons: [] },
      { noteId: "stable-source-note", status: "fresh", waitingForUa: false, reasons: [] },
    ]);
    expect(second.noteReports).toEqual(first.noteReports);
    expect(first.transitions).toEqual([]);
    expect(second.transitions).toEqual([]);
    expect(readLatestKnowledgeNote(studiesRoot, "sample", "personal-model").note.status).toBe(
      "active",
    );
    expect(readLatestKnowledgeNote(studiesRoot, "sample", "stable-source-note").note.status).toBe(
      "active",
    );
  });

  it("persists changed and deleted note reports, appends stale revisions, and preserves learning state", () => {
    const { studiesRoot, sourceRoot, initialSnapshot } = setup();
    const changed = createKnowledgeNote(studiesRoot, {
      id: "changed-note",
      evidence: [evidence(initialSnapshot, "changed.ts")],
    });
    const deleted = createKnowledgeNote(studiesRoot, {
      id: "deleted-note",
      evidence: [evidence(initialSnapshot, "deleted.ts")],
    });
    const draft = createKnowledgeNote(studiesRoot, {
      id: "draft-note",
      evidence: [evidence(initialSnapshot, "changed.ts")],
      status: "draft",
    });
    const learningDatabase = getStudyPaths(studiesRoot, "sample").learner.database;
    mkdirSync(getStudyPaths(studiesRoot, "sample").learner.root, { recursive: true });
    writeFileSync(learningDatabase, "opaque-fsrs-state\n");

    writeFileSync(join(sourceRoot, "changed.ts"), "export const owner = 'identity';\n");
    git(sourceRoot, ["rm", "deleted.ts"]);
    git(sourceRoot, ["add", "changed.ts"]);
    git(sourceRoot, ["commit", "-q", "-m", "Invalidate note evidence"]);
    const targetSnapshot = createCleanSnapshot(studiesRoot, "sample", "HEAD");
    const sourceBefore = inspectSourceStatus(studiesRoot, "sample");

    const first = auditStudyFreshness({
      studiesRoot,
      studyId: "sample",
      targetSnapshotId: targetSnapshot.id,
      apply: true,
      now: new Date("2026-07-20T12:00:00.000Z"),
    });
    const changedReport = first.noteReports.find((report) => report.noteId === "changed-note")!;
    const deletedReport = first.noteReports.find((report) => report.noteId === "deleted-note")!;
    const draftReport = first.noteReports.find((report) => report.noteId === "draft-note")!;
    const persistedPath = join(
      getKnowledgeNotePaths(studiesRoot, "sample", "changed-note").root,
      "freshness",
      `${targetSnapshot.id}--none.json`,
    );
    const persistedBytes = readFileSync(persistedPath, "utf8");
    const second = auditStudyFreshness({
      studiesRoot,
      studyId: "sample",
      targetSnapshotId: targetSnapshot.id,
      apply: true,
      now: new Date("2026-07-20T13:00:00.000Z"),
    });

    expect(changedReport).toMatchObject({
      status: "stale",
      waitingForUa: false,
      reasons: ["Referenced source changed: changed.ts"],
      targetIdentity: { snapshotId: targetSnapshot.id, analysisId: null },
    });
    expect(deletedReport.reasons).toEqual(["Referenced source changed: deleted.ts"]);
    expect(draftReport.status).toBe("stale");
    expect(first.transitions).toEqual([
      {
        kind: "note",
        noteId: "changed-note",
        reportHash: changedReport.reportHash,
        from: "active",
        to: "stale",
      },
      {
        kind: "note",
        noteId: "deleted-note",
        reportHash: deletedReport.reportHash,
        from: "active",
        to: "stale",
      },
    ]);
    const changedStored = readLatestKnowledgeNote(studiesRoot, "sample", "changed-note");
    const deletedStored = readLatestKnowledgeNote(studiesRoot, "sample", "deleted-note");
    expect(changedStored.note).toMatchObject({
      status: "stale",
      contentRevision: 2,
      contentHash: changed.contentHash,
      origin: {
        kind: "source-refresh",
        captureId: `freshness:${changedReport.reportHash}:r1`,
      },
    });
    expect(deletedStored.note).toMatchObject({
      status: "stale",
      contentRevision: 2,
      contentHash: deleted.contentHash,
    });
    expect(changedStored.content).toBe(
      "# Knowledge changed-note\n\nA durable explanation for changed-note.\n",
    );
    expect(readLatestKnowledgeNote(studiesRoot, "sample", "draft-note").note).toEqual(draft);
    expect(second.transitions).toEqual([]);
    expect(second.noteReports).toEqual(first.noteReports);
    expect(readFileSync(persistedPath, "utf8")).toBe(persistedBytes);
    expect(readFileSync(learningDatabase, "utf8")).toBe("opaque-fsrs-state\n");
    expect(inspectSourceStatus(studiesRoot, "sample")).toEqual(sourceBefore);
  });

  it("reports note UA waiting and treats canonical node objects as unchanged", () => {
    const { studiesRoot, sourceRoot, initialSnapshot } = setup();
    const oldAnalysis = createReadyUaAnalysis(studiesRoot, initialSnapshot, "note-ua-old", {
      id: "file:unchanged.ts",
      type: "file",
      filePath: "unchanged.ts",
      label: "Stable file",
      metadata: { alpha: 1, beta: 2 },
    });
    createKnowledgeNote(studiesRoot, {
      id: "ua-backed-note",
      evidence: [
        {
          ...evidence(initialSnapshot, "unchanged.ts"),
          analysisId: oldAnalysis.id,
          graphHash: oldAnalysis.graphHash,
          nodeIds: ["file:unchanged.ts"],
        },
      ],
    });

    const waiting = auditStudyFreshness({
      studiesRoot,
      studyId: "sample",
      targetSnapshotId: initialSnapshot.id,
    });
    expect(waiting.noteReports).toMatchObject([
      {
        noteId: "ua-backed-note",
        status: "stale",
        waitingForUa: true,
        reasons: ["UA-backed evidence has no target analysis for comparison"],
      },
    ]);

    writeFileSync(join(sourceRoot, "unrelated.ts"), "export const unrelated = true;\n");
    git(sourceRoot, ["add", "unrelated.ts"]);
    git(sourceRoot, ["commit", "-q", "-m", "Refresh note UA"]);
    const targetSnapshot = createCleanSnapshot(studiesRoot, "sample", "HEAD");
    const targetAnalysis = createReadyUaAnalysis(studiesRoot, targetSnapshot, "note-ua-new", {
      metadata: { beta: 2, alpha: 1 },
      label: "Stable file",
      filePath: "unchanged.ts",
      type: "file",
      id: "file:unchanged.ts",
    });
    const compared = auditStudyFreshness({
      studiesRoot,
      studyId: "sample",
      targetSnapshotId: targetSnapshot.id,
      targetAnalysisId: targetAnalysis.id,
    });

    expect(compared.noteReports).toMatchObject([
      {
        noteId: "ua-backed-note",
        status: "fresh",
        waitingForUa: false,
        reasons: [],
        targetIdentity: {
          snapshotId: targetSnapshot.id,
          analysisId: targetAnalysis.id,
          graphHash: targetAnalysis.graphHash,
        },
      },
    ]);
  });

  it("requires a target UA and compares node objects semantically instead of by key order", () => {
    const { studiesRoot, sourceRoot, initialSnapshot } = setup();
    const oldAnalysis = createReadyUaAnalysis(studiesRoot, initialSnapshot, "ua-old", {
      id: "file:unchanged.ts",
      type: "file",
      filePath: "unchanged.ts",
      label: "Stable file",
      metadata: { alpha: 1, beta: 2 },
    });
    const uaEvidence: EvidenceReference = {
      ...evidence(initialSnapshot, "unchanged.ts"),
      analysisId: oldAnalysis.id,
      graphHash: oldAnalysis.graphHash,
      nodeIds: ["file:unchanged.ts"],
    };
    createActiveCourse(studiesRoot, [
      {
        unitId: "ua-unit",
        lessonId: "ua-lesson",
        lessonEvidence: uaEvidence,
      },
    ]);

    const missingTarget = auditStudyFreshness({
      studiesRoot,
      studyId: "sample",
      targetSnapshotId: initialSnapshot.id,
    });
    expect(missingTarget.reports[0]).toMatchObject({ status: "stale", waitingForUa: true });
    expect(missingTarget.reports[0]?.items[0]?.reasons).toContain(
      "UA-backed evidence has no target analysis for comparison",
    );

    writeFileSync(join(sourceRoot, "unrelated.ts"), "export const unrelated = true;\n");
    git(sourceRoot, ["add", "unrelated.ts"]);
    git(sourceRoot, ["commit", "-q", "-m", "Unrelated UA refresh"]);
    const targetSnapshot = createCleanSnapshot(studiesRoot, "sample", "HEAD");
    const targetAnalysis = createReadyUaAnalysis(studiesRoot, targetSnapshot, "ua-new", {
      metadata: { beta: 2, alpha: 1 },
      label: "Stable file",
      filePath: "unchanged.ts",
      type: "file",
      id: "file:unchanged.ts",
    });

    const compared = auditStudyFreshness({
      studiesRoot,
      studyId: "sample",
      targetSnapshotId: targetSnapshot.id,
      targetAnalysisId: targetAnalysis.id,
    });
    expect(compared.reports[0]).toMatchObject({ status: "fresh", waitingForUa: false });
    expect(compared.reports[0]?.items[0]).toMatchObject({ status: "fresh", reasons: [] });
    expect(compared.reports[0]?.targetIdentity).toMatchObject({
      snapshotId: targetSnapshot.id,
      analysisId: targetAnalysis.id,
      graphHash: targetAnalysis.graphHash,
    });
  });
});
