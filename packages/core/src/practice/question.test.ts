import { describe, expect, it } from "vitest";

import type { LexiconEntry } from "../domain/schemas.js";
import { assembleTermEntry } from "../domain/structured-entry.js";
import {
  assembleTermPracticeQuestion,
  idOfPracticeQuestion,
  indexPracticeQuestions,
  practiceQuestionIdFromHead,
} from "./question.js";

const APP: LexiconEntry = {
  senseId: "app.program",
  headword: "app",
  phonetic: "/æp/",
  partOfSpeech: "noun",
  gloss: "应用：用户点开图标就能用的那个成品",
  usage: "App 是 application 的口语缩写。",
  track: "technical",
};

const ALLOW: LexiconEntry = {
  senseId: "allow.permit",
  headword: "allow",
  phonetic: "/əˈlaʊ/",
  partOfSpeech: "verb",
  gloss: "允许：放开某种行为或访问",
  usage: "allow access 在权限说明里极常见。",
  track: "general",
};

const OPTIONS = [
  {
    id: "separate-buttons",
    text: "保存资料、放弃本次修改和删除账号各用一个按钮，删除前再确认一次。",
    explanation: "三个动作后果不同，各自用明确的按钮。",
  },
  {
    id: "one-confirm",
    text: "用一个「确认」按钮处理全部操作，点了再猜用户想做什么。",
    explanation: "一个按钮承担三种后果，设置页会变得不可预测。",
  },
  {
    id: "all-links",
    text: "三项都做成链接，看起来更轻，点了再跳到别的页去完成。",
    explanation: "链接带走当前页；保存和放弃是留在本页的动作。",
  },
] as const;

function termOf(entry: LexiconEntry) {
  return assembleTermEntry(entry).entry;
}

function exercise(
  overrides: {
    readonly prompt?: unknown;
    readonly options?: unknown;
    readonly correctOptionId?: unknown;
  } = {},
) {
  return {
    prompt: "账号设置页有保存、放弃和删除。怎样安排更合适？",
    options: OPTIONS,
    correctOptionId: "separate-buttons",
    ...overrides,
  };
}

describe("practiceQuestionIdFromHead", () => {
  it("is category plus term slug, so the bank cannot drift off the term", () => {
    expect(practiceQuestionIdFromHead(APP)).toBe("technical-app.program");
    expect(practiceQuestionIdFromHead(ALLOW)).toBe("general-allow.permit");
  });
});

describe("assembleTermPracticeQuestion", () => {
  it("attaches the exercise to the term and derives identity from that term", () => {
    const result = assembleTermPracticeQuestion(termOf(APP), exercise());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.question.term.head).toEqual(APP);
    expect(result.question.exercise.prompt).toContain("账号设置页");
    expect(result.question.exercise.correctOptionId).toBe("separate-buttons");
    expect(result.question.exercise.options).toHaveLength(3);
    expect(idOfPracticeQuestion(result.question)).toBe("technical-app.program");
    expect("id" in result.question).toBe(false);
  });

  it("rejects a stemless prompt rather than serving a blank judgement", () => {
    const result = assembleTermPracticeQuestion(termOf(APP), exercise({ prompt: "   " }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-prompt", path: ["prompt"] }),
      ]),
    );
  });

  it("reuses the choice-exercise checks for option count and per-option explanations", () => {
    const result = assembleTermPracticeQuestion(
      termOf(APP),
      exercise({ options: OPTIONS.slice(0, 2) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((issue) => issue.code)).toContain("option-count");
  });

  it("rejects an option that is a noun definition with no situation text", () => {
    const result = assembleTermPracticeQuestion(
      termOf(APP),
      exercise({
        options: [OPTIONS[0], OPTIONS[1], { ...OPTIONS[2], text: "   " }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-text", path: ["options", 2, "text"] }),
      ]),
    );
  });
});

describe("indexPracticeQuestions", () => {
  it("keys the bank by the derived id and collapses a second quiz for the same term", () => {
    const first = assembleTermPracticeQuestion(termOf(APP), exercise());
    const second = assembleTermPracticeQuestion(
      termOf(APP),
      exercise({ prompt: "另一道不该独立存在的题。" }),
    );
    const other = assembleTermPracticeQuestion(termOf(ALLOW), exercise());
    expect(first.ok && second.ok && other.ok).toBe(true);
    if (!first.ok || !second.ok || !other.ok) return;
    const indexed = indexPracticeQuestions([first.question, other.question, second.question]);
    expect(indexed.ids).toEqual(["technical-app.program", "general-allow.permit"]);
    expect(indexed.byId.get("technical-app.program")?.exercise.prompt).toContain("账号设置页");
    expect(indexed.byId.get("technical-app.program")?.exercise.prompt).not.toContain("另一道");
  });
});
