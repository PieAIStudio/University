import { describe, expect, it } from "vitest";

import {
  INITIAL_CHOICE_BLOCK_STATE,
  applyChoicePick,
  choiceBlockFeedback,
} from "./choice-block.js";

const OPTIONS = [
  {
    id: "separate-buttons",
    explanation: "三个动作后果不同，各自用明确的按钮。",
  },
  {
    id: "one-confirm",
    explanation: "一个按钮承担三种后果，设置页会变得不可预测。",
  },
  {
    id: "all-links",
    explanation: "链接带走当前页；保存和放弃是留在本页的动作。",
  },
] as const;

const CORRECT = "separate-buttons";

describe("applyChoicePick", () => {
  it("marks the picked option wrong and does not unlock next", () => {
    const next = applyChoicePick(INITIAL_CHOICE_BLOCK_STATE, "one-confirm", CORRECT);
    expect(next.solved).toBe(false);
    expect(next.wrongOptionIds).toEqual(["one-confirm"]);
    expect(next.lastPickId).toBe("one-confirm");
    expect(choiceBlockFeedback(next, OPTIONS, CORRECT)).toEqual({
      kind: "wrong",
      explanation: "一个按钮承担三种后果，设置页会变得不可预测。",
    });
  });

  it("keeps earlier wrong marks and shows the latest option's own explanation", () => {
    const afterFirst = applyChoicePick(INITIAL_CHOICE_BLOCK_STATE, "one-confirm", CORRECT);
    const afterSecond = applyChoicePick(afterFirst, "all-links", CORRECT);
    expect(afterSecond.solved).toBe(false);
    expect(afterSecond.wrongOptionIds).toEqual(["one-confirm", "all-links"]);
    expect(choiceBlockFeedback(afterSecond, OPTIONS, CORRECT)).toEqual({
      kind: "wrong",
      explanation: "链接带走当前页；保存和放弃是留在本页的动作。",
    });
  });

  it("marks a correct pick right, shows that option's explanation as the principle, and unlocks next", () => {
    const afterMiss = applyChoicePick(INITIAL_CHOICE_BLOCK_STATE, "one-confirm", CORRECT);
    const afterHit = applyChoicePick(afterMiss, CORRECT, CORRECT);
    expect(afterHit.solved).toBe(true);
    expect(afterHit.wrongOptionIds).toEqual(["one-confirm"]);
    expect(choiceBlockFeedback(afterHit, OPTIONS, CORRECT)).toEqual({
      kind: "correct",
      explanation: "三个动作后果不同，各自用明确的按钮。",
    });
  });

  it("ignores further picks once the correct option is in", () => {
    const solved = applyChoicePick(INITIAL_CHOICE_BLOCK_STATE, CORRECT, CORRECT);
    expect(applyChoicePick(solved, "all-links", CORRECT)).toEqual(solved);
  });
});
