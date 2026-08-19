import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildLessonView } from "./views.js";
import { getCoursePaths, getLessonPaths, getUnitPaths } from "../studies/paths.js";
import { createStudy } from "../studies/repository.js";

const NOW = "2026-08-17T00:00:00.000Z";
const SOURCE_COMMIT = "0123456789abcdef0123456789abcdef01234567";

function contentHash(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value));
}

function makeStudy(): string {
  const studiesRoot = mkdtempSync(join(tmpdir(), "university-local-view-cache-"));
  createStudy(studiesRoot, { id: "sample", title: "Sample", now: new Date(NOW) });

  const course = getCoursePaths(studiesRoot, "sample", "course");
  mkdirSync(course.root, { recursive: true });
  writeJson(course.manifest, {
    schemaVersion: 1,
    id: "course",
    title: "Course",
    description: "",
    audience: "Beginner",
    objectives: ["Follow links"],
    unitIds: ["unit"],
    status: "active",
    currency: "follow-ref",
    prerequisiteCourseIds: [],
    createdAt: NOW,
    updatedAt: NOW,
  });

  const unit = getUnitPaths(studiesRoot, "sample", "course", "unit");
  mkdirSync(unit.root, { recursive: true });
  writeJson(unit.manifest, {
    schemaVersion: 1,
    id: "unit",
    title: "Unit",
    objective: "Follow links",
    prerequisiteUnitIds: [],
    lessonIds: ["source", "target"],
    status: "active",
  });

  writeLesson(studiesRoot, "source", 1, "Source", "See [[lesson:target]].");
  writeLesson(studiesRoot, "target", 1, "旧目标", "Old target.");
  return studiesRoot;
}

function writeLesson(
  studiesRoot: string,
  lessonId: string,
  revision: number,
  title: string,
  content: string,
): void {
  const lesson = getLessonPaths(studiesRoot, "sample", "course", "unit", lessonId);
  const revisionRoot = join(lesson.revisions, String(revision));
  mkdirSync(revisionRoot, { recursive: true });
  writeJson(join(revisionRoot, "manifest.json"), {
    schemaVersion: 1,
    id: lessonId,
    title,
    courseId: "course",
    unitId: "unit",
    exerciseIds: [],
    cardIds: [],
    contentRevision: revision,
    contentHash: contentHash(content),
    status: "active",
    evidence: [
      {
        kind: "fact",
        snapshotId: "snapshot-1",
        sourceCommit: SOURCE_COMMIT,
        sourcePath: "README.md",
        nodeIds: [],
      },
    ],
    sections: [],
    assets: [],
    createdAt: NOW,
    updatedAt: NOW,
  });
  writeFileSync(join(revisionRoot, "content.md"), content);
  writeJson(lesson.latest, { schemaVersion: 1, id: lessonId, contentRevision: revision });
}

describe("lesson view links", () => {
  it("reads a revised target title in the same process", () => {
    const studiesRoot = makeStudy();
    const route = {
      studyId: "sample",
      courseId: "course",
      unitId: "unit",
      lessonId: "source",
    } as const;
    const readView = () =>
      buildLessonView(studiesRoot, route, null, []) as {
        readonly lesson: {
          readonly links: readonly {
            readonly target: { readonly title: string } | null;
          }[];
        };
      };

    expect(readView().lesson.links[0]?.target?.title).toBe("旧目标");

    writeLesson(studiesRoot, "target", 2, "新目标", "New target.");

    expect(readView().lesson.links[0]?.target?.title).toBe("新目标");
  });
});
