// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createMemoryPersistence, createProgressPort } from "@pieai/university-core";

import { isRepositoryAnchor, loadCourse } from "../../content/library";
import type { Course, Lesson } from "../../content/library";
import { createOnlineReaderPort, READER_MARKS_STORAGE_KEY } from "./reader";

const lesson: Lesson = {
  id: "you-already-know-apps",
  title: "t",
  content: "body",
  contentRevision: 1,
  evidence: [
    {
      kind: "fact",
      sourceCommit: "abc",
      sourcePath: "README.md",
      lineStart: 1,
      lineEnd: 2,
      snippetUrl: "/content/turing-pact/foundations-before-zero/evidence/aaa.json",
    },
  ],
  assets: [],
  cards: [],
  exercises: [],
};

const locator = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "what-is-an-app",
  lessonId: lesson.id,
};

const COURSE: Course = {
  id: "foundations-before-zero",
  title: "在开始之前",
  description: "",
  audience: "",
  objectives: [],
  prerequisiteCourseIds: [],
  trackId: null,
  units: [{ id: "what-is-an-app", title: "u", objective: "", lessons: [lesson] }],
};

const LOCATOR_ONLY_COURSE: Course = {
  ...COURSE,
  id: "without-baked-evidence",
  units: [
    {
      id: "what-is-an-app",
      title: "u",
      objective: "",
      lessons: [
        {
          ...lesson,
          evidence: [
            {
              kind: "fact",
              sourceCommit: "abc",
              sourcePath: "README.md",
              lineStart: 1,
              lineEnd: 2,
            },
          ],
        },
      ],
    },
  ],
};

/*
  The port finds the lesson from the address rather than being handed one, so
  the package has to be in the session's cache — which is the state the reader
  is in by the time it asks for a snippet.
*/
beforeAll(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ course: COURSE }) }) as Response),
  );
  await loadCourse("turing-pact", COURSE.id);
  vi.unstubAllGlobals();
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("createOnlineReaderPort", () => {
  it("keeps marks on this machine without the authoring API", async () => {
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    const port = createOnlineReaderPort({ progress });
    const mark = await port.writeMark(locator, {
      contentRevision: 1,
      kind: "highlight",
      quote: { exact: "body", prefix: "", suffix: "" },
    });
    const listed = await port.listMarks(locator.studyId);
    expect(listed).toEqual([mark]);
    expect(
      JSON.parse(localStorage.getItem(READER_MARKS_STORAGE_KEY) ?? "{}")[locator.studyId],
    ).toHaveLength(1);
  });

  it("loads a baked evidence snippet by index", async () => {
    const snippet = {
      sourcePath: "README.md",
      sourceCommit: "abc",
      startLine: 1,
      endLine: 2,
      highlightStartLine: 1,
      highlightEndLine: 2,
      language: "markdown",
      code: "# hi",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => snippet,
      }),
    );
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    const port = createOnlineReaderPort({ progress });
    await expect(port.loadEvidenceSnippet(locator, 0, "full")).resolves.toEqual(snippet);
    const anchor = lesson.evidence[0];
    expect(anchor && isRepositoryAnchor(anchor) ? anchor.snippetUrl : null).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      anchor && isRepositoryAnchor(anchor) ? anchor.snippetUrl : undefined,
    );
  });

  it("returns locator-only when the published anchor has no snippet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ course: LOCATOR_ONLY_COURSE }),
      }),
    );
    await loadCourse("turing-pact", LOCATOR_ONLY_COURSE.id);
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    const port = createOnlineReaderPort({ progress });

    await expect(
      port.loadEvidenceSnippet({ ...locator, courseId: LOCATOR_ONLY_COURSE.id }, 0),
    ).resolves.toEqual({ kind: "locator-only" });
  });
});
