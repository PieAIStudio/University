// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const playSound = vi.hoisted(() => vi.fn());

vi.mock("../sound/index.js", () => ({
  playSound,
}));

import type {
  CourseReviewCardLocator,
  PriorAttempt,
  RecapReviewCardLocator,
} from "../view/lesson-view.js";
import type { ReviewCardPort, ReviewRatingPreview } from "./ports.js";
import { ReviewCard } from "./ReviewCard.js";

const CARD: RecapReviewCardLocator = {
  kind: "recap-card",
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "what-is-an-app",
  lessonId: "you-already-know-apps",
  cardId: "__recap__",
  front: "我能说出使用 App 和开发 App 的差别。",
  contentRevision: 1,
};

const COURSE_CARD: CourseReviewCardLocator = {
  kind: "course-card",
  studyId: CARD.studyId,
  courseId: CARD.courseId,
  unitId: CARD.unitId,
  lessonId: CARD.lessonId,
  cardId: "app-is-a-program",
  front: "App 是什么？",
  contentRevision: 1,
};

const HISTORY: PriorAttempt = {
  answer: "第一次复述。",
  revealedAt: "2026-08-25T00:00:00.000Z",
  contentRevision: 1,
};

const PREVIEW: ReviewRatingPreview = {
  again: 60_000,
  hard: 6 * 60_000,
  good: 10 * 60_000,
  easy: 8 * 86_400_000,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  playSound.mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function buttonWith(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(text),
  );
}

function setTextareaValue(value: string): void {
  const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
  if (!textarea) throw new Error("复述输入框没有渲染");
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

async function openRatingHelp(): Promise<HTMLElement> {
  const help = [...container.querySelectorAll<HTMLElement>(".rating-row .tip-trigger")].find(
    (element) => element.textContent?.includes("这四个按钮是什么意思？"),
  );
  if (!help) throw new Error("评分帮助没有渲染");
  await act(async () => help.click());
  const panel = document.body.querySelector<HTMLElement>(".tip-panel");
  if (!panel) throw new Error("评分帮助没有打开");
  return panel;
}

describe("ReviewCard recap path", () => {
  it("shows the same question, compares text history, and self-rates without a reference answer", async () => {
    const reveal = vi.fn<ReviewCardPort["reveal"]>(async () => ({
      back: null,
      priorAttempts: [HISTORY],
    }));
    const rate = vi.fn<ReviewCardPort["rate"]>(async () => ({
      dueAt: "2026-08-27T00:00:00.000Z",
    }));
    const onReviewed = vi.fn(async () => undefined);

    await act(async () => {
      root.render(
        <ReviewCard
          card={CARD}
          review={{ preview: () => PREVIEW, reveal, rate }}
          onReviewed={onReviewed}
        />,
      );
    });

    expect(container.textContent).toContain("讲一遍");
    expect(container.textContent).toContain(CARD.front);
    expect(container.textContent).toContain("请用自己的话，讲给一个完全不知道这件事的人听。");
    expect(container.querySelector("textarea")?.getAttribute("placeholder")).toBe(
      "在这里写你的复述……",
    );

    setTextareaValue("第二次复述。");
    await act(async () => {
      buttonWith("查看以前的复述")?.click();
    });

    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal.mock.calls[0]?.[1].answer).toBe("第二次复述。");
    expect(container.textContent).toContain("这次复述");
    expect(container.textContent).toContain("第二次复述。");
    expect(container.textContent).toContain("以前的复述（1 次）");
    expect(container.textContent).toContain("第一次复述。");
    expect(container.textContent).not.toContain("参考答案");
    expect(container.textContent).not.toContain("让 AI 讲讲这张卡");
    expect(container.textContent).toContain("重来");
    expect(container.textContent).toContain("困难");
    expect(container.textContent).toContain("良好");
    expect(container.textContent).toContain("简单");
    expect(buttonWith("重来 · 1 分钟")).toBeTruthy();
    expect(buttonWith("困难 · 6 分钟")).toBeTruthy();
    expect(buttonWith("良好 · 10 分钟")).toBeTruthy();
    expect(buttonWith("简单 · 8 天")).toBeTruthy();

    const help = await openRatingHelp();
    expect(help.textContent).toContain("这不是判对错");
    expect(help.textContent).not.toContain("参考答案");

    await act(async () => {
      buttonWith("简单")?.click();
    });

    expect(rate).toHaveBeenCalledWith(CARD, 4);
    expect(container.textContent).toContain("复习结果已保存");
    expect(onReviewed).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledWith("review.graded");
  });

  it("keeps the reference-answer guidance on an ordinary course card", async () => {
    const reveal = vi.fn<ReviewCardPort["reveal"]>(async () => ({
      back: "一段参考答案。",
    }));
    const rate = vi.fn<ReviewCardPort["rate"]>(async () => ({
      dueAt: "2026-08-27T00:00:00.000Z",
    }));

    await act(async () => {
      root.render(
        <ReviewCard
          card={COURSE_CARD}
          review={{ preview: () => PREVIEW, reveal, rate }}
          onReviewed={async () => undefined}
        />,
      );
    });

    setTextareaValue("我的回答。");
    await act(async () => {
      buttonWith("揭示答案")?.click();
    });

    expect(buttonWith("重来 · 1 分钟")).toBeTruthy();
    expect(buttonWith("困难 · 6 分钟")).toBeTruthy();
    expect(buttonWith("良好 · 10 分钟")).toBeTruthy();
    expect(buttonWith("简单 · 8 天")).toBeTruthy();

    const help = await openRatingHelp();
    expect(help.textContent).toContain("这不是判对错");
    expect(help.textContent).toContain("参考答案");
  });
});
