// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExerciseAttemptResult, GradingPort, LessonRef } from "@pieai/university-core";

import { ExerciseBlock } from "./ExerciseBlock.js";
import type { LessonView } from "../view/lesson-view.js";

const LOCATOR: LessonRef = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "what-is-an-app",
  lessonId: "why-though",
};

const EXERCISE: LessonView["lesson"]["exercises"][number] = {
  id: "explain",
  kind: "explain",
  title: "讲清楚",
  prompt: "为什么？",
  contentRevision: 1,
  hostGrade: null,
  latestSubmission: null,
};

const TIER_ONE_RESULT: ExerciseAttemptResult = {
  correct: false,
  attemptCount: 1,
  score: 0,
  maxScore: 1,
  awaitingHostGrade: false,
  meteredEligible: true,
  hostGrade: {
    passed: false,
    evaluation: "再看一眼你刚才读过的这句：\n\n> 这一段会说明为什么。",
    extensions: [],
    host: "tier-1",
    learnerAnswer: "我的理解是另一回事。",
    occurredAt: "2026-08-27T00:00:00.000Z",
  },
};

const TIER_TWO_RESULT: ExerciseAttemptResult = {
  ...TIER_ONE_RESULT,
  attemptCount: 2,
  score: 1,
  meteredEligible: false,
  hostGrade: {
    ...TIER_ONE_RESULT.hostGrade!,
    passed: true,
    evaluation: "你的解释抓住了关键关系。",
    host: "tier-2",
  },
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
    };
  }
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function buttonWith(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
    button.textContent?.includes(text),
  );
}

async function renderBlock(grading: GradingPort) {
  await act(async () => {
    root.render(
      <ExerciseBlock
        locator={LOCATOR}
        exercise={EXERCISE}
        grading={grading}
        onRefresh={async () => undefined}
      />,
    );
  });
}

