import { describe, expect, it } from "vitest";

import {
  XP_EXERCISE_FIRST_TRY,
  XP_READ_LESSON,
  levelOf,
  totalXpForLevel,
} from "@pieai/university-core";

import { library } from "../content/library";

const XP_PER_FIRST_PASS_LESSON = XP_READ_LESSON + XP_EXERCISE_FIRST_TRY;

function lessonCount(): number {
  return library.studies.reduce(
    (studyTotal, study) =>
      studyTotal + study.courses.reduce((courseTotal, course) => courseTotal + course.lessons, 0),
    0,
  );
}

/*
  A level says how much this learner has done, never what fraction of the shelf
  they have done.

  This file used to assert that a first pass over the whole library landed
  exactly on level 20. That tied the ceiling to the catalogue: retiring a study
  moved it to 18, and every course published afterwards would have moved it
  again — so the same number meant something different each month, and the test
  broke on content changes that were not defects. The planned AIGC and English
  shelves would have made it worse.

  So these assert the curve's shape instead. They hold whether the library has
  forty courses or four hundred.
*/
describe("the XP curve", () => {
  it("levels a learner up on their very first lesson", () => {
    // The reason the curve exists, and the one promise a beginner can feel.
    expect(XP_PER_FIRST_PASS_LESSON).toBeGreaterThanOrEqual(totalXpForLevel(2));
    expect(levelOf(XP_PER_FIRST_PASS_LESSON).level).toBeGreaterThanOrEqual(2);
  });

  it("asks for more each time, never the same or less", () => {
    let previousStep = 0;
    for (let level = 2; level <= 60; level += 1) {
      const step = totalXpForLevel(level) - totalXpForLevel(level - 1);
      expect(step, `level ${level} costs no more than the one before`).toBeGreaterThan(
        previousStep,
      );
      previousStep = step;
    }
  });

  it("keeps early levels frequent and later ones rare", () => {
    const lessonsFor = (level: number) =>
      Math.ceil(totalXpForLevel(level) / XP_PER_FIRST_PASS_LESSON);
    expect(lessonsFor(5)).toBeLessThanOrEqual(30);
    expect(lessonsFor(10)).toBeGreaterThan(lessonsFor(5) * 3);
    expect(lessonsFor(30)).toBeGreaterThan(1000);
  });

  it("has room for every shelf still to be published", () => {
    // Ten times today's library must still land inside the curve, with the
    // levels far enough apart that a bigger catalogue is progress, not a cap.
    const today = lessonCount();
    expect(today).toBeGreaterThan(0);
    const nowLevel = levelOf(today * XP_PER_FIRST_PASS_LESSON).level;
    const tenfoldLevel = levelOf(today * 10 * XP_PER_FIRST_PASS_LESSON).level;
    expect(tenfoldLevel).toBeGreaterThan(nowLevel);
    expect(Number.isFinite(totalXpForLevel(200))).toBe(true);
  });
});
