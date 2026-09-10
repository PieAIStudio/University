import { describe, expect, it } from "vitest";

import { prerequisitesMet, unmetPrerequisites } from "./prerequisites.js";

const SHELF = [
  { courseId: "before-you-start", title: "在开始之前" },
  { courseId: "too-big-to-read", title: "项目大到读不完" },
  { courseId: "run-a-real-project", title: "把真实项目跑起来" },
];

const finished =
  (...ids: readonly string[]) =>
  (id: string) =>
    ids.includes(id);

describe("what a course assumes", () => {
  it("names the courses rather than counting them", () => {
    const unmet = unmetPrerequisites(
      { prerequisiteCourseIds: ["before-you-start", "too-big-to-read"] },
      SHELF,
      finished(),
    );
    expect(unmet.map((course) => course.title)).toEqual(["在开始之前", "项目大到读不完"]);
  });

  it("keeps the author's order, not the shelf's", () => {
    const unmet = unmetPrerequisites(
      { prerequisiteCourseIds: ["too-big-to-read", "before-you-start"] },
      SHELF,
      finished(),
    );
    expect(unmet.map((course) => course.courseId)).toEqual(["too-big-to-read", "before-you-start"]);
  });

  it("drops the ones already finished", () => {
    const unmet = unmetPrerequisites(
      { prerequisiteCourseIds: ["before-you-start", "too-big-to-read"] },
      SHELF,
      finished("before-you-start"),
    );
    expect(unmet.map((course) => course.courseId)).toEqual(["too-big-to-read"]);
    expect(
      prerequisitesMet(
        { prerequisiteCourseIds: ["before-you-start"] },
        SHELF,
        finished("before-you-start"),
      ),
    ).toBe(true);
  });

  /*
    A prerequisite id matching nothing on the shelf is a content defect, and
    `check-published-catalog` is where that belongs. Printing the id at a learner
    would be worse than saying nothing, so it is dropped here — which also means
    a broken id cannot dim an island forever with no way to explain why.
  */
  it("says nothing about an id that is not on the shelf", () => {
    const unmet = unmetPrerequisites(
      { prerequisiteCourseIds: ["a-course-that-was-retired"] },
      SHELF,
      finished(),
    );
    expect(unmet).toEqual([]);
    expect(
      prerequisitesMet({ prerequisiteCourseIds: ["a-course-that-was-retired"] }, SHELF, finished()),
    ).toBe(true);
  });

  it("treats a course with no prerequisites as met", () => {
    expect(unmetPrerequisites({}, SHELF, finished())).toEqual([]);
    expect(prerequisitesMet({ prerequisiteCourseIds: [] }, SHELF, finished())).toBe(true);
  });

  it("does not repeat a prerequisite listed twice", () => {
    const unmet = unmetPrerequisites(
      { prerequisiteCourseIds: ["before-you-start", "before-you-start"] },
      SHELF,
      finished(),
    );
    expect(unmet).toHaveLength(1);
  });

  /*
    V5 §12 决定 C, as a property of this module's surface rather than of any one
    caller: 「灰是信息，锁是权力；这里我们只给信息。」 Nothing here returns a
    permission. A `canEnter` living next to `prerequisitesMet` would make
    disabling an enter button a one-line change somebody makes without reading
    the paragraph explaining why they must not.
  */
  it("exports nothing a caller could disable a button with", async () => {
    const module_ = (await import("./prerequisites.js")) as Record<string, unknown>;
    expect(Object.keys(module_).sort()).toEqual(["prerequisitesMet", "unmetPrerequisites"]);
  });
});
