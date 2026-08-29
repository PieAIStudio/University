import { describe, expect, it } from "vitest";

import {
  courseShapeOf,
  depthsFromPrerequisites,
  isFocusDimmed,
  studySub,
  type Course,
} from "./course";

function lesson(id: string): Course["units"][number]["lessons"][number] {
  return {
    id,
    title: id,
    content: "",
    contentRevision: 1,
    exerciseIds: [],
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
        {
          unitId: "u1",
          lessons: [
            { lessonId: "a", contentRevision: 1, exerciseIds: [] },
            { lessonId: "b", contentRevision: 1, exerciseIds: [] },
          ],
        },
        { unitId: "u2", lessons: [{ lessonId: "c", contentRevision: 1, exerciseIds: [] }] },
      ],
    });
  });
});

describe("depthsFromPrerequisites", () => {
  it("walks a chain and treats a missing peer as a root", () => {
    const depths = depthsFromPrerequisites([
      { id: "a", prerequisiteCourseIds: [] },
      { id: "b", prerequisiteCourseIds: ["a"] },
      { id: "c", prerequisiteCourseIds: ["b", "gone"] },
    ]);
    expect(depths.get("a")).toBe(0);
    expect(depths.get("b")).toBe(1);
    expect(depths.get("c")).toBe(2);
  });
});

describe("isFocusDimmed for an authoring focus", () => {
  const node = { studyId: "turing-pact", courseId: "foundations-before-zero" };

  it("dims nothing when the delivery shell (or an unfocused author) passes no track", () => {
    expect(isFocusDimmed(node, null)).toBe(false);
    expect(isFocusDimmed(node, { studyId: "turing-pact", courseIds: [] })).toBe(false);
  });

  it("dims every island that is not on the pinned run", () => {
    const authoringFocus = {
      studyId: "turing-pact",
      courseIds: ["foundations-before-zero", "founder-engineer"],
    };
    expect(isFocusDimmed(node, authoringFocus)).toBe(false);
    expect(isFocusDimmed({ studyId: "turing-pact", courseId: "later" }, authoringFocus)).toBe(true);
    expect(
      isFocusDimmed({ studyId: "buzz", courseId: "foundations-before-zero" }, authoringFocus),
    ).toBe(true);
  });
});

describe("studySub", () => {
  it("names the size before anything is finished, then how far the learner got", () => {
    expect(studySub(31, 0)).toBe("31 门课");
    expect(studySub(31, 4)).toBe("已学 4 关");
  });
});
