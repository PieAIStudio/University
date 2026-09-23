import { describe, expect, it } from "vitest";

import { islandBlueprint } from "./island-blueprint.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";
import {
  buildWildflowerGeometry,
  planWildflowers,
  WILDFLOWER_LIMIT,
  WILDFLOWER_TRIANGLES,
} from "./course-wildflowers.js";

describe("course wildflowers", () => {
  const blueprint = islandBlueprint({ studyId: "s", courseId: "wild", lessonCount: 24 });
  const standing = [{ x: 0, z: 0, radius: 3 }];
  const exclusions = [{ x: blueprint.nodes[3]!.x + 4, z: blueprint.nodes[3]!.z, radius: 1.5 }];
  const flowers = planWildflowers(blueprint, standing, exclusions);

  it("sprinkles a meadow, within its limit", () => {
    expect(flowers.length).toBeGreaterThan(100);
    expect(flowers.length).toBeLessThanOrEqual(WILDFLOWER_LIMIT);
  });

  it("keeps off the road, the lesson stones, everything standing and every exclusion", () => {
    const clearance = islandRouteClearance(blueprint);
    for (const f of flowers) {
      expect(distanceToIslandRoute(blueprint, f)).toBeGreaterThan(clearance);
      for (const n of blueprint.nodes)
        expect(Math.hypot(n.x - f.x, n.z - f.z)).toBeGreaterThan(blueprint.route.nodeRadius);
      for (const o of [...standing, ...exclusions])
        expect(Math.hypot(o.x - f.x, o.z - f.z)).toBeGreaterThan(o.radius);
    }
  });

  it("is the same meadow every time and costs its stated triangles", () => {
    expect(planWildflowers(blueprint, standing, exclusions)).toEqual(flowers);
    const geometry = buildWildflowerGeometry(flowers)!;
    expect(geometry.getAttribute("position").count / 3).toBe(flowers.length * WILDFLOWER_TRIANGLES);
    geometry.dispose();
  });
});
