import { afterEach, describe, expect, it } from "vitest";

import { NOT_STARTED } from "@pieai/university-core";
import type { LessonProgressSnapshot } from "@pieai/university-core";

import { progressSource } from "./source";
import { advanceLesson, lessonKey, resetAll } from "./store";

afterEach(() => {
  resetAll();
});

const ref = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "what-is-an-app",
  lessonId: "you-already-know-apps",
};

const UNSTARTED: LessonProgressSnapshot = { contentRevision: 1, exerciseIds: ["exercise"] };
const NO_EXERCISES: LessonProgressSnapshot = { contentRevision: 1, exerciseIds: [] };

describe("the online progress source", () => {
  it("returns NOT_STARTED for an untouched lesson with an exercise", () => {
    expect(progressSource().completionOf(ref, UNSTARTED)).toEqual(NOT_STARTED);
  });

  it("reports both flags true once the lesson is complete", () => {
    advanceLesson(lessonKey(ref.studyId, ref.courseId, ref.lessonId), 1);
    expect(progressSource().completionOf(ref, NO_EXERCISES)).toEqual({
      exercisesPassed: true,
      readConfirmed: true,
    });
  });

  it("ignores unitId, because the stored key has no unit segment", () => {
    // Two lessons sharing a lesson id across units would share this row.
    // No course does that today, which is the only reason the answer is safe.
    advanceLesson(lessonKey(ref.studyId, ref.courseId, ref.lessonId), 1);
    expect(
      progressSource().completionOf({ ...ref, unitId: "a-different-unit" }, NO_EXERCISES),
    ).toEqual({
      exercisesPassed: true,
      readConfirmed: true,
    });
  });
});
