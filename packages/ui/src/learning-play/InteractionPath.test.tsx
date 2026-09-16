// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityResult, InteractionPathActivity } from "@pieai/university-core";
import fixture from "../../../core/fixtures/interaction-path.json";
import { LearningActivity } from "./LearningActivity.js";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
const buttons = () => [...container.querySelectorAll<HTMLButtonElement>("button")];
async function click(text: string) {
  const button = buttons().find(
    (item) => item.textContent === text || item.getAttribute("aria-label") === text,
  );
  expect(button, text).toBeTruthy();
  expect(button!.disabled, text).toBe(false);
  await act(async () => button!.click());
}
async function render(scope = "account:lesson:1:zh-CN", onResult = vi.fn()) {
  await act(async () =>
    root.render(
      <LearningActivity
        activity={fixture as InteractionPathActivity}
        occurrenceId={scope}
        onResult={onResult}
        reviewContent={<p>完整复习文字</p>}
      />,
    ),
  );
  return onResult;
}
const commit = () => click("确认，看看结果");
async function throughDecisions() {
  await click("能，按 Enter 或空格");
  await commit();
  await click("下一轮");
  await click("焦点在按钮上时，Enter 和空格都能触发按钮。");
  await commit();
  await click("下一轮");
  await click("下一轮的问题标题");
  await commit();
  await click("下一轮");
}

