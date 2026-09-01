import { describe, expect, it } from "vitest";

import type { CourseView } from "../view/lesson-view.js";
import { coursePickStatsOf } from "./course-pick-stats.js";

type LessonSummary = CourseView["units"][number]["lessons"][number];

function lesson(overrides: Partial<LessonSummary> = {}): LessonSummary {
  return {
    id: "lesson",
    title: "lesson",
    contentRevision: 1,
    cardCount: 0,
    exerciseCount: 0,
    exerciseIds: [],
    contentChars: 0,
    progress: null,
    ...overrides,
  };
}

function course(lessons: readonly LessonSummary[]): Pick<CourseView, "units"> {
  return {
    units: [
      {
        id: "unit",
        title: "unit",
        objective: "objective",
        lessons,
      },
    ],
  };
}

describe("coursePickStatsOf", () => {
  it("folds lesson and exercise counts into the maximum first-try XP", () => {
    expect(
      coursePickStatsOf(
        course([
          lesson({ exerciseCount: 2, evidenceCount: 3 }),
          lesson({ exerciseCount: 1, evidenceCount: 4 }),
        ]),
      ),
    ).toEqual({ lessons: 2, exercises: 3, maxXp: 105, evidenceCount: 7 });
  });

  it("does not publish a partial evidence total", () => {
    const stats = coursePickStatsOf(
      course([lesson({ exerciseCount: 1, evidenceCount: 3 }), lesson({ exerciseCount: 2 })]),
    );

    expect(stats).toEqual({ lessons: 2, exercises: 3, maxXp: 105 });
    expect("evidenceCount" in stats).toBe(false);
  });
});
