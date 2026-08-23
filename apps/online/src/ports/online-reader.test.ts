// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { createMemoryPersistence, createProgressPort } from "@pieai/university-core";

import { isRepositoryAnchor } from "../content/library";
import type { Lesson } from "../content/library";
import { createOnlineReaderPort, READER_MARKS_STORAGE_KEY } from "./online-reader";

const lesson: Lesson = {
  id: "you-already-know-apps",
  title: "t",
  content: "body",
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

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("createOnlineReaderPort", () => {
  it("keeps marks on this machine without the authoring API", async () => {
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    const onComplete = vi.fn();
    const port = createOnlineReaderPort({ progress, lesson, onComplete });
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
    const port = createOnlineReaderPort({ progress, lesson, onComplete: () => undefined });
    await expect(port.loadEvidenceSnippet(locator, 0, "full")).resolves.toEqual(snippet);
    const anchor = lesson.evidence[0];
    expect(anchor && isRepositoryAnchor(anchor) ? anchor.snippetUrl : null).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      anchor && isRepositoryAnchor(anchor) ? anchor.snippetUrl : undefined,
    );
  });
});
