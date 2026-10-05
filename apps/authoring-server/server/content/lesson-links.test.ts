import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildLessonIndex } from "./lesson-links.js";

/** A tree shaped like the real one, without the repository's write path. */
function fixture(
  lessons: readonly {
    readonly courseId: string;
    readonly unitId: string;
    readonly lessonId: string;
    readonly title: string;
    readonly content: string;
    readonly sections?: readonly { readonly id: string; readonly title: string }[];
  }[],
): string {
  const studiesRoot = mkdtempSync(join(tmpdir(), "university-local-links-"));
  for (const lesson of lessons) {
    const dir = join(
      studiesRoot,
      "sample",
      "courses",
      lesson.courseId,
      "units",
      lesson.unitId,
      "lessons",
      lesson.lessonId,
      "revisions",
      "1",
    );
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "content.md"), lesson.content);
    writeFileSync(
      join(dir, "manifest.json"),
      JSON.stringify({ title: lesson.title, sections: lesson.sections ?? [] }),
    );
  }
  return studiesRoot;
}

describe("building the index", () => {
  it("reads the newest revision of each lesson", () => {
    const studiesRoot = fixture([
      { courseId: "c1", unitId: "u1", lessonId: "here", title: "旧标题", content: "旧正文" },
    ]);
    const dir = join(studiesRoot, "sample/courses/c1/units/u1/lessons/here/revisions/2");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "content.md"), "新正文");
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ title: "新标题" }));

    const index = buildLessonIndex(studiesRoot, "sample");

    expect(index.byPath.get("c1/u1/here")?.title).toBe("新标题");
  });

  it("survives a study with no courses at all", () => {
    const empty = mkdtempSync(join(tmpdir(), "university-local-links-empty-"));

    expect(buildLessonIndex(empty, "sample").byPath.size).toBe(0);
  });
});
