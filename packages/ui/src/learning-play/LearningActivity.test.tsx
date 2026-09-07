// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectActivity, TuneActivity } from "@pieai/university-core";
import { LearningActivity } from "./LearningActivity.js";
import { getBaseExamples } from "./base-examples.js";
import { getAIBriefExamples } from "./ai-brief-examples.js";

let container: HTMLDivElement;
let root: Root;
const click = async (label: string) => {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) =>
      candidate.textContent?.trim() === label || candidate.getAttribute("aria-label") === label,
  );
  expect(button, label).toBeDefined();
  await act(async () => button!.click());
};
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("activity host evidence boundary", () => {
  it("only reports a completed round once and preserves attempts and hints", async () => {
    const onResult = vi.fn();
    const original = getBaseExamples().find(
      (activity): activity is TuneActivity => activity.kind === "tune",
    )!;
    const activity: TuneActivity = {
      ...original,
      controls: original.controls.map((control) => ({
        ...control,
        initial: control.id === "width" ? 1000 : 65,
      })),
    };
    await act(async () =>
      root.render(<LearningActivity activity={activity} onResult={onResult} />),
    );
    await click("给我一个线索");
    await click("记录这次实验");
    await click("记录这次实验");
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0]![0]).toMatchObject({
      status: "completed",
      attempts: 1,
      hintsUsed: 1,
      submission: { parameters: { width: 1000, quality: 65 } },
    });
    await click("重新开始");
    expect(container.querySelector('[data-result="completed"]')).toBeNull();
    await click("记录这次实验");
    expect(onResult).toHaveBeenCalledTimes(2);
    expect(onResult.mock.calls[1]![0]).toMatchObject({ hintsUsed: 0, attempts: 1 });
  });
  it("skip never becomes success, and activity changes reset the round", async () => {
    const onResult = vi.fn();
    const examples = getBaseExamples();
    await act(async () =>
      root.render(<LearningActivity activity={examples[0]!} onResult={onResult} />),
    );
    await click("先跳过");
    expect(onResult.mock.calls[0]![0]).toMatchObject({ status: "skipped", attempts: 0 });
    await act(async () =>
      root.render(<LearningActivity activity={examples[1]!} onResult={onResult} />),
    );
    expect(container.querySelector('[data-result="skipped"]')).toBeNull();
    expect(container.querySelectorAll(".play-connect__node")).toHaveLength(6);
  });
  it("cancels an in-flight signal when skipped, without a late completion", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const onResult = vi.fn();
    const activity = getBaseExamples()[0] as ConnectActivity;
    await act(async () =>
      root.render(<LearningActivity activity={activity} onResult={onResult} />),
    );
    for (const edge of activity.edges) {
      await click(activity.nodes.find((node) => node.id === edge.from)!.label);
      await click(activity.nodes.find((node) => node.id === edge.to)!.label);
    }
    await click("放出测试信号");
    await click("先跳过");
    await act(async () => vi.runAllTimers());
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0]![0].status).toBe("skipped");
  });
  it("exposes a useful AI handoff only after real product acceptance, with a copy fallback", async () => {
    const onResult = vi.fn();
    const writeText = vi
      .fn()
      .mockRejectedValueOnce(new Error("Clipboard unavailable"))
      .mockResolvedValue(undefined);
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    try {
      await act(async () =>
        root.render(<LearningActivity activity={getAIBriefExamples()[0]!} onResult={onResult} />),
      );
      expect(container.textContent).toContain("预设 AI 案例");
      await click("访客可提交");
      await click("先等审核");
      await click("仅组织者可见");
      await click("验收这份任务单");
      expect(onResult).not.toHaveBeenCalled();
      expect(container.querySelector(".learning-activity__handoff")).toBeNull();
      await click("申请参加");
      await click("看看名单");
      await click("验收这份任务单");
      expect(onResult).not.toHaveBeenCalled();
      expect(container.textContent).toContain("客户的临时变更");
      await click("立即确认名额");
      await click("同样提交一次");
      await click("同样查看名单");
      await click("验收这份任务单");
      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult.mock.calls[0]![0]).toMatchObject({
        status: "completed",
        attempts: 2,
        submission: { handoff: expect.stringContaining("审核前不占名额") },
      });
      const artifact = container.querySelector(".learning-activity__handoff pre")!.textContent;
      expect(artifact).toContain("实际操作验证");
      await click("复制这份工作单");
      expect(container.textContent).toContain("可以直接选中下面的文字");
      expect(writeText).toHaveBeenCalledWith(artifact);
      await click("复制这份工作单");
      expect(container.textContent).toContain("已复制");
      expect(container.textContent).not.toContain("复制未完成");
      await click("重新开始");
      expect(container.querySelector(".learning-activity__handoff")).toBeNull();
      await click("先跳过");
      expect(container.querySelector(".learning-activity__handoff")).toBeNull();
    } finally {
      if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });
});
