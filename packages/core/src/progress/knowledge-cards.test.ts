import { describe, expect, it } from "vitest";

import type { CardProgress } from "../ports/progress.js";
import { getConceptEntry } from "../concepts/catalogue.js";
import { LONG_TERM_STABILITY_DAYS } from "./goals.js";
import {
  HEAD_START_CONCEPTS,
  collectedConcepts,
  knowledgeCardPips,
  knowledgeCardTier,
} from "./knowledge-cards.js";

function card(fsrs: Partial<CardProgress["fsrs"]>): CardProgress {
  return {
    cardKey: "k",
    studyId: "s",
    courseId: "c",
    lessonId: "l",
    dueAt: 0,
    fsrs: {
      due: new Date(0).toISOString(),
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 1,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      ...fsrs,
    },
  } as CardProgress;
}

describe("knowledge cards", () => {
  it("frame a card by memory: new, then known once through review, shining three weeks on", () => {
    expect(knowledgeCardTier([])).toBe("new");
    expect(knowledgeCardTier([card({ state: 1, reps: 1 })])).toBe("new");
    expect(knowledgeCardTier([card({ state: 2, reps: 2 })])).toBe("known");
    // Forgotten every time it came up is not "known".
    expect(knowledgeCardTier([card({ state: 2, reps: 2, lapses: 2 })])).toBe("new");
    expect(
      knowledgeCardTier([card({ state: 2, reps: 5, stability: LONG_TERM_STABILITY_DAYS })]),
    ).toBe("shining");
  });

  it("light one, two or three pips", () => {
    expect(knowledgeCardPips("new").filled).toBe(1);
    expect(knowledgeCardPips("known").filled).toBe(2);
    expect(knowledgeCardPips("shining").filled).toBe(3);
  });

  it("start the album two cards in, both real concepts", () => {
    for (const id of HEAD_START_CONCEPTS) expect(getConceptEntry(id)).toBeDefined();
    expect([...collectedConcepts([])]).toEqual([...HEAD_START_CONCEPTS]);
    expect(collectedConcepts(["prompt", "token"]).size).toBe(3);
  });
});
