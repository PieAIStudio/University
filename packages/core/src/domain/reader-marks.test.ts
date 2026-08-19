import { describe, expect, it } from "vitest";

import { buildQuestionPrompt, locateQuote, type ReaderMark } from "./reader-marks.js";

function mark(overrides: Partial<ReaderMark> = {}): ReaderMark {
  return {
    markId: "m1",
    lessonKey: "course/unit/lesson",
    contentRevision: 3,
    kind: "question",
    quote: { exact: "事件日志", prefix: "底层是一条", suffix: "。" },
    sectionTitle: "两个东西",
    note: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

describe("locateQuote", () => {
  it("finds the occurrence the prefix points at, not the first one", () => {
    const text = "先说事件日志，再说别的。真正要讲的事件日志在这里。";
    const found = locateQuote(text, {
      exact: "事件日志",
      prefix: "真正要讲的",
      suffix: "在这里",
    });
    expect(found).not.toBeNull();
    // Without the prefix this would land on the first occurrence at index 2,
    // which is a different sentence than the reader marked.
    expect(text.slice(found!.start, found!.end)).toBe("事件日志");
    expect(found!.start).toBeGreaterThan(10);
  });

  it("still finds the quote when the surrounding text was rewritten", () => {
    const found = locateQuote("完全换过的开头，事件日志，完全换过的结尾。", {
      exact: "事件日志",
      prefix: "原来的上文",
      suffix: "原来的下文",
    });
    expect(found).not.toBeNull();
  });

  it("returns null when the passage is genuinely gone", () => {
    expect(
      locateQuote("这一段已经彻底改写了。", { exact: "事件日志", prefix: "", suffix: "" }),
    ).toBeNull();
  });
});

describe("buildQuestionPrompt", () => {
  const context = {
    studyTitle: "buzz",
    lessonTitles: new Map([["course/unit/lesson", "一条消息是怎么走完全程的？"]]),
  };

  it("numbers each passage and says where it came from", () => {
    const prompt = buildQuestionPrompt(
      [mark(), mark({ markId: "m2", sectionTitle: null })],
      context,
    );
    expect(prompt).toContain("1. 《一条消息是怎么走完全程的？》「两个东西」");
    expect(prompt).toContain("2. 《一条消息是怎么走完全程的？》");
    expect(prompt).toContain("原文：事件日志");
  });

  it("asks for separate answers, because a merged essay loses the mapping", () => {
    expect(buildQuestionPrompt([mark()], context)).toContain("每条单独回答");
  });

  it("leaves out highlights and anything already resolved", () => {
    const prompt = buildQuestionPrompt(
      [
        mark({ markId: "h", kind: "highlight" }),
        mark({ markId: "done", resolvedAt: "2026-08-12T01:00:00.000Z" }),
      ],
      context,
    );
    expect(prompt).toBe("");
  });
});
