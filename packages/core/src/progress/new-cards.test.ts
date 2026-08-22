import { describe, expect, it } from "vitest";

import { createMemoryPersistence } from "./memory.js";
import { createProgressPort } from "./port.js";

/**
 * The product makes one promise about a new card, on two screens, and it used
 * to make two.
 *
 * The review screen's empty state says 「学一节新课，它会掉落新的卡片，明天就有
 * 事做了」. The settlement said 「现在就可以复习」, because FSRS's `newCard()` is
 * due immediately — its new queue is the study-it-now queue. Whichever one a
 * learner believed, the other was lying to them.
 *
 * Tomorrow is the one that survives, and this test is here so it stays that
 * way: a card answered thirty seconds after reading measures short-term
 * memory, and it spends FSRS's most informative interval on an answer nobody
 * could have forgotten yet.
 */
describe("a new card is tomorrow's work", () => {
  const drop = () => {
    const port = createProgressPort({ persistence: createMemoryPersistence() });
    port.dropCards("turing-pact", "foundations-before-zero", "you-already-know-apps", ["a", "b"]);
    return port;
  };

  it("is not due the moment it drops", () => {
    expect(drop().dueCards(Date.now()).length).toBe(0);
  });

  it("is due after midnight, not 24 hours later", () => {
    // Someone who finishes at 09:00 and comes back at 08:00 the next morning
    // must find their cards waiting. A flat +24h would tell them to come back
    // in an hour, every single day, for ever.
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const tomorrowMorning = midnight.getTime() + 86_400_000 + 8 * 3_600_000;
    expect(drop().dueCards(tomorrowMorning).length).toBe(2);
  });

  it("still counts toward what is coming tomorrow", () => {
    expect(drop().dueTomorrow()).toBe(2);
  });
});
