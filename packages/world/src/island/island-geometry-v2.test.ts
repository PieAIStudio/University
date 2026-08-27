import { describe, expect, it } from "vitest";

import { islandBlueprintV2 } from "./island-blueprint-v2.js";
import {
  buildIslandGeometryV2,
  islandGeometryV2Key,
  sampleIslandTerrainTopV2,
} from "./island-geometry-v2.js";

const blueprint = islandBlueprintV2({
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  lessonCount: 41,
  routeArchetype: "switchback",
  themeSelection: {
    naturalBasePackId: "nature-kit",
    accentPackIds: ["fantasy-town-kit"],
    recipeId: "R01-forest-academy",
  },
});

function dispose(shape: ReturnType<typeof buildIslandGeometryV2>): void {
  shape.terrain.dispose();
}

describe("Island V2 geometry projections", () => {
  it("compiles one finite terrain mesh with the route colour baked into its surface", () => {
    const shape = buildIslandGeometryV2(blueprint, "course");
    const position = shape.terrain.getAttribute("position");
    const colour = shape.terrain.getAttribute("color");

    expect(position.count).toBeGreaterThan(0);
    expect(colour.count).toBe(position.count);
    for (let index = 0; index < position.count; index += 1) {
      expect(Number.isFinite(position.getX(index))).toBe(true);
      expect(Number.isFinite(position.getY(index))).toBe(true);
      expect(Number.isFinite(position.getZ(index))).toBe(true);
      expect(Number.isFinite(colour.getX(index))).toBe(true);
      expect(Number.isFinite(colour.getY(index))).toBe(true);
      expect(Number.isFinite(colour.getZ(index))).toBe(true);
    }

    // There is deliberately no independent road/shoulder/path object. The
    // route is part of the same terrain colour field and grass exclusion rule.
    expect("path" in shape).toBe(false);
    dispose(shape);
  });

  it("keeps terrain colour deterministic for one blueprint", () => {
    const first = buildIslandGeometryV2(blueprint, "course");
    const second = buildIslandGeometryV2(blueprint, "course");

    expect(Array.from(first.terrain.getAttribute("color").array)).toEqual(
      Array.from(second.terrain.getAttribute("color").array),
    );
    dispose(first);
    dispose(second);
  });

  it("samples the same top-mesh height used by overlay roots", () => {
    const shape = buildIslandGeometryV2(blueprint, "course");
    const position = shape.terrain.getAttribute("position");
    const segments = blueprint.outline.length;
    const vertices = [
      { index: 0, x: 0, z: 0 },
      {
        index: 1,
        x: blueprint.outline[0]!.x * 0.06,
        z: blueprint.outline[0]!.z * 0.06,
      },
      {
        index: 1 + segments * 6 + 17,
        x: blueprint.outline[17]!.x * 0.65,
        z: blueprint.outline[17]!.z * 0.65,
      },
    ];

    for (const vertex of vertices) {
      const top = sampleIslandTerrainTopV2(blueprint, "course", vertex.x, vertex.z);
      expect(top.inside).toBe(true);
      expect(top.y).toBeCloseTo(position.getY(vertex.index), 7);
    }
    dispose(shape);
  });

  it("uses semantic LOD without creating a miniature road mesh", () => {
    const targetRadius = 3.2;
    const course = buildIslandGeometryV2(blueprint, "course");
    const world = buildIslandGeometryV2(blueprint, "world", targetRadius);

    expect(world.scale).toBeCloseTo(targetRadius / blueprint.bounds.maxHalf, 8);
    expect(world.bounds.halfX).toBeLessThanOrEqual(targetRadius + 0.001);
    expect(world.bounds.halfZ).toBeLessThanOrEqual(targetRadius + 0.001);
    expect(world.terrain.getAttribute("position").count).toBeLessThan(
      course.terrain.getAttribute("position").count,
    );
    expect("path" in course).toBe(false);
    expect("path" in world).toBe(false);
    expect(islandGeometryV2Key(blueprint, "world", targetRadius)).not.toBe(
      islandGeometryV2Key(blueprint, "course"),
    );
    dispose(course);
    dispose(world);
  });
});
