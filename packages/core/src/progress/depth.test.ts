import { describe, expect, it } from "vitest";

import { depthsFromPrerequisites } from "./depth.js";

const course = (id: string, ...prerequisiteCourseIds: string[]) => ({
  id,
  prerequisiteCourseIds,
});

describe("course depth from prerequisites", () => {
  it("puts a course with no prerequisites at the front", () => {
    expect(depthsFromPrerequisites([course("a")]).get("a")).toBe(0);
  });

  it("counts the longest chain, not the shortest", () => {
    // d depends on b (depth 1) and c (depth 2); the answer is 3, not 2.
    const depths = depthsFromPrerequisites([
      course("a"),
      course("b", "a"),
      course("c", "b"),
      course("d", "b", "c"),
    ]);
    expect([...depths.entries()].sort()).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
      ["d", 3],
    ]);
  });

  it("ignores a prerequisite that is not on the shelf", () => {
    // Cross-study or retired ids must not push a course down the map.
    expect(depthsFromPrerequisites([course("a", "gone")]).get("a")).toBe(1);
  });

  /*
    A cycle resolves rather than throwing, and that is the deliberate choice:
    prerequisites are authored content, and a course that sorts oddly is a far
    better failure than a world map that will not draw at all.
  */
  it("survives a cycle instead of hanging or throwing", () => {
    const depths = depthsFromPrerequisites([course("a", "b"), course("b", "a")]);
    expect(depths.get("a")).toBeTypeOf("number");
    expect(depths.get("b")).toBeTypeOf("number");
  });
});
