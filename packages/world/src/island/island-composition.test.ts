import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { glbModelInfo } from "../inspector/triangle-count.js";

import { islandBlueprint, sampleIslandSurface } from "./island-blueprint.js";
import {
  BRIDGE_FRACTIONS,
  COMPOSITION_SCALES,
  COMPOSITION_SOURCE_EXTENTS,
  ROADSIDE_CAMP_ASSEMBLY,
  ROUTE_BRIDGE_ASSEMBLY,
  SUMMIT_ACADEMY_ASSEMBLY,
  borderRockClusterCentres,
  evaluateAssembly,
  evaluateBridgeSpan,
  footprintSamplePoints,
  hasBridgeTerrainSupport,
  orientedFootprintFor,
  resolveAssemblyParts,
  searchAcademyPlacement,
  searchCampPlacement,
  worldSizeForAsset,
} from "./island-composition.js";
import { islandFieldFor, sampleIslandField } from "./island-field.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";
import { seeded } from "./random.js";
import { yawToWorld } from "./island-route-geometry.js";

const selection = islandThemeSelectionForCourse("turing-pact", "foundations-before-zero");

function makeBlueprint(lessonCount = 41, routeArchetype: "switchback" | "arc" = "switchback") {
  return islandBlueprint({
    studyId: "turing-pact",
    courseId: "foundations-before-zero",
    lessonCount,
    routeArchetype,
    themeSelection: selection,
  });
}

describe("composition module boundary", () => {
  it("does not import island-dressing at runtime", () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "island-composition.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/from ["']\.\/island-dressing\.js["']/);
  });
});

describe("COMPOSITION_SCALES", () => {
  it("derives roof height and lift from the measured wall scale", () => {
    const wallScale = COMPOSITION_SCALES.academyWall.height / COMPOSITION_SOURCE_EXTENTS.wall.y;
    expect(COMPOSITION_SCALES.academyRoof.height).toBeCloseTo(
      COMPOSITION_SOURCE_EXTENTS.roof.y * wallScale,
      5,
    );
    expect(COMPOSITION_SCALES.academyRoofGable.height).toBeCloseTo(
      COMPOSITION_SOURCE_EXTENTS["roof-gable"].y * wallScale,
      5,
    );
    expect(COMPOSITION_SCALES.academyRoof.lift).toBe(COMPOSITION_SCALES.academyWall.height);
    expect(COMPOSITION_SCALES.academyRoofGable.lift).toBe(COMPOSITION_SCALES.academyWall.height);
    expect(COMPOSITION_SCALES.academyRoof.lift).toBeLessThan(
      COMPOSITION_SCALES.academyWall.height + 0.05,
    );
    expect(COMPOSITION_SCALES.camp.height).toBe(0.32);
    expect(COMPOSITION_SCALES.camp.state).toBe("lit");
  });

  it("keeps academy elevation span far below wall height", () => {
    expect(SUMMIT_ACADEMY_ASSEMBLY.maxElevationSpan).toBeLessThan(0.4);
    expect(SUMMIT_ACADEMY_ASSEMBLY.maxElevationSpan).toBeLessThan(
      COMPOSITION_SCALES.academyWall.height * 0.2,
    );
    expect(SUMMIT_ACADEMY_ASSEMBLY.maxGroundSlope).toBeGreaterThan(0);
    expect(SUMMIT_ACADEMY_ASSEMBLY.maxGroundSlope).toBeLessThan(0.25);
  });
});

