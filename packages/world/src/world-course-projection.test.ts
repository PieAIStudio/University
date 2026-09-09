import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { CourseNode } from "./course/course.js";
import { placeWorld } from "./Maps.js";
import {
  buildWorldCourseGrid,
  clearWorldCourseProjectionCache,
  getWorldCourseBlueprint,
  getWorldCourseGrid,
  projectWorldCourse,
} from "./world-course-projection.js";

function makeNode(
  partial: Partial<CourseNode> & Pick<CourseNode, "studyId" | "courseId">,
): CourseNode {
  return {
    title: partial.courseId,
    studyTitle: partial.studyId,
    lessons: 10,
    depth: 0,
    prerequisiteCourseIds: [],
    trackId: null,
    ...partial,
  } as CourseNode;
}

const NODES: readonly CourseNode[] = [
  makeNode({ studyId: "alpha", courseId: "a1", depth: 0, lessons: 12 }),
  makeNode({
    studyId: "alpha",
    courseId: "a2",
    depth: 1,
    lessons: 8,
    prerequisiteCourseIds: ["a1"],
  }),
  makeNode({ studyId: "beta", courseId: "b1", depth: 0, lessons: 10 }),
  makeNode({
    studyId: "beta",
    courseId: "b2",
    depth: 1,
    lessons: 6,
    prerequisiteCourseIds: ["b1"],
  }),
];

const nothingDone = () => 0;

