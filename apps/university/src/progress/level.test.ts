import { describe, expect, it } from "vitest";

import {
  XP_EXERCISE_FIRST_TRY,
  XP_READ_LESSON,
  levelOf,
  totalXpForLevel,
} from "@pieai/university-core";

import { library } from "../content/library";

const FULL_LIBRARY_TARGET_LEVEL = 20;
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