describe("oriented footprints", () => {
  it("samples rotated corners, not only the centre", () => {
    const footprint = orientedFootprintFor("wall-doorway-square", 2.3, 0, 0, 0);
    const points = footprintSamplePoints(footprint);
    expect(points.length).toBeGreaterThanOrEqual(9);
    const xs = points.map((point) => point.x);
    const zs = points.map((point) => point.z);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(
      worldSizeForAsset("wall-doorway-square", 2.3).x,
      3,
    );
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(
      worldSizeForAsset("wall-doorway-square", 2.3).z,
      3,
    );

    const turned = footprintSamplePoints(
      orientedFootprintFor("wall-doorway-square", 2.3, 0, 0, Math.PI / 2),
    );
    const turnedXs = turned.map((point) => point.x);
    expect(Math.max(...turnedXs) - Math.min(...turnedXs)).toBeCloseTo(
      worldSizeForAsset("wall-doorway-square", 2.3).z,
      3,
    );
  });

  it("computes normalized rock dimensions matching donor GLB proportions at height 1", () => {
    // Independent known assertion: largeA at height 1 should be width ~3.021 and depth ~3.909
    const large = worldSizeForAsset("rock_largeA", 1);
    expect(large.x).toBeCloseTo(3.021, 2);
    expect(large.y).toBe(1);
    expect(large.z).toBeCloseTo(3.909, 2);

    // Independent known assertion: smallA at height 1 should be width ~1.887
    const small = worldSizeForAsset("rock_smallA", 1);
    expect(small.x).toBeCloseTo(1.887, 2);
    expect(small.y).toBe(1);
    expect(small.z).toBeCloseTo(1.887, 2);
  });

  it("verifies source bounds from actual donor GLB assets", () => {
    const largeGlb = readFileSync(
      new URL(
        "../../../../apps/university/public/kenney/r01/nature/rock_largeA.glb",
        import.meta.url,
      ),
    );
    const largeInfo = glbModelInfo(
      largeGlb.buffer.slice(largeGlb.byteOffset, largeGlb.byteOffset + largeGlb.byteLength),
    );
    expect(largeInfo).not.toBeNull();
    expect(largeInfo!.size![0]).toBeCloseTo(COMPOSITION_SOURCE_EXTENTS.rock_largeA.x, 3);
    expect(largeInfo!.size![1]).toBeCloseTo(COMPOSITION_SOURCE_EXTENTS.rock_largeA.y, 3);
    expect(largeInfo!.size![2]).toBeCloseTo(COMPOSITION_SOURCE_EXTENTS.rock_largeA.z, 3);

    const smallGlb = readFileSync(
      new URL(
        "../../../../apps/university/public/kenney/r01/nature/rock_smallA.glb",
        import.meta.url,
      ),
    );
    const smallInfo = glbModelInfo(
      smallGlb.buffer.slice(smallGlb.byteOffset, smallGlb.byteOffset + smallGlb.byteLength),
    );
    expect(smallInfo).not.toBeNull();
    expect(smallInfo!.size![0]).toBeCloseTo(COMPOSITION_SOURCE_EXTENTS.rock_smallA.x, 3);
    expect(smallInfo!.size![1]).toBeCloseTo(COMPOSITION_SOURCE_EXTENTS.rock_smallA.y, 3);
    expect(smallInfo!.size![2]).toBeCloseTo(COMPOSITION_SOURCE_EXTENTS.rock_smallA.z, 3);
  });
});

