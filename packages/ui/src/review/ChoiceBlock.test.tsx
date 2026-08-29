// @vitest-environment jsdom

import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const playSound = vi.hoisted(() => vi.fn());

vi.mock("../sound/index.js", () => ({
  playSound,
}));

import {
  CHOICE_BLOCK_KIND_LABEL,
  CHOICE_CORRECT_VERDICT,
  CHOICE_NEXT_LABEL,
  CHOICE_SOLVED_LABEL,
  CHOICE_SUBMIT_LABEL,
  CHOICE_WRONG_VERDICT,
  ChoiceBlock,
  type ChoiceBlockExercise,
} from "./ChoiceBlock.js";

const EXERCISE: ChoiceBlockExercise = {
  id: "buttons",
  prompt: "三个动作后果不同。怎么放？",
  options: [
    {
      id: "separate-buttons",
      text: "三个动作各自用明确的按钮。",
      explanation: "三个动作后果不同，各自用明确的按钮。",
    },
    {
      id: "one-confirm",
      text: "一个确认处理所有后果。",
      explanation: "一个按钮承担三种后果，设置页会变得不可预测。",
    },
    {
      id: "all-links",
      text: "三个都做成链接。",
      explanation: "链接带走当前页；保存和放弃是留在本页的动作。",
    },
  ],
  correctOptionId: "separate-buttons",
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  /*
    LiquidGroup owns a self-scheduling frame loop. Running the callback
    synchronously is useful here because it makes the SVG path observable in
    the same act(), but nested frames must be dropped or this becomes infinite
    recursion.
  */
  let insideFrame = false;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    if (insideFrame) return 1;
    insideFrame = true;
    try {
      callback(0);
    } finally {
      insideFrame = false;
    }
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
  playSound.mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function renderBlock(onNext?: () => void, onSolved?: () => void) {
  await act(async () => {
    root.render(
      <StrictMode>
        <ChoiceBlock exercise={EXERCISE} onNext={onNext} onSolved={onSolved} />
      </StrictMode>,
    );
  });
}

function buttonWith(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(text),
  );
}

function submitControl(): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find(
    (button) => button.textContent === CHOICE_SUBMIT_LABEL,
  );
}

describe("ChoiceBlock", () => {
  it("labels the only type this block renders, without A B C letters", async () => {
    await renderBlock();
    expect(container.textContent).toContain(CHOICE_BLOCK_KIND_LABEL);
    expect(container.querySelector(".choice-block__letter")).toBeNull();
    expect(buttonWith("A 三个动作各自用明确的按钮。")).toBeUndefined();
  });

  it("keeps submit visible and disabled until an option is selected", async () => {
    await renderBlock();
    const submit = submitControl();
    expect(submit).toBeTruthy();
    expect(submit?.disabled).toBe(true);
    expect(container.textContent).not.toContain("还不对");
    expect(container.textContent).not.toContain("答对了");
  });

  it("selecting an option is not submitting", async () => {
    await renderBlock();
    await act(async () => {
      buttonWith("一个确认处理所有后果。")?.click();
    });
    expect(container.textContent).not.toContain("还不对");
    expect(playSound).not.toHaveBeenCalled();
    expect(submitControl()?.disabled).toBe(false);
    expect(buttonWith("一个确认处理所有后果。")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("submitting a miss keeps the per-option explanation and does not unlock next", async () => {
    const onNext = vi.fn();
    const onSolved = vi.fn();
    await renderBlock(onNext, onSolved);
    await act(async () => {
      buttonWith("一个确认处理所有后果。")?.click();
    });
    await act(async () => {
      submitControl()?.click();
    });
    expect(container.textContent).toContain("还不对");
    expect(container.textContent).toContain("一个按钮承担三种后果，设置页会变得不可预测。");
    expect(container.textContent).toContain(CHOICE_WRONG_VERDICT);
    expect(container.querySelector(".choice-block__mark")?.textContent).toBe("×");
    expect(buttonWith(CHOICE_NEXT_LABEL)).toBeUndefined();
    expect(submitControl()?.disabled).toBe(true);
    expect(onSolved).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
    expect(playSound).toHaveBeenCalledWith("answer.wrong");
  });

  it("submitting the correct option shows the principle, the triple mark, and next", async () => {
    const onNext = vi.fn();
    const onSolved = vi.fn();
    await renderBlock(onNext, onSolved);
    await act(async () => {
      buttonWith("三个动作各自用明确的按钮。")?.click();
    });
    await act(async () => {
      submitControl()?.click();
    });
    expect(container.textContent).toContain("答对了");
    expect(container.textContent).toContain("三个动作后果不同，各自用明确的按钮。");
    expect(container.textContent).toContain(CHOICE_CORRECT_VERDICT);
    expect(container.querySelector(".choice-block__mark")?.textContent).toBe("✓");
    expect(container.querySelector(".choice-block__correct-merge")).toBeTruthy();
    expect(
      container.querySelector(".choice-block__correct-merge [data-liquid-gooey-silhouette]"),
    ).toBeTruthy();
    const blob = container.querySelector<SVGPathElement>(
      ".choice-block__correct-merge [data-liquid-gooey-blob]",
    );
    expect(blob).not.toBeNull();
    expect(blob?.getAttribute("d")?.trim()).toBeTruthy();
    expect(onSolved).toHaveBeenCalledTimes(1);
    const next = buttonWith(CHOICE_NEXT_LABEL);
    expect(next).toBeTruthy();
    expect(next?.disabled).toBe(false);
    await act(async () => {
      next?.click();
    });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledWith("answer.correct");
  });

  it("without onNext, a correct submit keeps the action disabled rather than hiding it", async () => {
    await renderBlock();
    await act(async () => {
      buttonWith("三个动作各自用明确的按钮。")?.click();
    });
    await act(async () => {
      submitControl()?.click();
    });
    const done = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === CHOICE_SOLVED_LABEL,
    );
    expect(done).toBeTruthy();
    expect(done?.disabled).toBe(true);
  });
});
