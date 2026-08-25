// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

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
      objective: "",
      lessons: [
        {
          id: "you-already-know-apps",
          title: "你已经会用 App 了",
          content: "## 现象\n一段课文。",
          evidence: [],
          assets: [],
          cards: [{ id: "app-is-a-program", kind: "recall", front: "问", back: "答" }],
          exercises: [],
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

  it("folds a published lesson into the read model the shared reader speaks", async () => {
    servePackage();
    const view = await createOnlineContentPort().lesson(locator);
    expect(view.lesson.id).toBe(locator.lessonId);
    expect(view.lesson.content).toContain("一段课文");
    // A published package is one snapshot, so there is exactly one edition.
    expect(view.lesson.contentRevision).toBe(1);
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
      contentRevision: 1,
    });
    expect(body).toEqual({ front: "问", back: "答", contentRevision: 1 });
  });

  it("refuses a card the package does not carry instead of showing a blank back", async () => {
    servePackage();
    await expect(
      createOnlineContentPort().card({
        kind: "course-card",
        ...locator,
        cardId: "not-a-card",
        front: "",
        contentRevision: 1,
      }),
    ).rejects.toThrow(/尚未加载/);
  });
});
