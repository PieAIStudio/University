import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { EvidenceReference } from "../../src/domain/schemas.js";
import {
  updateCourseStatus,
  updateUnitStatus,
  writeCourse,
  writeLessonRevision,
  writeUnit,
} from "../content/repository.js";
import { createStudy, registerLocalGitSource } from "../studies/repository.js";
import { createCleanSnapshot } from "../studies/snapshots.js";
import { composeLanguageLayer } from "./layer.js";
import { writeLanguageOverlay } from "./overlay.js";
import type { VocabularyState } from "./vocabulary-store.js";

const CREATED_AT = "2026-08-07T00:00:00.000Z";
const ROUTE = { courseId: "course-a", unitId: "unit-a", lessonId: "lesson-a" };

/**
 * Prose chosen so the detector has real work to do: `file`, `load`, `open` and
 * `commit` are all curated senses, and one of them appears only inside a fence.
 */
const LESSON_TEXT = [
  "# 一节课",
  "",
  "先把 file 读进来，再 load 一次，然后 open 它。",
  "",
  "```bash",
  "git commit -m 'x'",
  "```",
  "",
  "最后 run 一下。",
  "",
].join("\n");

function setup(): { readonly studiesRoot: string } {
  const container = mkdtempSync(join(tmpdir(), "university-local-layer-"));
  const studiesRoot = join(container, "studies");
  const sourceRoot = join(container, "source");
  execFileSync("git", ["init", "-q", sourceRoot]);
  execFileSync("git", ["-C", sourceRoot, "config", "user.name", "UniversityLocal Test"]);
  execFileSync("git", ["-C", sourceRoot, "config", "user.email", "test@university.local"]);
  writeFileSync(join(sourceRoot, "a.ts"), "export const x = 1;\n");
  execFileSync("git", ["-C", sourceRoot, "add", "a.ts"]);
  execFileSync("git", ["-C", sourceRoot, "commit", "-q", "-m", "Initial"]);
  createStudy(studiesRoot, { id: "sample", title: "Sample" });
  registerLocalGitSource(studiesRoot, "sample", sourceRoot);
  const snapshot = createCleanSnapshot(studiesRoot, "sample");
  const evidence: EvidenceReference = {
    kind: "fact",
    snapshotId: snapshot.id,
    sourceCommit: snapshot.sourceCommit,
    sourcePath: "a.ts",
    lineStart: 1,
    lineEnd: 1,
    nodeIds: [],
  };
  writeCourse(studiesRoot, "sample", {
    schemaVersion: 1,
    id: ROUTE.courseId,
    title: "Course A",
    description: "组合层测试",
    audience: "学习者",
    objectives: ["读懂"],
    unitIds: [ROUTE.unitId],
    status: "draft",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });
  writeUnit(studiesRoot, "sample", ROUTE.courseId, {
    schemaVersion: 1,
    id: ROUTE.unitId,
    title: "Unit A",
    objective: "认识",
    prerequisiteUnitIds: [],
    lessonIds: [ROUTE.lessonId],
    status: "draft",
  });
  writeLessonRevision(studiesRoot, "sample", {
    manifest: {
      schemaVersion: 1,
      id: ROUTE.lessonId,
      title: "Lesson A",
      courseId: ROUTE.courseId,
      unitId: ROUTE.unitId,
      exerciseIds: [],
      cardIds: [],
      contentRevision: 1,
      status: "active",
      evidence: [evidence],
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    },
    content: LESSON_TEXT,
  });
  updateUnitStatus(studiesRoot, "sample", ROUTE.courseId, ROUTE.unitId, "active");
  updateCourseStatus(studiesRoot, "sample", ROUTE.courseId, "active");
  return { studiesRoot };
}

function state(senseId: string, stage: VocabularyState["stage"]): VocabularyState {
  return { senseId, stage, dueAt: null, reps: 0, lapses: 0, updatedAt: CREATED_AT };
}

