// @vitest-environment jsdom

import { StrictMode, act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NOT_STARTED,
  createMemoryGradingPort,
  createMemoryReaderPort,
  type LessonRef,
  type SourceAccessPort,
} from "@pieai/university-core";

import { LessonReader } from "./lesson/LessonReader.js";
import type { LessonView } from "./view/lesson-view.js";
import { ExerciseBlock } from "./review/ExerciseBlock.js";
import { ReviewCard } from "./review/ReviewCard.js";
import type { ReviewCardPort, VocabularyDueWord, VocabularyReviewPort } from "./review/ports.js";
import { TodaySection, type TodaySectionData } from "./today/TodaySection.js";
import { VocabularyReview } from "./review/VocabularyReview.js";

const playSound = vi.hoisted(() => vi.fn());

vi.mock("./sound/index.js", () => ({
  playSound,
}));

const LOCATOR: LessonRef = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "what-is-an-app",
  lessonId: "strictmode-smoke",
};

const EXERCISE: LessonView["lesson"]["exercises"][number] = {
  id: "name-the-visible-thing",
  kind: "short-answer",
  title: "说出你看见的东西",
  prompt: "页面上最重要的内容是什么？",
  contentRevision: 1,
  hostGrade: null,
  latestSubmission: null,
};

const LESSON_VIEW: LessonView = {
  lesson: {
    id: LOCATOR.lessonId,
    title: "读懂一个真实的学习页面",
    contentRevision: 1,
    content: "# 读懂一个真实的学习页面\n\n## 先看正文\n\n正文必须出现在页面上。",
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

const REVIEW_CARD = {
  kind: "course-card" as const,
  ...LOCATOR,
  cardId: "visible-card",
  front: "什么东西必须先出现在页面上？",
  contentRevision: 1,
};

const REVIEW_PORT: ReviewCardPort = {
  preview: () => ({ again: 60_000, hard: 6 * 60_000, good: 10 * 60_000, easy: 8 * 86_400_000 }),
  reveal: async () => ({ back: "用户必须能看见并理解正文。" }),
  rate: async () => ({ dueAt: "2026-08-30T00:00:00.000Z" }),
};

const DUE_WORD: VocabularyDueWord = {
  senseId: "app.program",
  stage: "learning",
  entry: {
    senseId: "app.program",
    headword: "app",
    phonetic: "/æp/",
    partOfSpeech: "noun",
    gloss: "应用：用户点开图标就能用的那个成品",
    usage: "App 是 application 的口语缩写。",
    track: "technical",
  },
};

const TODAY_DATA: TodaySectionData = {
  card: null,
  nextLesson: {
    ...LOCATOR,
    studyTitle: "TuringPact",
    courseTitle: "在开始之前",
    lessonTitle: "今天先读这一节",
    contentRevision: 1,
    progress: null,
  },
  dueCount: 0,
  issues: [],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  /*
    LiquidGroup schedules another frame from inside its frame. A synchronous
    callback keeps the SVG observable in this cheap jsdom test; the guard is
    required so that the self-scheduling loop does not recurse forever.
  */
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
  playSound.mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function renderStrict(element: ReactElement): Promise<void> {
  await act(async () => {
    root.render(<StrictMode>{element}</StrictMode>);
  });
}

async function settleAsyncEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function buttonWith(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
    button.textContent?.includes(text),
  );
}

describe("shared learner surfaces under React StrictMode", () => {
  it("keeps lesson prose and the answer field visible", async () => {
    await renderStrict(
      <LessonReader
        locator={LOCATOR}
        view={LESSON_VIEW}
        completion={NOT_STARTED}
        unitObjective="我能说出页面上最重要的内容。"
        reader={createMemoryReaderPort()}
        grading={createMemoryGradingPort()}
        sourceAccess={SOURCE_ACCESS}
        requestToken=""
        onLearningChanged={async () => undefined}
      />,
    );

    expect(container.querySelector("h2")?.textContent).toBe("读懂一个真实的学习页面");
    expect(container.textContent).toContain("正文必须出现在页面上。");
    expect(container.querySelector("textarea")).not.toBeNull();
  });

  it("keeps a short-answer exercise's prompt, field, and submit action visible", async () => {
    await renderStrict(
      <ExerciseBlock
        locator={LOCATOR}
        exercise={EXERCISE}
        grading={createMemoryGradingPort()}
        onRefresh={async () => undefined}
      />,
    );

    expect(container.textContent).toContain("说出你看见的东西");
    expect(container.textContent).toContain("页面上最重要的内容是什么？");
    expect(container.querySelector("textarea")).not.toBeNull();
    expect(buttonWith("提交")).toBeTruthy();
  });

  it("keeps the review card's question, answer field, and reveal action visible", async () => {
    await renderStrict(
      <ReviewCard card={REVIEW_CARD} review={REVIEW_PORT} onReviewed={async () => undefined} />,
    );

    expect(container.querySelector("h2")?.textContent).toContain("通过答题复习");
    expect(container.textContent).toContain(REVIEW_CARD.front);
    expect(container.querySelector("textarea")).not.toBeNull();
    expect(buttonWith("揭示答案")).toBeTruthy();
  });

  it("keeps the due vocabulary card visible after its async load", async () => {
    const vocabularyReview: VocabularyReviewPort = {
      load: vi.fn(async () => ({ due: [DUE_WORD], reviewedToday: 2 })),
      rate: vi.fn(async () => undefined),
    };

    await renderStrict(<VocabularyReview review={vocabularyReview} />);
    await settleAsyncEffects();

    expect(container.querySelector("h2")?.textContent).toBe("app");
    expect(container.textContent).toContain("生词 · 1 个待复习");
    expect(buttonWith("我想好了，看释义")).toBeTruthy();
  });

  it("keeps today's next lesson and its primary action visible", async () => {
    await renderStrict(
      <TodaySection
        data={TODAY_DATA}
        onOpenLesson={() => undefined}
        onReviewed={async () => undefined}
      />,
    );

    expect(container.querySelector("h2")?.textContent).toBe("今天先读这一节");
    expect(container.textContent).toContain("TuringPact · 在开始之前");
    expect(buttonWith("开始学习")).toBeTruthy();
  });
});