describe("atomic assemblies", () => {
  it("omits the whole academy when a required asset is missing", () => {
    expect(resolveAssemblyParts(SUMMIT_ACADEMY_ASSEMBLY, new Map())).toBeNull();
    const onlyDoor = new Map<string, "fantasy-town-kit">([
      ["wall-doorway-square", "fantasy-town-kit"],
      ["roof-gable", "fantasy-town-kit"],
    ]);
    expect(resolveAssemblyParts(SUMMIT_ACADEMY_ASSEMBLY, onlyDoor)).toBeNull();
    const complete = new Map<string, "fantasy-town-kit">([
      ["wall-doorway-square", "fantasy-town-kit"],
      ["roof-gable", "fantasy-town-kit"],
      ["wall", "fantasy-town-kit"],
      ["roof", "fantasy-town-kit"],
      ["wall-corner", "fantasy-town-kit"],
    ]);
    expect(resolveAssemblyParts(SUMMIT_ACADEMY_ASSEMBLY, complete)?.length).toBe(5);
  });

  it("rejects a pad whose slope exceeds maxGroundSlope", () => {
    const blueprint = makeBlueprint();
    const field = islandFieldFor(blueprint);
    const anchor = {
      point: { x: 0, z: 0 },
      tangent: { x: 1, z: 0 },
      normal: { x: 0, z: 1 },
    };
    const steep = evaluateAssembly(
      SUMMIT_ACADEMY_ASSEMBLY,
      {
        blueprint,
        field,
        heightAt: (x) => x * 0.5,
        packByAsset: new Map([
          ["wall-doorway-square", "fantasy-town-kit"],
          ["roof-gable", "fantasy-town-kit"],
          ["wall", "fantasy-town-kit"],
          ["roof", "fantasy-town-kit"],
          ["wall-corner", "fantasy-town-kit"],
        ]),
      },
      anchor,
    );
    expect(steep.ok).toBe(false);
    expect(steep.reason).toBe("slope");
    expect(steep.slope ?? 0).toBeGreaterThan(SUMMIT_ACADEMY_ASSEMBLY.maxGroundSlope);
  });

  it("shares one base elevation and roof lift across academy parts", () => {
    const blueprint = makeBlueprint();
    const field = islandFieldFor(blueprint);
    const packByAsset = new Map<string, "fantasy-town-kit">([
      ["wall-doorway-square", "fantasy-town-kit"],
      ["roof-gable", "fantasy-town-kit"],
      ["wall", "fantasy-town-kit"],
      ["roof", "fantasy-town-kit"],
      ["wall-corner", "fantasy-town-kit"],
    ]);
    const placed = searchAcademyPlacement(
      {
        blueprint,
        field,
        heightAt: (x, z) => sampleIslandSurface(blueprint, x, z).y,
        packByAsset,
      },
      `${blueprint.seed}/academy-pad`,
    );
    expect(placed, "the canonical long course must host a complete academy").not.toBeNull();
    if (!placed) throw new Error("academy placement missing");
    const bases = placed.map((placement) => placement.y - (placement.lift ?? 0));
    expect(new Set(bases.map((value) => value.toFixed(5))).size).toBe(1);
    const gable = placed.find((placement) => placement.assetId === "roof-gable");
    const door = placed.find((placement) => placement.assetId === "wall-doorway-square");
    expect(placed.map((placement) => placement.assetId).sort()).toEqual(
      ["roof-gable", "wall", "wall", "wall", "wall-doorway-square"].sort(),
    );
    expect(gable?.lift).toBe(COMPOSITION_SCALES.academyWall.height);
    const wallSize = worldSizeForAsset("wall", COMPOSITION_SCALES.academyWall.height);
    expect(Math.hypot(gable!.x - door!.x, gable!.z - door!.z)).toBeCloseTo(
      (wallSize.z - wallSize.x) / 2,
      8,
    );
    expect(gable!.y - door!.y).toBeCloseTo(COMPOSITION_SCALES.academyWall.height, 8);
  });

  it("encloses a room rather than putting roofs on a facade", () => {
    const walls = SUMMIT_ACADEMY_ASSEMBLY.parts.filter(
      (part) => part.assetId === "wall" || part.assetId === "wall-doorway-square",
    );
    expect(walls).toHaveLength(4);
    expect(new Set(walls.map((part) => part.turn)).size).toBe(2);
    expect(Math.max(...walls.map((part) => part.along))).toBeGreaterThan(0);
    expect(Math.min(...walls.map((part) => part.along))).toBeLessThan(0);
    expect(Math.max(...walls.map((part) => part.away))).toBeGreaterThan(0);
    expect(Math.min(...walls.map((part) => part.away))).toBeLessThan(0);
    expect(SUMMIT_ACADEMY_ASSEMBLY.parts.filter((part) => part.lift)).toHaveLength(1);
  });
});

describe("camp grouping", () => {
  it("places tent and lit fire together with the entrance facing the pit", () => {
    const blueprint = makeBlueprint();
    const field = islandFieldFor(blueprint);
    const placed = searchCampPlacement(
      {
        blueprint,
        field,
        heightAt: (x, z) => sampleIslandSurface(blueprint, x, z).y,
      },
      `${blueprint.seed}/camp-test`,
    );
    expect(placed, "default 41-lesson switchback should host a roadside camp").not.toBeNull();
    if (!placed) throw new Error("camp placement missing");
    const fire = placed.find((placement) => placement.assetId === "camp");
    const tent = placed.find((placement) => placement.assetId === "tent");
    expect(placed).toHaveLength(2);
    expect(fire?.state).toBe("lit");
    expect(tent).toBeDefined();
    const toFire = { x: fire!.x - tent!.x, z: fire!.z - tent!.z };
    const forward = yawToWorld(tent!.turn);
    const length = Math.hypot(toFire.x, toFire.z) || 1;
    expect((forward.x * toFire.x + forward.z * toFire.z) / length).toBeGreaterThan(0.82);
    expect(length).toBeGreaterThan(
      worldSizeForAsset("camp", COMPOSITION_SCALES.camp.height).z * 0.5 +
        worldSizeForAsset("tent", COMPOSITION_SCALES.tent.height).z * 0.5,
    );
    const bases = placed.map((placement) => placement.y - (placement.lift ?? 0));
    expect(new Set(bases.map((value) => value.toFixed(5))).size).toBe(1);
  });

  it("keeps tent and fire as required camp parts", () => {
    expect(ROADSIDE_CAMP_ASSEMBLY.parts.map((part) => part.assetId)).toEqual(["camp", "tent"]);
    expect(ROADSIDE_CAMP_ASSEMBLY.parts.every((part) => !part.optional)).toBe(true);
  });
});

