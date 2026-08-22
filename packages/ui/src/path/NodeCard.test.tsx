// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NodeCard } from "./NodeCard.js";
import {
  PREVIEW_UNIT_LABEL,
  lessonCostLine,
  startButtonLabel,
  type PathLesson,
  type PathUnit,
} from "./path-stats.js";

const UNIT: PathUnit = {
  title: "证据锚点",
  objective: "用三行真实文件建立读法。",
  lessons: [
    {
      title: "证据锚点：让课文指向真实提交",
      content: `${"学".repeat(400)}[[evidence:src/app.ts:4-5]]`,
      exercises: [{}, {}, {}],
    },
  ],
};

const LESSON: PathLesson = UNIT.lessons[0]!;

let container: HTMLDivElement;
let root: Root;
let trigger: HTMLButtonElement;
let outside: HTMLButtonElement;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  trigger = document.createElement("button");
  trigger.textContent = "节点";
  document.body.append(trigger);
  outside = document.createElement("button");
  outside.textContent = "路径上的其他按钮";
  document.body.append(outside);
  trigger.focus();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  trigger.remove();
  outside.remove();
});

async function renderCard(
  props: Partial<Parameters<typeof NodeCard>[0]> & { readonly lesson?: PathLesson } = {},
) {
  const onClose = props.onClose ?? vi.fn();
  const onStart = props.onStart ?? vi.fn();
  const onStartUnit = props.onStartUnit ?? vi.fn();
  await act(async () => {
    root.render(
      <NodeCard
        open
        lesson={props.lesson ?? LESSON}
        unit={UNIT}
        onClose={onClose}
        onStart={onStart}
        onStartUnit={onStartUnit}
        returnFocusTo={trigger}
        {...props}
      />,
    );
  });
  return { onClose, onStart, onStartUnit };
}

function dialog(): HTMLElement {
  const node = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!node) throw new Error("missing dialog");
  return node;
}

function buttonWith(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll("button")].find((button) => button.textContent === text);
}

function press(key: string, shiftKey = false) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true }),
  );
}

describe("startButtonLabel", () => {
  it("prints the unlock count only when there is something to unlock", () => {
    expect(startButtonLabel(0)).toBe("开始");
    expect(startButtonLabel(0)).not.toContain("0 个");
    expect(startButtonLabel(3)).toBe("开始 · 学完解锁 3 个词条");
  });
});

describe("NodeCard", () => {
  it("shows title, derived cost, and a start label with no fake zero reward", async () => {
    await renderCard();
    const card = dialog();
    expect(card.getAttribute("aria-modal")).toBe("true");
    expect(card.getAttribute("role")).toBe("dialog");
    expect(card.getAttribute("aria-labelledby")).toBeTruthy();
    expect(card.textContent).toContain(LESSON.title);
    expect(card.textContent).toContain(lessonCostLine(LESSON));
    expect(buttonWith("开始")?.textContent).toBe("开始");
    expect(card.textContent).not.toContain("0 个");
    expect(card.textContent).not.toContain("解锁 0");
  });

  it("prints the unlock count on the button when the lesson names terms", async () => {
    await renderCard({
      lesson: {
        title: "词条课",
        content: "见 [[term:app.program]] 与 [[concept:idempotent]]。",
        exercises: [],
      },
    });
    expect(buttonWith("开始 · 学完解锁 2 个词条")).toBeTruthy();
    expect(dialog().textContent).not.toContain("0 个");
  });

  it("moves focus into the card and keeps Tab from reaching the path behind it", async () => {
    await renderCard();
    const card = dialog();
    const items = [...card.querySelectorAll<HTMLElement>("button")];
    expect(items.length).toBeGreaterThan(1);
    expect(card.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(outside);
    expect(document.activeElement).not.toBe(trigger);

    items[items.length - 1]!.focus();
    await act(async () => {
      press("Tab");
    });
    expect(document.activeElement).toBe(items[0]);
    expect(document.activeElement).not.toBe(outside);

    await act(async () => {
      press("Tab", true);
    });
    expect(document.activeElement).toBe(items[items.length - 1]);
    expect(card.contains(document.activeElement)).toBe(true);
  });

  it("closes on Escape and returns focus to the node button", async () => {
    const { onClose } = await renderCard();
    await act(async () => {
      press("Escape");
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.render(
        <NodeCard
          open={false}
          lesson={LESSON}
          unit={UNIT}
          onClose={onClose}
          onStart={vi.fn()}
          onStartUnit={vi.fn()}
          returnFocusTo={trigger}
        />,
      );
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when the blank around the card is clicked", async () => {
    const { onClose } = await renderCard();
    await act(async () => {
      document.querySelector<HTMLElement>(".path-card__scrim")?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("expands the unit card in place without leaving the dialog", async () => {
    const { onStartUnit } = await renderCard();
    const preview = [...document.querySelectorAll("button")].find((button) =>
      button.textContent?.includes(PREVIEW_UNIT_LABEL),
    );
    expect(preview).toBeTruthy();
    await act(async () => {
      preview?.click();
    });
    expect(dialog().textContent).toContain(UNIT.objective);
    await act(async () => {
      buttonWith("从第 1 节开始")?.click();
    });
    expect(onStartUnit).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });
});
