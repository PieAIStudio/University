import { expect, it } from "vitest";
import { islandBlueprint, ISLAND_ROUTE_ARCHETYPES } from "./island-blueprint.js";
import { islandFieldFor } from "./island-field.js";
import { uplandGroves } from "./course-upland-groves.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";
it("creates bounded terrain-led groves beyond the path, never a full-lawn quota", () => {
  let positive = 0;
  for (const routeArchetype of ISLAND_ROUTE_ARCHETYPES)
    for (const seed of ["meadow", "coast", "ridge"]) {
      const bp = islandBlueprint({
        studyId: "upland",
        courseId: "clearing",
        lessonCount: 41,
        seed,
        routeArchetype,
      });
      const field = islandFieldFor(bp),
        groves = uplandGroves(bp, field, [], []);
      expect(groves).toEqual(uplandGroves(bp, field, [], []));
      expect(groves.length).toBeLessThanOrEqual(2);
      positive += groves.length;
      for (const p of groves)
        expect(distanceToIslandRoute(bp, p)).toBeGreaterThanOrEqual(islandRouteClearance(bp) + 10);
      // Occupying the same meadow is a hard exclusion, not a reason to move the road.
      const covered = groves.map((p) => ({ ...p, radius: 6 }));
      for (const p of uplandGroves(bp, field, covered, []))
        for (const c of covered)
          expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeGreaterThanOrEqual(12);
    }
  expect(positive).toBeGreaterThan(0);
});
