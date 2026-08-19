import { describe, expect, it } from "vitest";

import {
  isDue,
  loadCard,
  newCard,
  RATING,
  review,
  SCHEDULER_PARAMETERS,
  SCHEDULER_VERSION,
  storeCard,
} from "./fsrs.js";

const AT = new Date("2026-08-19T09:00:00.000Z");

describe("the one scheduler", () => {
  it("is reproducible, which is what lets the local store replay its event log", () => {
    const card = newCard(AT);
    const once = review(card, RATING.good, AT);
    const twice = review(card, RATING.good, AT);
    expect(once.due.toISOString()).toBe(twice.due.toISOString());
    expect(SCHEDULER_PARAMETERS.enable_fuzz).toBe(false);
  });

  it("survives the round trip a JSON store puts it through", () => {
    // The bug this guards is a new card having no `last_review`: a store that
    // writes `undefined` and reads back `null` changes what FSRS is told.
    const fresh = newCard(AT);
    expect(storeCard(fresh).last_review).toBeUndefined();
    const answered = review(fresh, RATING.good, AT);
    const revived = loadCard(storeCard(answered));
    expect(revived).toEqual(answered);
    expect(review(revived, RATING.hard, AT).due).toEqual(review(answered, RATING.hard, AT).due);
  });

  it("does not let forgetting keep a long interval", () => {
    let card = newCard(AT);
    let at = AT;
    for (let step = 0; step < 4; step += 1) {
      card = review(card, RATING.good, at);
      at = card.due;
    }
    // Same card, same instant, two answers. Remembering has to buy more time
    // than forgetting, or the schedule is lying about what the learner knows.
    const remembered = review(card, RATING.good, at);
    const forgotten = review(card, RATING.again, at);
    expect(forgotten.due.getTime() - at.getTime()).toBeLessThan(
      remembered.due.getTime() - at.getTime(),
    );
    expect(forgotten.lapses).toBe(card.lapses + 1);
    expect(remembered.lapses).toBe(card.lapses);
  });

  it("answers the due question the same way both queues ask it", () => {
    const card = review(newCard(AT), RATING.good, AT);
    expect(isDue(card, AT)).toBe(false);
    expect(isDue(card, card.due)).toBe(true);
    // The online queue filters on a stored millisecond; the local one on a
    // Date. Same instant, same answer, or the two shells disagree about today.
    expect(storeCard(card).due).toBe(card.due.toISOString());
    expect(new Date(storeCard(card).due).getTime()).toBe(card.due.getTime());
  });

  it("records which algorithm produced a schedule", () => {
    // ts-fsrs reports both its own version and the algorithm generation, e.g.
    // "v5.4.1 using FSRS-6.0". Both halves matter when a stored row has to say
    // what scheduled it, so the whole string is what gets recorded.
    expect(SCHEDULER_VERSION).toMatch(/^v\d+\.\d+\.\d+ using FSRS-/);
    expect(SCHEDULER_PARAMETERS.request_retention).toBe(0.9);
  });
});