async function answerAndSubmit() {
  const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
  if (!textarea) throw new Error("missing answer field");
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (!setter) throw new Error("missing textarea value setter");
    setter.call(textarea, "我的理解是另一回事。");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const submit = buttonWith("提交");
  if (!submit) throw new Error("missing submit button");
  await act(async () => {
    submit.click();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("ExerciseBlock metered grading choice", () => {
  it("shows the wallet cost before an explicit paid choice, while keeping tier one reachable", async () => {
    const submitExercise = vi
      .fn<GradingPort["submitExercise"]>()
      .mockResolvedValueOnce(TIER_ONE_RESULT)
      .mockResolvedValueOnce(TIER_TWO_RESULT);
    const meteredGradingOffer = vi.fn(async () => ({
      kind: "available" as const,
      costPowerUnits: "100",
      availablePowerUnits: "900",
    }));
    const grading: GradingPort = { submitExercise, meteredGradingOffer };

    await renderBlock(grading);
    await answerAndSubmit();

    expect(submitExercise.mock.calls[0]?.[0].allowMetered).toBe(false);
    expect(meteredGradingOffer).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("这次会使用 1 次");
    expect(container.textContent).toContain("你的钱包还够 9 次");
    expect(container.textContent).toContain("只有点“使用 AI 批改”才会从钱包扣除这次批改");
    expect(container.textContent).not.toContain("power units");
    expect(buttonWith("只看 tier‑1 免费提示（不使用钱包）")).toBeTruthy();

    await act(async () => {
      buttonWith("只看 tier‑1 免费提示（不使用钱包）")?.click();
    });
    expect(container.textContent).toContain("已选择 tier‑1 免费提示（不使用钱包）");
    expect(submitExercise).toHaveBeenCalledTimes(1);

    await act(async () => {
      buttonWith("使用 AI 批改（使用 1 次）")?.click();
    });
    expect(submitExercise.mock.calls[1]?.[0].allowMetered).toBe(true);
    expect(submitExercise.mock.calls[1]?.[0].meteredFunding).toBe("wallet");
    expect(container.textContent).toContain("AI 评估 · 通过 · tier-2");
  });

  it("explains that an available daily free offer does not spend the wallet", async () => {
    const submitExercise = vi
      .fn<GradingPort["submitExercise"]>()
      .mockResolvedValueOnce(TIER_ONE_RESULT)
      .mockResolvedValueOnce(TIER_TWO_RESULT);
    const meteredGradingOffer = vi.fn(async () => ({
      kind: "free" as const,
      costPowerUnits: "100",
      remainingPowerUnits: "300",
      resetsAt: "2026-08-28T00:00:00.000Z",
    }));
    const grading: GradingPort = { submitExercise, meteredGradingOffer };

    await renderBlock(grading);
    await answerAndSubmit();

    expect(container.textContent).toContain("今天的免费 AI 批改还可用");
    expect(container.textContent).toContain("今天免费 AI 批改里的 1 次");
    expect(container.textContent).toContain("今天还剩 3 次");
    expect(container.textContent).toContain("不会扣钱包");
    expect(container.textContent).not.toContain("power units");
    expect(container.textContent).not.toContain("钱包还剩");
    expect(buttonWith("使用今日免费 AI 批改（使用 1 次）")).toBeTruthy();
    expect(buttonWith("只看 tier‑1 免费提示（不占今天的免费次数）")).toBeTruthy();

    await act(async () => {
      buttonWith("使用今日免费 AI 批改（使用 1 次）")?.click();
    });

    expect(submitExercise.mock.calls[1]?.[0].allowMetered).toBe(true);
    expect(submitExercise.mock.calls[1]?.[0].meteredFunding).toBe("free");
    expect(container.textContent).toContain("AI 评估 · 通过 · tier-2");
  });

  it("keeps the explanation and free choice visible when the quote is unavailable", async () => {
    const grading: GradingPort = {
      submitExercise: vi.fn(async () => TIER_ONE_RESULT),
      meteredGradingOffer: vi.fn(async () => ({
        kind: "unavailable" as const,
        costPowerUnits: "100",
        availablePowerUnits: "50",
        explanation: {
          kind: "explanation" as const,
          title: "AI 语义批改服务还没接通",
          whatItDoes: "它会给开放题提供额外的结构化评估。",
          whyUnavailable: "当前服务还没有配置；免费提示仍然可用。",
          futureSupport: "服务部署后再读取。",
        },
      })),
    };

    await renderBlock(grading);
    await answerAndSubmit();

    expect(container.textContent).toContain("AI 语义批改服务还没接通");
    expect(container.textContent).toContain("你的钱包还不够一次了");
    expect(container.textContent).not.toContain("0 次");
    expect(buttonWith("查看 AI 批改说明")).toBeTruthy();
    expect(buttonWith("只看 tier‑1 免费提示（不使用钱包）")).toBeTruthy();
  });

  it("opens the shared explanation and links anonymous learners to email binding", async () => {
    const grading: GradingPort = {
      submitExercise: vi.fn(async () => TIER_ONE_RESULT),
      meteredGradingOffer: vi.fn(async () => ({
        kind: "unavailable" as const,
        costPowerUnits: "100",
        availablePowerUnits: null,
        explanation: {
          kind: "explanation" as const,
          title: "今天的免费 AI 批改要先绑定邮箱",
          whatItDoes: "AI 会读懂你用中文写的答案，告诉你哪一步想岔了。",
          whyUnavailable:
            "它每次都要真的花钱，而现在这个身份只存在这台浏览器里——换个浏览器或者清一次数据就找不回来了。",
          futureSupport: "在个人档案绑定邮箱就能用；这台设备上已经学的进度会跟着你走。",
          action: { label: "去绑定邮箱", href: "/me" },
        },
      })),
    };

    await renderBlock(grading);
    await answerAndSubmit();

    const explanationButton = buttonWith("查看 AI 批改说明");
    expect(explanationButton).toBeTruthy();
    await act(async () => {
      explanationButton?.click();
    });

    const dialog = document.querySelector<HTMLDialogElement>(".capability-explanation");
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain("今天的免费 AI 批改要先绑定邮箱");
    expect(dialog?.textContent).toContain("它每次都要真的花钱");
    expect(dialog?.textContent).toContain("这台设备上已经学的进度会跟着你走");
    expect(dialog?.querySelector('a[href="/me"]')?.textContent).toBe("去绑定邮箱");
  });

  it("keeps the tier-one control and tells the learner when the daily free quota is exhausted", async () => {
    const freeQuotaMessage = "今天的免费 AI 批改用完了，明天恢复。";
    const grading: GradingPort = {
      submitExercise: vi.fn(async () => TIER_ONE_RESULT),
      meteredGradingOffer: vi.fn(async () => ({
        kind: "unavailable" as const,
        costPowerUnits: "100",
        availablePowerUnits: null,
        freeQuotaExhausted: true,
        freeQuotaResetsAt: "2026-08-28T00:00:00.000Z",
        explanation: {
          kind: "explanation" as const,
          title: "今天的免费 AI 批改用完了",
          whatItDoes: "它会给开放题提供额外的结构化评估。",
          whyUnavailable: freeQuotaMessage,
          futureSupport: "明天的免费 AI 批改次数恢复。",
        },
      })),
    };

    await renderBlock(grading);
    await answerAndSubmit();

    expect(container.textContent).toContain(freeQuotaMessage);
    const tierOneButton = buttonWith("只看 tier‑1 免费提示（不使用钱包）");
    expect(tierOneButton).toBeTruthy();
    expect(tierOneButton?.disabled).toBe(false);
    expect(buttonWith("查看 AI 批改说明")).toBeTruthy();
  });
});
