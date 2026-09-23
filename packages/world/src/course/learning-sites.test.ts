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
  LEARNING_NODE_KIND_SCALE,
  LEARNING_NODE_POST_SINK,
  LEARNING_NODE_TRIANGLES,
  LEARNING_PAD_RADIUS,
  LEARNING_STONE_TRIANGLES,
  buildLearningStoneGeometry,
  learningNodeKindGeometry,
  learningNodeTriangles,
} from "./learning-node-geometry.js";
import {
  LEARNING_SITE_RADIUS,
  MAX_SLOPE_RISE,
  checkpointGapOf,
  checkpointGaps,
  courseLearningSites,
  islandLearningKinds,
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
  // The same derivation `placeCourse` uses, so the gaps match the gates.
  const segments = segmentsFromPlacements(
    unitIds.map((unitId, index) => ({ unitId, unitTitle: unitId, lessonId: lessonIds[index]! })),
  );
  const blueprint = islandBlueprint({
    studyId,
    courseId,
    lessonCount: lessonIds.length,
    lessonIds,
    unitIds,
    themeSelection: islandThemeSelectionForCourse(studyId, courseId),
    checkpointGaps: checkpointGaps(segments, lessonIds.length),
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

      it("gives every segment its gate and its turn of board or pennant, once each", () => {
        expect(sites).toHaveLength(segments.length * 2);
        expect(new Set(sites.map((site) => site.id)).size).toBe(sites.length);
        segments.forEach((segment) =>
          expect(
            sites.filter((site) => site.segment.id === segment.id).map((site) => site.kind),
          ).toEqual([...islandLearningKinds(segment)]),
        );
        // Taking turns: the board first, where a newcomer has nothing to play with yet.
        expect(islandLearningKinds(segments[0]!)).toEqual(["checkpoint", "personal"]);
        if (segments[1])
          expect(islandLearningKinds(segments[1])).toEqual(["checkpoint", "challenge"]);
      });

      it("opens the gate with its segment and a roadside node with the lesson beside it", () => {
        for (const site of sites) {
          if (site.kind === "checkpoint") expect(site.opensWith).toBe(site.segment.lessonIds[0]);
          else expect(site.segment.lessonIds).toContain(site.opensWith);
        }
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
          const circles = [
            { what: "pad", at: site.ground, r: LEARNING_PAD_RADIUS },
            { what: "object", at: site.object, r: LEARNING_SITE_RADIUS[site.kind] },
          ];
          const circlesOf = (other: typeof site) => [
            { at: other.ground, r: LEARNING_PAD_RADIUS },
            { at: other.object, r: LEARNING_SITE_RADIUS[other.kind] },
          ];
          for (const { what, at, r } of circles) {
            const { x, z } = at;
            if (distanceToIslandRoute(blueprint, { x, z }) < route + r)
              problems.push(`${site.id} ${what} on the road`);
            for (const lesson of lessons)
              if (
                Math.hypot(x - lesson.position.x, z - lesson.position.z) <
                blueprint.route.nodeRadius + r
              )
                problems.push(`${site.id} ${what} on ${lesson.lessonId}`);
            for (const solid of solids)
              if (Math.hypot(x - solid.x, z - solid.z) < solid.r + r)
                problems.push(`${site.id} ${what} in ${solid.what}`);
            for (const other of drawn)
              if (other !== site && other.kind !== "checkpoint")
                for (const circle of circlesOf(other))
                  if (Math.hypot(x - circle.at.x, z - circle.at.z) < r + circle.r)
                    problems.push(`${site.id} ${what} overlaps ${other.id}`);
          }
          // The object stands behind its pad, away from the road the camera is on.
          if (
            distanceToIslandRoute(blueprint, site.object) <=
            distanceToIslandRoute(blueprint, site.ground)
          )
            problems.push(`${site.id} object is not behind its pad`);
          for (const stone of site.branch)
            for (const solid of solids)
              if (Math.hypot(stone.x - solid.x, stone.z - solid.z) < solid.r + 0.16)
                problems.push(`${site.id} stone in ${solid.what}`);
        }
        expect(problems).toEqual([]);
      });

      it("widens the gap each gate stands in, so the avatar lands clear of both pads", () => {
        const gaps = checkpointGaps(segments, lessons.length);
        // Along the road, not as the crow flies: a bend shortens a chord.
        const along = blueprint.nodes.slice(1).map((node, i) => node.t - blueprint.nodes[i]!.t);
        const ordinary = along.filter((_, i) => !gaps.includes(i));
        for (const gap of gaps)
          expect(along[gap]!, `gap ${gap}`).toBeGreaterThan(Math.max(...ordinary) * 1.45);
        // The avatar's ring (0.72) never overlaps a lesson stone when it stands under a gate.
        for (const site of sites.filter((s) => s.kind === "checkpoint" && s.resolved)) {
          const gap = checkpointGapOf(site.segment, lessons.length)!;
          for (const lesson of [lessons[gap]!, lessons[gap + 1]!])
            expect(
              Math.hypot(site.ground.x - lesson.position.x, site.ground.z - lesson.position.z),
              site.id,
            ).toBeGreaterThan(blueprint.route.nodeRadius + 0.72);
        }
      });

      it("finds free ground for gates and roadside nodes on the island", () => {
        expect(sites.some((site) => site.kind === "checkpoint" && site.resolved)).toBe(true);
        expect(sites.some((site) => site.kind !== "checkpoint" && site.resolved)).toBe(true);
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
    for (const kind of ["checkpoint", "personal", "challenge"] as const) {
      const scale = LEARNING_NODE_KIND_SCALE[kind];
      expect(LEARNING_NODE_POST_SINK * scale, kind).toBeGreaterThan(MAX_SLOPE_RISE);
      const geometry = learningNodeKindGeometry(kind);
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.min.y, kind).toBeLessThanOrEqual(
        -LEARNING_NODE_POST_SINK * scale + 1e-6,
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
