import { describe, expect, it } from "vitest";

import {
  contrastCaseAgrees,
  createContrastState,
  isContrastComplete,
  isValidContrastActivity,
  predictContrast,
  type ContrastActivity,
} from "./contrast.js";

const ACTIVITY: ContrastActivity = {
  kind: "contrast",
  id: "by-name-or-by-likeness",
  title: "按字找，和比像不像，哪里不一样",
  brief: "先猜这一次两边会不会给出同一个结果，再看它们各自做了什么。",
  goal: "说得出这两种找法在什么时候会给出同一个答案，什么时候不会。",
  takeaway: "字一样的时候两种都行；换个说法，只有比像不像的那种还找得到。",
  hint: "先问：这句话里的字，原文里有没有原样出现过？",
  question: "同一句话交给这两种找法，结果会一样吗？",
  source: { label: "搜索是怎么找到东西的", url: "https://example.org/how-search-works" },
  approaches: [
    { id: "literal", label: "按字找", note: "把你打的字，原样去正文里对。" },
    { id: "similar", label: "比像不像", note: "把意思换算成数，再找最接近的那一段。" },
  ],
  cases: [
    {
      id: "exact-words",
      label: "搜「发票」，文章里写的就是「发票」",
      detail: "两个字原样出现在正文里。",
      outcomes: { literal: "找到那一段", similar: "找到那一段" },
      why: "字面对得上，意思也最接近，两条路通向同一段。",
    },
    {
      id: "different-words",
      label: "搜「收据」，文章里写的是「发票」",
      detail: "意思接近，但一个字都不重合。",
      outcomes: { literal: "什么也没找到", similar: "找到那一段" },
      why: "按字找只认字；比像不像认的是意思，所以它还找得到。",
    },
  ],
};

const cloned = (patch: Partial<ContrastActivity>): ContrastActivity => ({ ...ACTIVITY, ...patch });

describe("predicting whether two approaches land together", () => {
  it("accepts a right prediction and settles that case", () => {
    const verdict = predictContrast(ACTIVITY, createContrastState(), "exact-words", true);
    expect(verdict.kind).toBe("right");
    if (verdict.kind !== "right") return;
    expect(verdict.agree).toBe(true);
    expect(verdict.why).toContain("同一段");
    expect(verdict.state.settled["exact-words"]).toBe(true);
    expect(verdict.state.misses).toBe(0);
  });

  /*
    A wrong prediction still reveals what the two approaches did. Being wrong
    about 「收据」 and then being shown that one side found nothing is the
    moment the lesson happens; withholding it until a lucky retry would make a
    miss a dead end rather than the point.
  */
  it("reveals the outcome on a wrong prediction, and leaves the case open", () => {
    const verdict = predictContrast(ACTIVITY, createContrastState(), "different-words", true);
    expect(verdict.kind).toBe("wrong");
    if (verdict.kind !== "wrong") return;
    expect(verdict.agree).toBe(false);
    expect(verdict.why).toContain("只认字");
    expect(verdict.state.settled["different-words"]).toBeUndefined();
    expect(verdict.state.misses).toBe(1);
  });

  it("refuses a case it does not have, and one already settled", () => {
    expect(predictContrast(ACTIVITY, createContrastState(), "nope", true).kind).toBe(
      "unknown-case",
    );
    const settled = predictContrast(ACTIVITY, createContrastState(), "exact-words", true);
    if (settled.kind !== "right") throw new Error("expected right");
    expect(predictContrast(ACTIVITY, settled.state, "exact-words", true).kind).toBe(
      "already-settled",
    );
  });

  it("is complete only once every case has been settled", () => {
    let state = createContrastState();
    expect(isContrastComplete(ACTIVITY, state)).toBe(false);
    for (const [caseId, agree] of [
      ["exact-words", true],
      ["different-words", false],
    ] as const) {
      const verdict = predictContrast(ACTIVITY, state, caseId, agree);
      if (verdict.kind !== "right") throw new Error("expected right");
      state = verdict.state;
    }
    expect(isContrastComplete(ACTIVITY, state)).toBe(true);
  });

  it("reads agreement off the two columns rather than a declared field", () => {
    expect(contrastCaseAgrees(ACTIVITY, ACTIVITY.cases[0]!)).toBe(true);
    expect(contrastCaseAgrees(ACTIVITY, ACTIVITY.cases[1]!)).toBe(false);
  });
});

