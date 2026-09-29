import { describe, expect, it } from "vitest";

import { emptyProgress } from "./document.js";
import type { ProgressDocument } from "../ports/progress.js";
import {
  badgesFor,
  calendarDay,
  challengeWonEventId,
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

it("does not award a completed-level badge before a modern record confirms reading", () => {
  const document = docWith({
    lessons: { "s/c/l": { progress: 1, completedAt: NOW, attempts: 1, readConfirmed: false } },
    exerciseAttempts: {
      a: {
        commandId: "a",
        locator: { studyId: "s", courseId: "c", unitId: "u", lessonId: "l" },
        exerciseId: "q",
        contentRevision: 1,
        answer: "a",
        score: 1,
        maxScore: 1,
        hostGrade: null,
        occurredAt: new Date(NOW).toISOString(),
      },
    },
  });
  expect(completedLessons(document)).toBe(0);
  expect(badgesFor(document).find((badge) => badge.id === "first-lesson")?.earned).toBe(false);
  expect(badgesFor(document).find((badge) => badge.id === "perfect-lesson")?.earned).toBe(false);
  document.lessons["s/c/l"] = { ...document.lessons["s/c/l"]!, readConfirmed: true };
  expect(completedLessons(document)).toBe(1);
  expect(badgesFor(document).find((badge) => badge.id === "perfect-lesson")?.earned).toBe(true);
});

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

describe("the seven badges V7 added", () => {
  const LESSON = { studyId: "s", courseId: "c", unitId: "u", lessonId: "l1" } as const;
  const minute = (n: number) => new Date(NOW + n * 60_000).toISOString();

  function attempt(
    exerciseId: string,
    at: number,
    result: "pass" | "fail" | null,
    { lessonId = LESSON.lessonId, revision = 1 } = {},
  ): ProgressDocument["exerciseAttempts"][string] {
    const passed = result === "pass";
    return {
      commandId: `${lessonId}:${exerciseId}:${at}`,
      locator: { ...LESSON, lessonId },
      exerciseId,
      contentRevision: revision,
      answer: "a",
      score: passed ? 1 : 0,
      maxScore: 1,
      hostGrade:
        result === null
          ? null
          : {
              passed,
              outcome: result,
              evaluation: "",
              extensions: [],
              host: "test",
              learnerAnswer: "a",
              occurredAt: minute(at),
            },
      occurredAt: minute(at),
    };
  }
  const log = (...records: ProgressDocument["exerciseAttempts"][string][]) =>
    Object.fromEntries(records.map((record) => [record.commandId, record]));
  const badge = (document: ProgressDocument, id: string, ...extra: number[]) =>
    badgesFor(document, ...extra).find((entry) => entry.id === id)!;

  it("are all on the wall, seventeen in total, each with its rule", () => {
    const ids = badgesFor(emptyProgress()).map((entry) => entry.id);
    expect(ids).toHaveLength(17);
    expect(new Set(ids).size).toBe(17);
    for (const id of [
      "mistakes-cleared",
      "own-words",
      "three-courses",
      "both-paths",
      "perfect-lesson",
      "challenger",
      "skip-test",
    ])
      expect(ids).toContain(id);
  });

  it("一次全对 needs a finished lesson whose every first answer was right", () => {
    const finished = { l1: { progress: 1, completedAt: NOW, attempts: 1 } };
    const perfect = docWith({
      lessons: { "s/c/l1": finished.l1 },
      exerciseAttempts: log(attempt("e1", 1, "pass"), attempt("e2", 2, "pass")),
    });
    expect(badge(perfect, "perfect-lesson").earned).toBe(true);
    // Wrong first, right after: the lesson is finished, the badge is not.
    const retried = docWith({
      lessons: { "s/c/l1": finished.l1 },
      exerciseAttempts: log(attempt("e1", 1, "fail"), attempt("e1", 2, "pass")),
    });
    expect(badge(retried, "perfect-lesson").earned).toBe(false);
    // Perfect so far, but the lesson was left before the end.
    const unfinished = docWith({ exerciseAttempts: log(attempt("e1", 1, "pass")) });
    expect(badge(unfinished, "perfect-lesson").earned).toBe(false);
  });

  it("错题清零 counts the moment the book was empty, even if a mistake came later", () => {
    const cleared = docWith({
      exerciseAttempts: log(
        attempt("e1", 1, "fail"),
        attempt("e2", 2, "fail"),
        attempt("e1", 3, "pass"),
        attempt("e2", 4, "pass"),
        attempt("e3", 5, "fail"),
      ),
    });
    expect(badge(cleared, "mistakes-cleared").earned).toBe(true);
    // Half put right: locked, halfway.
    const half = docWith({
      exerciseAttempts: log(
        attempt("e1", 1, "fail"),
        attempt("e2", 2, "fail"),
        attempt("e1", 3, "pass"),
      ),
    });
    expect(badge(half, "mistakes-cleared").earned).toBe(false);
    expect(badge(half, "mistakes-cleared").progress).toBeCloseTo(0.5);
    // Never wrong is not "cleared": there was nothing to clear.
    const neverWrong = docWith({ exerciseAttempts: log(attempt("e1", 1, "pass")) });
    expect(badge(neverWrong, "mistakes-cleared").earned).toBe(false);
    // A submission still waiting for its verdict is neither a mistake nor a fix.
    const waiting = docWith({
      exerciseAttempts: log(attempt("e1", 1, "fail"), attempt("e1", 2, null)),
    });
    expect(badge(waiting, "mistakes-cleared").earned).toBe(false);
  });

  it("错题清零 follows an exercise to its newer revision, as the book does", () => {
    const rewritten = docWith({
      exerciseAttempts: log(attempt("e1", 1, "fail"), attempt("e1", 2, "pass", { revision: 2 })),
    });
    expect(badge(rewritten, "mistakes-cleared").earned).toBe(true);
    // A pass on the old revision does not fix the new one's mistake.
    const stale = docWith({
      exerciseAttempts: log(
        attempt("e1", 1, "fail", { revision: 2 }),
        attempt("e1", 2, "pass", { revision: 1 }),
      ),
    });
    expect(badge(stale, "mistakes-cleared").earned).toBe(false);
  });

  it("自己的话 counts one teach-back card per lesson", () => {
    const cards: ProgressDocument["cards"] = {};
    for (let index = 0; index < 4; index += 1) cards[`s/c/u/l${index}/__recap__`] = card();
    cards["s/c/u/l9/ordinary"] = card();
    const four = docWith({ cards });
    expect(badge(four, "own-words").earned).toBe(false);
    expect(badge(four, "own-words").progress).toBeCloseTo(0.8);
    cards["s/c/u/l4/__recap__"] = card();
    expect(badge(docWith({ cards }), "own-words").earned).toBe(true);
  });

  it("三座岛 and 两条路 read what the catalogue knows about finished courses", () => {
    expect(badge(emptyProgress(), "three-courses", 2).earned).toBe(false);
    expect(badge(emptyProgress(), "three-courses", 3).earned).toBe(true);
    // Three courses down one road is still one road.
    expect(badge(emptyProgress(), "both-paths", 3, 1).earned).toBe(false);
    expect(badge(emptyProgress(), "both-paths", 2, 2).earned).toBe(true);
  });

  it("挑战者 and 跳级 read the synced wins and proofs", () => {
    expect(badge(emptyProgress(), "challenger").earned).toBe(false);
    const won = docWith({ xpEvents: { [challengeWonEventId("s/c/gate-1")]: 30 } });
    expect(badge(won, "challenger").earned).toBe(true);
    // Other XP never counts as a challenge.
    const read = docWith({ xpEvents: { "lesson-read:s/c/l1": 15 } });
    expect(badge(read, "challenger").earned).toBe(false);
    const proven = docWith({
      provenLessons: { "s/c/l1": { lessonKey: "s/c/l1", unitId: "u", provenAt: NOW } },
    });
    expect(badge(proven, "skip-test").earned).toBe(true);
  });
});