describe("shared interaction path host", () => {
  it("hides explanations, records wrong/revised answers and moves focus on reveal/next", async () => {
    const report = await render();
    expect(container.textContent).not.toContain("鼠标不是提交的必要条件");
    await click("不能，必须点击鼠标");
    await commit();
    expect(document.activeElement).toBe(container.querySelector('[role="status"]'));
    expect(container.textContent).toContain("鼠标不是提交的必要条件");
    expect(report).not.toHaveBeenCalled();
    await click("修改这次选择");
    await click("能，按 Enter 或空格");
    await commit();
    await click("下一轮");
    expect(document.activeElement?.tagName).toBe("H2");
    expect(container.querySelector(".interaction-path__receipt")?.textContent).toContain(
      "首答符合 0 轮",
    );
    await click("从头再练（保留本次记录）");
    expect(container.querySelector(".interaction-path__receipt")?.textContent).toContain(
      "共提交 2 次",
    );
  });
  it("supports repair/remove/reorder, completes with honest evidence and resets on scope change", async () => {
    const report = await render();
    await throughDecisions();
    expect(container.querySelectorAll(".interaction-path__assembly li")).toHaveLength(2);
    await commit();
    expect(container.textContent).toContain("没有实际检查，不能把结果写成通过");
    await click("修改这次选择");
    await click("移除：不用检查，直接说测试通过。");
    await click("检查 Enter 和空格都能触发提交。");
    await click("完成后请报告实际检查结果。");
    await click("调整顺序");
    await click("上移：完成后请报告实际检查结果。");
    await commit();
    await click("带走我的作品");
    const result = report.mock.calls[0]![0] as ActivityResult;
    expect(result.guidanceUsed).toBe(true);
    expect(result.submission.independentMastery).toBe(false);
    expect(result.attempts).toBe(5);
    expect(result.submission.handoff).toContain("实际检查结果");
    await render("other-account:other-lesson:2:en", report);
    expect(container.textContent).toContain("第 1 / 4 轮");
    expect(container.textContent).toContain("共提交 0 次");
    expect(container.querySelector("[data-result]")).toBeNull();
  });
  it("records optional help and prior full-text exposure", async () => {
    await render();
    await click("给我一点提示");
    const review = container.querySelector<HTMLDetailsElement>(".interaction-path__review")!;
    await act(async () => {
      review.open = true;
      review.dispatchEvent(new Event("toggle"));
    });
    await click("能，按 Enter 或空格");
    await commit();
    expect(container.querySelector(".interaction-path__receipt")?.textContent).toContain(
      "首答符合 0 轮",
    );
    expect(container.textContent).toContain("本次已打开完整讲解");
  });
  it("lets the actual artifact grow, keeps reorder optional and preserves selected feedback", async () => {
    await render();
    await click("能，按 Enter 或空格");
    expect(
      container.querySelector('[data-selected="true"]')?.getAttribute("data-outcome"),
    ).toBeNull();
    await commit();
    expect(container.querySelector('[data-outcome="fits"]')).not.toBeNull();
    await click("下一轮");
    await click("焦点在按钮上时，Enter 和空格都能触发按钮。");
    await commit();
    await click("下一轮");
    await click("下一轮的问题标题");
    await commit();
    await click("下一轮");
    expect(
      container
        .querySelector(".path-workbench > :first-child")
        ?.classList.contains("path-artifact"),
    ).toBe(true);
    expect(buttons().some((button) => button.textContent === "上移")).toBe(false);
    await click("检查 Enter 和空格都能触发提交。");
    expect(container.querySelector(".interaction-path__assembly")?.textContent).toContain(
      "检查 Enter 和空格",
    );
    expect(container.querySelector('[data-piece][aria-pressed="true"]')).not.toBeNull();
    await click("移除：检查 Enter 和空格都能触发提交。");
    expect(container.querySelector(".interaction-path__assembly")?.textContent).not.toContain(
      "检查 Enter 和空格",
    );
    expect(document.activeElement?.getAttribute("data-piece")).not.toBeNull();
  });
  it("shows the actual source beside a draft and resets a changed activity within one occurrence", async () => {
    const activity = structuredClone(fixture) as InteractionPathActivity;
    const step = activity.steps[1]!;
    if (step.kind !== "evidence") throw new Error("fixture");
    step.task = "unsupported";
    step.material.reference = { label: "来源记录", text: "来源说明按钮可以用键盘触发。" };
    await act(async () =>
      root.render(<LearningActivity activity={activity} occurrenceId="fixed-slot" />),
    );
    await click("能，按 Enter 或空格");
    await commit();
    await click("下一轮");
    expect(container.querySelector(".interaction-path__reference")?.textContent).toContain(
      "来源说明按钮可以用键盘触发。",
    );
    await act(async () =>
      root.render(
        <LearningActivity
          activity={{ ...activity, id: "new-definition" }}
          occurrenceId="fixed-slot"
        />,
      ),
    );
    expect(container.textContent).toContain("第 1 / 4 轮");
    expect(container.textContent).toContain("共提交 0 次");
  });
  it("shows the lesson image, preserves work during exercise navigation and carries an earlier artifact into the final decision", async () => {
    const activity = structuredClone(fixture) as InteractionPathActivity;
    const extended = {
      ...activity,
      assetId: "scene",
      steps: [...activity.steps, { ...activity.steps[0]!, id: "transfer" }],
    };
    const report = vi.fn();
    const next = vi.fn();
    const progress = vi.fn();
    await act(async () =>
      root.render(
        <LearningActivity
          activity={extended}
          occurrenceId="transfer-visit"
          onResult={report}
          onNext={next}
          onPathProgress={progress}
          assets={[
            {
              id: "scene",
              kind: "authorized-external",
              mime: "image/jpeg",
              url: "/content/assets/example.jpg",
              alt: "可观察的场景",
              attribution: "Original source credit",
            },
          ]}
        />,
      ),
    );
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("可观察的场景");
    expect(container.querySelector<HTMLDetailsElement>(".interaction-path__source")?.open).toBe(
      false,
    );
    await click("先去独立练习");
    expect(next).toHaveBeenCalledOnce();
    expect(report).not.toHaveBeenCalled();
    await throughDecisions();
    await click("移除：不用检查，直接说测试通过。");
    await click("完成后请报告实际检查结果。");
    await click("检查 Enter 和空格都能触发提交。");
    await commit();
    await click("下一轮");
    expect(container.querySelector("[data-result]")).toBeNull();
    await click("能，按 Enter 或空格");
    await commit();
    await click("带走我的作品");
    expect(report).toHaveBeenCalledOnce();
    expect(report.mock.calls[0]![0].submission.handoff).toContain("检查 Enter 和空格");
    expect(progress).toHaveBeenLastCalledWith(5);
    expect(container.querySelectorAll(".interaction-path__image-review")).toHaveLength(0);
    expect(container.querySelectorAll(".path-artifact")).toHaveLength(1);
  });
});
