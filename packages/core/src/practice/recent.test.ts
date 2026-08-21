import { describe, expect, it } from "vitest";

import {
  EMPTY_PRACTICE_RECENT,
  PRACTICE_RECENT_DOCUMENT_VERSION,
  PRACTICE_RECENT_LIMIT,
  parsePracticeRecent,
  pickPracticeQuestionId,
  rememberPracticeQuestion,
} from "./recent.js";

const ALWAYS_FIRST = () => 0;
const ALWAYS_LAST = () => 0.999;

describe("parsePracticeRecent", () => {
  it("reads a versioned list of ids and drops blanks and duplicates", () => {
    expect(
      parsePracticeRecent({
        version: 1,
        ids: ["technical-app.program", "", "technical-app.program", "general-allow.permit", 3],
      }),
    ).toEqual({
      version: PRACTICE_RECENT_DOCUMENT_VERSION,
      ids: ["technical-app.program", "general-allow.permit"],
    });
  });

  it("starts empty when the payload is missing or the wrong shape", () => {
    expect(parsePracticeRecent(null)).toEqual(EMPTY_PRACTICE_RECENT);
    expect(parsePracticeRecent(["technical-app.program"])).toEqual(EMPTY_PRACTICE_RECENT);
    expect(parsePracticeRecent({ version: 1, items: ["technical-app.program"] })).toEqual(
      EMPTY_PRACTICE_RECENT,
    );
  });

  it("keeps a newer version and yields no ids, so a save cannot downgrade it", () => {
    expect(parsePracticeRecent({ version: 2, ids: ["technical-app.program"] })).toEqual({
      version: 2,
      ids: [],
    });
  });
});

describe("rememberPracticeQuestion", () => {
  it("appends a new id and moves a repeat to the newest end", () => {
    const once = rememberPracticeQuestion(EMPTY_PRACTICE_RECENT, "a");
    const twice = rememberPracticeQuestion(once, "b");
    expect(twice.ids).toEqual(["a", "b"]);
    expect(rememberPracticeQuestion(twice, "a").ids).toEqual(["b", "a"]);
  });

  it("drops the oldest id when the ring is over capacity", () => {
    let state = EMPTY_PRACTICE_RECENT;
    state = rememberPracticeQuestion(state, "a", 2);
    state = rememberPracticeQuestion(state, "b", 2);
    state = rememberPracticeQuestion(state, "c", 2);
    expect(state.ids).toEqual(["b", "c"]);
  });

  it("ignores an empty id and refuses to mutate a future-version document", () => {
    expect(rememberPracticeQuestion(EMPTY_PRACTICE_RECENT, "")).toBe(EMPTY_PRACTICE_RECENT);
    const future = { version: 2, ids: ["kept"] as const };
    expect(rememberPracticeQuestion(future, "a")).toBe(future);
  });

  it("clears the ring when the caller asks for no capacity", () => {
    const filled = rememberPracticeQuestion(EMPTY_PRACTICE_RECENT, "a");
    expect(rememberPracticeQuestion(filled, "b", 0)).toEqual(EMPTY_PRACTICE_RECENT);
    expect(PRACTICE_RECENT_LIMIT).toBe(12);
  });
});

describe("pickPracticeQuestionId", () => {
  const BANK = ["a", "b", "c"] as const;

  it("skips ids still in the ring", () => {
    expect(pickPracticeQuestionId(BANK, ["a"], ALWAYS_FIRST)).toBe("b");
    expect(pickPracticeQuestionId(BANK, ["a", "b"], ALWAYS_FIRST)).toBe("c");
  });

  it("falls back to anything except the last served when the ring covers the bank", () => {
    expect(pickPracticeQuestionId(BANK, ["a", "b", "c"], ALWAYS_FIRST)).toBe("a");
    expect(pickPracticeQuestionId(BANK, ["c", "a", "b"], ALWAYS_FIRST)).toBe("a");
    expect(pickPracticeQuestionId(["only"], ["only"], ALWAYS_FIRST)).toBe("only");
  });

  it("returns null for an empty bank and ignores recent ids that have left it", () => {
    expect(pickPracticeQuestionId([], ["a"], ALWAYS_FIRST)).toBeNull();
    expect(pickPracticeQuestionId(["b"], ["gone", "b"], ALWAYS_FIRST)).toBe("b");
    expect(pickPracticeQuestionId(["a", "a", "b"], [], ALWAYS_LAST)).toBe("b");
  });
});
