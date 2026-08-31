// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { lessonKey, RECAP_CARD_ID } from "@pieai/university-core";

import { progressPort, resetAll } from "../../progress/store";
import { createOnlineContentPort } from "./content";

const course = {
  id: "foundations-before-zero",
  title: "在开始之前",
  description: "",
  audience: "",
  objectives: [],
  prerequisiteCourseIds: [],
  trackId: null,
  units: [
    {
      id: "what-is-an-app",
      title: "App 是什么",
      objective: "我能说出使用 App 和开发 App 的差别。",
      lessons: [
        {
          id: "you-already-know-apps",
          title: "你已经会用 App 了",
          content: "## 现象\n一段课文。",
          contentRevision: 3,
          evidence: [],
          assets: [],
          cards: [{ id: "app-is-a-program", kind: "recall", front: "问", back: "答" }],
          exercises: [
            {
              id: "exercise",
              kind: "short-answer",
              title: "问题",
              prompt: "题面",
            },
          ],
        },
      ],
    },
  ],
};

const locator = {
  studyId: "turing-pact",
  courseId: course.id,
  unitId: "what-is-an-app",
  lessonId: "you-already-know-apps",
};

function servePackage() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ course }) }) as Response),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetAll();
});

describe("createOnlineContentPort", () => {
  it("reads the structural shelf once instead of loading every course package", async () => {
    const shelf = {
      studies: [
        {
          id: "turing-pact",
          title: "TuringPact",
          courses: [],
        },
      ],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("/content/shelf.json");
      return { ok: true, json: async () => shelf } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const port = createOnlineContentPort();
    await expect(port.shelf()).resolves.toEqual(shelf);
    await expect(port.shelf()).resolves.toEqual(shelf);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lets a lesson retry after a published package returns an error", async () => {
    const retryCourse = { ...course, id: "recovery-course" };
    const retryLocator = { ...locator, courseId: retryCourse.id };
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ course: retryCourse }),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(createOnlineContentPort().lesson(retryLocator)).rejects.toThrow("503");
    await expect(createOnlineContentPort().lesson(retryLocator)).resolves.toMatchObject({
      lesson: { id: retryLocator.lessonId },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("folds a published lesson into the read model the shared reader speaks", async () => {
    servePackage();
    const view = await createOnlineContentPort().lesson(locator);
    expect(view.lesson.id).toBe(locator.lessonId);
    expect(view.lesson.content).toContain("一段课文");
    // A published package is one snapshot, but it keeps the source revision.
    expect(view.lesson.contentRevision).toBe(3);
  });

  it("does not trust aggregate progress over current exercise attempts", async () => {
    servePackage();
    const key = lessonKey(locator.studyId, locator.courseId, locator.lessonId);
    progressPort.advanceLesson(key, 1);
    progressPort.confirmLessonRead(key, 3);

    const view = await createOnlineContentPort().lesson(locator);

    expect(view.lesson.progress).toMatchObject({
      contentRevision: 3,
      status: "in-progress",
      progress: 1,
      readConfirmed: true,
    });
  });

  /*
    The literal `null` is the assertion, not a placeholder.

    A mistake book needs the question and cannot have the answer here: the
    import strips every reference answer out of the package, because a shipped
    answer is one network tab away from a learner who has attempted none of
    them. If this ever comes back as a string, an import has started shipping
    answers again — which it did once, in the change that added this file.
  */
  it("reads a mistake's question from the package, and withholds the answer", async () => {
    servePackage();

    await expect(createOnlineContentPort().exercise(locator, "exercise")).resolves.toEqual({
      id: "exercise",
      lessonTitle: "你已经会用 App 了",
      title: "问题",
      prompt: "题面",
      correctAnswer: null,
      contentRevision: 3,
    });
  });

  it("says so plainly when the address names a lesson this course does not have", async () => {
    servePackage();
    await expect(
      createOnlineContentPort().lesson({ ...locator, lessonId: "not-a-lesson" }),
    ).rejects.toThrow(/不在这门课里/);
  });

  it("reads both sides of a card out of the package rather than off a server", async () => {
    servePackage();
    const body = await createOnlineContentPort().card({
      kind: "course-card",
      ...locator,
      cardId: "app-is-a-program",
      front: "问",
      contentRevision: 3,
    });
    expect(body).toEqual({ front: "问", back: "答", contentRevision: 3 });
  });

  it("builds a recap front from the published unit objective and has no reference back", async () => {
    servePackage();
    const body = await createOnlineContentPort().card({
      kind: "recap-card",
      ...locator,
      cardId: RECAP_CARD_ID,
      front: "旧的能力句副本",
      contentRevision: 1,
    });

    expect(body).toEqual({
      front: "我能说出使用 App 和开发 App 的差别。",
      back: null,
      contentRevision: 1,
    });
  });

  it("refuses a card the package does not carry instead of showing a blank back", async () => {
    servePackage();
    await expect(
      createOnlineContentPort().card({
        kind: "course-card",
        ...locator,
        cardId: "not-a-card",
        front: "",
        contentRevision: 3,
      }),
    ).rejects.toThrow(/尚未加载/);
  });
});
