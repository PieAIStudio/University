import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  backlinksOf,
  buildLessonIndex,
  parseLessonLinks,
  resolveLessonLinks,
  type LessonIndex,
} from "./lesson-links.js";

/** A tree shaped like the real one, without the repository's write path. */
function fixture(
  lessons: readonly {
    readonly courseId: string;
    readonly unitId: string;
    readonly lessonId: string;
    readonly title: string;
    readonly content: string;
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
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ title: lesson.title }));
  }
  return studiesRoot;
}

const AT = { courseId: "c1", unitId: "u1", lessonId: "here" };

function indexOf(...lessons: Parameters<typeof fixture>[0]): LessonIndex {
  return buildLessonIndex(fixture(lessons), "sample");
}

describe("parsing wiki links", () => {
  it("reads bare, qualified and labelled forms with correct ranges", () => {
    const content = "看 [[lesson:a]] 和 [[lesson:c2/u2/b]]，还有 [[lesson:d|另一课]]。";
    const links = parseLessonLinks(content);

    expect(links.map((link) => link.rawTarget)).toEqual(["lesson:a", "lesson:c2/u2/b", "lesson:d"]);
    expect(links.map((link) => link.label)).toEqual([null, null, "另一课"]);
    expect(content.slice(links[0]!.start, links[0]!.end)).toBe("[[lesson:a]]");
  });

  it("leaves the syntax alone inside code, so a lesson can teach it", () => {
    const content = [
      "行内 `[[lesson:a]]` 是例子。",
      "",
      "```md",
      "[[lesson:b]]",
      "```",
      "",
      "真正的链接：[[lesson:c]]",
    ].join("\n");

    expect(parseLessonLinks(content).map((link) => link.rawTarget)).toEqual(["lesson:c"]);
  });
});

describe("resolving wiki links", () => {
  const index = indexOf(
    { courseId: "c1", unitId: "u1", lessonId: "here", title: "本课", content: "" },
    { courseId: "c1", unitId: "u1", lessonId: "sibling", title: "同单元", content: "" },
    { courseId: "c1", unitId: "u2", lessonId: "cousin", title: "同课程别单元", content: "" },
    { courseId: "c2", unitId: "u9", lessonId: "far", title: "别的课程", content: "" },
    { courseId: "c1", unitId: "u1", lessonId: "twin", title: "重名 A", content: "" },
    { courseId: "c1", unitId: "u2", lessonId: "twin", title: "重名 B", content: "" },
  );

  function resolve(token: string) {
    return resolveLessonLinks(parseLessonLinks(`x [[${token}]] y`), index, AT)[0]!;
  }

  it("resolves a bare id inside the same course, across units", () => {
    const result = resolve("lesson:cousin");

    expect(result.kind).toBe("resolved");
    expect(result.kind === "resolved" && result.target.title).toBe("同课程别单元");
  });

  it("resolves a fully qualified id into another course", () => {
    const result = resolve("lesson:c2/u9/far");

    expect(result.kind === "resolved" && result.target.title).toBe("别的课程");
  });

  it("refuses to guess when a bare id exists in two units", () => {
    // Guessing would send the reader to the wrong lesson and look like it
    // worked, which is the one failure mode worth being loud about.
    expect(resolve("lesson:twin")).toMatchObject({ kind: "broken", reason: "ambiguous" });
  });

  it("reports an unknown target rather than rendering a dead link", () => {
    expect(resolve("lesson:nope")).toMatchObject({ kind: "broken", reason: "not-found" });
    expect(resolve("lesson:c1/u1/nope")).toMatchObject({ kind: "broken", reason: "not-found" });
  });

  it("treats a link to itself as an authoring mistake", () => {
    expect(resolve("lesson:here")).toMatchObject({ kind: "broken", reason: "self" });
  });

  it("never throws on a malformed lesson target", () => {
    for (const token of ["lesson:", "lesson:c1/u1", "lesson:a/b/c/d"]) {
      expect(resolve(token)).toMatchObject({ kind: "broken", reason: "malformed" });
    }
  });

  it("leaves other token kinds to their own resolver", () => {
    // `[[evidence:…]]` is resolved elsewhere. Judging it here would report
    // every inline evidence anchor in the corpus as a broken lesson link.
    for (const token of ["", "note:a", "evidence:index.html:30"]) {
      expect(resolve(token)).toBeUndefined();
    }
  });
});

describe("backlinks", () => {
  it("finds the lesson that links here, and ignores one that only mentions it in code", () => {
    const index = indexOf(
      { courseId: "c1", unitId: "u1", lessonId: "here", title: "本课", content: "正文" },
      {
        courseId: "c1",
        unitId: "u1",
        lessonId: "points-here",
        title: "指过来的课",
        content: "延伸阅读 [[lesson:here]]。",
      },
      {
        courseId: "c1",
        unitId: "u1",
        lessonId: "only-shows-syntax",
        title: "只演示语法",
        content: "写法是 `[[lesson:here]]`。",
      },
    );

    const found = backlinksOf(index, AT);

    expect(found.map((entry) => entry.lessonId)).toEqual(["points-here"]);
  });

  it("returns nothing for a lesson nobody points at", () => {
    const index = indexOf({
      courseId: "c1",
      unitId: "u1",
      lessonId: "here",
      title: "本课",
      content: "",
    });

    expect(backlinksOf(index, AT)).toEqual([]);
  });
});

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
