import { describe, expect, it } from "vitest";

import { courseNodesOf } from "./course.js";

const SHELF = [
  {
    id: "turing-pact",
    title: "TuringPact",
    courses: [
      {
        id: "foundations-before-zero",
        title: "在开始之前",
        isBeingRewritten: true,
        units: [{ lessons: [{}, {}] }, { lessons: [{}] }],
        prerequisiteCourseIds: [],
        trackId: "spine",
      },
      {
        id: "reading-a-repository",
        title: "读一个仓库",
        units: [{ lessons: [{}] }],
        prerequisiteCourseIds: ["foundations-before-zero"],
        trackId: null,
      },
      {
        id: "writing-one",
        title: "自己写一个",
        units: [{ lessons: [{}] }],
        prerequisiteCourseIds: ["reading-a-repository"],
      },
    ],
  },
  {
    // Buzz's five courses have no prerequisites at all, so the graph gives no
    // order — every island sits at the shore.
    id: "buzz",
    title: "Buzz",
    courses: [
      { id: "buzz-orientation", title: "上手", units: [{ lessons: [{}, {}, {}] }] },
      { id: "buzz-reading-rust", title: "读 Rust", units: [{ lessons: [{}] }] },
    ],
  },
];

describe("the shelf, folded into the map's nodes", () => {
  it("counts lessons across units rather than trusting a stored total", () => {
    const nodes = courseNodesOf(SHELF);
    expect(nodes.find((node) => node.courseId === "foundations-before-zero")?.lessons).toBe(3);
    expect(nodes.find((node) => node.courseId === "buzz-orientation")?.lessons).toBe(3);
  });

  it("computes depth per series, because depth is a property of the set", () => {
    const nodes = courseNodesOf(SHELF);
    const depth = (courseId: string) =>
      nodes.find((node) => node.courseId === courseId)?.depth ?? -1;
    expect(depth("foundations-before-zero")).toBe(0);
    expect(depth("reading-a-repository")).toBe(1);
    expect(depth("writing-one")).toBe(2);
    // Nothing in Buzz depends on anything, so nothing in Buzz is behind
    // anything — one shore, five islands.
    expect(depth("buzz-orientation")).toBe(0);
    expect(depth("buzz-reading-rust")).toBe(0);
  });

  it("carries the series down onto every node, so the overlay keeps no second graph", () => {
    const nodes = courseNodesOf(SHELF);
    expect(nodes.filter((node) => node.studyId === "buzz")).toHaveLength(2);
    expect(nodes.every((node) => node.studyTitle.length > 0)).toBe(true);
    expect(
      nodes.find((node) => node.courseId === "foundations-before-zero")?.isBeingRewritten,
    ).toBe(true);
  });

  it("reads a missing prerequisite list as a root and a missing track as none", () => {
    // The authoring API sends neither for a course that has neither, and
    // `undefined` must not become `NaN` depth or a track called "undefined".
    const nodes = courseNodesOf(SHELF);
    const written = nodes.find((node) => node.courseId === "writing-one");
    expect(written?.trackId).toBeNull();
    expect(
      nodes.find((node) => node.courseId === "buzz-orientation")?.prerequisiteCourseIds,
    ).toEqual([]);
  });
});
