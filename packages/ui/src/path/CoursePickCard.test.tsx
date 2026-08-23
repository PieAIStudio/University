// @vitest-environment jsdom

import { act, createRef, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CoursePickCard } from "./CoursePickCard.js";

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

async function renderCard(onDismiss = vi.fn(), onEnter = vi.fn()) {
  const cardRef: RefObject<HTMLElement | null> = createRef();
  await act(async () => {
    root.render(
      <div className="app-shell">
        <button type="button" className="jsdom-rail">
          学习
        </button>
        <canvas />
        <nav className="jsdom-map-names">
          <button type="button" className="jsdom-map-name">
            课名
          </button>
        </nav>
        <CoursePickCard
          title="认识地形"
          studyTitle="图灵密约"
          lessons={9}
          depth={0}
          prerequisiteCount={0}
          onEnter={onEnter}
          onDismiss={onDismiss}
          cardRef={cardRef}
        />
      </div>,
    );
  });
  return { onDismiss, onEnter, cardRef };
}

describe("CoursePickCard", () => {
  it("Escape dismisses, a rail click dismisses, a canvas click does not", async () => {
    const { onDismiss } = await renderCard();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    onDismiss.mockClear();
    container
      .querySelector(".jsdom-rail")!
      .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    onDismiss.mockClear();
    container
      .querySelector("canvas")!
      .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("keeps the enter button as the action", async () => {
    await renderCard();
    const buttons = [...container.querySelectorAll("button")].map((button) => button.textContent);
    expect(buttons).toContain("进入这门课");
    expect(container.textContent).toContain("认识地形");
    expect(container.textContent).toContain("图灵密约");
  });
});
