import { describe, expect, it } from "vitest";

import { emptyProgress } from "./document.js";
import type { ProgressDocument } from "../ports/progress.js";
import {
  badgesFor,
  calendarDay,
  completedLessons,
  longTermCards,
  questComplete,
  questsForToday,
  scoredQuests,
  leagueStanding,
  LONG_TERM_STABILITY_DAYS,
} from "./goals.js";

const NOW = new Date(2026, 7, 23, 10, 0, 0).getTime();
const DAY = 86_400_000;

function card(over: Partial<ProgressDocument["cards"][string]["fsrs"]> = {}, dueAt = NOW - 1000) {
  return {
    cardKey: `k${Math.random()}`,
    studyId: "s",
    courseId: "c",
    lessonId: "l",
    dueAt,
    fsrs: {
      due: new Date(dueAt).toISOString(),
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 1,
      learning_steps: 0,
      reps: 1,
      lapses: 0,
      state: 1,
      ...over,
    },
  } as ProgressDocument["cards"][string];
}

function docWith(patch: Partial<ProgressDocument>): ProgressDocument {
  return { ...emptyProgress(), ...patch };
}

describe("questsForToday", () => {
  it("asks for one lesson, and counts only today's", () => {
    const document = docWith({
      lessons: {
        a: { progress: 1, completedAt: NOW - 2 * DAY, attempts: 1 },
        b: { progress: 1, completedAt: NOW - 3600_000, attempts: 1 },
      },
    });
    const [lesson] = questsForToday(document, NOW);
    expect(lesson!.done).toBe(1);
    expect(questComplete(lesson!)).toBe(true);
  });

  /*
    The rule that keeps the quest from breaking the scheduler. A fixed goal of
    ten teaches people to review cards that are not due, and reviewing early is
    exactly what makes the interval meaningless.
  */
  it("sets the review goal to what is actually due, not a round number", () => {
    const document = docWith({
      cards: { a: card({}, NOW - 1000), b: card({}, NOW - 1000), c: card({}, NOW + 5 * DAY) },
    });
    const review = questsForToday(document, NOW)[1]!;
    expect(review.goal).toBe(2);
  });

  /*
    Nothing due is a fact worth telling someone — it is how the product teaches
    that reviewing early is the one thing that breaks spaced repetition. But it
    must not be scored, or a brand-new learner opens the app already a third of
    the way through their day without having done anything.
  */
  it("says so plainly when the scheduler has nothing due, and does not score it", () => {
    const quests = questsForToday(emptyProgress(), NOW);
    const quest = quests[1]!;
    expect(quest.goal).toBe(0);
    expect(quest.title).toContain("没有到期");
    expect(quest.informational).toBe(true);
    expect(scoredQuests(quests)).toHaveLength(2);
  });

  it("scores it again the moment a card comes due", () => {
    const quests = questsForToday(docWith({ cards: { a: card({}, NOW - 1000) } }), NOW);
    expect(quests[1]!.informational).toBe(false);
    expect(scoredQuests(quests)).toHaveLength(3);
  });

  /*
    A card reviewed today is done even though it is no longer due — otherwise
    finishing the queue would make the quest read 0/0 and the learner would
    have watched their own progress disappear.
  */
  it("still counts a card that was reviewed today and is no longer due", () => {
    const document = docWith({
      cards: {
        a: card({ last_review: new Date(NOW - 3600_000).toISOString() }, NOW + 3 * DAY),
      },
    });
    const review = questsForToday(document, NOW)[1]!;
    expect(review.done).toBe(1);
    expect(review.goal).toBe(1);
    expect(questComplete(review)).toBe(true);
  });

  it("gives three quests and no more", () => {
    expect(questsForToday(emptyProgress(), NOW)).toHaveLength(3);
  });
});

