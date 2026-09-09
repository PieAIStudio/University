import { describe, expect, it } from "vitest";

import type { CourseNode } from "./course/course.js";
import {
  nextCourse,
  placeWorld,
  placeStudyArchipelago,
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

describe("learner series archipelago", () => {
  it("forms small ordered neighbourhoods with sky between them, not a uniform scatter", () => {
    const nodes = Array.from({ length: 31 }, (_, index) =>
      node({
        studyId: "grouped-shoals",
        courseId: `course-${String(index).padStart(3, "0")}`,
        lessons: 12,
        depth: index,
      }),
    );
    const world = placeStudyArchipelago(nodes, nothingDone, "grouped-shoals");
    // Connected components of nearby silhouettes, not a count of metadata
    // groups which could pass while their islands were still spread everywhere.
    const unseen = new Set(world.placements);
    const groups: number[][] = [];
    while (unseen.size > 0) {
      const seed = unseen.values().next().value!;
      unseen.delete(seed);
      const queue = [seed];
      const depths: number[] = [];
      while (queue.length > 0) {
        const entry = queue.pop()!;
        depths.push(entry.node.depth);
        for (const peer of unseen) {
          const reserved =
            worldIslandRadiusForState(entry.node.lessons, "live") +
            worldIslandRadiusForState(peer.node.lessons, "live");
          if (entry.position.distanceTo(peer.position) - reserved <= 3.5) {
            unseen.delete(peer);
            queue.push(peer);
          }
        }
      }
      groups.push(depths.sort((a, b) => a - b));
    }
    expect(groups.length).toBeGreaterThanOrEqual(6);
    expect(groups.length).toBeLessThanOrEqual(10);
    for (const group of groups) {
      expect(group.length).toBeGreaterThanOrEqual(3);
      expect(group.length).toBeLessThanOrEqual(6);
      expect(group.at(-1)! - group[0]!).toBe(group.length - 1);
    }
  });

  it("reserves future live radii so progress cannot rearrange dense large-course islands", () => {
    const nodes = Array.from({ length: 31 }, (_, index) =>
      node({
        studyId: "stable-large-islands",
        courseId: `course-${String(index).padStart(3, "0")}`,
        lessons: [24, 41, 80][index % 3]!,
        depth: index,
        prerequisiteCourseIds: index === 0 ? [] : [`course-${String(index - 1).padStart(3, "0")}`],
      }),
    );
    const initial = placeStudyArchipelago(nodes, nothingDone, "stable-large-islands");
    for (const completed of [1, 15, 31]) {
      const advanced = placeStudyArchipelago(
        nodes,
        (entry) => (entry.depth < completed ? 1 : 0),
        "stable-large-islands",
      );
      expect(advanced.placements.map((entry) => entry.position.toArray())).toEqual(
        initial.placements.map((entry) => entry.position.toArray()),
      );
      expect(advanced.extent).toBe(initial.extent);
      for (const entry of advanced.placements) {
        expect(entry.radius).toBe(worldIslandRadiusForState(entry.node.lessons, entry.state));
      }
    }
  });

  it.each([0, 1, 20, 31, 53])(
    "keeps %i-course catalogues finite, separated and deterministic as content and progress vary",
    (count) => {
      const nodes = Array.from({ length: count }, (_, index) =>
        node({
          studyId: "layout-pressure",
          courseId: `course-${String(index).padStart(3, "0")}`,
          lessons: [3, 6, 24, 41, 80][index % 5]!,
          depth: index,
        }),
      );
      for (const progress of [
        nothingDone,
        (entry: CourseNode) => (nodes.indexOf(entry) % 2 === 0 ? 1 : 0),
      ]) {
        const world = placeStudyArchipelago(nodes, progress, "layout-pressure");
        expect(world).toEqual(
          placeStudyArchipelago([...nodes].reverse(), progress, "layout-pressure"),
        );
        expect(world.placements).toHaveLength(count);
        expect(Number.isFinite(world.extent)).toBe(true);
        for (const [index, entry] of world.placements.entries()) {
          expect(entry.position.toArray().every(Number.isFinite)).toBe(true);
          expect(Math.hypot(entry.position.x, entry.position.z) + entry.radius).toBeLessThan(
            world.extent,
          );
          for (const other of world.placements.slice(index + 1)) {
            expect(
              Math.hypot(entry.position.x - other.position.x, entry.position.z - other.position.z),
            ).toBeGreaterThanOrEqual(entry.radius + other.radius);
          }
        }
      }
    },
  );

  it("uses the cheap remote catalogue projection without leaking another series", () => {
    const world = placeStudyArchipelago(NODES, nothingDone, "alpha");
    const reference = placeWorld(
      NODES.filter((entry) => entry.studyId === "alpha"),
      nothingDone,
      "alpha",
      "catalogue",
    );
    expect(world).toEqual(reference);
    expect(world.placements.map((entry) => entry.node.courseId).sort()).toEqual(["a1", "a2"]);
    expect(world.placements.filter((entry) => entry.state === "live")).toHaveLength(1);
    expect(placeStudyArchipelago(NODES, nothingDone, "absent").placements).toEqual([]);
  });

  it("keeps all courses reachable across series without changing source IDs or progress", () => {
    const progress = (entry: CourseNode) => (entry.courseId === "a1" ? 1 : 0);
    const alpha = placeStudyArchipelago(NODES, progress, "alpha");
    const beta = placeStudyArchipelago(NODES, progress, "beta");
    expect(
      [...alpha.placements, ...beta.placements]
        .map((entry) => entry.node)
        .sort((a, b) => a.courseId.localeCompare(b.courseId)),
    ).toEqual(NODES);
    expect(alpha.placements.find((entry) => entry.node.courseId === "a1")?.state).toBe("done");
    expect(alpha.placements.find((entry) => entry.node.courseId === "a2")?.state).toBe("live");
    expect(placeStudyArchipelago(NODES, progress, "alpha")).toEqual(alpha);
  });
});

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

  it("answers inside the project currently shown on the map", () => {
    expect(nextCourse(NODES, nothingDone, "alpha")?.courseId).toBe("a1");
    expect(nextCourse(NODES, nothingDone, "beta")?.courseId).toBe("b1");
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
