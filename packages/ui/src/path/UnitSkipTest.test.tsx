// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { compileAnswerKey } from "@pieai/university-core";

import { UnitSkipTest } from "./UnitSkipTest.js";
import type { LessonView, UnitView } from "../view/lesson-view.js";

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterEach(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

/** Four lessons; the sitting draws three, so one is skipped without being asked. */
const UNIT = {
  id: "how-it-understands-a-sentence",
  title: "它怎么看懂一句话",
  objective: "",
  lessons: [
    { id: "l1", title: "第一节" },
    { id: "l2", title: "第二节" },
    { id: "l3", title: "第三节" },
    { id: "l4", title: "第四节" },
  ],
} as unknown as UnitView;

const ANSWERS: Record<string, string> = {
  l1: "先处理再比像不像",
  l2: "向量",
  l3: "余弦",
  l4: "本地",
};

function lessonView(lessonId: string, expected: string | null): LessonView {
  return {
    lesson: {
      id: lessonId,
      title: lessonId,
      contentRevision: 1,
      content: "",
      sections: [],
      progress: null,
      evidence: [],
      cards: [],
      exercises: [
        {
          id: `${lessonId}-e0`,
          kind: "short-answer",
          title: "自检",
          prompt: `${lessonId} 的问题`,
          contentRevision: 1,
          ...(expected ? { answerKey: compileAnswerKey(expected) } : {}),
        },
      ],
    },
  } as unknown as LessonView;
}

function mount(
  options: {
    readonly load?: (lessonId: string) => LessonView;
    readonly proven?: ReadonlySet<string>;
  } = {},
) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const provenCalls: (readonly string[])[] = [];
  const opened: string[] = [];
  const load = options.load ?? ((lessonId: string) => lessonView(lessonId, ANSWERS[lessonId]!));

  act(() => {
    root.render(
      <UnitSkipTest
        studyId="browser-ai"
        courseId="search-your-own-photos"
        unit={UNIT}
        content={{ lesson: (locator) => Promise.resolve(load(locator.lessonId)) }}
        proven={options.proven ?? new Set()}
        onProven={(lessonIds) => provenCalls.push(lessonIds)}
        onOpenLesson={(locator) => opened.push(locator.lessonId)}
        pick={() => 0}
      />,
    );
  });

  const text = () => container.textContent ?? "";
  const click = async (label: string) => {
    const button = [...container.querySelectorAll("button")].find((node) =>
      (node.textContent ?? "").includes(label),
    );
    if (!button) throw new Error(`no button matching ${label} in: ${text()}`);
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };
  const answer = async (value: string) => {
    const field = container.querySelector("textarea");
    if (!field) throw new Error(`no answer field in: ${text()}`);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  /** Which lesson the question on screen came from, read off its prompt. */
  const asking = () => UNIT.lessons.find((lesson) => text().includes(`${lesson.id} 的问题`))?.id;

  return { container, root, text, click, answer, asking, provenCalls, opened };
}

describe("「我会了」", () => {
  it("proves the whole unit — including the lesson it never asked about", async () => {
    const test = mount();
    await test.click("我会了");
    for (let index = 0; index < 3; index += 1) {
      const lessonId = test.asking()!;
      await test.answer(ANSWERS[lessonId]!);
      await test.click("交这一题");
    }

    expect(test.text()).toContain("三道全对");
    expect(test.provenCalls).toHaveLength(1);
    /*
      Four lessons, three questions, and the fourth is proven too. That is the
      design's explicit trade — 「全对就把整个单元标记为已掌握」 — not an
      oversight, so it is asserted rather than left to be discovered.
    */
    expect([...test.provenCalls[0]!].sort()).toEqual(["l1", "l2", "l3", "l4"]);
    test.root.unmount();
  });

  it("opens only the lesson behind a wrong answer and proves the rest", async () => {
    const test = mount();
    await test.click("我会了");
    let wrongLesson = "";
    for (let index = 0; index < 3; index += 1) {
      const lessonId = test.asking()!;
      if (index === 1) {
        wrongLesson = lessonId;
        await test.answer("完全不对的答案");
      } else {
        await test.answer(ANSWERS[lessonId]!);
      }
      await test.click("交这一题");
    }

    expect(test.text()).toContain("错了一道");
    expect(test.provenCalls[0]).not.toContain(wrongLesson);
    expect(test.provenCalls[0]).toHaveLength(3);
    await test.click("去读");
    expect(test.opened).toEqual([wrongLesson]);
    test.root.unmount();
  });

  it("proves nothing when two answers are wrong", async () => {
    const test = mount();
    await test.click("我会了");
    for (let index = 0; index < 3; index += 1) {
      await test.answer(index < 2 ? "不对" : ANSWERS[test.asking()!]!);
      await test.click("交这一题");
    }

    expect(test.text()).toContain("错了 2 道");
    expect(test.text()).toContain("从头读一遍");
    expect(test.provenCalls).toEqual([]);
    test.root.unmount();
  });

  /*
    Three wrong reaches the same branch as two, and it used to say 「错了两道」
    there — telling somebody who got everything wrong that they got one right.
    A count printed from the number the component already has, not from the
    threshold that led to the branch.
  */
  it("says how many were actually wrong, not the threshold that got here", async () => {
    const test = mount();
    await test.click("我会了");
    for (let index = 0; index < 3; index += 1) {
      await test.answer("不对");
      await test.click("交这一题");
    }
    expect(test.text()).toContain("错了 3 道");
    expect(test.text()).not.toContain("错了 2 道");
    expect(test.provenCalls).toEqual([]);
    test.root.unmount();
  });

  /*
    36 of the 117 units on the shelf ask for a sentence rather than a phrase, and
    tier one cannot settle a sentence. The button is still there — 决定 D says
    every unit entry has one — so what is owed is the reason, in words, not a
    control that silently does nothing.
  */
  it("says why, rather than failing quietly, when the unit has no settleable question", async () => {
    const test = mount({ load: (lessonId) => lessonView(lessonId, null) });
    await test.click("我会了");
    expect(test.text()).toContain("没法用做题跳过");
    expect(test.provenCalls).toEqual([]);
    test.root.unmount();
  });

  /*
    Two settleable questions is not a cheaper sitting, it is a different one:
    the 「at most one wrong」 floor is a floor on three, so a two-question test
    would let one right answer prove a four-lesson unit. 31 of the 117 units on
    the shelf can only supply one or two, so this is the common case rather than
    the edge one.
  */
  it("declines rather than shortening the sitting when the unit cannot fill it", async () => {
    const test = mount({
      load: (lessonId) =>
        lessonView(lessonId, ["l1", "l2"].includes(lessonId) ? ANSWERS[lessonId]! : null),
    });
    await test.click("我会了");
    expect(test.text()).toContain("凑不出三道");
    expect(test.text()).not.toContain("第 1 / 2 题");
    expect(test.provenCalls).toEqual([]);
    test.root.unmount();
  });

  it("refuses to score a blank answer as either right or wrong", async () => {
    const test = mount();
    await test.click("我会了");
    const first = test.asking();
    await test.click("交这一题");
    expect(test.text()).toContain("先写下你的答案");
    expect(test.asking()).toBe(first);
    expect(test.provenCalls).toEqual([]);
    test.root.unmount();
  });

  /*
    决定 D again: 「每个单元入口都有一个『我会了』，随时能重测。」 A unit already
    proved still offers the test, because 「人的能力是一路长的」 and so is the
    course — a unit rewritten next year is a unit worth being asked about again.
  */
  it("still offers a retake on a unit that was already proved", () => {
    const test = mount({
      proven: new Set(UNIT.lessons.map((lesson) => lesson.id)),
    });
    expect(test.text()).toContain("再测一次");
    expect(test.text()).toContain("已经跳过了");
    test.root.unmount();
  });
});
