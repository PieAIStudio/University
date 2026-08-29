// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LessonSectionView } from "../view/lesson-view.js";
import {
  currentSectionNumber,
  LessonToolbar,
  readProgress,
  sectionProgressRatio,
} from "./LessonNav.js";

const SECTIONS: readonly LessonSectionView[] = [
  { id: "s1", title: "先猜一下" },
  { id: "s2", title: "答案" },
  { id: "s3", title: "自检" },
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  /*
    One frame, not a chain. A stub that calls back synchronously turns any
    self-scheduling rAF loop into unbounded recursion — the kit's liquid
    measurement loop schedules its next frame from inside the current one, so
    it used to die here with a stack overflow. Run the first frame inline, so
    effects that need a frame still settle, and drop the frames scheduled from
    inside it.
  */
  let insideFrame = false;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    if (insideFrame) return 1;
    insideFrame = true;
    try {
      cb(0);
    } finally {
      insideFrame = false;
    }
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  HTMLElement.prototype.getBoundingClientRect = originalRect;
  vi.unstubAllGlobals();
});

function box(top: number, height = 24): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    right: 200,
    bottom: top + height,
    width: 200,
    height,
    toJSON() {
      return {};
    },
  } as DOMRect;
}

const originalRect = HTMLElement.prototype.getBoundingClientRect;

function stubLessonRects(topsById: Readonly<Record<string, number>>): void {
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (this.classList.contains("lesson-toolbar")) return box(0, 48);
    const id = this.dataset.sectionId;
    if (id && id in topsById) return box(topsById[id]!);
    return originalRect.call(this);
  };
}

describe("currentSectionNumber", () => {
  it("stays on 1 until a later heading crosses the read line", () => {
    expect(
      currentSectionNumber(
        [
          { top: 80, height: 24 },
          { top: 400, height: 24 },
          { top: 800, height: 24 },
        ],
        56,
      ),
    ).toBe(1);
  });

  it("advances when a later heading crosses the read line", () => {
    expect(
      currentSectionNumber(
        [
          { top: -200, height: 24 },
          { top: -20, height: 24 },
          { top: 40, height: 24 },
        ],
        56,
      ),
    ).toBe(3);
  });

  it("ignores headings that have not been laid out", () => {
    expect(
      currentSectionNumber(
        [
          { top: 0, height: 0 },
          { top: 0, height: 0 },
          { top: 0, height: 0 },
        ],
        0,
      ),
    ).toBe(1);
  });
});

describe("sectionProgressRatio", () => {
  it("fills by section count, not by a course-wide index", () => {
    expect(sectionProgressRatio(1, 8)).toBeCloseTo(0.125);
    expect(sectionProgressRatio(3, 8)).toBeCloseTo(0.375);
    expect(sectionProgressRatio(8, 8)).toBe(1);
    expect(sectionProgressRatio(1, 0)).toBe(0);
  });
});

describe("readProgress", () => {
  it("maps a scroll position onto the part of the page already passed", () => {
    expect(readProgress(0, 5620, 900)).toBe(0);
    expect(readProgress(2360, 5620, 900)).toBeCloseTo(0.5, 5);
    expect(readProgress(4720, 5620, 900)).toBe(1);
  });
});

describe("LessonToolbar", () => {
  it("is a close control and a progress bar, not a nav", async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(<LessonToolbar onClose={onClose} sections={SECTIONS} />);
    });
    expect(container.querySelector("nav")).toBeNull();
    expect(container.textContent).not.toContain("关卡地图");
    expect(container.textContent).toContain("1/3");
    const close = container.querySelector<HTMLButtonElement>(".lesson-toolbar__close");
    expect(close?.getAttribute("aria-label")).toBe("离开课文");
    await act(async () => {
      close?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("updates the bar as the current section changes", async () => {
    const onClose = vi.fn();
    stubLessonRects({ s1: 80, s2: 400, s3: 800 });
    await act(async () => {
      root.render(
        <>
          <LessonToolbar onClose={onClose} sections={SECTIONS} />
          {SECTIONS.map((section) => (
            <h2 key={section.id} data-section-id={section.id}>
              {section.title}
            </h2>
          ))}
        </>,
      );
    });
    expect(container.querySelector("[role='progressbar']")?.getAttribute("aria-valuemax")).toBe(
      "3",
    );
    expect(container.querySelector("[role='progressbar']")?.getAttribute("aria-valuenow")).toBe(
      "1",
    );
    expect(container.querySelector("[role='progressbar']")?.getAttribute("aria-valuetext")).toBe(
      "1/3",
    );

    stubLessonRects({ s1: -200, s2: -20, s3: 40 });
    await act(async () => {
      root.render(
        <>
          <LessonToolbar onClose={onClose} sections={[...SECTIONS]} />
          {SECTIONS.map((section) => (
            <h2 key={section.id} data-section-id={section.id}>
              {section.title}
            </h2>
          ))}
        </>,
      );
    });
    expect(container.querySelector("[role='progressbar']")?.getAttribute("aria-valuenow")).toBe(
      "3",
    );
    expect(container.querySelector("[role='progressbar']")?.getAttribute("aria-valuetext")).toBe(
      "3/3",
    );
  });
});

/**
 * The bar is scroll-driven, and which element it listens to is the part that
 * silently fails.
 *
 * It first listened capture-phase on `window`, on the reasoning that capture
 * reaches a non-bubbling event's target anyway. In a browser it received
 * nothing from the reader's scroll and the bar sat on one section from the top
 * of a lesson to the bottom. Every unit test agreed with the comment, because
 * jsdom has no layout and no scrolling — it cannot tell a listener that fires
 * from one that does not.
 *
 * So assert the structural fact instead: the listener goes on the nearest
 * scrolling ancestor when there is one, and falls back to `window` when the
 * document itself scrolls. That is checkable without a compositor, and it is
 * the thing that was wrong.
 */
describe("LessonToolbar scroll target", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it("listens on the scrolling ancestor rather than on window", () => {
    const scroller = document.createElement("div");
    scroller.style.overflowY = "auto";
    host.append(scroller);
    const mount = createRoot(scroller);
    const onScroller = vi.spyOn(scroller, "addEventListener");
    const onWindow = vi.spyOn(window, "addEventListener");

    act(() => mount.render(<LessonToolbar onClose={() => {}} sections={SECTIONS} />));

    const scrollerEvents = onScroller.mock.calls.map(([type]) => type);
    expect(scrollerEvents).toContain("scroll");
    /* GameProgress' liquid observer intentionally watches window scroll in
       capture phase. The assertion is about LessonToolbar not adding a
       second, bubble-phase document listener when a nearer scroller exists. */
    const windowScrollCalls = onWindow.mock.calls.filter(([type]) => type === "scroll");
    expect(windowScrollCalls).toHaveLength(1);
    expect(windowScrollCalls[0]?.[2]).toMatchObject({ capture: true });

    act(() => mount.unmount());
  });

  it("falls back to window when nothing above it scrolls", () => {
    const onWindow = vi.spyOn(window, "addEventListener");

    act(() => root.render(<LessonToolbar onClose={() => {}} sections={SECTIONS} />));

    expect(onWindow.mock.calls.map(([type]) => type)).toContain("scroll");
  });
});