describe("whether a board is a contrast at all", () => {
  it("accepts the authored board", () => {
    expect(isValidContrastActivity(ACTIVITY)).toBe(true);
  });

  /*
    The load-bearing rule. A board whose cases all split is not teaching a
    contrast — it is teaching "these two are different", which the reader can
    answer correctly forever without looking at a single case. Same in the
    mirror: a board where they always agree.

    Both directions are asserted because either one alone passes with the check
    written as a one-sided `.includes(false)`.
  */
  it("refuses a board where the answer never changes", () => {
    const alwaysDiffer = cloned({
      cases: [ACTIVITY.cases[1]!, { ...ACTIVITY.cases[1]!, id: "another-split" }],
    });
    expect(isValidContrastActivity(alwaysDiffer)).toBe(false);

    const alwaysAgree = cloned({
      cases: [ACTIVITY.cases[0]!, { ...ACTIVITY.cases[0]!, id: "another-match" }],
    });
    expect(isValidContrastActivity(alwaysAgree)).toBe(false);
  });

  /*
    The quiet one. A missing or mistyped approach id renders a column with
    nothing in it, and a reader cannot tell an empty column from an answer that
    happens to be "nothing".
  */
  it("refuses a case that does not say what both approaches did", () => {
    expect(
      isValidContrastActivity(
        cloned({
          cases: [ACTIVITY.cases[0]!, { ...ACTIVITY.cases[1]!, outcomes: { literal: "没找到" } }],
        }),
      ),
    ).toBe(false);

    expect(
      isValidContrastActivity(
        cloned({
          cases: [
            ACTIVITY.cases[0]!,
            { ...ACTIVITY.cases[1]!, outcomes: { literal: "没找到", simliar: "找到了" } },
          ],
        }),
      ),
    ).toBe(false);

    expect(
      isValidContrastActivity(
        cloned({
          cases: [
            ACTIVITY.cases[0]!,
            { ...ACTIVITY.cases[1]!, outcomes: { literal: "没找到", similar: "   " } },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("refuses two approaches that are the same one twice, and a board of one case", () => {
    expect(
      isValidContrastActivity(
        cloned({
          approaches: [ACTIVITY.approaches[0], { ...ACTIVITY.approaches[1], id: "literal" }],
        }),
      ),
    ).toBe(false);
    expect(isValidContrastActivity(cloned({ cases: [ACTIVITY.cases[0]!] }))).toBe(false);
    expect(
      isValidContrastActivity(
        cloned({ cases: [ACTIVITY.cases[0]!, { ...ACTIVITY.cases[1]!, id: "exact-words" }] }),
      ),
    ).toBe(false);
  });

  /*
    A stray space is not something the reader can see, so it must not be
    something the engine sees. Before this, a trailing space in one column
    turned an agreeing case into a splitting one and inverted what the board
    taught, with both columns looking identical on screen.
  */
  it("does not let a stray space split a case that agrees", () => {
    const spaced = cloned({
      cases: [
        {
          ...ACTIVITY.cases[0]!,
          outcomes: { literal: "找到那一段", similar: " 找到那一段  " },
        },
        ACTIVITY.cases[1]!,
      ],
    });
    expect(contrastCaseAgrees(spaced, spaced.cases[0]!)).toBe(true);
    expect(isValidContrastActivity(spaced)).toBe(true);
  });
});