describe("bridge span gate", () => {
  it("rejects a flat lawn and accepts a real depression between banks", () => {
    const blueprint = makeBlueprint();
    const field = islandFieldFor(blueprint);
    const context = {
      blueprint,
      field,
      heightAt: (x: number, z: number) => sampleIslandSurface(blueprint, x, z).y,
    };
    const flat = evaluateBridgeSpan(context, { x: 0, z: 0 }, { x: 1, z: 0 }, 3.5);
    expect(flat.ok).toBe(false);
    const carved = evaluateBridgeSpan(
      {
        ...context,
        heightAt: (x) => (Math.abs(x) < 1.25 ? 0 : 0.7),
      },
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      3.5,
    );
    expect(carved).toMatchObject({
      ok: true,
      baseY: expect.any(Number),
      deckY: expect.any(Number),
    });
    expect(carved.deckY).toBeGreaterThan(0.7);
    expect(hasBridgeTerrainSupport(blueprint, field, { x: 0, z: 0 }, { x: 1, z: 0 })).toBe(false);
  });

  it("rejects the highest obstruction, including one off the centreline", () => {
    const blueprint = makeBlueprint();
    const field = islandFieldFor(blueprint);
    for (const offAxis of [false, true]) {
      const result = evaluateBridgeSpan(
        {
          blueprint,
          field,
          heightAt: (x, z) =>
            Math.abs(x) > 1.25
              ? 0.7
              : Math.abs(x + 0.875) < 0.22 && (!offAxis || z > 0.2)
                ? 1.6
                : 0,
        },
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        3.5,
      );
      expect(result).toMatchObject({ ok: false, reason: "deck-buried" });
    }
  });

  it("checks both support pads and rejects non-finite height or direction", () => {
    const blueprint = makeBlueprint();
    const field = islandFieldFor(blueprint);
    const context = { blueprint, field, heightAt: (x: number) => (Math.abs(x) > 1.25 ? 0.7 : 0) };
    expect(
      evaluateBridgeSpan({ ...context, heightAt: () => NaN }, { x: 0, z: 0 }, { x: 1, z: 0 }, 3.5)
        .ok,
    ).toBe(false);
    expect(evaluateBridgeSpan(context, { x: 0, z: 0 }, { x: 0, z: 0 }, 3.5).ok).toBe(false);
    expect(
      evaluateBridgeSpan(
        {
          ...context,
          heightAt: (x, z) => (Math.abs(x) > 1.25 ? (z > 0.3 ? 1.2 : 0.7) : 0),
        },
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        3.5,
      ).ok,
    ).toBe(false);
  });

  it("actually places the complete bridge across a supported depression", () => {
    const blueprint = makeBlueprint();
    const result = evaluateAssembly(
      ROUTE_BRIDGE_ASSEMBLY,
      {
        blueprint,
        field: islandFieldFor(blueprint),
        heightAt: (x) => (Math.abs(x) > 1.25 ? 0.7 : 0),
      },
      { point: { x: 0, z: 0 }, tangent: { x: 1, z: 0 }, normal: { x: 0, z: 1 } },
    );
    expect(result.ok, result.reason).toBe(true);
    expect(result.placements).toHaveLength(1);
    expect(result.placements?.[0]).toMatchObject({ assetId: "bridge", y: 0.7 });
  });

  it("refuses a bridge without support and never returns a partial deck", () => {
    expect(BRIDGE_FRACTIONS.length).toBeGreaterThan(0);
    expect(BRIDGE_FRACTIONS.length).toBeLessThanOrEqual(8);
    const blueprint = makeBlueprint();
    const result = evaluateAssembly(
      ROUTE_BRIDGE_ASSEMBLY,
      {
        blueprint,
        field: islandFieldFor(blueprint),
        heightAt: () => 0.4,
      },
      { point: { x: 0, z: 0 }, tangent: { x: 1, z: 0 }, normal: { x: 0, z: 1 } },
    );
    expect(result.ok).toBe(false);
    expect(result.placements).toBeUndefined();
    expect(result.reason).toBeTruthy();
  });
});

describe("border rock centres", () => {
  it("keeps fallback centres inside the field and off the water", () => {
    const blueprint = makeBlueprint();
    const field = islandFieldFor(blueprint);
    const centres = borderRockClusterCentres(
      blueprint,
      field,
      seeded(`${blueprint.seed}/rock-centre-test`),
    );
    expect(centres.length).toBeGreaterThan(0);
    for (const centre of centres) {
      const fieldSample = sampleIslandField(field, centre.x, centre.z);
      expect(fieldSample.inside, `${centre.x},${centre.z}`).toBe(true);
      expect(fieldSample.shore, `${centre.x},${centre.z}`).toBeLessThanOrEqual(0.9);
      expect(sampleIslandSurface(blueprint, centre.x, centre.z).inside).toBe(true);
    }
  });
});
