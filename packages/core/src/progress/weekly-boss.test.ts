import { describe, expect, it } from "vitest";

import { compileAnswerKey } from "../grading/answer-key.js";
import type { ProgressDocument } from "../ports/progress.js";
import { emptyProgress } from "./document.js";
import {
  answerWeeklyBoss,
  startWeeklyBossRound,
  weeklyBoss,
  weeklyBossDaysLeft,
  weeklyBossFlawless,
  weeklyBossHeartsLeft,
  weeklyBossLessons,
  weeklyBossRoundOver,
  weeklyBossRoundWon,
  weeklyBossWeek,
  weeklyBossWonEventId,
  WEEKLY_BOSS_HEARTS,
  WEEKLY_BOSS_HIT_XP,
  type WeeklyBossRound,
} from "./weekly-boss.js";

/** Local noon; 2026-09-28 is a Monday. */
const on = (month: number, date: number, hour = 12) =>
  new Date(2026, month - 1, date, hour).getTime();

function finished(document: ProgressDocument, courseId: string, lessonId: string, at: number) {
  document.lessons[`s/${courseId}/${lessonId}`] = {
    progress: 1,
    completedAt: at,
    attempts: 1,
  } as ProgressDocument["lessons"][string];
}

/** Each lesson carries one exercise that grades deterministically, answered "a". */
const oneEach = () => [{ id: "e", prompt: "Which one?", answerKey: compileAnswerKey("a") }];

function weekOf(lessons: readonly string[], at = on(9, 29)) {
  const document = emptyProgress();
  for (const lesson of lessons) finished(document, "prompting", lesson, at);
  return document;
}

/** Answer a round and write each heart the way the app does: as an XP event. */
function play(document: ProgressDocument, round: WeeklyBossRound, answers: readonly string[]) {
  let current = round;
  for (const answer of answers) {
    const step = answerWeeklyBoss(current, answer);
    if (step.hitEventId) document.xpEvents[step.hitEventId] = WEEKLY_BOSS_HIT_XP;
    current = step.round;
  }
  return current;
}

