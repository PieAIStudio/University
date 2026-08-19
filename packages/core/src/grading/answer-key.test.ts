import { describe, expect, it } from "vitest";

import { compileAnswerKey, coverage, gradeDeterministically, normalise } from "./answer-key.js";

describe("the answer never ships", () => {
  it("compiles to something the answer cannot be read out of", () => {
    const key = compileAnswerKey("图灵密约");
    expect(JSON.stringify(key)).not.toContain("图灵密约");
    expect(key.len).toBe(4);
    // Length is deliberately kept — a substring window needs it — and it is
    // the one thing the key does reveal.
    expect(Object.keys(key).sort()).toEqual(["fp", "len"]);
  });

  it("still passes the answer it was built from", () => {
    const key = compileAnswerKey("图灵密约");
    expect(gradeDeterministically("图灵密约", key).outcome).toBe("pass");
    expect(gradeDeterministically(" 图灵密约。", key).outcome).toBe("pass");
    expect(gradeDeterministically("产品叫图灵密约", key).outcome).toBe("pass");
    expect(gradeDeterministically("图灵测试", key).outcome).toBe("fail");
  });

  it("keeps the substring leniency the plain-text version had", () => {
    // This is the behaviour that would have been lost by hashing alone: a fact
    // wrapped in a sentence is still that fact, and the window scan is what
    // preserves it without the answer in hand.
    const key = compileAnswerKey("due_at");
    expect(gradeDeterministically("我觉得是 due_at 这一列", key).outcome).toBe("pass");
  });

  it("refuses to guess at a sentence", () => {
    const key = compileAnswerKey("因为运行时和源码是两回事，改了源码不重启就不生效");
    const verdict = gradeDeterministically("因为要重启", key);
    expect(verdict.outcome).toBe("undecided");
    if (verdict.outcome === "undecided") expect(verdict.reason).toContain("第 2 层");
  });

  it("asks for an answer before judging an empty one", () => {
    expect(gradeDeterministically("   ", compileAnswerKey("x")).outcome).toBe("undecided");
  });

  it("normalises the way a keyboard forces, not the way a grader wishes", () => {
    expect(normalise(" Due_At。 ")).toBe("due_at");
    expect(normalise("图灵、密约")).toBe("图灵密约");
  });

  it("reports coverage rather than claiming it", () => {
    const keys = [compileAnswerKey("图灵密约"), compileAnswerKey("一".repeat(30)), undefined];
    expect(coverage(keys)).toEqual({ total: 3, decidable: 1, share: 1 / 3 });
  });

  /**
   * These six strings are the real expected answers of six real exercises in
   * this library, not invented cases. Every one of them is punctuation, because
   * the lesson is teaching syntax — and stripping punctuation left an empty key
   * whose fingerprint the substring scan matched at every position, so all six
   * passed whatever a learner typed.
   */
  describe("an answer that is punctuation", () => {
    const SYNTAX = ["...", "??", "?", "?.", "[]", "=>"] as const;

    it.each(SYNTAX)("accepts %s and refuses something else", (expected) => {
      const key = compileAnswerKey(expected);
      expect(gradeDeterministically(expected, key).outcome).toBe("pass");
      expect(gradeDeterministically("随便写点什么", key).outcome).toBe("fail");
    });

    it("still accepts the symbol inside a sentence", () => {
      const key = compileAnswerKey("...");
      expect(gradeDeterministically("用 ... 把旧对象展开", key).outcome).toBe("pass");
    });

    it("tolerates a trailing full stop the way prose answers do", () => {
      const key = compileAnswerKey("??");
      expect(gradeDeterministically("??。", key).outcome).toBe("pass");
    });

    it("never passes an answer whose key normalised away entirely", () => {
      // `　` is a full-width space: whitespace under both readings, so
      // neither form of the key has anything left to compare.
      const key = compileAnswerKey("　 ");
      expect(key.len).toBe(0);
      expect(gradeDeterministically("随便写点什么", key).outcome).toBe("undecided");
    });

    it("keeps punctuation out of the way when the answer is prose", () => {
      const key = compileAnswerKey("图灵密约");
      expect(key.symFp).toBeUndefined();
      expect(gradeDeterministically("图灵密约。", key).outcome).toBe("pass");
    });
  });
});
