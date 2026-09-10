import { describe, expect, it } from "vitest";

import {
  createWeighState,
  decideWeigh,
  isValidWeighActivity,
  isWeighComplete,
  weighOutcomes,
  type WeighActivity,
} from "./weigh.js";

const ACTIVITY: WeighActivity = {
  kind: "weigh",
  id: "read-the-piece-or-the-whole",
  title: "只读要改的那一块，还是先把整个项目读一遍",
  brief: "每一种情况里挑一个做法。同一个做法不会每次都对。",
  goal: "说得出这两种读法各自在什么情况下更划算。",
  takeaway: "改一个已知的小地方就直接去那儿；不知道该改哪儿的时候，省下的那点时间会加倍还回去。",
  hint: "先问：你现在知不知道要改的是哪个文件？",
  question: "这一次，你打算怎么读这个项目？",
  source: { label: "项目大到读不完", path: "src/App.jsx", line: 1, lineEnd: 4 },
  options: [
    { id: "piece", label: "只读要改的那一块", note: "快，但你看不见它牵着谁。" },
    { id: "whole", label: "先把整个项目过一遍", note: "慢，但改完不会有想不到的地方碎掉。" },
  ],
  situations: [
    {
      id: "known-button",
      label: "把一个按钮的字从「提交」改成「保存」",
      detail: "你已经知道它在哪个文件里。",
      bestOptionId: "piece",
      why: "位置已知，改动不牵别处，读整个项目换不回任何东西。",
      costOfOther: { whole: "先读一遍要花掉一个下午，而这次读到的东西一样也用不上。" },
    },
    {
      id: "unknown-crash",
      label: "上传大图会崩，不知道是哪一段干的",
      detail: "报错指向一个你没见过的文件。",
      bestOptionId: "whole",
      why: "不知道该改哪儿的时候，「那一块」是找不到的——你得先知道谁牵着谁。",
      costOfOther: { piece: "直接扎进报错那个文件，会把时间花在一段根本不是原因的代码上。" },
    },
  ],
};

const cloned = (patch: Partial<WeighActivity>): WeighActivity => ({ ...ACTIVITY, ...patch });

describe("choosing for one situation at a time", () => {
  it("accepts the right choice and says what it cost", () => {
    const verdict = decideWeigh(ACTIVITY, createWeighState(), "known-button", "piece");
    expect(verdict.kind).toBe("right");
    if (verdict.kind !== "right") return;
    expect(verdict.why).toContain("位置已知");
    expect(verdict.costOfOther.whole).toContain("一个下午");
    expect(verdict.state.decided["known-button"]).toBe("piece");
  });

  /*
    A miss says only "not here". Every other option is wrong for its own
    reason, and the set of those reasons is what the reader is supposed to
    arrive at — handing them over on a wrong guess lets somebody collect the
    whole lesson by guessing through it.
  */
  it("says nothing beyond a miss on a wrong choice", () => {
    const verdict = decideWeigh(ACTIVITY, createWeighState(), "known-button", "whole");
    expect(verdict.kind).toBe("wrong");
    if (verdict.kind !== "wrong") return;
    expect(Object.keys(verdict)).toEqual(["kind", "state"]);
    expect(verdict.state.misses).toBe(1);
    expect(verdict.state.decided["known-button"]).toBeUndefined();
  });

  it("refuses an unknown situation, an unknown option, and one already decided", () => {
    expect(decideWeigh(ACTIVITY, createWeighState(), "nope", "piece").kind).toBe(
      "unknown-situation",
    );
    expect(decideWeigh(ACTIVITY, createWeighState(), "known-button", "nope").kind).toBe(
      "unknown-option",
    );
    const decided = decideWeigh(ACTIVITY, createWeighState(), "known-button", "piece");
    if (decided.kind !== "right") throw new Error("expected right");
    expect(decideWeigh(ACTIVITY, decided.state, "known-button", "whole").kind).toBe(
      "already-decided",
    );
  });

  it("is complete only once every situation has been decided", () => {
    let state = createWeighState();
    expect(isWeighComplete(ACTIVITY, state)).toBe(false);
    for (const [situationId, optionId] of [
      ["known-button", "piece"],
      ["unknown-crash", "whole"],
    ] as const) {
      const verdict = decideWeigh(ACTIVITY, state, situationId, optionId);
      if (verdict.kind !== "right") throw new Error("expected right");
      state = verdict.state;
    }
    expect(isWeighComplete(ACTIVITY, state)).toBe(true);
  });

  it("reports which option won which situations, so the flip is visible at the end", () => {
    expect(weighOutcomes(ACTIVITY)).toEqual([
      { optionId: "piece", situationIds: ["known-button"] },
      { optionId: "whole", situationIds: ["unknown-crash"] },
    ]);
  });
});