function compose(studiesRoot: string, vocabulary: readonly VocabularyState[] = []) {
  return composeLanguageLayer({
    studiesRoot,
    studyId: "sample",
    language: "en",
    ...ROUTE,
    contentRevision: 1,
    content: LESSON_TEXT,
    vocabulary,
  });
}

describe("composed foreign-language layer", () => {
  it("gives a never-annotated lesson a layer anyway", () => {
    // The whole point of detection: coverage stops depending on whether
    // anybody got around to annotating this particular lesson.
    const { studiesRoot } = setup();
    const layer = compose(studiesRoot);

    expect(layer.status).toBe("annotated");
    expect(layer.senseIds.length).toBeGreaterThan(0);
  });

  it("never annotates a word that only appears inside code", () => {
    const { studiesRoot } = setup();
    const layer = compose(studiesRoot);

    expect(layer.senseIds).not.toContain("commit.git");
    expect(layer.senseIds).not.toContain("commit.db");
  });

  it("drops a paused sense even when the text is full of it", () => {
    const { studiesRoot } = setup();
    const layer = compose(studiesRoot, [state("file.storage", "paused")]);

    expect(layer.senseIds).not.toContain("file.storage");
  });

  it("does not introduce new words while a learning backlog is active", () => {
    const { studiesRoot } = setup();
    const layer = compose(studiesRoot, [state("file.storage", "learning")]);

    expect(layer.reasons).toEqual({ "file.storage": "learning" });
  });

  it("treats a retired word as familiar rather than as unseen", () => {
    const { studiesRoot } = setup();
    // Nothing else is competing, so the retired word is the only thing left to
    // show — and it must arrive labelled `familiar`, which is what dims it.
    const layer = compose(studiesRoot, [
      state("file.storage", "stable"),
      state("load.action", "paused"),
      state("open.action", "paused"),
      state("run.action", "paused"),
    ]);

    expect(layer.reasons["file.storage"]).toBe("familiar");
  });

  it("lets unseen words displace a retired one when the budget is tight", () => {
    // A beginner's allowance is small. Spending any of it re-teaching a word
    // the learner has already retired is the wrong trade, so `familiar` ranks
    // last and simply misses out when there is nothing spare.
    const { studiesRoot } = setup();
    const layer = compose(studiesRoot, [state("file.storage", "stable")]);

    expect(layer.senseIds).not.toContain("file.storage");
    expect(layer.senseIds.every((id) => layer.reasons[id] === "new")).toBe(true);
  });

  it("does not let already-known words spend a beginner's budget", () => {
    // An authored overlay full of words the learner has retired used to fill
    // the whole allowance, so a beginner saw three words they already knew and
    // nothing new.
    const { studiesRoot } = setup();
    writeLanguageOverlay({
      studiesRoot,
      studyId: "sample",
      language: "en",
      ...ROUTE,
      anchors: [
        { quote: "file", occurrence: 1, senseId: "file.storage" },
        { quote: "load", occurrence: 1, senseId: "load.action" },
      ],
    });

    const known = compose(studiesRoot, [
      state("file.storage", "familiar"),
      state("load.action", "familiar"),
    ]);
    const newIds = known.senseIds.filter((id) => known.reasons[id] === "new");

    expect(known.senseIds).toEqual(expect.arrayContaining(["file.storage", "load.action"]));
    expect(newIds.length).toBeGreaterThan(0);
  });

  it("keeps every range pointing at the text it claims", () => {
    const { studiesRoot } = setup();
    const layer = compose(studiesRoot);

    for (const range of layer.ranges) {
      expect(range.end).toBeGreaterThan(range.start);
      expect(LESSON_TEXT.slice(range.start, range.end).trim()).not.toBe("");
    }
    // No character may belong to two senses, or the renderer would have to
    // choose one and the choice would depend on array order.
    const sorted = [...layer.ranges].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i]!.start).toBeGreaterThanOrEqual(sorted[i - 1]!.end);
    }
  });
});
