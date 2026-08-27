// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Course, Lesson } from "../content/library";
import { toPath, type HostExerciseGrade } from "@pieai/university-core";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";
import { lessonKey, progressPort, resetAll } from "../progress/store";
import { LessonScreen } from "./LessonScreen";

vi.mock("@pieai/university-ui/sound/index.js", () => ({
  playSound: vi.fn(),
  SoundToggle: () => <button type="button">声音</button>,
}));

const LESSON: Lesson = {
  id: "you-already-know-apps",
  title: "会使用 App 和会开发 App，差在哪儿？",
  content: [
    "# 会使用 App 和会开发 App，差在哪儿？",
    "",
    "## 先把“使用 App”和“开发 App”分开",
    "",
    "开头。",
    "",
    "## 先猜一下",
    "",
    "中间。",
    "",
    "## 答案",
    "",
    "后面。",
  ].join("\n"),
  contentRevision: 1,
  evidence: [
    {
      kind: "fact",
      sourceCommit: "3b402e069a5db5fe9eb82dbc03aa05152b3d298b",
      sourcePath: "README.md",
      lineStart: 1,
      lineEnd: 4,
      note: "README",
    },
  ],
  assets: [],
  cards: [
    {
      id: "app-means-application",
      kind: "basic",
      front: "App 是什么的缩写？",
      back: "Application。",
    },
  ],
  exercises: [
    {
      id: "product-name-from-readme",
      kind: "short-answer",
      title: "产品中文名",
      prompt: "README 第 1 行里，产品的中文名是哪四个字？",
    },
  ],
  sections: [],
};

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
      id: "what-is-an-app",
      title: "你每天用的 App，拆开是什么",
      objective: "我能说出使用 App 和开发 App 的差别。",
      lessons: [LESSON],
    },
  ],
};

/** The same course as the shelf holds it: shape, no prose. */
const SHELF_COURSE: CourseView = {
  id: COURSE.id,
  title: COURSE.title,
  description: "",
  audience: "",
  objectives: [],
  status: "active",
  isDefault: true,
  prerequisiteCourseIds: [],
  trackId: null,
  units: [
    {
      id: "what-is-an-app",
      title: "你每天用的 App，拆开是什么",
      objective: "我能说出使用 App 和开发 App 的差别。",
      status: "active",
      lessons: [
        {
          id: LESSON.id,
          title: LESSON.title,
          status: "active",
          contentRevision: 1,
          cardCount: LESSON.cards.length,
          exerciseCount: LESSON.exercises.length,
          exerciseIds: LESSON.exercises.map((exercise) => exercise.id),
          contentChars: LESSON.content.length,
          evidenceCount: 1,
          unlockCount: 0,
          progress: null,
        },
      ],
    },
  ],
};

const LOCATOR = {
  studyId: "turing-pact",
  courseId: COURSE.id,
  unitId: "what-is-an-app",
  lessonId: LESSON.id,
};

const PASSING_GRADE: HostExerciseGrade = {
  passed: true,
  evaluation: "通过",
  extensions: [],
  host: "test",
  learnerAnswer: "答案",
  occurredAt: "2026-08-27T00:00:00.000Z",
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
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
  /*
    The published package, served the way the delivery build fetches it. The
    screen goes through `ContentPort` now, in both builds, so stubbing the fetch
    exercises the real adapter rather than a hand-written stand-in for it.
  */
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ course: COURSE }) }) as Response),
  );
  resetAll();
});

const originalRect = HTMLElement.prototype.getBoundingClientRect;

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  HTMLElement.prototype.getBoundingClientRect = originalRect;
  vi.unstubAllGlobals();
  resetAll();
});

function box(top: number, height = 24): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    right: 200,
    bottom: top + height,
    width: 200,
    height,
    toJSON() {
      return {};
    },
  } as DOMRect;
}

function stubLessonRects(topsById: Readonly<Record<string, number>>): void {
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (this.classList.contains("lesson-toolbar")) return box(0, 48);
    const id = this.dataset.sectionId;
    if (id && id in topsById) return box(topsById[id]!);
    return originalRect.call(this);
  };
}

function renderHost(onBack = vi.fn(), onWorthwhileProgress?: () => void) {
  return act(async () => {
    root.render(
      <LessonScreen
        locator={LOCATOR}
        course={SHELF_COURSE}
        returnDepth={0}
        onBack={onBack}
        onWorthwhileProgress={onWorthwhileProgress}
        onSettled={() => undefined}
        onFollowLink={() => undefined}
        onOpenLesson={() => undefined}
        onReturn={() => undefined}
      />,
    );
  });
}

