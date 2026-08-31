import { describe, expect, it } from "vitest";

import { todayNodeForContext } from "./study-context.js";

const node = (courseId: string, depth: number, lessons: number) => ({
  courseId,
  title: courseId,
  lessons,
  studyId: "turing-pact",
  studyTitle: "TuringPact",
  depth,
  prerequisiteCourseIds: [],
  trackId: null,
});

describe("today course context", () => {
  it("keeps the current course island from advertising a sibling course", () => {
    const current = node("current-course", 1, 2);
    const sibling = node("sibling-course", 0, 10);

    expect(
      todayNodeForContext(
        [sibling, current],
        { kind: "course", studyId: "turing-pact", courseId: "current-course" },
        "turing-pact",
        () => 0,
      )?.courseId,
    ).toBe("current-course");
  });
});
