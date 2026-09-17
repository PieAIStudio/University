// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  localizeActivity,
  type InteractionPathActivity,
  type ExperimentStep,
} from "@pieai/university-core";
import fixture from "../../../core/fixtures/interaction-path-v2.json";
import { I18nProvider } from "../i18n/index.js";
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
async function click(label: string) {
  const button = buttons().find(
    (item) => item.textContent === label || item.getAttribute("aria-label") === label,
  );
  expect(button, label).toBeTruthy();
  expect(button!.disabled, label).toBe(false);
  await act(async () => {
    button!.focus();
    button!.click();
  });
  return button!;
}
async function render(
  activity: InteractionPathActivity = fixture as InteractionPathActivity,
  scope = "account:lesson:1:zh-CN",
) {
  const report = vi.fn();
  const next = vi.fn();
  await act(async () =>
    root.render(
      <LearningActivity
        activity={activity}
        occurrenceId={scope}
        onResult={report}
        onNext={next}
        reviewContent={<p>完整复习文字</p>}
      />,
    ),
  );
  return { report, next };
}
const commit = () => click("确认，看看结果");
async function toExperiment() {
  await click("按 Enter 或空格");
  await commit();
  await click("下一轮");
}
const preview = () => container.querySelector(".path-experiment__preview");
const feedback = () => container.querySelector(".interaction-path__feedback");

