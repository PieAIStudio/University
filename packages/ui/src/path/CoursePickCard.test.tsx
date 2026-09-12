// @vitest-environment jsdom

import { act, createRef, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
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
const REWRITE_NOTICE = "这门课是早期版本，正在重写。内容可以读，但用词和讲解顺序还没到现在的标准。";

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
  isBeingRewritten = false,
}: {
  readonly onDismiss?: ReturnType<typeof vi.fn<() => void>>;
  readonly onEnter?: ReturnType<typeof vi.fn<() => void>>;
  readonly objectives?: readonly string[];
  readonly stats?: CoursePickStats;
  readonly isBeingRewritten?: boolean;
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
          unmetPrerequisites={[]}
          objectives={objectives}
          stats={stats}
          isBeingRewritten={isBeingRewritten}
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
    // Said once, in the sentence above, and not repeated as an inventory row.
    expect(container.textContent).not.toContain("真实代码引用条数");
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

  it("shows the rewrite notice without taking away the enter action", async () => {
    const { onEnter } = await renderCard({ isBeingRewritten: true });
    const notice = container.querySelector<HTMLElement>("[data-course-rewrite-notice]");
    const enter = container.querySelector<HTMLButtonElement>(".picked__enter");

    expect(notice).not.toBeNull();
    expect(notice?.textContent).toBe(REWRITE_NOTICE);
    expect(enter).not.toBeNull();
    await act(async () => enter?.click());
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it("does not show the rewrite notice for a current course", async () => {
    await renderCard({ isBeingRewritten: false });

    expect(container.querySelector("[data-course-rewrite-notice]")).toBeNull();
  });
});

/*
  V5 §12 决定 C. The card is where a learner first meets a course they have not
  earned their way to, and 「灰是信息，锁是权力」 decides what it may do about it:
  say what the course assumes, by name, and leave the door open.

  Both halves are asserted, because either one alone reads as done. A card that
  names the prerequisite and disables the button has locked them out politely; a
  card that lets them in and says nothing has told them nothing.
*/
describe("a course whose prerequisites are unmet", () => {
  const withUnmet = (unmet: readonly { readonly courseId: string; readonly title: string }[]) =>
    renderToStaticMarkup(
      <CoursePickCard
        title="用 AI 把一个真实开源项目跑起来"
        studyTitle="学会用 AI 做应用"
        depth={1}
        unmetPrerequisites={unmet}
        objectives={["跑起来一个真实项目"]}
        stats={{ lessons: 8, exercises: 8, maxXp: 400 }}
        isBeingRewritten={false}
        onEnter={() => undefined}
        onDismiss={() => undefined}
        cardRef={{ current: null }}
      />,
    );

  it("names what it assumes rather than counting it", () => {
    const markup = withUnmet([{ courseId: "before-you-start", title: "在开始之前" }]);
    expect(markup).toContain("在开始之前");
    expect(markup).toContain("没学过也进得去");
  });

  it("still offers the way in, and offers it the same way as a course with none", () => {
    const unmet = withUnmet([{ courseId: "before-you-start", title: "在开始之前" }]);
    const met = withUnmet([]);
    expect(unmet).toContain("进入这门课");
    const enterMarkup = /<button[^>]*picked__enter[\s\S]*?<\/button>/.exec(unmet)?.[0] ?? "";
    expect(enterMarkup).not.toContain("disabled");
    expect(enterMarkup).not.toContain("aria-disabled");
    /*
      The enter control is byte-identical in both cards. A weaker assertion —
      「the button is present」 — would pass with it greyed, relabelled 「先去学
      先修课」, or wrapped in something that swallows the click.
    */
    const enterOf = (markup: string) =>
      /<button[^>]*picked__enter[\s\S]*?<\/button>/.exec(markup)?.[0];
    expect(enterOf(unmet)).toBeTruthy();
    expect(enterOf(unmet)).toEqual(enterOf(met));
  });
});
