import { describe, expect, it } from "vitest";
import { challengeBoards, challengeDeck, isChallengePair } from "./challenge.js";
const cards = Array.from({ length: 7 }, (_, i) => ({
  id: String(i),
  front: `q${i}`,
  back: `a${i}`,
  lessonId: "lesson",
  lessonTitle: "Lesson",
  contentRevision: 1,
}));
describe("challenge board projection", () => {
  it("retains exact course text, shuffles without mutating the source", () => {
    const before = JSON.stringify(cards);
    const deck = challengeDeck(cards, () => 0.2);
    expect(deck).toHaveLength(7);
    expect(new Set(deck.map((card) => card.id)).size).toBe(7);
    expect(JSON.stringify(cards)).toBe(before);
  });
  it("removes ambiguous duplicates and refuses empty or excessive prose", () => {
    expect(
      challengeDeck([
        ...cards,
        cards[0]!,
        { ...cards[0]!, id: "duplicate" },
        { ...cards[0]!, id: "empty", front: "" },
      ]),
    ).toHaveLength(7);
  });
  it("does not repeat one lonely pair to pad a timed session", () => {
    expect(challengeBoards(cards).map((board) => board.length)).toEqual([3, 4]);
  });
  it("uses the native graph rule to accept only corresponding pairs", () => {
    expect(isChallengePair(cards, "0", "0")).toBe(true);
    expect(isChallengePair(cards, "0", "1")).toBe(false);
    expect(isChallengePair(cards, "unknown", "unknown")).toBe(false);
  });
});
