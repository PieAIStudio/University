// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMemoryGradingPort,
  createMemoryReaderPort,
  type LessonRef,
  type SourceAccessPort,
} from "@pieai/university-core";

import { LessonReader } from "./LessonReader.js";
import type { LessonView } from "../view/lesson-view.js";

const LOCATOR: LessonRef = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "what-is-an-app",
  lessonId: "you-already-know-apps",
};

const EXERCISE: LessonView["lesson"]["exercises"][number] = {
  id: "product-name-from-readme",
  kind: "short-answer",
  title: "产品中文名",
  prompt: "README 第 1 行里，产品的中文名是哪四个字？",
  contentRevision: 1,
  hostGrade: null,
  latestSubmission: null,
};

const LESSON_VIEW: LessonView = {
  lesson: {
    id: LOCATOR.lessonId,
    title: "会使用 App 和会开发 App，差在哪儿？",
    contentRevision: 1,
    content: "# 会使用 App 和会开发 App，差在哪儿？\n\n## 先把使用和开发分开\n\n正文。",
    sections: [],
    progress: null,
    evidence: [],
    exercises: [EXERCISE],
    cards: [],
  },
};

const SOURCE_EXPLANATION = {
  kind: "explanation" as const,
  title: "源码暂不可用",
  whatItDoes: "说明课程背后的源码位置。",
  whyUnavailable: "这条测试不需要打开源码。",
  futureSupport: "接入源码后仍会保留这个入口。",
};

const SOURCE_ACCESS: SourceAccessPort = {
  lessonVersion: () => SOURCE_EXPLANATION,
  closeLessonVersion: () => SOURCE_EXPLANATION,
  uaDashboard: () => SOURCE_EXPLANATION,
  layerCoverage: async () => SOURCE_EXPLANATION,
};

const NEIGHBOURS = {
  previous: null,
  next: { ...LOCATOR, lessonId: "next-lesson", title: "下一节标题" },
  position: 1,
  total: 2,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  let insideFrame = false;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    if (insideFrame) return 1;
    insideFrame = true;
    try {
      callback(0);
    } finally {
      insideFrame = false;
    }
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("crypto", {
    randomUUID: () => "00000000-0000-4000-8000-000000000001",
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function renderReader(
  completion: { readonly exercisesPassed: boolean; readonly readConfirmed: boolean },
  reader = createMemoryReaderPort(),
) {
  await act(async () => {
    root.render(
      <LessonReader
        locator={LOCATOR}
        view={LESSON_VIEW}
        completion={completion}
        unitObjective="我能说出使用 App 和开发 App 的差别。"
        reader={reader}
        grading={createMemoryGradingPort()}
        sourceAccess={SOURCE_ACCESS}
        requestToken=""
        onLearningChanged={async () => undefined}
        neighbours={NEIGHBOURS}
        onOpenLesson={() => undefined}
        onBackToCourse={() => undefined}
      />,
    );
  });
  return reader;
}

describe("read confirmation stays an explicit remaining step", () => {
  it("does not auto-complete a lesson whose exercises just passed", async () => {
    const reader = await renderReader({ exercisesPassed: true, readConfirmed: false });
    expect(reader.completed).toEqual([]);
    expect(container.querySelector("[data-remaining='read']")).not.toBeNull();
    expect(container.textContent).toContain("题目过了。还差确认你读过这一版");
    expect(container.textContent).toContain("我读完了");
    expect(container.textContent).toContain("答对不会自动完课");
  });

  it("puts the remaining confirm after the exercise, as the unique next step", async () => {
    await renderReader({ exercisesPassed: true, readConfirmed: false });
    const remaining = container.querySelector("[data-remaining='read']");
    const exercise = container.querySelector(".exercise-panel");
    expect(remaining).not.toBeNull();
    expect(exercise).not.toBeNull();
    expect(
      exercise &&
        remaining &&
        exercise.compareDocumentPosition(remaining) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      container.querySelectorAll("section.lesson-completion .liquid-cta__button"),
    ).toHaveLength(1);
    expect(container.textContent).toContain("题目过了。还差确认你读过这一版，这节才会计入进度。");
  });

  it("records the read only when the learner presses the remaining confirm", async () => {
    const reader = await renderReader({ exercisesPassed: true, readConfirmed: false });
    const button = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === "我读完了",
    );
    if (!button) throw new Error("missing remaining confirm");
    await act(async () => {
      button.click();
    });
    expect(reader.completed).toEqual([
      {
        locator: LOCATOR,
        input: { commandId: "00000000-0000-4000-8000-000000000001", contentRevision: 1 },
      },
    ]);
  });

  it("keeps the linear confirm before exercises while the quiz is still open", async () => {
    await renderReader({ exercisesPassed: false, readConfirmed: false });
    expect(container.querySelector("[data-remaining='read']")).toBeNull();
    expect(container.textContent).toContain("读到这里，确认你读完了这一版");
    expect(container.textContent).toContain("我读完了");
    expect(container.textContent).not.toContain("题目过了");
  });

  it("stops shouting re-confirm once reading is recorded and the quiz remains", async () => {
    await renderReader({ exercisesPassed: false, readConfirmed: true });
    expect(container.textContent).toContain("已确认读过这一版。还差练习。");
    expect(
      [...container.querySelectorAll("button")].some(
        (button) => button.textContent === "我读完了" || button.textContent === "再次确认本次更新",
      ),
    ).toBe(false);
  });
});
