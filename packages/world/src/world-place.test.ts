import { describe, expect, it } from "vitest";

import type { CourseNode } from "./course/course.js";
import {
  nextCourse,
  placeWorld,
  WORLD_ISLAND_STATE_SCALE,
  worldIslandRadiusForState,
} from "./Maps.js";

function node(partial: Partial<CourseNode> & Pick<CourseNode, "studyId" | "courseId">): CourseNode {
  return {
    title: partial.courseId,
    studyTitle: partial.studyId,
    lessons: 10,
    depth: 0,
    prerequisiteCourseIds: [],
    ...partial,
  } as CourseNode;
}

const NODES: readonly CourseNode[] = [
  node({ studyId: "alpha", courseId: "a1", depth: 0, lessons: 12 }),
  node({ studyId: "alpha", courseId: "a2", depth: 1, prerequisiteCourseIds: ["a1"] }),
  node({ studyId: "beta", courseId: "b1", depth: 0, lessons: 8 }),
  node({ studyId: "beta", courseId: "b2", depth: 1, prerequisiteCourseIds: ["b1"] }),
];

const nothingDone = () => 0;

describe("placeWorld", () => {
  /*
    The whole point of the change: dragging the map used to land you among
    another project's islands with the top bar still naming the one you left.
    It cannot any more, because the other project is not in the scene.
  */
  it("puts one project in the scene and nothing else", () => {
    const world = placeWorld(NODES, nothingDone, "alpha");
    expect(world.placements.map((entry) => entry.node.courseId).sort()).toEqual(["a1", "a2"]);
  });

  it("stands that project on the origin rather than out on a ring", () => {
    for (const studyId of ["alpha", "beta"]) {
      const world = placeWorld(NODES, nothingDone, studyId);
      for (const entry of world.placements) {
        expect(Math.hypot(entry.position.x, entry.position.z)).toBeLessThanOrEqual(world.extent);
      }
      // Something is near enough to the origin that the opening shot finds it.
      const nearest = Math.min(
        ...world.placements.map((entry) => Math.hypot(entry.position.x, entry.position.z)),
      );
      expect(nearest).toBeLessThan(12);
    }
  });

  it("walks every series from its first island at the top toward the viewer", () => {
    for (const studyId of ["alpha", "beta"]) {
      const world = placeWorld(NODES, nothingDone, studyId);
      const ordered = [...world.placements].sort((a, b) => a.node.depth - b.node.depth);
      for (let index = 1; index < ordered.length; index += 1) {
        expect(ordered[index]!.position.z).toBeGreaterThan(ordered[index - 1]!.position.z);
      }
    }
  });

  /*
    Exactly one lit island, and it has to be one that is in the frame. When the
    accent was chosen across the whole catalogue, three projects out of four
    showed a map with nothing lit on it at all.
  */
  it("lights exactly one course, in the project being shown", () => {
    for (const studyId of ["alpha", "beta"]) {
      const world = placeWorld(NODES, nothingDone, studyId);
      const live = world.placements.filter((entry) => entry.state === "live");
      expect(live).toHaveLength(1);
      expect(live[0]!.node.studyId).toBe(studyId);
    }
  });

  it("gives an unknown project an empty scene rather than someone else's", () => {
    expect(placeWorld(NODES, nothingDone, "gamma").placements).toEqual([]);
  });

  it("uses one generic state scale to make the live island the focal point", () => {
    const base = worldIslandRadiusForState(12, "done") / WORLD_ISLAND_STATE_SCALE.done;
    expect(worldIslandRadiusForState(12, "live") / base).toBeCloseTo(1.2, 8);
    expect(worldIslandRadiusForState(12, "live")).toBeGreaterThan(
      worldIslandRadiusForState(12, "open"),
    );
    expect(worldIslandRadiusForState(12, "open")).toBeGreaterThan(
      worldIslandRadiusForState(12, "idle"),
    );

    const world = placeWorld(NODES, nothingDone, "alpha");
    const live = world.placements.find((entry) => entry.state === "live");
    const satellite = world.placements.find((entry) => entry.state === "idle");
    expect(live?.radius).toBeCloseTo(worldIslandRadiusForState(12, "live"), 8);
    expect(satellite?.radius).toBeCloseTo(worldIslandRadiusForState(10, "idle"), 8);
    expect(live?.radius ?? 0).toBeGreaterThan(satellite?.radius ?? 0);
  });
});

describe("nextCourse", () => {
  /*
    「今天」 asks a different question from the map. Wandering into another
    project to have a look does not change what you were three lessons from
    finishing, so this one still reads the whole catalogue.
  */
  it("answers across every project, not just the one on screen", () => {
    const done = (entry: CourseNode) => (entry.courseId === "b1" ? 1 : 0);
    expect(nextCourse(NODES, done)?.courseId).toBe("b2");
  });

  /*
    Splitting the map by project made this visible. Finish alpha's opening
    course and the old ordering sent 「今天」 to *beta*, because beta's first
    course is depth 0 and alpha's second is depth 1 — a comparison that means
    something inside one spine and nothing at all across two.
  */
  it("stays in the project the learner has already started", () => {
    const done = (entry: CourseNode) => (entry.courseId === "a1" ? 1 : 0);
    expect(nextCourse(NODES, done)?.courseId).toBe("a2");
  });

  it("ignores a course whose prerequisite is unfinished", () => {
    expect(nextCourse(NODES, nothingDone)?.depth).toBe(0);
  });

  it("prefers the longer course when two are equally shallow", () => {
    // a1 has 12 lessons, b1 has 8; a one-lesson preface must not outrank a spine.
    expect(nextCourse(NODES, nothingDone)?.courseId).toBe("a1");
  });

  it("has no answer once everything is finished", () => {
    expect(nextCourse(NODES, () => 1)).toBeNull();
  });
});