describe("whether a board is a trade-off at all", () => {
  it("accepts the authored board", () => {
    expect(isValidWeighActivity(ACTIVITY)).toBe(true);
  });

  /*
    The rule the whole activity rests on. A board where one option wins every
    situation is finishable, every situation has an answer, every answer has a
    reason — and the reader completes it by picking the same thing twice. That
    is the exact behaviour a 决策 lesson exists to break, and nothing else in
    this validator can see it.
  */
  it("refuses a board where one option wins every situation", () => {
    const alwaysPiece = cloned({
      situations: [ACTIVITY.situations[0]!, { ...ACTIVITY.situations[1]!, bestOptionId: "piece" }],
    });
    expect(isValidWeighActivity(alwaysPiece)).toBe(false);

    const alwaysWhole = cloned({
      situations: [{ ...ACTIVITY.situations[0]!, bestOptionId: "whole" }, ACTIVITY.situations[1]!],
    });
    expect(isValidWeighActivity(alwaysWhole)).toBe(false);
  });

  it("refuses a situation whose answer is not on the table", () => {
    expect(
      isValidWeighActivity(
        cloned({
          situations: [
            ACTIVITY.situations[0]!,
            { ...ACTIVITY.situations[1]!, bestOptionId: "neither" },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("refuses one option, duplicate ids, and fewer situations than options", () => {
    expect(isValidWeighActivity(cloned({ options: [ACTIVITY.options[0]!] }))).toBe(false);
    expect(
      isValidWeighActivity(
        cloned({ options: [ACTIVITY.options[0]!, { ...ACTIVITY.options[1]!, id: "piece" }] }),
      ),
    ).toBe(false);
    expect(isValidWeighActivity(cloned({ situations: [ACTIVITY.situations[0]!] }))).toBe(false);
    expect(
      isValidWeighActivity(
        cloned({
          situations: [ACTIVITY.situations[0]!, { ...ACTIVITY.situations[1]!, id: "known-button" }],
        }),
      ),
    ).toBe(false);
  });

  /*
    The rule that arrived with the third option. 「What the other one would have
    cost」 names two different choices once a board has three, so the cost is
    keyed by the option it belongs to — and a board that leaves one out renders
    a blank where the trade-off was supposed to be.
  */
  it("refuses a situation that does not price every losing option", () => {
    const threeWay = cloned({
      options: [...ACTIVITY.options, { id: "ask", label: "先问一句", note: "不读，但要等。" }],
      situations: [
        { ...ACTIVITY.situations[0]!, costOfOther: { whole: "一个下午", ask: "等一天" } },
        { ...ACTIVITY.situations[1]!, costOfOther: { piece: "找错地方", ask: "等一天" } },
        {
          id: "first-day",
          label: "第一天进项目",
          detail: "你连它叫什么都不知道。",
          bestOptionId: "ask",
          why: "问一句最便宜。",
          costOfOther: { piece: "不知道那一块在哪", whole: "读一周" },
        },
      ],
    });
    expect(isValidWeighActivity(threeWay)).toBe(true);

    const missingOne = cloned({
      ...threeWay,
      situations: [
        { ...threeWay.situations[0]!, costOfOther: { whole: "一个下午" } },
        ...threeWay.situations.slice(1),
      ],
    });
    expect(isValidWeighActivity(missingOne)).toBe(false);

    // A cost written against the answer itself is a contradiction on screen.
    const pricesTheWinner = cloned({
      ...threeWay,
      situations: [
        { ...threeWay.situations[0]!, costOfOther: { piece: "?", whole: "一个下午" } },
        ...threeWay.situations.slice(1),
      ],
    });
    expect(isValidWeighActivity(pricesTheWinner)).toBe(false);
  });
});
