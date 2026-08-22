import { describe, expect, it } from "vitest";

import { courseShapeOf, type Course } from "./course";

function lesson(id: string): Course["units"][number]["lessons"][number] {
  return {
    id,
    title: id,
    content: "",
    exercises: [],
    cards: [],
  };
}

function courseOf(id: string, units: Course["units"]): Course {
  return { id, units };
}

describe("courseShapeOf", () => {
  it("keeps the study id the package itself does not store", () => {
    const course = courseOf("foundations-before-zero", [
      {
        id: "u1",
        title: "One",
        lessons: [lesson("a"), lesson("b")],
      },
      { id: "u2", title: "Two", lessons: [lesson("c")] },
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
