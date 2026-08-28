import { describe, expect, it } from "vitest";

import { islandBlueprint } from "./island-blueprint.js";
import {
  buildIslandUndersideGeometry,
  ISLAND_UNDERSIDE_TRIANGLE_BUDGET,
  type IslandUndersideGeometry,
} from "./island-underside.js";

function makeBlueprint(seed = "underside-engineering-fixture") {
  return islandBlueprint({
    studyId: "turing-pact",
    courseId: "foundations-before-zero",
    lessonCount: 41,
    seed,
    routeArchetype: "switchback",
    themeSelection: {
      naturalBasePackId: "nature-kit",
      accentPackIds: ["fantasy-town-kit"],
      recipeId: "R01-forest-academy",
    },
  });
}

function worldGeometry(seed?: string): IslandUndersideGeometry {
  const blueprint = makeBlueprint(seed);
  const scale = 3.2 / blueprint.bounds.maxHalf;
  return buildIslandUndersideGeometry(
    blueprint,
    "world",
    scale,
    blueprint.bounds.maxHalf * 0.54 * scale,
  );
}

function dispose(geometry: IslandUndersideGeometry): void {
  geometry.structure.dispose();
  geometry.glow.dispose();
}

function attributeBytes(geometry: IslandUndersideGeometry): readonly number[][] {
  return [
    Array.from(geometry.structure.getAttribute("position").array),
    Array.from(geometry.structure.getAttribute("color").array),
    Array.from(geometry.structure.getIndex()!.array),
    Array.from(geometry.glow.getAttribute("position").array),
    Array.from(geometry.glow.getAttribute("color").array),
    Array.from(geometry.glow.getIndex()!.array),
  ];
}

describe("island engineering underside", () => {
  it("emits byte-identical structure and light geometry for one seed", () => {
    const first = worldGeometry();
    const second = worldGeometry();

    expect(attributeBytes(first)).toEqual(attributeBytes(second));
    expect(first.stats).toEqual(second.stats);
    dispose(first);
    dispose(second);
  });

  it("uses the seed for stable panel orientation instead of a global template", () => {
    const first = worldGeometry("engineering-seed-a");
    const second = worldGeometry("engineering-seed-b");

    expect(Array.from(first.structure.getAttribute("position").array)).not.toEqual(
      Array.from(second.structure.getAttribute("position").array),
    );
    dispose(first);
    dispose(second);
  });

  it("keeps the world chassis cheap while retaining readable structural tiers", () => {
    const geometry = worldGeometry();
    const { stats } = geometry;
    const totalTriangles = stats.structureTriangles + stats.glowTriangles;

    expect(stats.panelCount).toBe(6);
    expect(stats.ribCount).toBe(6);
    expect(stats.podCount).toBe(4);
    expect(totalTriangles).toBeLessThanOrEqual(ISLAND_UNDERSIDE_TRIANGLE_BUDGET.world);
    expect(stats.plateTopY).toBeGreaterThan(stats.plateBottomY);
    expect(stats.plateBottomY).toBeGreaterThan(stats.lipBottomY);
    expect(stats.plateBottomY).toBeGreaterThan(stats.coreBottomY);
    expect(stats.thrusterTopY).toBeLessThan(stats.plateBottomY);

    const colors = geometry.structure.getAttribute("color");
    const distinct = new Set<string>();
    for (let index = 0; index < colors.count; index += 1) {
      distinct.add(
        [colors.getX(index), colors.getY(index), colors.getZ(index)]
          .map((value) => value.toFixed(4))
          .join("/"),
      );
    }
    // Panel tones plus darker lips, ribs, core and pods must survive in the
    // vertex buffer; a single material colour would collapse this to one.
    expect(distinct.size).toBeGreaterThanOrEqual(10);
    dispose(geometry);
  });

  it("spends extra detail only in the course projection", () => {
    const blueprint = makeBlueprint();
    const world = worldGeometry();
    const course = buildIslandUndersideGeometry(blueprint, "course", 1, blueprint.underside.depth);
    const worldTriangles = world.stats.structureTriangles + world.stats.glowTriangles;
    const courseTriangles = course.stats.structureTriangles + course.stats.glowTriangles;

    expect(course.stats.panelCount).toBe(10);
    expect(course.stats.ribCount).toBe(10);
    expect(course.stats.podCount).toBe(6);
    expect(courseTriangles).toBeGreaterThan(worldTriangles);
    expect(courseTriangles).toBeLessThanOrEqual(ISLAND_UNDERSIDE_TRIANGLE_BUDGET.course);
    dispose(world);
    dispose(course);
  });

  it("contains only finite positions, colours and bounds", () => {
    const geometry = worldGeometry();
    for (const mesh of [geometry.structure, geometry.glow]) {
      for (const name of ["position", "color"] as const) {
        const attribute = mesh.getAttribute(name);
        for (const value of attribute.array) expect(Number.isFinite(value)).toBe(true);
      }
      expect(mesh.boundingBox).not.toBeNull();
      expect(mesh.boundingSphere).not.toBeNull();
      expect(Number.isFinite(mesh.boundingSphere!.radius)).toBe(true);
    }
    dispose(geometry);
  });
});
