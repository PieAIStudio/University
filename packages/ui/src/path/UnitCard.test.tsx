// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UnitCard } from "./UnitCard.js";
import {
  START_UNIT_LABEL,
  UNIT_ABILITY_LABEL,
  UNIT_EVIDENCE_HEADING,
  unitEvidenceLocators,
  unitMetaLine,
  type PathUnit,
} from "./path-stats.js";

const UNIT: PathUnit = {
  title: "证据锚点",
  objective: "用三行真实文件建立 export 的读法。",
  lessons: [
    {
      title: "第一节",
      contentChars: 88,
      exerciseCount: 1,
      evidenceCount: 2,
      unlockCount: 0,
      // The same coordinate twice: the card lists a source once, not per marker.
      evidenceLocators: ["src/app.ts:4-5", "src/app.ts:4-5"],
    },
    {
      title: "第二节",
      contentChars: 62,
      exerciseCount: 2,
      evidenceCount: 2,
      unlockCount: 0,
      evidenceLocators: ["lib/parse.ts:10-12", "src/boot.ts:1"],
    },
    {
      title: "第三节",
      contentChars: 76,
      exerciseCount: 0,
      evidenceCount: 4,
      unlockCount: 0,
      evidenceLocators: ["a.ts:1", "b.ts:1", "c.ts:1", "d.ts:1"],
    },
  ],
};

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
  trigger.textContent = "单元列表";
  document.body.append(trigger);
  outside = document.createElement("button");
  outside.textContent = "路径";
  document.body.append(outside);
  trigger.focus();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  trigger.remove();
  outside.remove();
});

async function renderCard(onClose = vi.fn(), onStart = vi.fn()) {
  await act(async () => {
    root.render(
      <UnitCard open unit={UNIT} onClose={onClose} onStart={onStart} returnFocusTo={trigger} />,
    );
  });
  return { onClose, onStart };
}

function dialog(): HTMLElement {
  const node = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!node) throw new Error("missing dialog");
  return node;
}

describe("unitEvidenceLocators", () => {
  it("dedupes, keeps path and lines only, and stops at five", () => {
    expect(unitEvidenceLocators(UNIT.lessons)).toEqual([
      "src/app.ts:4-5",
      "lib/parse.ts:10-12",
      "src/boot.ts:1",
      "a.ts:1",
      "b.ts:1",
    ]);
  });
});

describe("UnitCard", () => {
  it("puts the objective in the first-person ability slot and lists coordinates only", async () => {
    await renderCard();
    const card = dialog();
    expect(card.getAttribute("aria-modal")).toBe("true");
    expect(card.getAttribute("role")).toBe("dialog");
    expect(card.textContent).toContain(UNIT.title);
    expect(card.textContent).toContain(UNIT_ABILITY_LABEL);
    expect(card.textContent).toContain(UNIT.objective);
    expect(card.textContent).toContain(UNIT_EVIDENCE_HEADING);
    expect(card.textContent).toContain("src/app.ts:4-5");
    expect(card.textContent).toContain("lib/parse.ts:10-12");
    expect(card.textContent).toContain(unitMetaLine(UNIT.lessons));
    /*
      The card used to be handed lesson prose and measure it, so a private
      repository's source could reach a screenshot a paying learner takes. It
      cannot any more: `PathLesson` carries counts and coordinates, and there is
      no prose on it to leak. The cap is still worth asserting.
    */
    expect(card.textContent).not.toContain("c.ts:1");
    expect(card.textContent).not.toContain("d.ts:1");
    expect(
      [...card.querySelectorAll("button")].some(
        (button) => button.textContent === START_UNIT_LABEL,
      ),
    ).toBe(true);
  });

  it("traps Tab inside the sheet", async () => {
    await renderCard();
    const card = dialog();
    const items = [...card.querySelectorAll<HTMLElement>("button")];
    expect(items.length).toBeGreaterThan(1);
    expect(card.contains(document.activeElement)).toBe(true);
    items[items.length - 1]!.focus();
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
      );
    });
    expect(document.activeElement).toBe(items[0]);
    expect(document.activeElement).not.toBe(outside);
  });

  it("closes on Escape and returns focus to the list button", async () => {
    const { onClose } = await renderCard();
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => {
      root.render(
        <UnitCard
          open={false}
          unit={UNIT}
          onClose={onClose}
          onStart={vi.fn()}
          returnFocusTo={trigger}
        />,
      );
    });
    expect(document.activeElement).toBe(trigger);
  });
});
