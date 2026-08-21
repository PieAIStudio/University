import { afterEach, describe, expect, it } from "vitest";

import { NOT_STARTED } from "@pieai/university-core";

import type { Course, Lesson } from "../content/library";
import { courseShapeOf, progressSource } from "./source";
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

function lesson(id: string): Lesson {
  return {
    id,
    title: id,
    content: "",
    evidence: [],
    assets: [],
    cards: [],
    exercises: [],
  };
}

function courseOf(id: string, units: Course["units"]): Course {
  return {
    id,
    title: id,
    description: "",
    audience: "",
    objectives: [],
    prerequisiteCourseIds: [],
    trackId: null,
    units,
  };
}

describe("the online progress source", () => {
  it("returns NOT_STARTED for an untouched lesson", () => {
    expect(progressSource().completionOf(ref)).toEqual(NOT_STARTED);
  });

  it("reports both flags true once the lesson is complete", () => {
    advanceLesson(lessonKey(ref.studyId, ref.courseId, ref.lessonId), 1);
    expect(progressSource().completionOf(ref)).toEqual({
      exercisesPassed: true,
      readConfirmed: true,
    });
  });

  it("ignores unitId, because the stored key has no unit segment", () => {
    // Two lessons sharing a lesson id across units would share this row.
    // No course does that today, which is the only reason the answer is safe.
    advanceLesson(lessonKey(ref.studyId, ref.courseId, ref.lessonId), 1);
    expect(progressSource().completionOf({ ...ref, unitId: "a-different-unit" })).toEqual({
      exercisesPassed: true,
      readConfirmed: true,
    });
  });
});

describe("the online course shape", () => {
  it("keeps the study id the package itself does not store", () => {
    const course = courseOf("foundations-before-zero", [
      {
        id: "u1",
        title: "One",
        objective: "",
        lessons: [lesson("a"), lesson("b")],
      },
      { id: "u2", title: "Two", objective: "", lessons: [lesson("c")] },
    ]);
    expect(courseShapeOf(course, "turing-pact")).toEqual({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      units: [
        { unitId: "u1", lessonIds: ["a", "b"] },
        { unitId: "u2", lessonIds: ["c"] },
      ],
    });
  });
});
