import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { islandBlueprint } from "../island/island-blueprint.js";
import { islandThemeSelectionForCourse } from "../island/kenney-recipes.js";
import { planIslandDressing, placementFootprintRadius } from "../island/island-dressing.js";
import { courseLandscapePlan } from "../island/course-landscape-plan.js";
import { distanceToIslandRoute } from "../island/island-route-geometry.js";
import type { LessonPlacement } from "../Maps.js";
import {
  LEARNING_GATE_HALF_SPAN,
  LEARNING_NODE_POST_SINK,
  LEARNING_NODE_SCALE,
  LEARNING_NODE_TRIANGLES,
  LEARNING_STONE_TRIANGLES,
  buildLearningStoneGeometry,
  learningNodeKindGeometry,
  learningNodeTriangles,
} from "./learning-node-geometry.js";
import {
  LEARNING_SITE_RADIUS,
  MAX_SLOPE_RISE,
  courseLearningSites,
  segmentsFromPlacements,
} from "./learning-sites.js";

/** Real course shapes: the study and course ids pick the recipe, the unit sizes pick the segments. */
function placements(
  studyId: string,
  courseId: string,
  unitSizes: readonly number[],
): LessonPlacement[] {
  const unitIds = unitSizes.flatMap((size, unit) =>
    Array.from({ length: size }, () => `unit-${unit}`),
  );
  const lessonIds = unitIds.map((_, index) => `lesson-${index}`);
  const blueprint = islandBlueprint({
    studyId,
    courseId,
    lessonCount: lessonIds.length,
    lessonIds,
    unitIds,
    themeSelection: islandThemeSelectionForCourse(studyId, courseId),
  });
  return blueprint.nodes.map((node, index) => ({
    studyId,
    courseId,
    unitId: node.unitId,
    unitTitle: node.unitId,
    unitIndex: node.unitIndex,
    lessonId: node.id,
    lessonTitle: node.id,
    chars: 4000,
    position: new THREE.Vector3(node.x, node.y, node.z),
    state: index === 0 ? "live" : "idle",
    kind: "lesson",
    hueShift: 0,
    blueprint,
    visualToken: node.visualToken,
  })) as unknown as LessonPlacement[];
}

const COURSES = [
  ["ai-literacy", "understanding-ai", [5, 6, 7, 6, 6, 6]],
  ["browser-ai", "run-a-real-project-with-ai", [4, 4]],
  ["browser-ai", "make-the-cutout-app-yours", [2, 2, 3, 2]],
] as const;

