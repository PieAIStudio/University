// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Course } from "../content/library";
import { advanceLesson, lessonKey } from "../progress/store";
import { SettlementHost } from "./SettlementHost";

vi.mock("@pieai/university-ui/sound/index.js", () => ({
  playSound: vi.fn(),
}));

const LESSON_ID = "you-already-know-apps";
const UNIT_ID = "what-is-an-app";
const COURSE: Course = {
  id: "foundations-before-zero",
  title: "《在开始之前：App、代码、和你》",
  description: "",
  audience: "",
  objectives: [],
  prerequisiteCourseIds: [],
  trackId: null,
  units: [
    {
      id: UNIT_ID,
      title: "你每天用的 App，拆开是什么",
      objective: "能说出使用和开发的差别。",
      lessons: [
        {
          id: LESSON_ID,
          title: "会使用 App 和会开发 App，差在哪儿？",
          content: "正文",
          evidence: [],
          assets: [],
          cards: [],
          exercises: [],
        },
        {
          id: "app-is-a-pile-of-files",
          title: "屏幕上的按钮，代码里能找到对应的哪几行？",
          content: "下一节",
          evidence: [],
          assets: [],
          cards: [],
          exercises: [{ id: "ex1", kind: "short-answer", prompt: "下一题" }],
        },
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
          studyId="turing-pact-open"
          unitId={UNIT_ID}
          lessonId={LESSON_ID}
          onMap={vi.fn()}
          onNext={vi.fn()}
          onIncomplete={onIncomplete}
        />,
      );
    });
    expect(container.textContent).not.toContain("读完了");
    expect(onIncomplete).toHaveBeenCalledTimes(1);
  });

  it("renders the settlement once the store actually holds a finish", async () => {
    advanceLesson(lessonKey("turing-pact-done", COURSE.id, LESSON_ID), 1);
    const onIncomplete = vi.fn();
    await act(async () => {
      root.render(
        <SettlementHost
          course={COURSE}
          grewFrom={{ key: `turing-pact-done/${COURSE.id}/${LESSON_ID}`, doneBefore: 0 }}
          studyId="turing-pact-done"
          unitId={UNIT_ID}
          lessonId={LESSON_ID}
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
