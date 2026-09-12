import { describe, expect, it } from "vitest";

import {
  createSortState,
  isSortComplete,
  isValidSortActivity,
  placeSortItem,
  type SortActivity,
} from "./sort.js";

const ACTIVITY: SortActivity = {
  kind: "sort",
  id: "is-it-a-component",
  title: "这算不算一个组件",
  brief: "把每一样放进它真正属于的那一格。",
  goal: "说得出组件不等于功能，也不等于页面。",
  takeaway: "组件是样子和反应住在同一个文件里的那一块。",
  hint: "先问：它有没有自己的样子，和自己的反应？",
  question: "下面这些，哪些是组件？",
  source: { label: "React 官方文档", url: "https://react.dev/learn/your-first-component" },
  buckets: [
    { id: "component", label: "是组件", note: "样子和反应住在一个文件里" },
    { id: "not", label: "不是组件", note: "它是别的东西" },
  ],
  items: [
    {
      id: "upload-button",
      label: "那个上传按钮",
      detail: "它自己画自己的样子，也自己处理被点。",
      bucketId: "component",
      why: "样子和反应都在它自己那份文件里。",
    },
    {
      id: "remove-background",
      label: "「去掉背景」这件事",
      detail: "点了之后会发生的那一串。",
      bucketId: "not",
      why: "这是一个功能，不是屏幕上的一块。",
      tempting: { bucketId: "component", whyNot: "它没有自己的样子——你指不出它在屏幕的哪儿。" },
    },
  ],
};

describe("sorting things into the bucket that holds them", () => {
  it("accepts the right bucket and hands back that item's own reason", () => {
    const verdict = placeSortItem(ACTIVITY, createSortState(), "upload-button", "component");
    expect(verdict.kind).toBe("right");
    if (verdict.kind !== "right") return;
    expect(verdict.why).toContain("自己那份文件");
    expect(verdict.state.placed["upload-button"]).toBe("component");
    expect(verdict.state.misses).toBe(0);
  });

  /*
    The whole difference between this and a quiz. A learner who calls a feature
    a component has a specific wrong model — they are thinking of what happens,
    not of what is on screen — and only the item knows which sentence addresses
    it. A generic "try again" leaves them to guess again with the same model.
  */
  it("answers the tempting wrong bucket with the reason it does not hold", () => {
    const verdict = placeSortItem(ACTIVITY, createSortState(), "remove-background", "component");
    expect(verdict.kind).toBe("wrong");
    if (verdict.kind !== "wrong") return;
    expect(verdict.whyNot).toContain("没有自己的样子");
    expect(verdict.state.misses).toBe(1);
    expect(verdict.state.placed).toEqual({});
  });

  it("counts a miss without a written reason, rather than inventing one", () => {
    const noTemptation = placeSortItem(ACTIVITY, createSortState(), "upload-button", "not");
    expect(noTemptation.kind).toBe("wrong");
    if (noTemptation.kind !== "wrong") return;
    expect(noTemptation.whyNot).toBeNull();
  });

  it("refuses a second placement of something already placed", () => {
    const first = placeSortItem(ACTIVITY, createSortState(), "upload-button", "component");
    if (first.kind !== "right") throw new Error("setup");
    expect(placeSortItem(ACTIVITY, first.state, "upload-button", "not").kind).toBe(
      "already-placed",
    );
  });

  it("is complete only when every item sits in its own bucket", () => {
    let state = createSortState();
    expect(isSortComplete(ACTIVITY, state)).toBe(false);
    for (const item of ACTIVITY.items) {
      const verdict = placeSortItem(ACTIVITY, state, item.id, item.bucketId);
      if (verdict.kind !== "right") throw new Error(`could not place ${item.id}`);
      state = verdict.state;
    }
    expect(isSortComplete(ACTIVITY, state)).toBe(true);
  });
});

describe("what makes a sort board unplayable", () => {
  it("accepts the well-formed one", () => {
    expect(isValidSortActivity(ACTIVITY)).toBe(true);
  });

  it("rejects a single bucket, which is a list and not a decision", () => {
    expect(
      isValidSortActivity({
        ...ACTIVITY,
        buckets: [ACTIVITY.buckets[0]!],
        items: [ACTIVITY.items[0]!],
      }),
    ).toBe(false);
  });

  it("rejects a bucket nothing ever lands in", () => {
    // A permanently empty bucket can be eliminated without understanding
    // anything, which makes the board easier for the wrong reason.
    expect(
      isValidSortActivity({
        ...ACTIVITY,
        buckets: [...ACTIVITY.buckets, { id: "spare", label: "多的", note: "没人会进来" }],
      }),
    ).toBe(false);
  });

  it("rejects a temptation pointing at the right answer", () => {
    expect(
      isValidSortActivity({
        ...ACTIVITY,
        items: [
          ACTIVITY.items[0]!,
          {
            ...ACTIVITY.items[1]!,
            tempting: { bucketId: "not", whyNot: "自相矛盾" },
          },
        ],
      }),
    ).toBe(false);
  });

  it("rejects an item filed under a bucket that does not exist", () => {
    expect(
      isValidSortActivity({
        ...ACTIVITY,
        items: [ACTIVITY.items[0]!, { ...ACTIVITY.items[1]!, bucketId: "nowhere" }],
      }),
    ).toBe(false);
  });
});
