// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const playSound = vi.hoisted(() => vi.fn());

vi.mock("../sound/index.js", () => ({
  playSound,
}));

import type { PriorAttempt, RecapReviewCardLocator } from "../view/lesson-view.js";
import type { ReviewCardPort } from "./ports.js";
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

const HISTORY: PriorAttempt = {
  answer: "第一次复述。",
  revealedAt: "2026-08-25T00:00:00.000Z",
  contentRevision: 1,
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
      root.render(<ReviewCard card={CARD} review={{ reveal, rate }} onReviewed={onReviewed} />);
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

    await act(async () => {
      buttonWith("简单")?.click();
    });

    expect(rate).toHaveBeenCalledWith(CARD, 4);
    expect(container.textContent).toContain("复习结果已保存");
    expect(onReviewed).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledWith("review.graded");
  });
});