describe("the weekly boss", () => {
  it("names its week by the Monday it arrived, in the learner's own time", () => {
    expect(weeklyBossWeek(on(9, 28))).toBe("2026-09-28");
    expect(weeklyBossWeek(on(10, 4, 23))).toBe("2026-09-28");
    expect(weeklyBossWeek(on(10, 5, 0))).toBe("2026-10-05");
  });

  it("stands where the learner last finished a lesson, and leaves at the end of Sunday", () => {
    const document = emptyProgress();
    for (const lesson of ["a", "b", "c", "d"]) finished(document, "prompting", lesson, on(9, 29));
    finished(document, "tools", "e", on(10, 3));
    const boss = weeklyBoss(document, on(10, 4), oneEach);
    expect(boss?.island).toEqual({ studyId: "s", courseId: "tools" });
    expect(boss?.week).toBe("2026-09-28");
    expect(boss?.leavesAt).toBe(on(10, 5, 0));
    expect(weeklyBossDaysLeft(boss!, on(10, 4))).toBe(1);
    expect(weeklyBossDaysLeft(boss!, on(9, 28, 9))).toBe(7);
  });

  it("comes on Monday with last week's work, and its pool only grows until Sunday", () => {
    const document = emptyProgress();
    for (const [index, lesson] of ["a", "b", "c", "d", "e"].entries())
      finished(document, "prompting", lesson, on(9, 21 + index));
    const monday = weeklyBoss(document, on(9, 28, 9), oneEach);
    expect(monday?.hearts).toBe(WEEKLY_BOSS_HEARTS);
    expect(monday?.pool).toHaveLength(5);
    // Sunday still reaches back to last Monday: nothing that took a heart ages out.
    expect(weeklyBossLessons(document, on(10, 4, 23))).toHaveLength(5);
    // The Monday before last is outside every window of this week.
    finished(document, "prompting", "old", on(9, 20));
    expect(
      weeklyBossLessons(document, on(9, 28, 9)).map((lesson) => lesson.lessonId),
    ).not.toContain("old");
  });

  it("does not come at all with fewer than five questions: the pool is never padded", () => {
    const document = weekOf(["a", "b", "c", "d"]);
    expect(weeklyBoss(document, on(9, 30), oneEach)).toBeNull();
    // Five lessons, but one's only exercise needs a model to judge: still four.
    finished(document, "prompting", "open", on(9, 29));
    const open = (lesson: { lessonId: string }) =>
      lesson.lessonId === "open" ? [{ id: "e", prompt: "Explain in your own words." }] : oneEach();
    expect(weeklyBoss(document, on(9, 30), open)).toBeNull();
    expect(weeklyBoss(emptyProgress(), on(9, 30), oneEach)).toBeNull();
  });

  it("asks as many as it has hearts, spread across the lessons", () => {
    const boss = weeklyBoss(weekOf(["a", "b", "c", "d", "e", "f"]), on(9, 30), oneEach)!;
    const round = startWeeklyBossRound(boss, () => 0);
    expect(round.questions).toHaveLength(5);
    expect(new Set(round.questions.map((question) => question.lessonId)).size).toBe(5);
  });

  it("keeps a taken heart taken: a miss costs nothing and the next round asks only what is left", () => {
    const document = weekOf(["a", "b", "c", "d", "e"]);
    const first = play(
      document,
      startWeeklyBossRound(weeklyBoss(document, on(9, 30), oneEach)!, () => 0),
      ["a", "x", "a", "", "a"],
    );
    // The blank one asked for an answer instead of counting; the round is not over.
    expect(first.verdicts).toEqual(["correct", "wrong", "correct", "correct"]);
    expect(weeklyBossRoundOver(first)).toBe(false);
    const done = play(document, first, ["x"]);
    expect(weeklyBossRoundOver(done)).toBe(true);
    expect(weeklyBossRoundWon(done)).toBe(false);
    expect(weeklyBossHeartsLeft(done)).toBe(2);

    // Later, on any device: the boss remembers, and asks only the two it still has.
    const later = weeklyBoss(document, on(10, 1), oneEach)!;
    expect(later.hearts).toBe(2);
    expect(later.pool).toHaveLength(2);
    const second = play(
      document,
      startWeeklyBossRound(later, () => 0),
      ["a", "a"],
    );
    expect(weeklyBossRoundWon(second)).toBe(true);
    expect(weeklyBossFlawless(second)).toBe(false);
  });

  it("is flawless only for five in a row from full hearts", () => {
    const document = weekOf(["a", "b", "c", "d", "e"]);
    const round = play(
      document,
      startWeeklyBossRound(weeklyBoss(document, on(9, 30), oneEach)!, () => 0),
      ["a", "a", "a", "a", "a"],
    );
    expect(weeklyBossRoundWon(round)).toBe(true);
    expect(weeklyBossFlawless(round)).toBe(true);
  });

  it("the same question cannot take two hearts", () => {
    const document = weekOf(["a", "b", "c", "d", "e"]);
    const boss = weeklyBoss(document, on(9, 30), oneEach)!;
    play(
      document,
      startWeeklyBossRound(boss, () => 0),
      ["a"],
    );
    play(
      document,
      startWeeklyBossRound(boss, () => 0),
      ["a"],
    );
    expect(weeklyBoss(document, on(9, 30), oneEach)?.hearts).toBe(4);
  });

  it("stays beaten for the rest of its week on every device, and comes back next Monday", () => {
    const document = weekOf(["a", "b", "c", "d", "e"], on(10, 1));
    document.xpEvents[weeklyBossWonEventId("2026-09-28")] = 0;
    expect(weeklyBoss(document, on(10, 2), oneEach)).toMatchObject({ beaten: true, hearts: 0 });
    expect(weeklyBoss(document, on(10, 5, 9), oneEach)).toMatchObject({ beaten: false, hearts: 5 });
  });

  it("finishes with one question when two devices took the last hearts without the win", () => {
    const document = weekOf(["a", "b", "c", "d", "e", "f"]);
    const boss = weeklyBoss(document, on(9, 30), oneEach)!;
    const all = startWeeklyBossRound(boss, () => 0);
    for (const question of all.questions)
      document.xpEvents[`weekly-boss:2026-09-28:hit:${question.lessonId}#${question.exerciseId}`] =
        WEEKLY_BOSS_HIT_XP;
    const stranded = weeklyBoss(document, on(9, 30), oneEach)!;
    expect(stranded).toMatchObject({ beaten: false, hearts: 0 });
    const round = startWeeklyBossRound(stranded, () => 0);
    expect(round.questions).toHaveLength(1);
    expect(weeklyBossRoundWon(play(document, round, ["a"]))).toBe(true);
  });
});
