import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { islandBlueprint } from "./island-blueprint.js";
import {
  planIslandDressing,
  placementFootprintRadius,
  COURSE_GROVE_LEADER_HEIGHT,
} from "./island-dressing.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";
import {
  courseLandscapePlan,
  courseLandscapeGround,
  courseTreeIsFir,
  COURSE_LANDSCAPE_LIMITS,
  type CourseOutcrop,
} from "./course-landscape-plan.js";
import {
  buildCourseLandscapeGeometry,
  createCourseOutcropGeometry,
} from "./course-landscape-geometry.js";
import { createMiniatureAsset } from "./miniature-assets.js";
import { foliageFootprintRadius } from "./foliage-geometry.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";
import { worldSizeForAsset } from "./island-composition.js";
import { courseRockTopPoints, sampleCourseRockTop } from "./course-rock-profile.js";
import { landscapeFootprint } from "./course-outcrop-plan.js";
import { COURSE_ROCK_BANK_POINTS } from "./course-rock-profile.js";

describe("course landscape from the existing terrain", () => {
  it.each(["arc", "horseshoe", "loop-around-hill", "switchback", "serpentine"] as const)(
    "%s keeps rock terraces and garden feet clear across lengths and seeds",
    (routeArchetype) => {
      let totalOutcrops = 0,
        totalFlora = 0;
      for (const lessonCount of [6, 12, 24, 41])
        for (const seed of [0, 1, 2]) {
          const blueprint = islandBlueprint({
            studyId: "landscape-matrix",
            courseId: `site-${seed}`,
            lessonCount,
            routeArchetype,
            themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
          });
          const dressing = planIslandDressing(blueprint, "course");
          const plan = courseLandscapePlan(blueprint, dressing);
          expect(courseLandscapePlan(blueprint, dressing)).toBe(plan);
          expect(plan.outcrops.length).toBeLessThanOrEqual(COURSE_LANDSCAPE_LIMITS.outcrops);
          expect(plan.flora.length).toBeLessThanOrEqual(COURSE_LANDSCAPE_LIMITS.flora);
          expect(plan.borders?.length ?? 0).toBeLessThanOrEqual(6);
          totalOutcrops += plan.outcrops.length;
          totalFlora += plan.flora.length;
          for (const rock of plan.outcrops) {
            if (rock.feature !== "ruin") {
              expect(rock.groundHeights).toHaveLength(COURSE_ROCK_BANK_POINTS.length);
              for (const [i, p] of COURSE_ROCK_BANK_POINTS.entries()) {
                const point = {
                  x: rock.x + (p.x * Math.cos(rock.turn) - p.z * Math.sin(rock.turn)) * rock.radius,
                  z: rock.z + (p.x * Math.sin(rock.turn) + p.z * Math.cos(rock.turn)) * rock.radius,
                };
                expect(rock.groundHeights![i]).toBeCloseTo(
                  courseLandscapeGround(blueprint, point).y,
                  6,
                );
              }
            }
            expect(
              [rock.x, rock.z, rock.radius, rock.height, rock.baseY].every(Number.isFinite),
            ).toBe(true);
            expect(distanceToIslandRoute(blueprint, rock)).toBeGreaterThanOrEqual(
              islandRouteClearance(blueprint) + rock.radius + rock.height * 1.4 - 1e-6,
            );
            for (const p of dressing.placements)
              expect(Math.hypot(p.x - rock.x, p.z - rock.z)).toBeGreaterThanOrEqual(
                rock.radius + placementFootprintRadius(p) + 0.44,
              );
            for (const p of rock.footprint) {
              const ground = courseLandscapeGround(blueprint, p);
              expect(ground.inside).toBe(true);
              expect(rock.baseY).toBeLessThanOrEqual(ground.y);
            }
          }
          for (const p of plan.flora) {
            expect([p.x, p.y, p.z, p.size, p.radius].every(Number.isFinite)).toBe(true);
            expect(courseLandscapeGround(blueprint, p).inside).toBe(true);
            expect(p.y).toBeLessThanOrEqual(p.groundRange[0]);
            expect(p.groundRange[1] - p.y).toBeLessThanOrEqual(0.163);
            expect(distanceToIslandRoute(blueprint, p)).toBeGreaterThanOrEqual(
              islandRouteClearance(blueprint) + p.radius + 0.15,
            );
            expect(p.anchorId.length).toBeGreaterThan(0);
            if (p.supportId) {
              const support = plan.outcrops.find((r) => r.id === p.supportId)!;
              expect(support).toBeDefined();
              expect(support.feature).not.toBe("ruin");
              const top = courseRockTopPoints(support);
              for (const foot of [{ x: p.x, z: p.z }, ...landscapeFootprint(p.x, p.z, p.radius)]) {
                const y = sampleCourseRockTop(top, foot.x, foot.z);
                expect(y).not.toBeNull();
                expect(p.y).toBeLessThanOrEqual(y!);
                expect(y! - p.y).toBeLessThanOrEqual(0.133);
              }
            }
          }
          for (const p of plan.borders ?? []) {
            expect(dressing.placements.some((a) => a.id === p.anchorId)).toBe(true);
            expect(p.y).toBeLessThanOrEqual(p.groundRange[0]);
            expect(p.groundRange[1] - p.y).toBeLessThanOrEqual(0.133);
            expect(distanceToIslandRoute(blueprint, p)).toBeGreaterThanOrEqual(
              islandRouteClearance(blueprint) + p.radius,
            );
            for (const a of dressing.placements)
              expect(Math.hypot(a.x - p.x, a.z - p.z)).toBeGreaterThanOrEqual(
                placementFootprintRadius(a) + p.radius + 0.159,
              );
          }
          for (const p of plan.stones ?? []) {
            const original = dressing.placements.find((a) => a.id === p.id)!;
            expect(original).toBeDefined();
            const footprint = worldSizeForAsset(original.assetId, original.height);
            expect(p.radius).toBeLessThanOrEqual(Math.min(footprint.x, footprint.z) / 2 + 1e-6);
            expect(p.y).toBeLessThanOrEqual(p.groundRange[0]);
            expect(p.groundRange[1] - p.y).toBeLessThanOrEqual(0.267);
            expect(distanceToIslandRoute(blueprint, p)).toBeGreaterThanOrEqual(
              islandRouteClearance(blueprint) + p.radius + p.height * 0.7 - 1e-6,
            );
          }
          const geometry = buildCourseLandscapeGeometry(plan);
          try {
            expect(geometry.triangles).toBeLessThanOrEqual(COURSE_LANDSCAPE_LIMITS.triangles);
            for (const mesh of [geometry.rock, geometry.flora, geometry.water])
              if (mesh)
                for (const attr of Object.values(mesh.attributes))
                  expect(Array.from(attr.array).every(Number.isFinite)).toBe(true);
          } finally {
            geometry.dispose();
          }
        }
      // Positive witnesses: omitting the entire feature is not safety.
      expect(totalFlora).toBeGreaterThan(120);
      expect(totalOutcrops).toBeGreaterThan(0);
      process.stdout.write(
        `[course landscape ${routeArchetype}] terraces=${totalOutcrops} flora=${totalFlora}\n`,
      );
    },
    120_000,
  );

  it("sculpts one closed terrain-seated bank inside its shared reservation", () => {
    const outcrop: CourseOutcrop = {
      id: "rock",
      x: 0,
      z: 0,
      radius: 5,
      height: 4,
      baseY: -0.16,
      groundRange: [0, 0.4],
      footprint: [],
      meadow: 0.5,
      turn: 0.4,
    };
    const geometry = createCourseOutcropGeometry(outcrop);
    try {
      const p = geometry.getAttribute("position"),
        ids = geometry.index!;
      const vertices = Array.from({ length: p.count }, (_, i) =>
        new THREE.Vector3().fromBufferAttribute(p, i),
      );
      const key = (i: number) =>
        vertices[i]!.toArray()
          .map((v) => v.toFixed(5))
          .join(",");
      const edges = new Map<string, number>();
      let volume = 0;
      for (let i = 0; i < ids.count; i += 3) {
        const a = ids.getX(i),
          b = ids.getX(i + 1),
          c = ids.getX(i + 2);
        const normal = vertices[b]!.clone()
          .sub(vertices[a]!)
          .cross(vertices[c]!.clone().sub(vertices[a]!));
        expect(normal.length()).toBeGreaterThan(1e-5);
        volume += vertices[a]!.dot(vertices[b]!.clone().cross(vertices[c]!)) / 6;
        for (const [from, to] of [
          [a, b],
          [b, c],
          [c, a],
        ]) {
          const edge = [key(from!), key(to!)].sort().join("/");
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      expect([...edges.values()].every((n) => n === 2)).toBe(true);
      expect(volume).toBeGreaterThan(0);
      expect(vertices.every((v) => Math.hypot(v.x, v.z) <= outcrop.radius + 1e-6)).toBe(true);
      expect(ids.count / 3).toBe(COURSE_LANDSCAPE_LIMITS.outcropTriangles);
      // Four closed game-art boulders (R58-02), not a sampled mound; the
      // Kenney-derived bank they replaced cost 196.
      expect(ids.count / 3).toBe(176);
      const colour = geometry.getAttribute("color");
      const topColours = new Map<string, string>();
      for (let i = 0; i < p.count; i++) {
        if (p.getY(i) < 0.5) continue;
        const point = key(i),
          shade = [colour.getX(i), colour.getY(i), colour.getZ(i)].join(",");
        if (topColours.has(point)) expect(shade).toBe(topColours.get(point));
        else topColours.set(point, shade);
      }
    } finally {
      geometry.dispose();
    }
  });

  it("retains a tall leader and smaller companions within the original tree envelope", () => {
    const blueprint = islandBlueprint({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonCount: 41,
      themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
    });
    const trees = planIslandDressing(blueprint, "course").placements.filter(
      (p) => p.kind === "tree" && p.clusterId,
    );
    const groves = new Map<string, number[]>();
    for (const tree of trees) {
      expect(tree.height).toBeLessThanOrEqual(COURSE_GROVE_LEADER_HEIGHT);
      const heights = groves.get(tree.clusterId!) ?? [];
      heights.push(tree.height);
      groves.set(tree.clusterId!, heights);
    }
    const grouped = [...groves.values()].filter((heights) => heights.length >= 3);
    expect(grouped.length).toBeGreaterThan(1);
    // Constrained shoulders may use the explicitly bounded young-leader
    // recovery; still require real tall groves and a hierarchy in every group.
    expect(
      grouped.filter((h) => Math.max(...h) >= COURSE_GROVE_LEADER_HEIGHT * 0.94).length,
    ).toBeGreaterThanOrEqual(2);
    for (const heights of grouped) {
      expect(Math.max(...heights)).toBeGreaterThanOrEqual(COURSE_GROVE_LEADER_HEIGHT * 0.64 * 0.94);
      expect(Math.max(...heights) / Math.min(...heights)).toBeGreaterThan(1.3);
    }
  });

  it.each(["fir", "broadleaf"] as const)(
    "reuses the complete %s inside the reserved course-tree envelope",
    (kind) => {
      const geometry = createMiniatureAsset(kind, "course");
      try {
        expect(geometry.index!.count / 3).toBe(kind === "fir" ? 408 : 432);
        const p = geometry.getAttribute("position");
        for (let i = 0; i < p.count; i++)
          expect(Math.hypot(p.getX(i), p.getZ(i))).toBeLessThanOrEqual(
            foliageFootprintRadius("tree", 1),
          );
        const forms = Array.from({ length: 30 }, (_, i) => courseTreeIsFir("grove", i, -i));
        expect(forms).toEqual(
          Array.from({ length: 30 }, (_, i) => courseTreeIsFir("grove", i, -i)),
        );
        expect(forms.some(Boolean)).toBe(true);
        expect(forms.some((v) => !v)).toBe(true);
      } finally {
        geometry.dispose();
      }
    },
  );
});
