import { describe, expect, it } from "vitest";
import { islandBlueprint, pointInsideOutline } from "./island-blueprint.js";
import { planIslandDressing, placementFootprintRadius } from "./island-dressing.js";
import { courseLandscapePlan } from "./course-landscape-plan.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";
import { sampleIslandTerrainTop } from "./island-geometry.js";
import { buildCourseSpringGeometry } from "./course-spring-geometry.js";
import {
  planCourseSpring,
  overlapsCourseSpring,
  springWaterLevel,
  COURSE_SPRING_TRIANGLE_CEILING,
} from "./course-spring-plan.js";

describe("course coastal spring", () => {
  it("retains shallow head over a bed ripple without going uphill or covering a ravine", () => {
    expect(springWaterLevel(1, 0.86, 0.91)).toBe(1);
    expect(springWaterLevel(1, 0.88, 0.97)).toBe(1);
    expect(springWaterLevel(1, 0.95, 1.01)).toBeNull();
    expect(springWaterLevel(1, 0.4, 0.95)).toBeNull();
    expect(springWaterLevel(1, NaN, 1)).toBeNull();
  });

  it("keeps the first real course's landscape deterministic with reserved water", () => {
    const bp = islandBlueprint({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonCount: 41,
      themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
    });
    const dressing = planIslandDressing(bp, "course"),
      landscape = courseLandscapePlan(bp, dressing);
    expect(courseLandscapePlan(bp, dressing)).toBe(landscape);
    console.log("[first course spring]", landscape.spring ? landscape.spring.id : "no safe source");
    if (landscape.spring)
      for (const p of dressing.placements)
        expect(overlapsCourseSpring(landscape.spring, p, placementFootprintRadius(p))).toBe(false);
  });
  it("keeps real bank coverage, downhill water and a clear route across the shape matrix", () => {
    let witnesses = 0;
    for (const routeArchetype of [
      "arc",
      "horseshoe",
      "loop-around-hill",
      "switchback",
      "serpentine",
    ] as const)
      for (const lessonCount of [12, 24, 41]) {
        const blueprint = islandBlueprint({
          studyId: "spring-check",
          courseId: "garden",
          lessonCount,
          routeArchetype,
          themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
        });
        const dressing = planIslandDressing(blueprint, "course");
        const landscape = courseLandscapePlan(blueprint, dressing);
        const spring = landscape.spring;
        if (!spring) continue;
        witnesses++;
        expect(
          planCourseSpring(blueprint, [
            ...dressing.placements.map((p) => ({ ...p, radius: placementFootprintRadius(p) })),
            ...landscape.outcrops,
          ]),
        ).toEqual(spring);
        let previous = spring.basin.y;
        for (const s of spring.channel) {
          expect(s.y).toBeLessThanOrEqual(previous + 1e-7);
          expect(s.y).toBeGreaterThan(s.groundRange[1]);
          expect(s.y - s.groundRange[0]).toBeLessThanOrEqual(0.26);
          expect(distanceToIslandRoute(blueprint, s)).toBeGreaterThanOrEqual(
            islandRouteClearance(blueprint) + s.halfWidth,
          );
          for (const side of [-1, 0, 1]) {
            const x = s.x - spring.direction.z * s.halfWidth * side;
            const z = s.z + spring.direction.x * s.halfWidth * side;
            const ground = sampleIslandTerrainTop(blueprint, "course", x, z);
            expect(ground.inside).toBe(true);
            expect(s.y - ground.y).toBeGreaterThanOrEqual(-1e-6);
          }
          previous = s.y;
        }
        expect(pointInsideOutline(spring.lip, blueprint.outline)).toBe(false);
        expect(landscape.flora.every((p) => !overlapsCourseSpring(spring, p, p.radius))).toBe(true);
        const { bank, water } = buildCourseSpringGeometry(spring);
        try {
          expect((bank.index!.count + water.index!.count) / 3).toBeLessThanOrEqual(
            COURSE_SPRING_TRIANGLE_CEILING,
          );
          for (const g of [bank, water]) {
            expect(g.index!.count).toBeGreaterThan(0);
            for (const attr of Object.values(g.attributes))
              expect(Array.from(attr.array).every(Number.isFinite)).toBe(true);
          }
        } finally {
          bank.dispose();
          water.dispose();
        }
      }
    console.log("[spring positive terrain witnesses]", witnesses);
    expect(witnesses).toBeGreaterThan(0);
  }, 120_000);

  it("omits a spring instead of guessing when occupancy is unknown or all land is reserved", () => {
    const blueprint = islandBlueprint({
      studyId: "spring-check",
      courseId: "blocked",
      lessonCount: 24,
    });
    expect(planCourseSpring(blueprint, [{ x: 0, z: 0, radius: Number.NaN }])).toBeNull();
    expect(
      planCourseSpring(blueprint, [{ x: 0, z: 0, radius: blueprint.bounds.maxHalf * 3 }]),
    ).toBeNull();
  });
});
