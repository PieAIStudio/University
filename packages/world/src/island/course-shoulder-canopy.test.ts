import { expect, it } from "vitest";
import { islandBlueprint, ISLAND_ROUTE_ARCHETYPES } from "./island-blueprint.js";
import { planIslandDressing } from "./island-dressing.js";
import { courseLandscapePlan } from "./course-landscape-plan.js";
import { courseRockTopPoints, sampleCourseRockTop } from "./course-rock-profile.js";
import { landscapeFootprint } from "./course-outcrop-plan.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";
it("keeps optional shoulder trees seated on actual rock, inside reserves and clear of real paths", () => {
  let witnesses = 0;
  for (const routeArchetype of ISLAND_ROUTE_ARCHETYPES)
    for (const seed of ["coast", "garden", "ridge"]) {
      const bp = islandBlueprint({
        studyId: "turing-pact",
        courseId: "foundations-before-zero",
        lessonCount: 41,
        seed,
        routeArchetype,
        themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
      });
      const dressing = planIslandDressing(bp, "course"),
        plan = courseLandscapePlan(bp, dressing);
      for (const tree of plan.canopy ?? []) {
        witnesses++;
        const site = plan.outcrops.find((p) => p.id === tree.supportId)!;
        expect(site.feature).not.toBe("ruin");
        expect(Math.hypot(tree.x - site.x, tree.z - site.z) + tree.radius).toBeLessThanOrEqual(
          site.radius,
        );
        expect(distanceToIslandRoute(bp, tree)).toBeGreaterThanOrEqual(
          islandRouteClearance(bp) + tree.radius + (site.height + tree.size) * 1.4,
        );
        const points = courseRockTopPoints(site);
        const ground = [
          { x: tree.x, z: tree.z },
          ...landscapeFootprint(tree.x, tree.z, tree.size * 0.12),
        ].map((p) => sampleCourseRockTop(points, p.x, p.z)!);
        expect(Math.max(...ground) - Math.min(...ground)).toBeLessThanOrEqual(0.14);
        expect(tree.y).toBeCloseTo(Math.min(...ground) - 0.012, 6);
      }
    }
  expect(witnesses).toBeGreaterThan(0);
});
