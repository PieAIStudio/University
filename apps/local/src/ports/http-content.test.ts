import { afterEach, describe, expect, it, vi } from "vitest";

import { createHttpContentPort } from "./http-content";

const locator = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "what-is-an-app",
  lessonId: "you-already-know-apps",
};

function jsonOk(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createHttpContentPort", () => {
  it("reads a lesson off the same authoring URL the shell used to build itself", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonOk({ lesson: { id: locator.lessonId } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const view = await createHttpContentPort().lesson(locator);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/studies/turing-pact/courses/foundations-before-zero/units/what-is-an-app/lessons/you-already-know-apps",
    );
    expect(view.lesson.id).toBe(locator.lessonId);
  });

  it("passes the navigation's abort signal down to the request", async () => {
    // A slow answer for the lesson the learner has already left must never be
    // allowed to overwrite the one they are looking at.
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonOk({ lesson: {} }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await createHttpContentPort().lesson(locator, { signal: controller.signal });

    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it("reads both sides of a card off the content route", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonOk({ front: "问", back: "答", contentRevision: 3 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const body = await createHttpContentPort().card({
      kind: "course-card",
      ...locator,
      cardId: "app-is-a-program",
      front: "问",
      contentRevision: 3,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/studies/turing-pact/courses/foundations-before-zero/units/what-is-an-app/lessons/you-already-know-apps/cards/app-is-a-program/content",
    );
    expect(body).toEqual({ front: "问", back: "答", contentRevision: 3 });
  });

  it("refuses an id that would become a directory traversal on the far side", async () => {
    // The address parser deliberately accepts any id — a published id is
    // authored upstream. The adapter that joins one into a filesystem path is
    // where `..` stops being a strange name.
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonOk({}));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createHttpContentPort().lesson({ ...locator, unitId: "../../etc" }),
    ).rejects.toThrow(/地址不对/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
