import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { islandBlueprint } from "./island-blueprint.js";
import {
  buildIslandGeometry,
  ISLAND_GEOMETRY_PALETTE,
  islandCliffDarkFor,
  islandGeometryKey,
  sampleIslandTerrainTop,
} from "./island-geometry.js";

const blueprint = islandBlueprint({
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

function dispose(shape: ReturnType<typeof buildIslandGeometry>): void {
  shape.terrain.dispose();
}

describe("Island geometry projections", () => {
  it("keeps meadow, route soil, and rock in separate warm value bands", () => {
    const meadow = new THREE.Color(ISLAND_GEOMETRY_PALETTE.grass);
    const soil = new THREE.Color(ISLAND_GEOMETRY_PALETTE.soilHint);
    const rock = new THREE.Color(ISLAND_GEOMETRY_PALETTE.rock);
    const meadowHsl = { h: 0, s: 0, l: 0 };
    const soilHsl = { h: 0, s: 0, l: 0 };
    const rockHsl = { h: 0, s: 0, l: 0 };
    meadow.getHSL(meadowHsl);
    soil.getHSL(soilHsl);
    rock.getHSL(rockHsl);

    // These are broad art-direction guards, not exact screenshots: the route
    // must be the light cream band and exposed slopes must be visibly brown.
    expect(soilHsl.l).toBeGreaterThan(meadowHsl.l);
    expect(soilHsl.h).toBeGreaterThan(0.06);
    expect(soilHsl.h).toBeLessThan(0.16);
    expect(rockHsl.h).toBeGreaterThan(0.03);
    expect(rockHsl.h).toBeLessThan(0.1);
    expect(rockHsl.s).toBeGreaterThan(0.25);
  });

  it("compiles one finite terrain mesh with the route colour baked into its surface", () => {
    const shape = buildIslandGeometry(blueprint, "course");
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
    const first = buildIslandGeometry(blueprint, "course");
    const second = buildIslandGeometry(blueprint, "course");

    expect(Array.from(first.terrain.getAttribute("color").array)).toEqual(
      Array.from(second.terrain.getAttribute("color").array),
    );
    dispose(first);
    dispose(second);
  });

  it("keeps each projection's underside in its own palette family", () => {
    const first = islandBlueprint({
      studyId: "turing-pact",
      courseId: "underside-green",
      lessonCount: 12,
      seed: "underside-green",
    });
    const second = islandBlueprint({
      studyId: "turing-pact",
      courseId: "underside-warm",
      lessonCount: 12,
      seed: "underside-warm",
    });
    expect(islandCliffDarkFor(first)).not.toBe(islandCliffDarkFor(second));
  });

  it("samples the same top-mesh height used by overlay roots", () => {
    const shape = buildIslandGeometry(blueprint, "course");
    const position = shape.terrain.getAttribute("position");
    // The vertices are read out of the mesh rather than reconstructed from a
    // hard-coded ring table. The earlier version of this test spelled out the
    // radials 0.06 and 0.65 and the index arithmetic that went with a
    // thirteen-ring fan, so raising the ring count silently pointed it at
    // vertices that were no longer where it thought they were and it failed
    // for a reason that had nothing to do with the invariant it exists to
    // protect. The invariant is that an overlay root placed at a top vertex's
    // x/z gets that vertex's height back.
    const centre = { x: position.getX(0), y: position.getY(0), z: position.getZ(0) };
    expect(centre.x).toBeCloseTo(0, 9);
    expect(centre.z).toBeCloseTo(0, 9);
    const samples = [0, 137, 1601, 3407];

    for (const index of samples) {
      const x = position.getX(index);
      const z = position.getZ(index);
      const top = sampleIslandTerrainTop(blueprint, "course", x, z);
      expect(top.inside, `vertex ${index}`).toBe(true);
      expect(top.y, `vertex ${index}`).toBeCloseTo(position.getY(index), 6);
    }
    dispose(shape);
  });

  it("uses semantic LOD without creating a miniature road mesh", () => {
    const targetRadius = 3.2;
    const course = buildIslandGeometry(blueprint, "course");
    const world = buildIslandGeometry(blueprint, "world", targetRadius);

    expect(world.scale).toBeCloseTo(targetRadius / blueprint.bounds.maxHalf, 8);
    expect(world.bounds.halfX).toBeLessThanOrEqual(targetRadius + 0.001);
    expect(world.bounds.halfZ).toBeLessThanOrEqual(targetRadius + 0.001);
    expect(world.terrain.getAttribute("position").count).toBeLessThan(
      course.terrain.getAttribute("position").count,
    );
    expect("path" in course).toBe(false);
    expect("path" in world).toBe(false);
    expect(islandGeometryKey(blueprint, "world", targetRadius)).not.toBe(
      islandGeometryKey(blueprint, "course"),
    );
    dispose(course);
    dispose(world);
  });
});
