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

describe("isFocusDimmed", () => {
  const node = { studyId: "turing-pact", courseId: "foundations-before-zero" };

  it("dims nothing when the delivery shell (or an unfocused author) passes no track", () => {
    expect(isFocusDimmed(node, null)).toBe(false);
    expect(isFocusDimmed(node, { studyId: "turing-pact", courseIds: [] })).toBe(false);
  });

  it("dims every island that is not on the pinned run", () => {
    const focus = {
      studyId: "turing-pact",
      courseIds: ["foundations-before-zero", "founder-engineer"],
    };
    expect(isFocusDimmed(node, focus)).toBe(false);
    expect(isFocusDimmed({ studyId: "turing-pact", courseId: "later" }, focus)).toBe(true);
    expect(isFocusDimmed({ studyId: "buzz", courseId: "foundations-before-zero" }, focus)).toBe(
      true,
    );
  });
});

describe("studySub", () => {
  it("names the size before anything is finished, then how far the learner got", () => {
    expect(studySub(31, 0)).toBe("31 门课");
    expect(studySub(31, 4)).toBe("已学 4 关");
  });
});
