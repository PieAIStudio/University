// @vitest-environment jsdom

/**
 * A programmatic `element.click()` never hit-tests. This file exists because
 * that is how the unit-strip bug shipped: the button was in the tree, the
 * canvas (and invisible overlay titles) sat on top of it, and only a real
 * pointer sequence at its screen position could tell the two apart.
 */
import { act, type CSSProperties } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { UnitCard, type PathUnit } from "@pieai/university-ui";

import "../styles.css";

const UNIT: PathUnit = {
  title: "从零开始之前",
  objective: "读完能说出这一单元在讲什么。",
  lessons: [{ title: "第一节", content: "正文", exercises: [] }],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  // jsdom does not always compute imported stylesheets. These selectors
  // are the production stack from `styles.css` — if they drift, this
  // test stops describing the bug it exists to catch.
  const style = document.createElement("style");
  style.dataset.overlayStack = "true";
  style.textContent = `
    .labels { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
    .label, button.label { pointer-events: none; }
    button.label.is-visible, button.label:focus-visible { pointer-events: auto; }
    .app-shell__main .stagewrap > .picked,
    .app-shell__main .stagewrap > .nextup {
      position: absolute; z-index: 3; pointer-events: auto;
    }
    .stagewrap { position: relative; }
  `;
  document.head.append(style);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.head.querySelectorAll("style[data-overlay-stack]").forEach((node) => node.remove());
});

function box(el: Element, rect: { left: number; top: number; width: number; height: number }) {
  const value = {
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON() {
      return this;
    },
  };
  el.getBoundingClientRect = () => value as DOMRect;
}

function hitTest(rootEl: Element, x: number, y: number): Element | null {
  const hits: { el: Element; z: number; order: number }[] = [];
  let order = 0;
  const walk = (el: Element, parentZ: number) => {
    const style = getComputedStyle(el);
    const raw = style.zIndex;
    const z = raw === "auto" || raw === "" ? parentZ : Number.parseInt(raw, 10) || parentZ;
    const rect = el.getBoundingClientRect();
    const contains = x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
    const pe = style.pointerEvents;
    const idx = order++;
    if (contains && pe !== "none") hits.push({ el, z, order: idx });
    for (const child of el.children) walk(child, z);
  };
  walk(rootEl, 0);
  hits.sort((left, right) => right.z - left.z || right.order - left.order);
  return hits[0]?.el ?? null;
}

function dispatchPointerSequence(target: EventTarget, x: number, y: number) {
  const base = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: x,
    clientY: y,
    screenX: x,
    screenY: y,
    button: 0,
  };
  const pointer =
    typeof PointerEvent === "function"
      ? (type: string, buttons: number) =>
          new PointerEvent(type, {
            ...base,
            buttons,
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
          })
      : null;
  const mouse = (type: string, buttons: number) => new MouseEvent(type, { ...base, buttons });
  const fire = (type: string, buttons: number) => {
    if (pointer && type.startsWith("pointer")) target.dispatchEvent(pointer(type, buttons));
    else target.dispatchEvent(mouse(type, buttons));
  };
  fire("pointerdown", 1);
  fire("mousedown", 1);
  fire("pointerup", 0);
  fire("mouseup", 0);
  fire("click", 0);
}

/** Hit-test, then fire a pointer/mouse sequence on whatever is actually there. */
function realClickAt(rootEl: Element, x: number, y: number) {
  const target = hitTest(rootEl, x, y);
  if (!target) throw new Error(`nothing at ${x},${y} accepts pointer events`);
  dispatchPointerSequence(target, x, y);
  return target;
}

function Stack({
  open,
  onOpen,
  onClose,
  extraLabelClass = "label--quiet",
}: {
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly extraLabelClass?: string;
}) {
  return (
    <div className="app-shell__main">
      <div className="learn-stage">
        <div className="stagewrap">
          <canvas data-map="stage" />
          <aside className="picked picked--left">
            <div className="unit-strip">
              <p className="unit-strip__name">从零开始之前</p>
              <button
                type="button"
                className="unit-strip__list"
                aria-label="先看这一单元讲什么"
                aria-haspopup="dialog"
                aria-expanded={open ? true : undefined}
                onClick={onOpen}
              >
                列表
              </button>
            </div>
          </aside>
          <nav className="labels" aria-label="世界地图上的去处">
            <button
              type="button"
              className={`label label--lesson ${extraLabelClass}`}
              style={{ "--placed": 1 } as CSSProperties}
            >
              很长的课时标题会盖住按钮
            </button>
          </nav>
        </div>
      </div>
      {open ? (
        <UnitCard open unit={UNIT} onClose={onClose} onStart={onClose} returnFocusTo={null} />
      ) : null}
    </div>
  );
}

function layoutOverlapping(rootEl: HTMLElement) {
  const stage = rootEl.querySelector(".stagewrap")!;
  const canvas = rootEl.querySelector("canvas")!;
  const picked = rootEl.querySelector(".picked")!;
  const button = rootEl.querySelector<HTMLButtonElement>(".unit-strip__list")!;
  const label = rootEl.querySelector<HTMLElement>(".labels .label")!;
  box(stage, { left: 0, top: 0, width: 800, height: 600 });
  box(canvas, { left: 0, top: 0, width: 800, height: 600 });
  box(picked, { left: 14, top: 14, width: 260, height: 140 });
  box(button, { left: 230, top: 40, width: 32, height: 32 });
  // Covers the unit-strip button the way a long quiet title did on the path.
  box(label, { left: 200, top: 20, width: 220, height: 80 });
  return { button, label, canvas };
}

describe("unit strip real click", () => {
  it("opens the unit card from a pointer sequence at the button, not element.click()", async () => {
    let open = false;
    const render = async () => {
      await act(async () => {
        root.render(
          <Stack
            open={open}
            onOpen={() => {
              open = true;
            }}
            onClose={() => {
              open = false;
            }}
          />,
        );
      });
    };

    await render();
    const { button } = layoutOverlapping(container);
    const x = 246;
    const y = 56;
    const hit = realClickAt(container, x, y);
    expect(button.contains(hit) || hit === button).toBe(true);
    expect(open).toBe(true);

    await render();
    expect(document.querySelector("[role='dialog']")).not.toBeNull();
  });

  it("does not let an invisible overlay title steal the pointer", async () => {
    let open = false;
    await act(async () => {
      root.render(
        <Stack
          open={false}
          onOpen={() => {
            open = true;
          }}
          onClose={() => undefined}
        />,
      );
    });
    const { label } = layoutOverlapping(container);
    const hit = hitTest(container, 246, 56);
    expect(hit).not.toBe(label);
    expect(open).toBe(false);
    realClickAt(container, 246, 56);
    expect(open).toBe(true);
  });
});