describe("material-first shared path", () => {
  it("explains a wrong attempt without claiming its successful example already happened", async () => {
    const activity = structuredClone(fixture) as InteractionPathActivity;
    const step = activity.steps[0]!;
    if (step.kind !== "decision") throw new Error("The fixture starts with a decision");
    const wrong = step.options.find((option) => option.id !== step.correctOptionId)!;
    const correct = step.options.find((option) => option.id === step.correctOptionId)!;
    await render(activity);
    await click(wrong.label);
    await commit();
    expect(feedback()?.textContent).toContain(wrong.explanation);
    expect(feedback()?.textContent).not.toContain(step.explanation);
    await click("修改这次选择");
    await click(correct.label);
    await commit();
    expect(feedback()?.textContent).toContain(step.explanation);
  });

  it("presents the teacher bridge and needed material before the dependent choice", async () => {
    const activity = structuredClone(fixture) as InteractionPathActivity;
    const withBridges = {
      ...activity,
      steps: activity.steps.map((step, index) => ({
        ...step,
        brief:
          index === 0
            ? "先看键盘说明，再试着提交一次预约。"
            : "已有一次尝试，现在改变一个条件看看。",
      })),
    };
    await render(withBridges);
    const bridge = container.querySelector(".interaction-path__bridge")!;
    const material = container.querySelector('[data-material-id="keyboard-note"]')!;
    const question = container.querySelector(".interaction-path__task h2")!;
    const choices = container.querySelector(".interaction-path__choices")!;
    const before = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(before(bridge, material)).toBe(true);
    expect(before(material, question)).toBe(true);
    expect(before(question, choices)).toBe(true);
    expect(question.getAttribute("aria-describedby")).toBe(bridge.id);
    await toExperiment();
    expect(container.querySelector(".interaction-path__bridge")?.textContent).toBe(
      "已有一次尝试，现在改变一个条件看看。",
    );
    expect(document.activeElement).toBe(container.querySelector(".interaction-path__task h2"));
  });

  it("puts context, task, source and current material on the path, with later recall and optional source details", async () => {
    const { report, next } = await render();
    const context = container.querySelector(".path-materials__context")!;
    expect(context.closest("details")).toBeNull();
    expect(context.textContent).toContain(fixture.context.introduction);
    expect(context.textContent).toContain(fixture.context.task);
    const question = container.querySelector(".interaction-path__task h2")!;
    expect(
      context.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.querySelector('[data-material-id="keyboard-note"]')?.textContent).toContain(
      fixture.materials[0]!.text,
    );
    expect(container.querySelector('[data-material-id="draft-note"]')).toBeNull();
    expect(container.querySelector<HTMLAnchorElement>(".path-materials a")?.href).toBe(
      fixture.source.url,
    );
    expect(container.querySelector<HTMLDetailsElement>(".interaction-path__source")?.open).toBe(
      false,
    );
    expect(buttons().some((button) => button.textContent === "按 Enter 或空格")).toBe(true);
    await click("先去独立练习");
    expect(next).toHaveBeenCalledOnce();
    expect(report).not.toHaveBeenCalled();
    await toExperiment();
    expect(container.querySelector<HTMLDetailsElement>(".path-materials__recall")?.open).toBe(
      false,
    );
    expect(container.querySelectorAll("[data-material-id]")).toHaveLength(2);
    expect(container.querySelector('[data-material-id="draft-note"]')?.textContent).toContain(
      "教学草稿",
    );
    const details = container.querySelector(".interaction-path__source")!;
    expect(details.textContent).toContain(fixture.sources[0]!.limitation);
    expect(details.textContent).toContain(fixture.sources[0]!.summary);
    expect(details.textContent).toContain(fixture.sources[0]!.date);
  });

  it("previews each current preset, requires explicit submission and keeps focus on reversible controls", async () => {
    const { report } = await render();
    await toExperiment();
    expect(preview()?.textContent).toContain("等待按键");
    expect(container.querySelector('[data-control-id="focus"]')?.getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(container.textContent).not.toContain("焦点已经就位，还需要按键触发。");
    await commit();
    expect(feedback()?.getAttribute("data-passed")).toBe("false");
    expect(document.activeElement).toBe(feedback());
    const control = await click("按下 Enter");
    expect(document.activeElement).toBe(control);
    expect(preview()?.textContent).toContain("Enter 触发了一次预约提交");
    expect(feedback()).toBeNull();
    expect(container.textContent).not.toContain("焦点和按键一起满足了当前模拟的提交条件。");
    expect(container.querySelector("[data-passed], [data-outcome='fits']")).toBeNull();
    await commit();
    expect(feedback()?.getAttribute("data-passed")).toBe("true");
    await click("按下 Enter");
    expect(document.activeElement).toBe(control);
    expect(control.getAttribute("aria-pressed")).toBe("false");
    expect(feedback()).toBeNull();
    expect(buttons().some((button) => button.textContent === "下一轮")).toBe(false);
    await commit();
    expect(feedback()?.getAttribute("data-passed")).toBe("false");
    expect(report).not.toHaveBeenCalled();
    await click("按下 Enter");
    await commit();
    await click("下一轮");
    expect(document.activeElement?.tagName).toBe("H2");
    await click("确认焦点在取消按钮上，再按键");
    await commit();
    await click("回顾这次的方法");
    expect(report).toHaveBeenCalledOnce();
    const result = report.mock.calls[0]![0];
    expect(result.submission.independentMastery).toBe(false);
    expect(result.guidanceUsed).toBe(true);
    expect(result.submission).not.toHaveProperty("handoff");
    expect(result.submission.recap).toBe(fixture.takeaway);
    expect(container.querySelector(".path-artifact")).toBeNull();
    expect(
      result.submission.evidence.attempts
        .filter((attempt: { stepId: string }) => attempt.stepId === "try-conditions")
        .map((attempt: { passed: boolean }) => attempt.passed),
    ).toEqual([false, true, false, true]);
  });

  it("initializes and resets an experiment-first path, including an empty accepted selection", async () => {
    const activity = structuredClone(fixture) as InteractionPathActivity;
    const experiment = activity.steps[1] as ExperimentStep;
    experiment.initialControlIds = [];
    experiment.cases[0]!.accepted = true;
    activity.steps = [experiment, activity.steps[0]!, activity.steps[2]!];
    await render(activity);
    expect(preview()?.textContent).toContain("没有焦点，也没有按键");
    await click("给我一点提示");
    await commit();
    expect(feedback()?.getAttribute("data-passed")).toBe("true");
    expect(container.querySelector(".interaction-path__receipt")?.textContent).toContain(
      "首答符合 0 轮",
    );
    await click("焦点在预约按钮上");
    await click("从头再练（保留本次记录）");
    expect(preview()?.textContent).toContain("没有焦点，也没有按键");
    expect(container.querySelector(".interaction-path__receipt")?.textContent).toContain(
      "共提交 1 次",
    );
    expect(container.querySelector(".interaction-path__receipt")?.textContent).toContain(
      "重开 1 次",
    );
    await render(activity, "different-account:lesson:2:en");
    expect(container.querySelector(".interaction-path__receipt")?.textContent).toContain(
      "共提交 0 次",
    );
  });

  it("finishes without an artifact using a method recap and never claims independent mastery", async () => {
    const activity = structuredClone(fixture) as InteractionPathActivity;
    activity.steps[1] = { ...activity.steps[0]!, id: "recheck", phase: "practice" };
    const { report } = await render(activity);
    await toExperiment();
    await click("按 Enter 或空格");
    await commit();
    await click("下一轮");
    await click("确认焦点在取消按钮上，再按键");
    await commit();
    await click("回顾这次的方法");
    expect(container.querySelector(".interaction-path__recap")?.textContent).toContain(
      activity.takeaway,
    );
    expect(container.querySelector(".path-artifact")).toBeNull();
    expect(buttons().some((button) => button.textContent === "复制作品")).toBe(false);
    expect(container.textContent).not.toContain("你刚刚完成的作品");
    expect(report).toHaveBeenCalledOnce();
    expect(report.mock.calls[0]![0].submission).toMatchObject({
      recap: activity.takeaway,
      independentMastery: false,
    });
    expect(report.mock.calls[0]![0].submission).not.toHaveProperty("handoff");
    expect(container.textContent).toContain("独立试试");
  });

  it("localizes context, material and simulation, treats source copy as plain text and keeps lesson image credits", async () => {
    const activity = localizeActivity(fixture as InteractionPathActivity, "en");
    activity.materials![0]!.text = "<em>Source text, not HTML</em>";
    activity.assetId = "original-image";
    await act(async () =>
      root.render(
        <I18nProvider locale="en">
          <LearningActivity
            activity={activity}
            assets={[
              {
                id: "original-image",
                kind: "authorized-external",
                mime: "image/jpeg",
                url: "/content/original.jpg",
                alt: "Original booking screen",
                attribution: "Original image credit",
              },
            ]}
          />
        </I18nProvider>,
      ),
    );
    expect(container.querySelector(".path-materials__context")?.textContent).toContain(
      "Someone books without a mouse",
    );
    expect(container.querySelector(".path-materials__text")?.textContent).toBe(
      "<em>Source text, not HTML</em>",
    );
    expect(container.querySelector(".path-materials em")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("Original booking screen");
    expect(container.querySelector(".interaction-path__image figcaption")?.textContent).toBe(
      "Original image credit",
    );
    expect(container.querySelector(".interaction-path__source")?.textContent).toContain(
      "Original image credit",
    );
    await click("Press Enter or Space");
    await click("Confirm and reveal");
    await click("Next round");
    expect(container.querySelector(".path-experiment__note")?.textContent).toContain(
      "does not operate a real booking page or call AI",
    );
    await click("Press Enter");
    expect(preview()?.textContent).toContain("Booking submitted (simulation)");
  });
});
