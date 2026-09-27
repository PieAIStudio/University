import { describe, expect, it } from "vitest";

import { compileAnswerKey } from "../grading/answer-key.js";
import type { ProgressDocument } from "../ports/progress.js";
import { emptyProgress } from "./document.js";
import {
  pickWeeklyBossQuestions,
  recentlyFinishedLessons,
  weeklyBoss,
  weeklyBossBeaten,
  weeklyBossWeek,
  weeklyBossWonEventId,
  WEEKLY_BOSS_QUESTIONS,
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

describe("the weekly boss", () => {
  it("names its week by the Monday it arrived, in the learner's own time", () => {
    expect(weeklyBossWeek(on(9, 28))).toBe("2026-09-28");
    expect(weeklyBossWeek(on(10, 4, 23))).toBe("2026-09-28");
    expect(weeklyBossWeek(on(10, 5, 0))).toBe("2026-10-05");
  });

  it("stands on the island studied most in the last seven days", () => {
    const document = emptyProgress();
    for (const [index, lesson] of ["a", "b", "c"].entries())
      finished(document, "prompting", lesson, on(9, 29 + index));
    for (const lesson of ["d", "e"]) finished(document, "tools", lesson, on(10, 3));
    const boss = weeklyBoss(document, on(10, 4), oneEach);
    expect(boss?.island).toEqual({ studyId: "s", courseId: "prompting" });
    expect(boss?.week).toBe("2026-09-28");
    expect(boss?.leavesAt).toBe(on(10, 5, 0));
  });

  it("comes on Monday with last week's work, so the week has its appointment", () => {
    const document = emptyProgress();
    for (const [index, lesson] of ["a", "b", "c", "d", "e"].entries())
      finished(document, "prompting", lesson, on(9, 23 + index));
    const monday = weeklyBoss(document, on(9, 28, 9), oneEach);
    expect(monday?.pool).toHaveLength(WEEKLY_BOSS_QUESTIONS);
    // Seven days back from Wednesday 13:00 is last Wednesday 13:00: that day's noon lesson has aged out.
    expect(
      recentlyFinishedLessons(document, on(9, 30, 13)).map((lesson) => lesson.lessonId),
    ).toEqual(["e", "d", "c", "b"]);
  });

  it("does not come at all with fewer than five questions: the pool is never padded", () => {
    const document = emptyProgress();
    for (const lesson of ["a", "b", "c", "d"]) finished(document, "prompting", lesson, on(9, 29));
    expect(weeklyBoss(document, on(9, 30), oneEach)).toBeNull();
    // Five lessons, but one's only exercise needs a model to judge: still four.
    finished(document, "prompting", "open", on(9, 29));
    const open = (lesson: { lessonId: string }) =>
      lesson.lessonId === "open" ? [{ id: "e", prompt: "Explain in your own words." }] : oneEach();
    expect(weeklyBoss(document, on(9, 30), open)).toBeNull();
    expect(weeklyBoss(emptyProgress(), on(9, 30), oneEach)).toBeNull();
  });

  it("asks five spread across the lessons, and leaves beaten with at most one wrong", () => {
    const document = emptyProgress();
    for (const lesson of ["a", "b", "c", "d", "e", "f"])
      finished(document, "prompting", lesson, on(9, 29));
    const boss = weeklyBoss(document, on(9, 30), oneEach)!;
    const questions = pickWeeklyBossQuestions(boss.pool, () => 0);
    expect(questions).toHaveLength(5);
    expect(new Set(questions.map((question) => question.lessonId)).size).toBe(5);
    expect(weeklyBossBeaten(questions, ["a", "a", "a", "a", "a"])).toBe(true);
    expect(weeklyBossBeaten(questions, ["a", "a", "a", "a", "x"])).toBe(true);
    expect(weeklyBossBeaten(questions, ["a", "a", "a", "x", ""])).toBe(false);
  });

  it("stays beaten for the rest of its week on every device, and comes back next Monday", () => {
    const document = emptyProgress();
    for (const lesson of ["a", "b", "c", "d", "e"])
      finished(document, "prompting", lesson, on(10, 1));
    document.xpEvents[weeklyBossWonEventId("2026-09-28")] = 0;
    expect(weeklyBoss(document, on(10, 2), oneEach)?.beaten).toBe(true);
    expect(weeklyBoss(document, on(10, 5, 9), oneEach)?.beaten).toBe(false);
  });
});
