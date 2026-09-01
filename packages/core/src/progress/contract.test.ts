import { describe, expect, it } from "vitest";

import {
  courseShapeOf,
  isLessonComplete,
  lessonRefKey,
  NOT_STARTED,
  parseLessonRefKey,
  readCourseProgress,
  type CourseShape,
  type LessonCompletion,
  type LessonRef,
  type ProgressSource,
} from "./contract.js";

const course: CourseShape = {
  studyId: "turingpact",
  courseId: "foundations-before-zero",
  units: [
    {
      unitId: "u1",
      lessons: [
        { lessonId: "a", contentRevision: 8, exerciseIds: [] },
        { lessonId: "b", contentRevision: 8, exerciseIds: [] },
      ],
    },
    { unitId: "u2", lessons: [{ lessonId: "c", contentRevision: 8, exerciseIds: [] }] },
  ],
};

function sourceOf(finished: readonly string[]): ProgressSource {
  return {
    completionOf: (ref) =>
      finished.includes(ref.lessonId)
        ? { exercisesPassed: true, readConfirmed: true }
        : NOT_STARTED,
  };
}

describe("naming a lesson", () => {
  it("round-trips through its key", () => {
    const ref: LessonRef = { studyId: "s", courseId: "c", unitId: "u", lessonId: "l" };
    expect(parseLessonRefKey(lessonRefKey(ref))).toEqual(ref);
  });

  it("refuses a key that is missing a part rather than inventing one", () => {
    expect(parseLessonRefKey("s/c/l")).toBeNull();
    expect(parseLessonRefKey("s/c//l")).toBeNull();
    expect(parseLessonRefKey("")).toBeNull();
  });

  it("keeps two lessons apart when only their unit differs", () => {
    // This is the collision the delivery shell's three-part key cannot see.
    const left = lessonRefKey({ studyId: "s", courseId: "c", unitId: "u1", lessonId: "intro" });
    const right = lessonRefKey({ studyId: "s", courseId: "c", unitId: "u2", lessonId: "intro" });
    expect(left).not.toBe(right);
  });
});

describe("what finished means", () => {
  it("needs both conditions", () => {
    const cases: [LessonCompletion, boolean][] = [
      [{ exercisesPassed: true, readConfirmed: true }, true],
      [{ exercisesPassed: true, readConfirmed: false }, false],
      [{ exercisesPassed: false, readConfirmed: true }, false],
      [NOT_STARTED, false],
    ];
    for (const [completion, expected] of cases) {
      expect(isLessonComplete(completion)).toBe(expected);
    }
  });

  it("does not count answering as reading", () => {
    // A learner who skipped to the quiz and guessed has not done the thing the
    // product is for, and the read model must not claim they did.
    expect(isLessonComplete({ exercisesPassed: true, readConfirmed: false })).toBe(false);
  });
});

describe("the read model", () => {
  it("counts across units, not within one", () => {
    expect(readCourseProgress(course, sourceOf(["a", "c"])).done).toBe(2);
    expect(readCourseProgress(course, sourceOf([])).total).toBe(3);
  });

  it("accents the first unfinished lesson in reading order, not the last touched", () => {
    // "b" is finished and "a" is not: next is still "a", because dipping ahead
    // does not move a learner's place in the course.
    const progress = readCourseProgress(course, sourceOf(["b"]));
    expect(progress.next).toEqual({
      studyId: "turingpact",
      courseId: "foundations-before-zero",
      unitId: "u1",
      lessonId: "a",
    });
  });

  it("has nothing to accent once the course is done", () => {
    const progress = readCourseProgress(course, sourceOf(["a", "b", "c"]));
    expect(progress.complete).toBe(true);
    expect(progress.next).toBeNull();
  });

  it("calls an empty course incomplete rather than complete", () => {
    // 0 of 0 is arithmetically "all of them", and reporting an empty course as
    // finished would light a beacon on a world with nothing in it.
    const empty: CourseShape = { studyId: "s", courseId: "c", units: [] };
    const progress = readCourseProgress(empty, sourceOf([]));
    expect(progress.complete).toBe(false);
    expect(progress.next).toBeNull();
  });
});

describe("courseShapeOf", () => {
  it("keeps the study id the package itself does not store", () => {
    expect(
      courseShapeOf(
        {
          id: "foundations-before-zero",
          units: [
            {
              id: "u1",
              lessons: [
                { id: "a", contentRevision: 8, exerciseIds: ["a-exercise"] },
                { id: "b", contentRevision: 8, exerciseIds: [] },
              ],
            },
            { id: "u2", lessons: [{ id: "c", contentRevision: 8, exerciseIds: [] }] },
          ],
        },
        "turing-pact",
      ),
    ).toEqual({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      units: [
        {
          unitId: "u1",
          lessons: [
            { lessonId: "a", contentRevision: 8, exerciseIds: ["a-exercise"] },
            { lessonId: "b", contentRevision: 8, exerciseIds: [] },
          ],
        },
        { unitId: "u2", lessons: [{ lessonId: "c", contentRevision: 8, exerciseIds: [] }] },
      ],
    });
  });

  it("preserves the learner rewrite fact without importing authoring status", () => {
    expect(
      courseShapeOf(
        {
          id: "foundations-before-zero",
          isBeingRewritten: true,
          units: [],
        },
        "turing-pact",
      ).isBeingRewritten,
    ).toBe(true);
  });
});
