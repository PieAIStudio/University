import { describe, expect, it } from "vitest";
import { islandBlueprint } from "./island-blueprint.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";
import { planIslandDressing, placementFootprintRadius } from "./island-dressing.js";
import { courseLandscapePlan, COURSE_LANDSCAPE_LIMITS } from "./course-landscape-plan.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";
import { islandTerrainFootprintRange } from "./island-geometry.js";
import { landscapeFootprint } from "./course-outcrop-plan.js";
import { buildCourseLandscapeGeometry } from "./course-landscape-geometry.js";
import { sampleIslandField, islandFieldFor } from "./island-field.js";
import { courseMeadowBeds } from "./course-meadow-beds.js";

const fixture = (count: number) =>
  islandBlueprint({
    studyId: "turing-pact",
    courseId: `meadow-proof-${count}`,
    lessonCount: count,
    themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
  });

describe("R54 composed groundcover", () => {
  it("keeps a bounded meadow grammar instead of filling every available grid cell", () => {
    let witnesses = 0;
    for (const count of [6, 12, 24, 41, 80]) {
      const bp = fixture(count),
        dressing = planIslandDressing(bp, "course");
      const occupied = dressing.placements.map((p) => ({
        ...p,
        radius: placementFootprintRadius(p),
      }));
      const beds = courseMeadowBeds(bp, occupied);
      expect(beds).toEqual(courseMeadowBeds(bp, occupied));
      expect(beds.length).toBeLessThanOrEqual(8);
      for (const [i, bed] of beds.entries()) {
        expect(sampleIslandField(islandFieldFor(bp), bed.x, bed.z).inside).toBe(true);
        expect(distanceToIslandRoute(bp, bed)).toBeGreaterThanOrEqual(
          islandRouteClearance(bp) + bed.radius + 0.45,
        );
        for (const other of beds.slice(i + 1))
          expect(Math.hypot(bed.x - other.x, bed.z - other.z)).toBeGreaterThanOrEqual(
            bed.radius + other.radius + 3,
          );
      }
      witnesses += beds.length;
    }
    expect(witnesses).toBeGreaterThan(5);
  }, 60000);

  it("emits real, grounded low accents without changing the accepted terrain or tall scenery", () => {
    let newPlants = 0,
      bedsWithPlants = 0;
    for (const count of [6, 12, 24, 41, 80]) {
      const bp = fixture(count),
        dressing = planIslandDressing(bp, "course");
      const before = JSON.stringify({ bp, dressing });
      const plan = courseLandscapePlan(bp, dressing);
      expect(JSON.stringify({ bp, dressing })).toBe(before);
      expect(plan.flora.length).toBeLessThanOrEqual(COURSE_LANDSCAPE_LIMITS.flora);
      const plants = plan.flora.filter((p) => p.anchorId.startsWith("meadow/"));
      const beds = plan.meadowBeds ?? [];
      bedsWithPlants += beds.length;
      newPlants += plants.length;
      for (const p of plants) {
        const bed = beds.find((b) => b.id === p.anchorId)!;
        expect(bed).toBeDefined();
        expect(Math.hypot(p.x - bed.x, p.z - bed.z) + p.radius).toBeLessThanOrEqual(
          bed.radius + 1e-6,
        );
        const ground = islandTerrainFootprintRange(
          bp,
          landscapeFootprint(p.x, p.z, p.radius, 8),
          "course",
        );
        expect(ground).not.toBeNull();
        expect(ground!.maxY - ground!.minY).toBeLessThanOrEqual(0.15 + 1e-7);
        expect(p.y).toBeCloseTo(ground!.minY - 0.012, 6);
        expect(distanceToIslandRoute(bp, p)).toBeGreaterThanOrEqual(
          islandRouteClearance(bp) + p.radius + 0.15,
        );
        for (const q of plan.flora) {
          if (q.id === p.id || q.supportId) continue;
          expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThanOrEqual(
            p.radius + q.radius + 0.039,
          );
        }
      }
      for (const b of beds) expect(plants.some((p) => p.anchorId === b.id)).toBe(true);
      const geometry = buildCourseLandscapeGeometry(plan);
      try {
        expect(geometry.triangles).toBeLessThanOrEqual(COURSE_LANDSCAPE_LIMITS.triangles);
        expect(
          [geometry.rock, geometry.flora, geometry.water].filter(Boolean).length,
        ).toBeLessThanOrEqual(3);
      } finally {
        geometry.dispose();
      }
      console.log(
        `[meadow-proof] lessons=${count} beds=${beds.length} flora=${plan.flora.length} triangles=${geometry.triangles}`,
      );
    }
    expect(newPlants).toBeGreaterThan(12);
    expect(bedsWithPlants).toBeGreaterThan(4);
  }, 60000);
});
