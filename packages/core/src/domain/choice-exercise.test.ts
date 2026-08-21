import { describe, expect, it } from "vitest";

import {
  CHOICE_OPTION_COUNT,
  validateChoiceExercise,
  type ChoiceExerciseDraft,
} from "./choice-exercise.js";

const OPTIONS = [
  {
    id: "separate-buttons",
    text: "保存资料、放弃本次修改和删除账号各用一个按钮，删除前再确认一次。",
    explanation: "三个动作后果不同，各自用明确的按钮，读者才不必猜点下去会发生什么。",
  },
  {
    id: "one-confirm",
    text: "用一个「确认」按钮处理全部操作，点了再猜用户想做什么。",
    explanation: "一个按钮承担三种后果，等于把决定推给下一次点击，设置页会变得不可预测。",
  },
  {
    id: "all-links",
    text: "三项都做成链接，看起来更轻，点了再跳到别的页去完成。",
    explanation: "链接带走当前页；保存和放弃是留在本页的动作，做成链接会拆掉这次编辑。",
  },
] as const;

function draft(
  overrides: Partial<ChoiceExerciseDraft> & {
    readonly options?: ChoiceExerciseDraft["options"];
  } = {},
): ChoiceExerciseDraft {
  return {
    options: OPTIONS,
    correctOptionId: "separate-buttons",
    ...overrides,
  };
}

function codesOf(input: ChoiceExerciseDraft) {
  const result = validateChoiceExercise(input);
  return result.ok ? [] : result.errors.map((issue) => issue.code);
}

describe("validateChoiceExercise", () => {
  it("accepts three distinct options, a known correct id, and an explanation on every option", () => {
    expect(validateChoiceExercise(draft())).toEqual({ ok: true });
    expect(CHOICE_OPTION_COUNT).toBe(3);
  });

  it("rejects fewer than three options", () => {
    const result = validateChoiceExercise(draft({ options: OPTIONS.slice(0, 2) }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "option-count", path: ["options"] }),
      ]),
    );
  });

  it("rejects more than three options", () => {
    expect(
      codesOf(draft({ options: [...OPTIONS, { ...OPTIONS[0], id: "extra-item" }] })),
    ).toContain("option-count");
  });

  it("rejects a correct id that is not among the options", () => {
    const result = validateChoiceExercise(draft({ correctOptionId: "not-an-option" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "unknown-correct-id", path: ["correctOptionId"] }),
    ]);
  });

  it("rejects duplicate option ids", () => {
    const result = validateChoiceExercise(
      draft({
        options: [OPTIONS[0], { ...OPTIONS[1], id: OPTIONS[0].id }, OPTIONS[2]],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: "duplicate-option-id",
        path: ["options", 1, "id"],
      }),
    ]);
  });

  it("rejects an option missing an explanation", () => {
    const result = validateChoiceExercise(
      draft({
        options: [OPTIONS[0], OPTIONS[1], { ...OPTIONS[2], explanation: "" }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: "missing-explanation",
        path: ["options", 2, "explanation"],
      }),
    ]);
  });

  it("rejects an option whose explanation is only whitespace", () => {
    expect(
      codesOf(
        draft({
          options: [OPTIONS[0], OPTIONS[1], { ...OPTIONS[2], explanation: "   " }],
        }),
      ),
    ).toContain("missing-explanation");
  });

  it("does not throw when the draft is the wrong shape", () => {
    expect(() => validateChoiceExercise({ options: null, correctOptionId: null })).not.toThrow();
    expect(codesOf({ options: null, correctOptionId: null })).toEqual(
      expect.arrayContaining(["option-count", "unknown-correct-id"]),
    );
  });
});
