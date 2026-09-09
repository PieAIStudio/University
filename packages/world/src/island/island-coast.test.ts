import { describe, expect, it } from "vitest";
import {
  ISLAND_ROUTE_ARCHETYPES,
  islandBlueprint,
  sampleIslandSurface,
} from "./island-blueprint.js";
import { buildIslandGeometry } from "./island-geometry.js";

describe("a landform continues to its cliff instead of ending on a flat plate", () => {
  it.each(ISLAND_ROUTE_ARCHETYPES)("retains authored coastal relief for %s", (routeArchetype) => {
    for (const lessonCount of [6, 12, 24, 41]) {
      for (const seed of ["coast", "upland", "grove"]) {
        const blueprint = islandBlueprint({
          studyId: "coast-regression",
          courseId: `course-${lessonCount}`,
          lessonCount,
          routeArchetype,
          seed: `coast-r38/${routeArchetype}/${lessonCount}/${seed}`,
        });
        const heights = blueprint.outline.map((p) => sampleIslandSurface(blueprint, p.x, p.z).y);
        const span = Math.max(...heights) - Math.min(...heights);
        expect(
          span / blueprint.bounds.maxHalf,
          `${lessonCount}/${seed} cliff lip height range`,
        ).toBeGreaterThan(0.025);
        expect(
          heights.filter((y) => y > 0.02 * blueprint.bounds.maxHalf).length / heights.length,
          `${lessonCount}/${seed} land reaches cliff`,
        ).toBeGreaterThan(0.45);
        const world = buildIslandGeometry(blueprint, "world");
        try {
          const position = world.terrain.getAttribute("position");
          const segments = 32;
          const topRings = (world.counts.topTriangles / segments + 1) / 2;
          const outerStart = 1 + (topRings - 1) * segments;
          const edge = Array.from({ length: segments }, (_, i) => position.getY(outerStart + i));
          const colors = world.terrain.getAttribute("color");
          const indices = world.terrain.getIndex()!;
          const cliffStart = (world.counts.topTriangles + world.counts.routeTriangles) * 3;
          for (let i = 0; i < segments; i++) {
            const lip = indices.getX(cliffStart + i * 6);
            for (let channel = 0; channel < 3; channel++) {
              expect(
                colors.array[(outerStart + i) * 3 + channel],
                "no separate coloured lid edge",
              ).toBeCloseTo(colors.array[lip * 3 + channel]!, 6);
            }
          }
          expect(
            Math.max(...edge) - Math.min(...edge),
            "distant lip must keep relief too",
          ).toBeGreaterThan(0.02);
          expect(world.counts.total).toBe(640);
        } finally {
          world.terrain.dispose();
        }
      }
    }
  });
});
