// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMemoryPersistence,
  createProgressPort,
  recapCardKeyOf,
  type ProgressPort,
} from "@pieai/university-core";

import { RecapPrompt } from "./RecapPrompt.js";

const LOCATOR = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "what-is-an-app",
  lessonId: "you-already-know-apps",
} as const;

let container: HTMLDivElement;
let root: Root;
let progress: ProgressPort;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  progress = createProgressPort({ persistence: createMemoryPersistence() });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function setTextareaValue(value: string): void {
  const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
  if (!textarea) throw new Error("复述输入框没有渲染");
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("RecapPrompt", () => {
  it("renders the final text-first prompt and keeps voice input out", async () => {
    await act(async () => {
      root.render(
        <RecapPrompt
          locator={LOCATOR}
          unitObjective="我能说出使用 App 和开发 App 的差别。"
          contentRevision={2}
          progress={progress}
        />,
      );
    });

    expect(container.textContent).toContain("讲一遍");
    expect(container.textContent).toContain("请用自己的话，讲给一个完全不知道这件事的人听。");
    expect(container.textContent).toContain("我能说出使用 App 和开发 App 的差别。");
    expect(container.querySelector("textarea")?.getAttribute("placeholder")).toBe(
      "在这里写你的复述……",
    );
    expect(container.textContent).toContain("保存为复习卡");
    expect(container.textContent).toContain("语音输入：还在设计");
    expect(container.querySelector("button[aria-label*='语音']")).toBeNull();
    expect(progress.recapCard(LOCATOR)).toBeNull();
  });

  it("writes one answer to the shared progress document and then shows saved state", async () => {
    const onSaved = vi.fn(async () => undefined);
    await act(async () => {
      root.render(
        <RecapPrompt
          locator={LOCATOR}
          unitObjective="我能说出使用 App 和开发 App 的差别。"
          contentRevision={2}
          progress={progress}
          onSaved={onSaved}
        />,
      );
    });

    setTextareaValue("我能用自己的话讲清楚。 ");
    await act(async () => {
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent?.includes("保存为复习卡"))
        ?.click();
    });

    const card = progress.recapCard(LOCATOR);
    expect(card).toMatchObject({
      kind: "recap-card",
      cardKey: recapCardKeyOf(LOCATOR),
      contentRevision: 2,
    });
    expect(progress.retrievalAttempts(recapCardKeyOf(LOCATOR))).toEqual([
      expect.objectContaining({ answer: "我能用自己的话讲清楚。 " }),
    ]);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("复习卡已保存");
    expect(container.textContent).toContain("到期时它会回来，请再讲一遍。");
    expect(container.querySelector("textarea")).toBeNull();
  });
});
