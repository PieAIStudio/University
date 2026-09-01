// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";
import { contentPort } from "../ports/index";
import { lessonKey, progressPort, resetAll } from "../progress/store";
import { SettlementHost } from "./SettlementHost";

vi.mock("@pieai/university-ui/sound/index.js", () => ({
  playSound: vi.fn(),
}));

const LESSON_ID = "you-already-know-apps";
const UNIT_ID = "what-is-an-app";
const EXERCISE_ID = `${LESSON_ID}-exercise-0`;

vi.mock("../ports/index", () => ({
  // No sender is configured in this suite, which is also the product's default
  // and the reason the settlement's reminder pre-prompt stays off: a browser
  // permission that cannot be asked for twice is not spent on a reminder
  // nothing can deliver. The two rendered states are covered where the card
  // itself lives, in ReviewReminderPrompt.test.tsx.
  REVIEW_REMINDER_SENDER_CONFIGURED: false,
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
  isDefault: true,
  prerequisiteCourseIds: [],
  trackId: null,
  units: [
    {
      id: UNIT_ID,
      title: "你每天用的 App，拆开是什么",
      objective: "能说出使用和开发的差别。",
      lessons: [
        lesson(LESSON_ID, "会使用 App 和会开发 App，差在哪儿？", 1),
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
  resetAll();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function locator(studyId: string) {
  return {
    studyId,
    courseId: COURSE.id,
    unitId: UNIT_ID,
    lessonId: LESSON_ID,
  } as const;
}

function passExercise(studyId: string): void {
  const lesson = locator(studyId);
  progressPort.recordExerciseAttempt({
    commandId: `pass:${studyId}`,
    locator: lesson,
    exerciseId: EXERCISE_ID,
    contentRevision: 1,
    answer: "answer",
    score: 1,
    maxScore: 1,
    hostGrade: {
      passed: true,
      evaluation: "通过",
      extensions: [],
      host: "test",
      learnerAnswer: "answer",
      occurredAt: "2026-08-26T00:00:00.000Z",
    },
    occurredAt: "2026-08-26T00:00:00.000Z",
  });
}

describe("SettlementHost", () => {
  it("does not congratulate a visit that never finished the lesson", async () => {
    const onIncomplete = vi.fn();
    await act(async () => {
      root.render(
        <SettlementHost
          course={COURSE}
          grewFrom={null}
          locator={locator("turing-pact-open")}
          onMap={vi.fn()}
          onNext={vi.fn()}
          onIncomplete={onIncomplete}
        />,
      );
    });
    expect(container.textContent).not.toContain("读完了");
    expect(onIncomplete).toHaveBeenCalledTimes(1);
  });

  it("does not congratulate correct exercises without a read confirmation", async () => {
    const studyId = "turing-pact-answered";
    passExercise(studyId);
    const onIncomplete = vi.fn();
    await act(async () => {
      root.render(
        <SettlementHost
          course={COURSE}
          grewFrom={null}
          locator={locator(studyId)}
          onMap={vi.fn()}
          onNext={vi.fn()}
          onIncomplete={onIncomplete}
        />,
      );
    });

    expect(container.textContent).not.toContain("读完了");
    expect(onIncomplete).toHaveBeenCalledTimes(1);
  });

  it("does not congratulate a read confirmation without passing exercises", async () => {
    const studyId = "turing-pact-read";
    progressPort.confirmLessonRead(lessonKey(studyId, COURSE.id, LESSON_ID), 1);
    const onIncomplete = vi.fn();
    await act(async () => {
      root.render(
        <SettlementHost
          course={COURSE}
          grewFrom={null}
          locator={locator(studyId)}
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
    const studyId = "turing-pact-done";
    progressPort.confirmLessonRead(lessonKey(studyId, COURSE.id, LESSON_ID), 1);
    passExercise(studyId);
    const onIncomplete = vi.fn();
    await act(async () => {
      root.render(
        <SettlementHost
          course={COURSE}
          grewFrom={{ key: `${studyId}/${COURSE.id}/${LESSON_ID}`, doneBefore: 0 }}
          locator={locator(studyId)}
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
    expect(container.textContent).not.toContain("还在设计");
    expect(container.textContent).not.toContain("即将推出");
    expect(container.textContent).not.toContain("语音输入");
    expect(container.querySelector("button[aria-label*='语音']")).toBeNull();
  });

  it("while the reward is assembling, says 读完了 instead of flashing a catalogue card", async () => {
    const studyId = "turing-pact-pending-reward";
    progressPort.confirmLessonRead(lessonKey(studyId, COURSE.id, LESSON_ID), 1);
    passExercise(studyId);

    const original = contentPort.lesson.bind(contentPort);
    contentPort.lesson = () => new Promise(() => undefined);

    try {
      await act(async () => {
        root.render(
          <SettlementHost
            course={COURSE}
            grewFrom={{ key: `${studyId}/${COURSE.id}/${LESSON_ID}`, doneBefore: 0 }}
            locator={locator(studyId)}
            onMap={vi.fn()}
            onNext={vi.fn()}
            onIncomplete={vi.fn()}
          />,
        );
      });
      expect(container.textContent).toContain("读完了");
      expect(container.querySelector(".loading-trivia")).toBeNull();
      expect(container.textContent).not.toContain("地图铺开时");
      expect(container.textContent).not.toContain("对着真实项目学");
      expect(container.textContent).not.toContain("点一座岛");
    } finally {
      contentPort.lesson = original;
    }
  });
});
