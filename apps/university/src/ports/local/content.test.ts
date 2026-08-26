import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMemoryPersistence,
  createProgressPort,
  lessonKey,
  RECAP_CARD_ID,
} from "@pieai/university-core";

import { createLocalContentPort, refreshLocalBootstrap } from "./content";

/** The document the port imports the old SQLite projection into. */
function port() {
  return createLocalContentPort({
    progress: createProgressPort({ persistence: createMemoryPersistence() }),
  });
}

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

describe("createLocalContentPort", () => {
  it("reads a lesson off the same authoring URL the shell used to build itself", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonOk({ lesson: { id: locator.lessonId } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const view = await port().lesson(locator);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/studies/turing-pact/courses/foundations-before-zero/units/what-is-an-app/lessons/you-already-know-apps",
    );
    expect(view.lesson.id).toBe(locator.lessonId);
  });

  it("does not trust the server's completed flag over current exercise attempts", async () => {
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonOk({
        lesson: {
          id: locator.lessonId,
          contentRevision: 2,
          progress: {
            contentRevision: 2,
            status: "completed",
            progress: 1,
            updatedAt: "2026-01-01T00:00:00.000Z",
            readConfirmed: true,
          },
          exercises: [{ id: "exercise", contentRevision: 2 }],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const view = await createLocalContentPort({ progress }).lesson(locator);

    expect(view.lesson.progress).toMatchObject({
      contentRevision: 2,
      status: "in-progress",
      progress: 1,
      readConfirmed: true,
    });
  });

  it("passes the navigation's abort signal down to the request", async () => {
    // A slow answer for the lesson the learner has already left must never be
    // allowed to overwrite the one they are looking at.
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonOk({ lesson: {} }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await port().lesson(locator, { signal: controller.signal });

    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it("reads both sides of a card off the content route", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonOk({ front: "问", back: "答", contentRevision: 3 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const body = await port().card({
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

  it("serves a recap from its locator without creating an authoring content route", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonOk({}));
    vi.stubGlobal("fetch", fetchMock);

    const body = await port().card({
      kind: "recap-card",
      ...locator,
      cardId: RECAP_CARD_ID,
      front: "我能说出使用 App 和开发 App 的差别。",
      contentRevision: 3,
    });

    expect(body).toEqual({
      front: "我能说出使用 App 和开发 App 的差别。",
      back: null,
      contentRevision: 3,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the question and reference answer for a mistake without loading the lesson view", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonOk({
        id: "exercise",
        lessonTitle: "你已经会用 App 了",
        title: "问题",
        prompt: "题面",
        correctAnswer: "正确答案",
        contentRevision: 3,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const body = await port().exercise(locator, "exercise");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/studies/turing-pact/courses/foundations-before-zero/units/what-is-an-app/lessons/you-already-know-apps/exercises/exercise",
    );
    expect(body.correctAnswer).toBe("正确答案");
  });

  it("refuses an id that would become a directory traversal on the far side", async () => {
    // The address parser deliberately accepts any id — a published id is
    // authored upstream. The adapter that joins one into a filesystem path is
    // where `..` stops being a strange name.
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonOk({}));
    vi.stubGlobal("fetch", fetchMock);

    await expect(port().lesson({ ...locator, unitId: "../../etc" })).rejects.toThrow(/地址不对/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the shelf the authoring API answers with", () => {
  it("fills current exercise ids from the existing lesson route", async () => {
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/bootstrap") {
          return jsonOk({ studies: [{ id: "turing-pact", title: "TuringPact" }] });
        }
        if (
          url ===
          "/api/studies/turing-pact/courses/foundations-before-zero/units/what-is-an-app/lessons/you-already-know-apps"
        ) {
          return jsonOk({
            lesson: {
              exercises: [
                {
                  id: "current-exercise",
                  contentRevision: 8,
                  hostGrade: {
                    passed: true,
                    evaluation: "通过",
                    extensions: [],
                    host: "test",
                    learnerAnswer: "答",
                    occurredAt: "2026-08-26T00:00:00.000Z",
                  },
                },
              ],
            },
          });
        }
        return jsonOk({
          study: { id: "turing-pact", title: "TuringPact" },
          courses: [
            {
              id: "foundations-before-zero",
              title: "在开始之前",
              units: [
                {
                  id: "what-is-an-app",
                  title: "u",
                  lessons: [
                    {
                      id: "you-already-know-apps",
                      title: "l",
                      contentRevision: 8,
                      contentChars: 10,
                      cardCount: 0,
                      exerciseCount: 1,
                      progress: null,
                    },
                  ],
                },
              ],
            },
          ],
          notes: [],
        });
      }),
    );
    await refreshLocalBootstrap();
    progress.confirmLessonRead(
      lessonKey("turing-pact", "foundations-before-zero", "you-already-know-apps"),
      8,
    );

    const shelf = await createLocalContentPort({ progress }).shelf();

    expect(shelf.studies[0]?.courses[0]?.units[0]?.lessons[0]?.exerciseIds).toEqual([
      "current-exercise",
    ]);
    expect(progress.latestExerciseAttempt(locator, "current-exercise", 8)?.hostGrade?.passed).toBe(
      true,
    );
  });

  it("drops the server's own progress and imports it into the document instead", async () => {
    // Two answers to 「这一关学完了吗」 is how one campus lights a stone the
    // other leaves dark. The SQLite projection is a bridge, not a source.
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/bootstrap") {
          return jsonOk({ studies: [{ id: "turing-pact", title: "TuringPact" }] });
        }
        return jsonOk({
          study: { id: "turing-pact", title: "TuringPact" },
          courses: [
            {
              id: "foundations-before-zero",
              title: "在开始之前",
              units: [
                {
                  id: "what-is-an-app",
                  title: "u",
                  lessons: [
                    {
                      id: "you-already-know-apps",
                      title: "l",
                      contentRevision: 2,
                      contentChars: 10,
                      cardCount: 0,
                      exerciseCount: 0,
                      exerciseIds: [],
                      progress: {
                        contentRevision: 2,
                        status: "completed",
                        progress: 1,
                        updatedAt: "2026-01-01T00:00:00.000Z",
                        readConfirmed: true,
                      },
                    },
                  ],
                },
              ],
            },
          ],
          notes: [],
        });
      }),
    );

    const shelf = await createLocalContentPort({ progress }).shelf();

    expect(shelf.studies.map((study) => study.id)).toEqual(["turing-pact"]);
    expect(shelf.studies[0]?.courses[0]?.units[0]?.lessons[0]?.progress).toBeNull();
    expect(
      progress.lessonState(
        lessonKey("turing-pact", "foundations-before-zero", "you-already-know-apps"),
      ).progress,
    ).toBe(1);
  });
});
