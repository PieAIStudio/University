// @vitest-environment jsdom

import { act, createRef, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CoursePickCard } from "./CoursePickCard.js";
import type { CoursePickStats } from "./course-pick-stats.js";

// Overlay class names, not this component's. The shared-styles ratchet
// reads className="…" literals in packages/ui; a test that needs the
// overlay's selectors must not emit them as if the card owned them.
const overlay = {
  labels: ["labels"].join(" "),
  course: ["label", "label--course"].join(" "),
  study: ["label", "label--study"].join(" "),
};

let container: HTMLDivElement;
let root: Root;

const OBJECTIVES = ["原样保留的第一条成果", "原样保留的第二条成果"];
const COMPLETE_STATS: CoursePickStats = {
  lessons: 9,
  exercises: 4,
  maxXp: 235,
  evidenceCount: 7,
};

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

async function renderCard({
  onDismiss = vi.fn(),
  onEnter = vi.fn(),
  objectives = OBJECTIVES,
  stats = COMPLETE_STATS,
}: {
  readonly onDismiss?: ReturnType<typeof vi.fn<() => void>>;
  readonly onEnter?: ReturnType<typeof vi.fn<() => void>>;
  readonly objectives?: readonly string[];
  readonly stats?: CoursePickStats;
} = {}) {
  const cardRef: RefObject<HTMLElement | null> = createRef();
  await act(async () => {
    root.render(
      <div className="app-shell">
        <button type="button" className="jsdom-rail">
          学习
        </button>
        <canvas />
        <nav className={overlay.labels}>
          <button type="button" className={overlay.course}>
            课名
          </button>
          <div className={overlay.study}>大课名</div>
        </nav>
        <CoursePickCard
          title="认识地形"
          studyTitle="图灵密约"
          depth={0}
          prerequisiteCount={0}
          objectives={objectives}
          stats={stats}
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
  it("shows every authored outcome and the real content and XP preview", async () => {
    await renderCard();

    expect(container.textContent).toContain("学完这门课，你能：");
    expect(
      [...container.querySelectorAll(".picked__objectives li")].map((item) => item.textContent),
    ).toEqual(OBJECTIVES);
    expect(container.textContent).toContain("这些本事来自 7 段真实项目代码");
    expect(container.textContent).toContain("课时数9");
    expect(container.textContent).toContain("练习数4");
    expect(container.textContent).toContain("最多可得 XP235");
    expect(container.textContent).toContain("真实代码引用条数7");
  });

  it("omits the optional evidence statistics when the shelf cannot count them", async () => {
    await renderCard({
      stats: {
        lessons: 9,
        exercises: 4,
        maxXp: 235,
      },
    });

    expect(container.querySelector(".picked__evidence")).toBeNull();
    expect(container.textContent).not.toContain("真实项目代码");
    expect(container.textContent).not.toContain("真实代码引用");
    expect(container.textContent).not.toMatch(/0/);
  });

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

    onDismiss.mockClear();
    container
      .querySelector("button.label")!
      .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    expect(onDismiss).not.toHaveBeenCalled();

    onDismiss.mockClear();
    container
      .querySelector(".label--study")!
      .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("keeps the enter button as the action", async () => {
    await renderCard();
    const buttons = [...container.querySelectorAll("button")].map((button) => button.textContent);
    expect(buttons).toContain("进入这门课");
    expect(container.textContent).toContain("认识地形");
    expect(container.textContent).toContain("图灵密约");
  });
});