describe("learning sites", () => {
  for (const [studyId, courseId, units] of COURSES) {
    describe(`${studyId}/${courseId}`, () => {
      const lessons = placements(studyId, courseId, units);
      const blueprint = lessons[0]!.blueprint;
      const sites = courseLearningSites(lessons);
      const segments = segmentsFromPlacements(lessons);

      it("gives every segment its three nodes, once each", () => {
        expect(sites).toHaveLength(segments.length * 3);
        expect(new Set(sites.map((site) => site.id)).size).toBe(sites.length);
      });

      it("never stands an object in the road, on a lesson, or inside anything already there", () => {
        const route = blueprint.route.roadWidth / 2 + blueprint.route.shoulderWidth;
        const dressing = planIslandDressing(blueprint, "course");
        const landscape = courseLandscapePlan(blueprint, dressing);
        const solids = [
          ...dressing.placements.map((p) => {
            const r = placementFootprintRadius(p);
            return { x: p.x, z: p.z, r: Number.isFinite(r) ? r : 1, what: p.id };
          }),
          ...[
            ...landscape.outcrops,
            ...landscape.flora,
            ...(landscape.stones ?? []),
            ...(landscape.canopy ?? []),
          ].map((item) => ({ x: item.x, z: item.z, r: item.radius, what: item.id })),
        ];
        const problems: string[] = [];
        const drawn = sites.filter((site) => site.resolved);
        for (const site of drawn) {
          if (site.kind === "checkpoint") {
            // A gate spans the road on purpose: its posts are what stand on the ground.
            const yaw = site.yaw!;
            for (const sign of [1, -1]) {
              const x = site.ground.x + Math.cos(yaw) * sign * LEARNING_GATE_HALF_SPAN;
              const z = site.ground.z - Math.sin(yaw) * sign * LEARNING_GATE_HALF_SPAN;
              for (const solid of solids)
                if (Math.hypot(x - solid.x, z - solid.z) < solid.r + 0.16)
                  problems.push(`${site.id} post in ${solid.what}`);
            }
            for (const lesson of lessons)
              if (
                Math.hypot(site.ground.x - lesson.position.x, site.ground.z - lesson.position.z) <
                blueprint.route.nodeRadius + 0.2
              )
                problems.push(`${site.id} on ${lesson.lessonId}`);
            continue;
          }
          const r = LEARNING_SITE_RADIUS[site.kind];
          const { x, z } = site.ground;
          if (distanceToIslandRoute(blueprint, { x, z }) < route + r)
            problems.push(`${site.id} on the road`);
          for (const lesson of lessons)
            if (
              Math.hypot(x - lesson.position.x, z - lesson.position.z) <
              blueprint.route.nodeRadius + r
            )
              problems.push(`${site.id} on ${lesson.lessonId}`);
          for (const solid of solids)
            if (Math.hypot(x - solid.x, z - solid.z) < solid.r + r)
              problems.push(`${site.id} in ${solid.what}`);
          for (const other of drawn)
            if (
              other !== site &&
              other.kind !== "checkpoint" &&
              Math.hypot(x - other.ground.x, z - other.ground.z) <
                r + LEARNING_SITE_RADIUS[other.kind]
            )
              problems.push(`${site.id} overlaps ${other.id}`);
          for (const stone of site.branch)
            for (const solid of solids)
              if (Math.hypot(stone.x - solid.x, stone.z - solid.z) < solid.r + 0.16)
                problems.push(`${site.id} stone in ${solid.what}`);
        }
        expect(problems).toEqual([]);
      });

      it("finds free ground for every kind somewhere on the island", () => {
        for (const kind of ["checkpoint", "personal", "challenge"] as const)
          expect(
            sites.some((site) => site.kind === kind && site.resolved),
            kind,
          ).toBe(true);
      });

      it("answers the same question the same way, from one cache", () => {
        expect(courseLearningSites(lessons)).toBe(sites);
        expect(
          courseLearningSites(placements(studyId, courseId, units)).map((s) => s.ground.toArray()),
        ).toEqual(sites.map((s) => s.ground.toArray()));
      });
    });
  }
});

describe("learning node geometry", () => {
  it("stays inside the triangle ceilings the technique lock records", () => {
    for (const kind of ["checkpoint", "personal", "challenge"] as const)
      expect(learningNodeTriangles(kind), kind).toBeLessThanOrEqual(LEARNING_NODE_TRIANGLES[kind]);
  });

  it("sinks every post deeper than the steepest ground a site may stand on", () => {
    // Objects turn to face the camera, so any foot can end up on the low side.
    expect(LEARNING_NODE_POST_SINK * LEARNING_NODE_SCALE).toBeGreaterThan(MAX_SLOPE_RISE);
    for (const kind of ["checkpoint", "personal", "challenge"] as const) {
      const geometry = learningNodeKindGeometry(kind);
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.min.y, kind).toBeLessThanOrEqual(
        -LEARNING_NODE_POST_SINK * LEARNING_NODE_SCALE + 1e-6,
      );
      expect(geometry.getAttribute("color"), kind).toBeDefined();
      geometry.dispose();
    }
  });

  it("merges the stepping stones of the drawn nodes into one mesh", () => {
    const lessons = placements(...(COURSES[0] as unknown as [string, string, number[]]));
    const sites = courseLearningSites(lessons).slice(0, 3);
    const stones = sites.filter((s) => s.resolved).reduce((sum, s) => sum + s.branch.length, 0);
    const geometry = buildLearningStoneGeometry(sites);
    expect(geometry?.getIndex()?.count ?? 0).toBe(stones * LEARNING_STONE_TRIANGLES * 3);
    geometry?.dispose();
  });
});

describe("measured (not asserted): how often a node finds free ground", () => {
  it("reports the resolution rate per course", () => {
    const rows = COURSES.map(([studyId, courseId, units]) => {
      const sites = courseLearningSites(placements(studyId, courseId, units));
      const byKind = (kind: string) =>
        `${sites.filter((s) => s.kind === kind && s.resolved).length}/${sites.filter((s) => s.kind === kind).length}`;
      return `${courseId}: checkpoint ${byKind("checkpoint")} personal ${byKind("personal")} challenge ${byKind("challenge")} stones ${sites.reduce((n, s) => n + s.branch.length, 0)}`;
    });
    // eslint-disable-next-line no-console
    console.info(rows.join("\n"));
  });
});
