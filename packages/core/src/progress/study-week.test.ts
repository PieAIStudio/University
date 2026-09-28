import { describe, expect, it } from "vitest";

import type { ProgressDocument } from "../ports/progress.js";
import { emptyProgress } from "./document.js";
import { studyWeek, todayGoalProgress } from "./study-week.js";

/** Local noon; 2026-09-28 is a Monday. */
const on = (month: number, date: number, hour = 12) =>
  new Date(2026, month - 1, date, hour).getTime();

describe("the avatar panel's week", () => {
  it("lights the days with any study, marks rest days, and knows today", () => {
    const document = emptyProgress();
    document.lessons["s/c/l1"] = {
      progress: 1,
      completedAt: on(9, 28),
      attempts: 1,
    } as ProgressDocument["lessons"][string];
    document.exerciseAttempts.x = {
      commandId: "x",
      locator: { studyId: "s", courseId: "c", unitId: "u", lessonId: "l2" },
      exerciseId: "e",
      contentRevision: 1,
      answer: "a",
      score: 1,
      maxScore: 1,
      hostGrade: null,
      occurredAt: new Date(on(9, 30)).toISOString(),
    };
    document.streak = {
      days: 3,
      lastDay: "2026-09-30",
      rest: { granted: ["week:2026-09-28"], covered: ["2026-09-29"] },
    };
    const week = studyWeek(document, on(10, 1));
    expect(week.map((day) => day.day)).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(week.map((day) => day.studied)).toEqual([true, false, true, false, false, false, false]);
    expect(week[1]!.rested).toBe(true);
    expect(week.findIndex((day) => day.today)).toBe(3);
  });

  it("counts today's goal from the scored quests, full when every one is done", () => {
    const fresh = emptyProgress();
    expect(todayGoalProgress(fresh, on(9, 28))).toBe(0);
    const done = emptyProgress();
    done.lessons["s/c/l1"] = {
      progress: 1,
      completedAt: on(9, 28, 9),
      attempts: 1,
    } as ProgressDocument["lessons"][string];
    done.streak = { days: 1, lastDay: "2026-09-28" };
    // Nothing due: the review quest is informational, so lesson and streak are the goal.
    expect(todayGoalProgress(done, on(9, 28))).toBe(1);
  });
});
