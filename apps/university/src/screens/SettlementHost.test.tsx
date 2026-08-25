// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";
import { advanceLesson, lessonKey } from "../progress/store";
import { SettlementHost } from "./SettlementHost";

vi.mock("@pieai/university-ui/sound/index.js", () => ({
  playSound: vi.fn(),
}));

const LESSON_ID = "you-already-know-apps";
const UNIT_ID = "what-is-an-app";

vi.mock("../ports/index", () => ({
  contentPort: {
    async lesson() {
      return {
        lesson: {
          id: LESSON_ID,
          title: "会使用 App 和会开发 App，差在哪儿？",
          contentRevision: 1,
          content: "正文",
          sections: [],
          progress: null,
          evidence: [],
          exercises: [],
          cards: [],
        },
      };
    },
  },
}));

function lesson(id: string, title: string, exerciseCount = 0) {
  return {
    id,
    title,
    status: "active",
    contentRevision: 1,
    cardCount: 0,
    exerciseCount,
    exerciseIds: Array.from({ length: exerciseCount }, (_, index) => `${id}-exercise-${index}`),
    contentChars: 3,
    evidenceCount: 0,
    unlockCount: 0,
    progress: null,
  };
}

const COURSE: CourseView = {
  id: "foundations-before-zero",
  title: "《在开始之前：App、代码、和你》",
  description: "",
  audience: "",
  objectives: [],
  status: "active",
  isDefault: true,
  prerequisiteCourseIds: [],
  trackId: null,
  units: [
    {
      id: UNIT_ID,
      title: "你每天用的 App，拆开是什么",
      objective: "能说出使用和开发的差别。",
      status: "active",
      lessons: [
        lesson(LESSON_ID, "会使用 App 和会开发 App，差在哪儿？"),
        lesson("app-is-a-pile-of-files", "屏幕上的按钮，代码里能找到对应的哪几行？", 1),
      ],
    },
  ],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion: reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
    onchange: null,
  }));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("SettlementHost", () => {
  it("does not congratulate a visit that never finished the lesson", async () => {
    const onIncomplete = vi.fn();
    await act(async () => {
      root.render(
        <SettlementHost
          course={COURSE}
          grewFrom={null}
          locator={{
            studyId: "turing-pact-open",
            courseId: COURSE.id,
            unitId: UNIT_ID,
            lessonId: LESSON_ID,
          }}
          onMap={vi.fn()}
          onNext={vi.fn()}
          onIncomplete={onIncomplete}
        />,
      );
    });
    expect(container.textContent).not.toContain("读完了");
    expect(onIncomplete).toHaveBeenCalledTimes(1);
  });

  it("renders the settlement once the document actually holds a finish", async () => {
    advanceLesson(lessonKey("turing-pact-done", COURSE.id, LESSON_ID), 1);
    const onIncomplete = vi.fn();
    await act(async () => {
      root.render(
        <SettlementHost
          course={COURSE}
          grewFrom={{ key: `turing-pact-done/${COURSE.id}/${LESSON_ID}`, doneBefore: 0 }}
          locator={{
            studyId: "turing-pact-done",
            courseId: COURSE.id,
            unitId: UNIT_ID,
            lessonId: LESSON_ID,
          }}
          onMap={vi.fn()}
          onNext={vi.fn()}
          onIncomplete={onIncomplete}
        />,
      );
    });
    expect(onIncomplete).not.toHaveBeenCalled();
    expect(container.textContent).toContain("读完了");
    expect(container.textContent).toContain("1 / 2 关");
    expect(container.textContent).not.toContain("还剩");
  });
});
