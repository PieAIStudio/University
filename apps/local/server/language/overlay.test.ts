import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { EvidenceReference } from "@pieai/university-core/domain/schemas.js";
import {
  updateCourseStatus,
  updateUnitStatus,
  writeCourse,
  writeLessonRevision,
  writeUnit,
} from "../content/repository.js";
import { createStudy, registerLocalGitSource } from "../studies/repository.js";
import { createCleanSnapshot } from "../studies/snapshots.js";
import { readLessonLanguageLayer, writeLanguageOverlay } from "./overlay.js";

const CREATED_AT = "2026-08-06T00:00:00.000Z";
const ROUTE = { courseId: "self-course", unitId: "self-unit", lessonId: "self-lesson" };
const LESSON_TEXT =
  "# 快照\n\n快照是一份不可变的副本，证据钉在提交上。\n\n```bash\necho 快照\n```\n";

function setup(): { readonly studiesRoot: string } {
  const container = mkdtempSync(join(tmpdir(), "university-local-language-"));
  const studiesRoot = join(container, "studies");
  const sourceRoot = join(container, "source");
  execFileSync("git", ["init", "-q", sourceRoot]);
  execFileSync("git", ["-C", sourceRoot, "config", "user.name", "UniversityLocal Test"]);
  execFileSync("git", ["-C", sourceRoot, "config", "user.email", "test@university.local"]);
  writeFileSync(join(sourceRoot, "auth.ts"), "export const owner = 'session-service';\n");
  execFileSync("git", ["-C", sourceRoot, "add", "auth.ts"]);
  execFileSync("git", ["-C", sourceRoot, "commit", "-q", "-m", "Initial"]);
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
  writeCourse(studiesRoot, "sample", {
    schemaVersion: 1,
    id: ROUTE.courseId,
    title: "Self",
    description: "语言层测试",
    audience: "学习者",
    objectives: ["读懂快照"],
    unitIds: [ROUTE.unitId],
    status: "draft",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });
  writeUnit(studiesRoot, "sample", ROUTE.courseId, {
    schemaVersion: 1,
    id: ROUTE.unitId,
    title: "快照",
    objective: "认识快照",
    prerequisiteUnitIds: [],
    lessonIds: [ROUTE.lessonId],
    status: "draft",
  });
  writeLessonRevision(studiesRoot, "sample", {
    manifest: {
      schemaVersion: 1,
      id: ROUTE.lessonId,
      title: "快照",
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

describe("language overlay", () => {
  it("round-trips: what is written is what the lesson serves", () => {
    const { studiesRoot } = setup();
    const receipt = writeLanguageOverlay({
      studiesRoot,
      studyId: "sample",
      language: "en",
      ...ROUTE,
      anchors: [{ quote: "快照", occurrence: 2, senseId: "snapshot.git" }],
    });
    expect(receipt.placed).toBe(1);
    expect(receipt.rejected).toEqual([]);

    const layer = readLessonLanguageLayer({
      studiesRoot,
      studyId: "sample",
      language: "en",
      ...ROUTE,
      contentRevision: 1,
      content: LESSON_TEXT,
    });
    expect(layer.status).toBe("annotated");
    expect(layer.senseIds).toEqual(["snapshot.git"]);
    const [range] = layer.ranges;
    expect(LESSON_TEXT.slice(range!.start, range!.end)).toBe("快照");
    // Occurrence 2 is the prose one, not the heading.
    expect(range!.start).toBeGreaterThan(LESSON_TEXT.indexOf("快照") + 1);
  });

  it("rejects at write time an anchor that would land inside code", () => {
    const { studiesRoot } = setup();
    // Occurrence 3 of 快照 is inside the fenced block.
    const receipt = writeLanguageOverlay({
      studiesRoot,
      studyId: "sample",
      language: "en",
      ...ROUTE,
      anchors: [{ quote: "快照", occurrence: 3, senseId: "snapshot.git" }],
    });
    expect(receipt.placed).toBe(0);
    expect(receipt.rejected).toEqual([{ senseId: "snapshot.git", reason: "inside-code" }]);
  });

  it("reports an unannotated lesson as such, not as an error", () => {
    const { studiesRoot } = setup();
    const layer = readLessonLanguageLayer({
      studiesRoot,
      studyId: "sample",
      language: "en",
      ...ROUTE,
      contentRevision: 1,
      content: LESSON_TEXT,
    });
    expect(layer).toEqual({ status: "not-annotated", ranges: [], senseIds: [] });
  });

  /**
   * The hash comparison is the safety argument of the whole layer: an overlay
   * written against one revision must never decorate different bytes, because
   * every position in it was chosen by a person looking at the old text.
   */
  it("refuses to decorate text the overlay was not written against", () => {
    const { studiesRoot } = setup();
    writeLanguageOverlay({
      studiesRoot,
      studyId: "sample",
      language: "en",
      ...ROUTE,
      anchors: [{ quote: "快照", occurrence: 2, senseId: "snapshot.git" }],
    });
    const layer = readLessonLanguageLayer({
      studiesRoot,
      studyId: "sample",
      language: "en",
      ...ROUTE,
      contentRevision: 1,
      content: LESSON_TEXT + "\n多了一行。\n",
    });
    expect(layer.status).toBe("stale");
    expect(layer.ranges).toEqual([]);
  });
});
