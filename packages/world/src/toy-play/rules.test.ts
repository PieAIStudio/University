import { describe, expect, it } from "vitest";
import { newToyGame, toyDeck, toyReducer, TOY_MODES, word } from "./rules.js";

describe("shared toy-game state", () => {
  for (const mode of TOY_MODES) {
    it(`${mode}: every card is reachable and a whole round can finish honestly`, () => {
      let state = newToyGame(mode);
      const deck = toyDeck(mode);
      expect(deck.length).toBeGreaterThanOrEqual(8);
      expect(new Set(deck.map((card) => card.id)).size).toBe(deck.length);
      for (const card of deck) {
        expect(word(card.prompt, "en")).not.toBe("");
        expect(word(card.prompt, "zh-CN")).not.toBe("");
        expect(card.answer).toBeGreaterThanOrEqual(0);
        expect(card.answer).toBeLessThan(card.options?.length ?? (mode === "invaders" ? 2 : 3));
        state = toyReducer(state, { type: "submit", index: card.answer });
        expect(state.phase).toBe("feedback");
        expect(state.correct).toBe(true);
        // Double submission cannot award the same item twice.
        expect(toyReducer(state, { type: "submit", index: card.answer })).toBe(state);
        state = toyReducer(state, { type: "next" });
      }
      expect(state.phase).toBe("complete");
      expect(state.cursor).toBe(deck.length);
      expect(state.firstTry).toBe(deck.length);
      expect(state.history).toHaveLength(deck.length);
      expect(toyReducer(state, { type: "tick", active: true })).toBe(state);
    });
    it(`${mode}: retries never become first-try success or bypass verification`, () => {
      let state = newToyGame(mode);
      const answer = toyDeck(mode)[0]!.answer;
      state = toyReducer(state, { type: "submit", index: (answer + 1) % 2 });
      expect(state.correct).toBe(false);
      expect(toyReducer(state, { type: "next" })).toBe(state);
      expect(toyReducer(state, { type: "select", index: answer })).toBe(state);
      state = toyReducer(state, { type: "retry" });
      state = toyReducer(state, { type: "submit", index: answer });
      expect(state.correct).toBe(true);
      expect(state.firstTry).toBe(0);
      expect(state.mistakes).toBe(1);
      expect(state.missed).toEqual([toyDeck(mode)[0]!.id]);
      state = toyReducer(state, { type: "next" });
      expect(state.correct).toBe(false);
      expect(state.selected).toBeNull();
      expect(state.lastChoice).toBeNull();
      expect(state.attempts).toBe(0);
      expect(state.seconds).toBe(25);
    });
    it(`${mode}: inactive clocks stop, expiry explains, and reset is complete`, () => {
      let state = newToyGame(mode);
      expect(toyReducer(state, { type: "tick", active: false })).toBe(state);
      for (let i = 0; i < 25; i++) state = toyReducer(state, { type: "tick", active: true });
      expect(state.seconds).toBe(0);
      expect(state.phase).toBe("feedback");
      expect(state.lastChoice).toBeNull();
      expect(state.mistakes).toBe(1);
      expect(toyReducer(state, { type: "tick", active: true })).toBe(state);
      expect(toyReducer(state, { type: "reset", mode })).toEqual(newToyGame(mode));
    });
  }
  it("rejects out-of-range, fractional and non-finite input", () => {
    for (const mode of TOY_MODES) {
      const state = newToyGame(mode);
      for (const index of [-1, 8, NaN, Infinity, 0.5]) {
        expect(toyReducer(state, { type: "select", index })).toBe(state);
        expect(toyReducer(state, { type: "submit", index })).toBe(state);
      }
    }
  });
});
