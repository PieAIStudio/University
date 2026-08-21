import { describe, expect, it } from "vitest";

import { EMPTY_PRACTICE_RECENT, rememberPracticeQuestion } from "./recent.js";
import { advancePracticeSession, startPracticeSession, unlockPracticeSession } from "./session.js";

const ALWAYS_FIRST = () => 0;
const BANK = ["a", "b", "c"] as const;

describe("startPracticeSession", () => {
  it("starts at 第 1, locked, and avoids whatever the ring already holds", () => {
    const recent = rememberPracticeQuestion(EMPTY_PRACTICE_RECENT, "a");
    const session = startPracticeSession(BANK, recent, ALWAYS_FIRST);
    expect(session).toEqual({ ordinal: 1, currentId: "b", unlocked: false });
  });

  it("has no current question when the bank is empty", () => {
    expect(startPracticeSession([], EMPTY_PRACTICE_RECENT, ALWAYS_FIRST)).toEqual({
      ordinal: 1,
      currentId: null,
      unlocked: false,
    });
  });
});

describe("unlockPracticeSession", () => {
  it("unlocks the current question once and ignores a session with nothing on screen", () => {
    const sitting = startPracticeSession(BANK, EMPTY_PRACTICE_RECENT, ALWAYS_FIRST);
    const unlocked = unlockPracticeSession(sitting);
    expect(unlocked.unlocked).toBe(true);
    expect(unlockPracticeSession(unlocked)).toBe(unlocked);
    expect(unlockPracticeSession({ ordinal: 1, currentId: null, unlocked: false })).toEqual({
      ordinal: 1,
      currentId: null,
      unlocked: false,
    });
  });
});

describe("advancePracticeSession", () => {
  it("does not move the ring or the ordinal until the current question is unlocked", () => {
    const sitting = startPracticeSession(BANK, EMPTY_PRACTICE_RECENT, ALWAYS_FIRST);
    const next = advancePracticeSession(sitting, BANK, EMPTY_PRACTICE_RECENT, ALWAYS_FIRST);
    expect(next.session).toBe(sitting);
    expect(next.recent).toBe(EMPTY_PRACTICE_RECENT);
  });

  it("remembers the solved id, increments the sitting counter, and locks the next term", () => {
    const sitting = unlockPracticeSession(
      startPracticeSession(BANK, EMPTY_PRACTICE_RECENT, ALWAYS_FIRST),
    );
    const next = advancePracticeSession(sitting, BANK, EMPTY_PRACTICE_RECENT, ALWAYS_FIRST);
    expect(sitting.currentId).toBe("a");
    expect(next.recent.ids).toEqual(["a"]);
    expect(next.session).toEqual({ ordinal: 2, currentId: "b", unlocked: false });
  });
});
