import { describe, expect, it } from "vitest";

import {
  XP_EXERCISE_FIRST_TRY,
  XP_READ_LESSON,
  levelOf,
  totalXpForLevel,
} from "@pieai/university-core";

import { library } from "../content/library";

/*
  Where a completionist lands, not a target the curve is tuned to hit.

  It was 20 while the library held 579 lessons. Retiring the UniversityLocal
  study on 2026-08-31 took it to 495, and 40 XP a lesson now tops out at 18 —
  level 20 wants 570. This is bookkeeping, not a fix: whether the ceiling
  should be pulled back to 20 by retuning the curve, or left to climb again as
  courses are published, is a game-feel decision and belongs to the owner.
*/
const FULL_LIBRARY_TARGET_LEVEL = 18;
const XP_PER_FIRST_PASS_LESSON = XP_READ_LESSON + XP_EXERCISE_FIRST_TRY;

function lessonCount(): number {
  return library.studies.reduce(
    (studyTotal, study) =>
      studyTotal + study.courses.reduce((courseTotal, course) => courseTotal + course.lessons, 0),
    0,
  );
}

describe("the imported library's first-pass XP", () => {
  it("lands exactly inside the designed full-library level", () => {
    const totalXp = lessonCount() * XP_PER_FIRST_PASS_LESSON;
    const level = levelOf(totalXp);

    expect(level.level).toBe(FULL_LIBRARY_TARGET_LEVEL);
    expect(totalXp).toBeGreaterThanOrEqual(totalXpForLevel(FULL_LIBRARY_TARGET_LEVEL));
    expect(totalXp).toBeLessThan(totalXpForLevel(FULL_LIBRARY_TARGET_LEVEL + 1));
  });
});
