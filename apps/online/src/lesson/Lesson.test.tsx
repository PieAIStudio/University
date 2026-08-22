// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Course, Lesson } from "../content/library";
import { toHash } from "../url-state";
import { LessonReaderHost } from "../screens/LessonReaderHost";
import { LessonScreen } from "./Lesson";

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
  evidence: [],
  assets: [],
  cards: [],
  exercises: [],
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
      objective: "",
      lessons: [LESSON],
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
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});

const originalRect = HTMLElement.prototype.getBoundingClientRect;

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  HTMLElement.prototype.getBoundingClientRect = originalRect;
  vi.unstubAllGlobals();
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

describe("LessonScreen reading chrome", () => {
  it("has no nav, no breadcrumb, and a section bar instead of a course index", async () => {
    const onBack = vi.fn();
    await act(async () => {
      root.render(
        <LessonScreen
          lesson={LESSON}
          course={COURSE}
          unitId="what-is-an-app"
          onPass={() => undefined}
          onBack={onBack}
        />,
      );
    });
    expect(container.querySelectorAll("nav")).toHaveLength(0);
    expect(container.textContent).not.toContain("关卡地图");
    expect(container.textContent).not.toContain("1/1");
    expect(container.textContent).not.toMatch(/\d+\/\d+/);
    const bar = container.querySelector("[role='progressbar']");
    expect(bar?.getAttribute("aria-valuemax")).toBe("3");
    expect(bar?.getAttribute("aria-valuenow")).toBe("1");
    expect(container.querySelector(".lesson__en")?.textContent).toBe("EN");
  });

  it("moves the bar as a later section crosses the read line", async () => {
    const onBack = vi.fn();
    stubLessonRects({ s1: 80, s2: 400, s3: 900 });
    await act(async () => {
      root.render(
        <LessonScreen
          lesson={LESSON}
          course={COURSE}
          unitId="what-is-an-app"
          onPass={() => undefined}
          onBack={onBack}
        />,
      );
    });
    expect(container.querySelector("[role='progressbar']")?.getAttribute("aria-valuenow")).toBe(
      "1",
    );

    stubLessonRects({ s1: -120, s2: 20, s3: 700 });
    await act(async () => {
      root.render(
        <LessonScreen
          lesson={{ ...LESSON, content: `${LESSON.content}\n` }}
          course={COURSE}
          unitId="what-is-an-app"
          onPass={() => undefined}
          onBack={onBack}
        />,
      );
    });
    expect(container.querySelector("[role='progressbar']")?.getAttribute("aria-valuenow")).toBe(
      "2",
    );
    expect(container.querySelector("[role='progressbar']")?.getAttribute("aria-valuetext")).toBe(
      "2/3",
    );
  });
});

describe("LessonReaderHost close", () => {
  it("✕ returns through onBack, which the shell wires to the course path", async () => {
    const onBack = vi.fn();
    const coursePath = toHash({
      kind: "course",
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
    });
    expect(coursePath).toBe("#/turing-pact/foundations-before-zero");

    await act(async () => {
      root.render(
        <LessonReaderHost
          course={COURSE}
          studyId="turing-pact"
          unitId="what-is-an-app"
          lessonId="you-already-know-apps"
          onBack={onBack}
          onSettled={() => undefined}
          onFollowLink={() => undefined}
        />,
      );
    });
    expect(container.querySelector("nav")).toBeNull();
    await act(async () => {
      container.querySelector<HTMLButtonElement>(".lesson-toolbar__close")?.click();
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