describe("the shared lesson reader", () => {
  it("has no nav, no breadcrumb, and a section bar instead of a course index", async () => {
    await renderHost();
    expect(container.querySelectorAll("nav")).toHaveLength(0);
    expect(container.textContent).not.toContain("关卡地图");
    expect(container.textContent).not.toContain("1/1");
    const bar = container.querySelector("[role='progressbar']");
    expect(bar?.getAttribute("aria-valuemax")).toBe("3");
    expect(bar?.getAttribute("aria-valuenow")).toBe("1");
  });

  it("offers the twelve reading tools the delivery-only screen was missing", async () => {
    await renderHost();
    expect(container.textContent).toContain("讲解层级");
    expect(container.textContent).toContain("标准讲解");
    expect(container.textContent).toContain("外语模式");
    expect(container.textContent).toContain("完成本次更新");
    expect(container.textContent).toContain("产品中文名");
    expect(container.textContent).toContain("3b402e06");
    expect(container.querySelector(".lesson-reader")).not.toBeNull();
    expect(container.querySelector(".exercise-panel")).not.toBeNull();
    expect(container.querySelector(".lesson-next")).not.toBeNull();
  });

  it("keeps the current exercise gate visible when aggregate progress is already one", async () => {
    const key = lessonKey(LOCATOR.studyId, LOCATOR.courseId, LOCATOR.lessonId);
    progressPort.advanceLesson(key, 1);
    progressPort.confirmLessonRead(key, LESSON.contentRevision);

    await renderHost();

    expect(container.textContent).toContain("练习通过后");
    expect(container.textContent).toContain("再次确认本次更新");
    expect(container.querySelector(".lesson-practice")).toBeNull();
  });

  it("does not treat opening an already completed lesson as a new value event", async () => {
    const key = lessonKey(LOCATOR.studyId, LOCATOR.courseId, LOCATOR.lessonId);
    progressPort.advanceLesson(key, 1);
    progressPort.confirmLessonRead(key, LESSON.contentRevision);
    progressPort.recordExerciseAttempt({
      commandId: "completed-before-open",
      locator: LOCATOR,
      exerciseId: LESSON.exercises[0]!.id,
      contentRevision: LESSON.contentRevision,
      answer: "答案",
      score: 1,
      maxScore: 1,
      hostGrade: PASSING_GRADE,
      occurredAt: PASSING_GRADE.occurredAt,
    });
    const onWorthwhileProgress = vi.fn();

    await renderHost(vi.fn(), onWorthwhileProgress);

    expect(onWorthwhileProgress).not.toHaveBeenCalled();
  });

  it("starts account persistence when a new lesson completion is banked", async () => {
    const key = lessonKey(LOCATOR.studyId, LOCATOR.courseId, LOCATOR.lessonId);
    const onWorthwhileProgress = vi.fn();

    await renderHost(vi.fn(), onWorthwhileProgress);
    expect(onWorthwhileProgress).not.toHaveBeenCalled();

    await act(async () => {
      progressPort.confirmLessonRead(key, LESSON.contentRevision);
      progressPort.recordExerciseAttempt({
        commandId: "completed-during-open",
        locator: LOCATOR,
        exerciseId: LESSON.exercises[0]!.id,
        contentRevision: LESSON.contentRevision,
        answer: "答案",
        score: 1,
        maxScore: 1,
        hostGrade: PASSING_GRADE,
        occurredAt: "2026-08-27T00:01:00.000Z",
      });
    });

    await vi.waitFor(() => expect(onWorthwhileProgress).toHaveBeenCalledTimes(1));
  });

  it("offers the unit capability sentence as a text recap after reading is confirmed", async () => {
    const key = lessonKey(LOCATOR.studyId, LOCATOR.courseId, LOCATOR.lessonId);
    progressPort.confirmLessonRead(key, LESSON.contentRevision);

    await renderHost();

    expect(container.textContent).toContain("讲一遍");
    expect(container.textContent).toContain("请用自己的话，讲给一个完全不知道这件事的人听。");
    expect(container.textContent).toContain("我能说出使用 App 和开发 App 的差别。");
    expect(container.querySelector(".recap-prompt textarea")?.getAttribute("placeholder")).toBe(
      "在这里写你的复述……",
    );
    expect(container.textContent).toContain("保存为复习卡");
    expect(container.textContent).toContain("语音输入：还在设计");
    expect(container.querySelector("button[aria-label*='语音']")).toBeNull();
  });

  it("keeps the source checkout entry visible and explains the delivery boundary", async () => {
    await renderHost();
    expect(container.textContent).toContain("这节课钉在");
    expect(container.textContent).toContain("打开正在学习的 App");
    expect(container.querySelector("[data-parity-control='lesson-source-version']")).not.toBeNull();
  });

  it("moves the bar as a later section crosses the read line", async () => {
    stubLessonRects({ s1: 80, s2: 400, s3: 900 });
    await renderHost();
    expect(container.querySelector("[role='progressbar']")?.getAttribute("aria-valuenow")).toBe(
      "1",
    );

    stubLessonRects({ s1: -120, s2: 20, s3: 700 });
    // A resize is what the bar listens to besides scroll, and jsdom has no
    // layout to scroll — so this is the honest way to ask it to measure again.
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(container.querySelector("[role='progressbar']")?.getAttribute("aria-valuenow")).toBe(
      "2",
    );
    expect(container.querySelector("[role='progressbar']")?.getAttribute("aria-valuetext")).toBe(
      "2/3",
    );
  });
});

describe("LessonScreen close", () => {
  it("✕ returns through onBack, which the shell wires to the course path", async () => {
    const onBack = vi.fn();
    const coursePath = toPath({
      kind: "course",
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
    });
    expect(coursePath).toBe("/turing-pact/foundations-before-zero");

    await renderHost(onBack);
    expect(container.querySelector("nav")).toBeNull();
    const close = container.querySelector<HTMLButtonElement>(".lesson-toolbar__close");
    expect(close).not.toBeNull();
    await act(async () => {
      close?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
