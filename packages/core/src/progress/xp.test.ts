import { describe, expect, it } from "vitest";

import {
  FREE_DAILY_CAP,
  freeCreditsToday,
  reviewXp,
  streakMultiplier,
  xpFor,
  type XpEvent,
} from "./xp.js";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 7, 23, 9, 0, 0);

describe("reviewXp", () => {
  it("pays almost nothing for recalling something seen an hour ago", () => {
    expect(reviewXp({ rating: "good", lastReviewedAt: NOW - 3_600_000, now: NOW })).toBe(3);
  });

  it("pays the most for recalling something last seen two months ago", () => {
    expect(reviewXp({ rating: "good", lastReviewedAt: NOW - 70 * DAY, now: NOW })).toBe(150);
  });

  it("rises with the interval and never falls", () => {
    const days = [0, 1, 2, 3, 7, 14, 30, 60, 90, 365];
    const scores = days.map((d) =>
      reviewXp({ rating: "good", lastReviewedAt: NOW - d * DAY, now: NOW }),
    );
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]!).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });

  /*
    The rule that protects the scheduler. If 「很轻松」 paid more than
    「想起来了」, people would misreport difficulty to farm points — and
    difficulty is the only thing FSRS has to go on. Rating changes when the
    card comes back, never what this review is worth.
  */
  it("pays hard, good and easy identically", () => {
    const at = { lastReviewedAt: NOW - 20 * DAY, now: NOW } as const;
    const scores = (["hard", "good", "easy"] as const).map((rating) => reviewXp({ rating, ...at }));
    expect(new Set(scores).size).toBe(1);
  });

  /*
    Failure has to pay. Docking points for 「没想起来」 teaches people to click
    「想起来了」 when they did not, which corrupts the input the whole product
    runs on. Showing up is the behaviour we want.
  */
  it("still pays for a card you could not recall", () => {
    expect(reviewXp({ rating: "again", lastReviewedAt: NOW - 30 * DAY, now: NOW })).toBeGreaterThan(
      0,
    );
  });

  it("pays a long-interval recall far more than a failure", () => {
    const recalled = reviewXp({ rating: "good", lastReviewedAt: NOW - 90 * DAY, now: NOW });
    const forgot = reviewXp({ rating: "again", lastReviewedAt: NOW - 90 * DAY, now: NOW });
    expect(recalled).toBeGreaterThan(forgot * 10);
  });
});

describe("xpFor", () => {
  it("pays nothing for re-reading a lesson", () => {
    const reread: XpEvent[] = [{ kind: "read-lesson", firstTime: false }];
    expect(xpFor(reread, { streakDays: 1, now: NOW })).toBe(0);
  });

  /*
    The whole design in one assertion: a day of grinding new lessons cannot
    reach what a returning learner earns from cards that have aged, and the
    difference is time, which cannot be bought.
  */
  it("cannot be out-earned by grinding new lessons in one day", () => {
    const grind: XpEvent[] = Array.from({ length: 10 }, () => [
      { kind: "read-lesson", firstTime: true } as const,
      { kind: "exercise", firstTry: true } as const,
    ]).flat();
    const returning: XpEvent[] = Array.from({ length: 20 }, () => ({
      kind: "review" as const,
      rating: "good" as const,
      lastReviewedAt: NOW - 70 * DAY,
    }));

    const grindScore = xpFor(grind, { streakDays: 1, now: NOW });
    const returningScore = xpFor(returning, { streakDays: 1, now: NOW });

    expect(grindScore).toBe(400);
    expect(returningScore).toBeGreaterThan(grindScore * 5);
  });

  /*
    Rounding once on the total, not once per event. Per-event rounding loses a
    different amount depending on how the same day is split into calls, so the
    same work would score differently for no reason a learner could see.
  */
  it("applies the streak bonus to the total, not to each event", () => {
    const events: XpEvent[] = Array.from({ length: 3 }, () => ({
      kind: "review" as const,
      rating: "good" as const,
      lastReviewedAt: NOW - 2 * DAY, // 10 each
    }));
    expect(xpFor(events, { streakDays: 7, now: NOW })).toBe(Math.round(30 * 1.2));
  });

  it("gives no bonus below seven days and a bigger one at thirty", () => {
    expect(streakMultiplier(6)).toBe(1);
    expect(streakMultiplier(7)).toBeGreaterThan(1);
    expect(streakMultiplier(30)).toBeGreaterThan(streakMultiplier(29));
  });
});

describe("freeCreditsToday", () => {
  it("gives one credit for showing up", () => {
    expect(freeCreditsToday(0)).toBe(1);
  });

  it("earns one more per lesson", () => {
    expect(freeCreditsToday(1)).toBe(2);
    expect(freeCreditsToday(3)).toBe(4);
  });

  it("caps at four however much you study", () => {
    expect(freeCreditsToday(50)).toBe(FREE_DAILY_CAP);
  });

  it("never goes negative on nonsense input", () => {
    expect(freeCreditsToday(-5)).toBe(1);
  });
});