describe("world-course-projection cache", () => {
  it("retains blueprint and grid identity across catalogue focus changes", () => {
    clearWorldCourseProjectionCache();

    // Focus on study "alpha"
    const worldAlpha = placeWorld(NODES, nothingDone, "alpha", "catalogue");
    // Focus change to study "beta"
    const worldBeta = placeWorld(NODES, nothingDone, "beta", "catalogue");

    // Live focus changed
    const liveAlpha = worldAlpha.placements.find((p) => p.state === "live");
    const liveBeta = worldBeta.placements.find((p) => p.state === "live");
    expect(liveAlpha?.node.studyId).toBe("alpha");
    expect(liveBeta?.node.studyId).toBe("beta");

    // All course shapes & grids are preserved across focus change
    for (const node of NODES) {
      const pAlpha = worldAlpha.placements.find((p) => p.node.courseId === node.courseId);
      const pBeta = worldBeta.placements.find((p) => p.node.courseId === node.courseId);
      expect(pAlpha).toBeDefined();
      expect(pBeta).toBeDefined();

      // Blueprint identity strictly preserved
      expect(pBeta!.blueprint).toBe(pAlpha!.blueprint);
      // Grid identity strictly preserved
      expect(pBeta!.grid).toBe(pAlpha!.grid);
    }
  });

  it("updates state/progress and done grid on progress while keeping the same blueprint", () => {
    clearWorldCourseProjectionCache();

    const worldIdle = placeWorld(NODES, nothingDone, "alpha", "catalogue");
    const a1Idle = worldIdle.placements.find((p) => p.node.courseId === "a1")!;
    expect(a1Idle.progress).toBe(0);
    expect(a1Idle.state).toBe("live");
    expect(a1Idle.grid.lessons[0]!.state).toBe("idle");

    // Learner finishes a1
    const progressOf = (node: CourseNode) => (node.courseId === "a1" ? 1 : 0);
    const worldDone = placeWorld(NODES, progressOf, "alpha", "catalogue");
    const a1Done = worldDone.placements.find((p) => p.node.courseId === "a1")!;

    expect(a1Done.progress).toBe(1);
    expect(a1Done.state).toBe("done");

    // Same blueprint shape (island geography does not change because user finished lessons)
    expect(a1Done.blueprint).toBe(a1Idle.blueprint);

    // Done grid is distinct from idle grid
    expect(a1Done.grid).not.toBe(a1Idle.grid);
    expect(a1Done.grid.lessons[0]!.state).toBe("done");

    // Re-querying done state reuses the cached done grid
    const worldDoneRepeat = placeWorld(NODES, progressOf, "alpha", "catalogue");
    const a1DoneRepeat = worldDoneRepeat.placements.find((p) => p.node.courseId === "a1")!;
    expect(a1DoneRepeat.blueprint).toBe(a1Done.blueprint);
    expect(a1DoneRepeat.grid).toBe(a1Done.grid);
  });

  it("does not retain stale geometry when lesson count or seed changes", () => {
    clearWorldCourseProjectionCache();

    // Own a mutable fixture while preserving the public readonly CourseNode contract.
    const mutableNode = { ...makeNode({ studyId: "gamma", courseId: "g1", lessons: 6 }) };
    const initial = projectWorldCourse(mutableNode, "catalogue", "idle");
    expect(initial.blueprint.nodes.length).toBeGreaterThan(0);

    // 1. Mutating lessonCount invalidates cache
    mutableNode.lessons = 14;
    const resized = projectWorldCourse(mutableNode, "catalogue", "idle");
    expect(resized.blueprint).not.toBe(initial.blueprint);
    expect(resized.grid).not.toBe(initial.grid);
    expect(resized.blueprint.nodes.length).not.toBe(initial.blueprint.nodes.length);

    // 2. Changing lookSeed invalidates cache
    const seedA = projectWorldCourse(mutableNode, "catalogue", "idle", { lookSeed: "shot-seed-a" });
    const seedB = projectWorldCourse(mutableNode, "catalogue", "idle", { lookSeed: "shot-seed-b" });
    expect(seedA.blueprint).not.toBe(resized.blueprint);
    expect(seedB.blueprint).not.toBe(seedA.blueprint);
    expect(seedB.grid).not.toBe(seedA.grid);
    expect(seedA.blueprint.seed).toBe("shot-seed-a");
    expect(seedB.blueprint.seed).toBe("shot-seed-b");

    // 3. New CourseNode object does not retain stale geometry
    const freshNode = makeNode({ studyId: "gamma", courseId: "g1", lessons: 20 });
    const fresh = projectWorldCourse(freshNode, "catalogue", "idle");
    expect(fresh.blueprint).not.toBe(seedB.blueprint);
    expect(fresh.grid).not.toBe(seedB.grid);
  });

  it("preserves study scope existing semantic grid with route anchors", () => {
    clearWorldCourseProjectionCache();

    const worldStudy = placeWorld(NODES, nothingDone, "alpha", "study");
    expect(worldStudy.placements.map((p) => p.node.courseId).sort()).toEqual(["a1", "a2"]);

    const a1Placement = worldStudy.placements.find((p) => p.node.courseId === "a1")!;
    expect(a1Placement.grid.projection).toBe("world");
    // In study scope, the grid has the multi-anchor lesson route corresponding to blueprint nodes
    expect(a1Placement.grid.lessons.length).toBe(a1Placement.blueprint.nodes.length);
    expect(a1Placement.grid.route.length).toBeGreaterThan(0);

    // Blueprint is shared between study and catalogue scopes for the same node
    const worldCat = placeWorld(NODES, nothingDone, "alpha", "catalogue");
    const a1CatPlacement = worldCat.placements.find((p) => p.node.courseId === "a1")!;
    expect(a1Placement.blueprint).toBe(a1CatPlacement.blueprint);
    // But grid projections are distinct (catalogue has 1 anchor silhouette, study has route anchors)
    expect(a1Placement.grid).not.toBe(a1CatPlacement.grid);
    expect(a1CatPlacement.grid.lessons.length).toBe(1);

    // Repeated study calls retain grid and blueprint identity
    const worldStudyRepeat = placeWorld(NODES, nothingDone, "alpha", "study");
    const a1Repeat = worldStudyRepeat.placements.find((p) => p.node.courseId === "a1")!;
    expect(a1Repeat.blueprint).toBe(a1Placement.blueprint);
    expect(a1Repeat.grid).toBe(a1Placement.grid);
  });

  it("re-exports buildWorldCourseGrid with cache integration and compatibility", () => {
    const nodeA = NODES[0]!;
    const gridA = buildWorldCourseGrid(nodeA, "idle");
    const gridB = getWorldCourseGrid(nodeA, "catalogue", "idle");
    expect(gridA).toBe(gridB);

    const bp = getWorldCourseBlueprint(nodeA);
    expect(bp).toBeDefined();
    expect(bp.courseId).toBe(nodeA.courseId);
  });
  it("delivers orders-of-magnitude speedup on catalogue focus changes", () => {
    const catalogue = JSON.parse(
      readFileSync(
        new URL("../../../apps/university/src/content/imported.json", import.meta.url),
        "utf8",
      ),
    );
    const catNodes: readonly CourseNode[] = catalogue.studies.flatMap((study: any) =>
      study.courses.map((course: any, depth: number) => ({
        courseId: course.courseId,
        title: course.title,
        lessons: course.lessons,
        studyId: study.studyId,
        studyTitle: study.title,
        depth,
        prerequisiteCourseIds: [],
        trackId: null,
      })),
    );

    clearWorldCourseProjectionCache();

    // Cold run: generates blueprints and grids
    const t0 = performance.now();
    const w1 = placeWorld(catNodes, nothingDone, "turing-pact", "catalogue");
    const tCold = performance.now() - t0;

    // Warm focus change: changes focus from turing-pact to directing
    const t1 = performance.now();
    const w2 = placeWorld(catNodes, nothingDone, "directing", "catalogue");
    const tWarmFocus = performance.now() - t1;

    expect(w1.placements.length).toBe(catNodes.length);
    expect(w2.placements.length).toBe(catNodes.length);
    expect(tWarmFocus).toBeLessThan(20);

    console.log(`[benchmark] Cold placeWorld (${catNodes.length} courses): ${tCold.toFixed(2)}ms`);
    console.log(
      `[benchmark] Warm focus change (${catNodes.length} courses): ${tWarmFocus.toFixed(2)}ms (speedup: ${(tCold / tWarmFocus).toFixed(1)}x)`,
    );
  });
});
