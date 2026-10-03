import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createStudy, readStudy } from "../studies/repository.js";
import {
  writeCourse,
  writeUnit,
  writeLessonRevision,
  updateCourseStatus,
  updateUnitStatus,
  readLatestLesson,
  readUnit,
} from "../content/repository.js";
import { exportCourseRecovery, importCourseRecovery } from "../recovery/course-recovery.js";
import { retireStudyContent } from "./retire-content.js";

function setup() {
  const root = mkdtempSync(join(tmpdir(), "retire-content-test-"));
  const studiesRoot = join(root, "studies");
  createStudy(studiesRoot, { id: "sample", title: "Sample" });
  const now = "2026-10-03T00:00:00.000Z";
  for (const id of ["course", "other"]) {
    writeCourse(studiesRoot, "sample", {
      schemaVersion: 1,
      id,
      title: id,
      description: "",
      audience: "Beginner",
      objectives: ["Read"],
      unitIds: ["unit"],
      status: "draft",
      currency: "pinned-history",
      prerequisiteCourseIds: [],
      createdAt: now,
      updatedAt: now,
    });
    writeUnit(studiesRoot, "sample", id, {
      schemaVersion: 1,
      id: "unit",
      title: "Unit",
      objective: "Read",
      lessonIds: ["keep", "remove"],
      prerequisiteUnitIds: [],
      status: "draft",
    });
    for (const lessonId of ["keep", "remove"])
      writeLessonRevision(studiesRoot, "sample", {
        manifest: {
          schemaVersion: 1,
          id: lessonId,
          title: lessonId,
          courseId: id,
          unitId: "unit",
          contentRevision: 1,
          status: "active",
          sections: [],
          assets: [],
          cardIds: [],
          exerciseIds: [],
          evidence: [
            {
              kind: "fact",
              sourceUrl: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
              sourceTitle: "JavaScript",
              sourceAuthority: "mdn",
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
        content: `# ${lessonId}\n\nRead this preserved source.\n`,
      });
    updateUnitStatus(studiesRoot, "sample", id, "unit", "active");
    updateCourseStatus(studiesRoot, "sample", id, "active");
  }
  mkdirSync(join(studiesRoot, "sample", "learner"), { recursive: true });
  writeFileSync(join(studiesRoot, "sample", "learner", "history"), "history must survive");
  const before = exportCourseRecovery({
    studiesRoot,
    studyId: "sample",
    outDirectory: join(root, "before"),
  });
  const proposal = {
    schemaVersion: 1,
    proposalId: "retire-old",
    reason: "Owner approved retirement",
    expectedPackages: Object.fromEntries(before.courses.map((c) => [c.courseId, c.sha256])),
    retain: [{ courseId: "course", units: [{ unitId: "unit", lessonIds: ["keep"] }] }],
  };
  return { root, studiesRoot, proposal, outDirectory: join(root, "retired"), studyId: "sample" };
}

describe("native content retirement", () => {
  it("dry-run preserves native content, learner history and the absent archive", () => {
    const input = setup();
    expect(retireStudyContent({ ...input, dryRun: true }).outcome).toBe("validated");
    expect(readUnit(input.studiesRoot, "sample", "course", "unit").lessonIds).toEqual([
      "keep",
      "remove",
    ]);
    expect(existsSync(input.outDirectory)).toBe(false);
  });
  it("rejects changed source hashes and missing retained identities before writing", () => {
    const input = setup();
    expect(() =>
      retireStudyContent({
        ...input,
        proposal: { ...input.proposal, expectedPackages: { course: `sha256:${"0".repeat(64)}` } },
      }),
    ).toThrow("expectedPackages");
    expect(() =>
      retireStudyContent({
        ...input,
        proposal: {
          ...input.proposal,
          retain: [{ courseId: "course", units: [{ unitId: "unit", lessonIds: ["unknown"] }] }],
        },
      }),
    ).toThrow("existing lessons");
    expect(existsSync(input.outDirectory)).toBe(false);
  });
  it("archives before removing, leaves retained revisions and learner bytes unchanged, and restores alone", () => {
    const input = setup();
    const kept = readLatestLesson(input.studiesRoot, "sample", "course", "unit", "keep");
    const result = retireStudyContent(input);
    expect(result.outcome).toBe("retired");
    expect(result.removed).toHaveLength(3);
    expect(readLatestLesson(input.studiesRoot, "sample", "course", "unit", "keep")).toEqual(kept);
    expect(readUnit(input.studiesRoot, "sample", "course", "unit").lessonIds).toEqual(["keep"]);
    expect(readFileSync(join(input.studiesRoot, "sample", "learner", "history"), "utf8")).toBe(
      "history must survive",
    );
    expect(existsSync(join(input.outDirectory, "native/sample/learner"))).toBe(false);
    const restoredRoot = join(input.root, "restored");
    importCourseRecovery({
      studiesRoot: restoredRoot,
      studyId: "sample",
      inputDirectory: join(input.outDirectory, "recovery"),
    });
    const restored = exportCourseRecovery({
      studiesRoot: restoredRoot,
      studyId: "sample",
      outDirectory: join(input.root, "restored-export"),
    });
    expect(Object.fromEntries(restored.courses.map((c) => [c.courseId, c.sha256]))).toEqual(
      input.proposal.expectedPackages,
    );
  });
  it("can archive a whole study while keeping its learner store", () => {
    const input = setup();
    retireStudyContent({ ...input, proposal: { ...input.proposal, retain: [] } });
    expect(readStudy(input.studiesRoot, "sample").status).toBe("archived");
    expect(readFileSync(join(input.studiesRoot, "sample", "learner", "history"), "utf8")).toBe(
      "history must survive",
    );
    expect(existsSync(join(input.studiesRoot, "sample", "courses/course"))).toBe(false);
  });
});