describe("badges", () => {
  it("starts with none earned and every rule visible", () => {
    const badges = badgesFor(emptyProgress());
    expect(badges.some((badge) => badge.earned)).toBe(false);
    expect(badges.every((badge) => badge.how.length > 0)).toBe(true);
  });

  /*
    The wall must not be clearable by volume. Three badges need elapsed calendar
    days and one needs the scheduler to agree the cards stuck, so a person who
    reads a hundred lessons in one sitting still cannot have them.
  */
  it("cannot be cleared in one day however much is read", () => {
    const lessons: ProgressDocument["lessons"] = {};
    for (let index = 0; index < 200; index += 1) {
      lessons[`l${index}`] = { progress: 1, completedAt: NOW, attempts: 1 };
    }
    const badges = badgesFor(docWith({ lessons, streak: { days: 1, lastDay: "2026-08-23" } }));
    const locked = badges.filter((badge) => !badge.earned).map((badge) => badge.id);
    expect(locked).toContain("streak-7");
    expect(locked).toContain("streak-30");
    expect(locked).toContain("streak-100");
    expect(locked).toContain("long-term-50");
  });

  it("counts a card as remembered only once the scheduler says it will hold", () => {
    const document = docWith({
      cards: {
        a: card({ stability: LONG_TERM_STABILITY_DAYS + 1 }),
        b: card({ stability: LONG_TERM_STABILITY_DAYS - 1 }),
      },
    });
    expect(longTermCards(document)).toBe(1);
  });

  it("shows partial progress on a locked badge rather than a question mark", () => {
    const lessons: ProgressDocument["lessons"] = {};
    for (let index = 0; index < 5; index += 1) {
      lessons[`l${index}`] = { progress: 1, completedAt: NOW, attempts: 1 };
    }
    const ten = badgesFor(docWith({ lessons })).find((badge) => badge.id === "ten-lessons")!;
    expect(ten.earned).toBe(false);
    expect(ten.progress).toBeCloseTo(0.5);
  });

  it("ignores a lesson that was opened but never finished", () => {
    const document = docWith({
      lessons: { a: { progress: 0.4, completedAt: null, attempts: 2 } },
    });
    expect(completedLessons(document)).toBe(0);
  });
});

describe("calendarDay", () => {
  it("is a local day, so a late-night session belongs to that night", () => {
    const late = new Date(2026, 7, 23, 23, 30).getTime();
    const earlier = new Date(2026, 7, 23, 7, 0).getTime();
    expect(calendarDay(late)).toBe(calendarDay(earlier));
  });
});

describe("leagueStanding", () => {
  it("starts everyone on the bottom step", () => {
    const standing = leagueStanding(emptyProgress(), NOW);
    expect(standing.tier.id).toBe("stone");
    expect(standing.progress).toBe(0);
  });

  /*
    The property the whole tier system exists for. Reading two hundred lessons
    in one sitting moves nothing here, because the tier is cut on cards whose
    interval has already stretched past three weeks — and three weeks cannot be
    spent in an afternoon.
  */
  it("cannot be climbed by reading, only by remembering", () => {
    const lessons: ProgressDocument["lessons"] = {};
    for (let index = 0; index < 200; index += 1) {
      lessons[`l${index}`] = { progress: 1, completedAt: NOW, attempts: 1 };
    }
    expect(leagueStanding(docWith({ lessons }), NOW).tier.id).toBe("stone");
  });

  it("promotes once enough cards have actually stuck", () => {
    const cards: ProgressDocument["cards"] = {};
    for (let index = 0; index < 12; index += 1) {
      cards[`c${index}`] = card({ stability: LONG_TERM_STABILITY_DAYS + 5 });
    }
    expect(leagueStanding(docWith({ cards }), NOW).tier.id).toBe("bronze");
  });

  it("stops at the top instead of reporting progress past it", () => {
    const cards: ProgressDocument["cards"] = {};
    for (let index = 0; index < 500; index += 1) {
      cards[`c${index}`] = card({ stability: 90 });
    }
    const standing = leagueStanding(docWith({ cards }), NOW);
    expect(standing.next).toBeNull();
    expect(standing.progress).toBe(1);
  });

  it("counts this week from Monday, not from seven days ago", () => {
    const monday = new Date(2026, 7, 17, 9, 0).getTime(); // a Monday
    const sunday = new Date(2026, 7, 16, 23, 0).getTime();
    const wednesday = new Date(2026, 7, 19, 9, 0).getTime();
    const document = docWith({
      lessons: {
        old: { progress: 1, completedAt: sunday, attempts: 1 },
        recent: { progress: 1, completedAt: wednesday, attempts: 1 },
      },
    });
    expect(leagueStanding(document, monday + 3 * DAY).lessonsThisWeek).toBe(1);
  });
});
