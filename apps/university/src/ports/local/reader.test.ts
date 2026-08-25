import { afterEach, describe, expect, it, vi } from "vitest";

import { createLocalReaderPort } from "./reader";

const locator = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "what-is-an-app",
  lessonId: "you-already-know-apps",
};

function jsonOk(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createLocalReaderPort", () => {
  it("hits the same nine authoring URLs the shared reader used to", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/vocabulary") return jsonOk({ states: [] });
      if (url === "/api/vocabulary/presented") return jsonOk({ recorded: 1 });
      if (url.endsWith("/marks") && init?.method === undefined) return jsonOk({ marks: [] });
      if (url.endsWith("/marks") && init?.method === "POST") {
        return jsonOk({
          mark: {
            markId: "m1",
            lessonKey: "a/b/c",
            contentRevision: 1,
            kind: "question",
            quote: { exact: "x", prefix: "", suffix: "" },
            sectionTitle: null,
            note: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            resolvedAt: null,
          },
        });
      }
      if (url.includes("/marks/") && init?.method === "POST") return jsonOk({ resolved: "m1" });
      if (url.includes("/marks/") && init?.method === "DELETE") return jsonOk({ deleted: "m1" });
      if (url.includes("/vocabulary/") && url.endsWith("/stage")) {
        return jsonOk({ state: { senseId: "app", stage: "learning" } });
      }
      if (url.endsWith("/complete")) return jsonOk({ ok: true });
      if (url.includes("/evidence/0")) {
        return jsonOk({
          sourcePath: "README.md",
          sourceCommit: "abc",
          startLine: 1,
          endLine: 4,
          highlightStartLine: 1,
          highlightEndLine: 4,
          language: "markdown",
          code: "# hi",
        });
      }
      return { ok: false, json: async () => ({ error: url }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const port = createLocalReaderPort({ requestToken: async () => "tok" });
    await port.listVocabulary();
    await port.recordPresented({
      studyId: locator.studyId,
      lessonId: locator.lessonId,
      senseIds: ["app"],
    });
    await port.listMarks(locator.studyId);
    await port.writeMark(locator, {
      contentRevision: 1,
      kind: "question",
      quote: { exact: "x", prefix: "", suffix: "" },
    });
    await port.resolveMark(locator.studyId, "m1");
    await port.deleteMark(locator.studyId, "m1");
    await port.stageWord("app", "learning");
    await port.completeLesson(locator, { commandId: "c1", contentRevision: 1 });
    await port.loadEvidenceSnippet(locator, 0, "full");

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual([
      "/api/vocabulary",
      "/api/vocabulary/presented",
      "/api/studies/turing-pact/marks",
      "/api/studies/turing-pact/courses/foundations-before-zero/units/what-is-an-app/lessons/you-already-know-apps/marks",
      "/api/studies/turing-pact/marks/m1",
      "/api/studies/turing-pact/marks/m1",
      "/api/vocabulary/app/stage",
      "/api/studies/turing-pact/courses/foundations-before-zero/units/what-is-an-app/lessons/you-already-know-apps/complete",
      "/api/studies/turing-pact/courses/foundations-before-zero/units/what-is-an-app/lessons/you-already-know-apps/evidence/0?view=full",
    ]);
    const presented = fetchMock.mock.calls[1]![1];
    expect(presented?.headers).toMatchObject({ "X-University-Local-Token": "tok" });
  });
});
