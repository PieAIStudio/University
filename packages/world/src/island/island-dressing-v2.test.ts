import { describe, expect, it } from "vitest";

import { islandBlueprintV2, sampleIslandSurfaceV2 } from "./island-blueprint-v2.js";
import {
  distanceToIslandRouteV2,
  islandDressingSafetyZonesV2,
  planIslandDressingV2,
} from "./island-dressing-v2.js";
import { sampleIslandTerrainTopV2 } from "./island-geometry-v2.js";
import { islandThemeSelectionForCourse, recipeById, type IslandRecipe } from "./kenney-recipes.js";

const selection = islandThemeSelectionForCourse("turing-pact", "foundations-before-zero");
const r01 = recipeById("R01-forest-academy") as IslandRecipe;
const WORLD_MINOR_ASSETS = new Set(["lantern", "wall", "wall-corner"]);
const ROOF_ASSETS = new Set(["roof", "roof-gable"]);

function makeBlueprint(unitIds?: readonly string[]) {
  return islandBlueprintV2({
    studyId: "turing-pact",
    courseId: "foundations-before-zero",
    lessonIds: Array.from({ length: 41 }, (_, index) => `lesson-${index + 1}`),
    unitIds,
    routeArchetype: "switchback",
    themeSelection: selection,
  });
}

describe("Island V2 dressing", () => {
  it("builds a deterministic, curated R01 composition inside the island", () => {
    const blueprint = makeBlueprint();
    const first = planIslandDressingV2(blueprint, "course");
    const second = planIslandDressingV2(blueprint, "course");
    expect(first).toEqual(second);
    expect(first.placements.length).toBeGreaterThan(45);
    expect(first.placements.some((placement) => placement.packId === "nature-kit")).toBe(true);
    expect(first.placements.some((placement) => placement.packId === "fantasy-town-kit")).toBe(
      true,
    );
    const accentPlacements = first.placements.filter(
      (placement) => placement.packId === "fantasy-town-kit",
    );
    const expectedAccentAssets = new Set(
      r01.accentRoles
        .filter((role) => role.packId === "fantasy-town-kit")
        .flatMap((role) => role.assetIds),
    );
    expect(r01.accentPackIds).toEqual(["fantasy-town-kit"]);
    expect(new Set(accentPlacements.map((placement) => placement.packId))).toEqual(
      new Set(r01.accentPackIds),
    );
    expect(new Set(accentPlacements.map((placement) => placement.assetId))).toEqual(
      expectedAccentAssets,
    );

    const expectedHeights = [
      ["fountain-round", 0.48, 0.62],
      ["stall", 1.25, 1.55],
      ["wall-doorway-square", 2.1, 2.5],
      ["wall", 2.1, 2.5],
      ["wall-corner", 2.1, 2.5],
      ["roof", 0.03, 0.08],
      ["roof-gable", 0.95, 1.25],
      ["lantern", 1.25, 1.5],
    ] as const;
    for (const [assetId, minimum, maximum] of expectedHeights) {
      const placements = accentPlacements.filter((placement) => placement.assetId === assetId);
      expect(placements.length, assetId).toBeGreaterThan(0);
      expect(placements.every((placement) => placement.height >= minimum)).toBe(true);
      expect(placements.every((placement) => placement.height <= maximum)).toBe(true);
    }

    for (const placement of first.placements) {
      const surface = sampleIslandSurfaceV2(blueprint, placement.x, placement.z);
      const renderedTop = sampleIslandTerrainTopV2(blueprint, "course", placement.x, placement.z);
      expect(surface.inside, placement.id).toBe(true);
      expect(placement.y, placement.id).toBeCloseTo(renderedTop.y + (placement.lift ?? 0), 8);
      expect(placement.height).toBeGreaterThan(0);
      expect(distanceToIslandRouteV2(blueprint, placement)).toBeGreaterThan(
        blueprint.route.roadWidth / 2,
      );
      expect(
        Math.hypot(placement.x - blueprint.hero.x, placement.z - blueprint.hero.z),
      ).toBeGreaterThanOrEqual(blueprint.hero.radius + 1.4);
      if (ROOF_ASSETS.has(placement.assetId)) {
        expect(placement.lift, placement.id).toBeGreaterThan(2);
        expect(placement.y, placement.id).toBeGreaterThan(surface.y);
      } else {
        expect(placement.lift ?? 0, placement.id).toBe(0);
      }
      if (placement.packId === "fantasy-town-kit") {
        expect(surface.radial, placement.id).toBeLessThanOrEqual(0.88);
      }
    }
  });

  it("derives conservative grass aprons from the same authored placements", () => {
    const plan = planIslandDressingV2(makeBlueprint(), "course");
    const zones = islandDressingSafetyZonesV2(plan);
    expect(zones.length).toBeGreaterThan(0);
    expect(zones.every((zone) => zone.kind === "landmark" && zone.radius > 0)).toBe(true);
    expect(zones).toEqual(islandDressingSafetyZonesV2(plan));
  });

  it("keeps the authored courtyard inside route and radial clearances", () => {
    for (const routeArchetype of [
      "arc",
      "horseshoe",
      "loop-around-hill",
      "switchback",
      "serpentine",
    ] as const) {
      const blueprint = islandBlueprintV2({
        studyId: "turing-pact",
        courseId: "foundations-before-zero",
        lessonCount: 41,
        routeArchetype,
        themeSelection: selection,
      });
      const accentPlacements = planIslandDressingV2(blueprint, "course").placements.filter(
        (placement) => placement.packId === "fantasy-town-kit",
      );
      expect(new Set(accentPlacements.map((placement) => placement.assetId))).toEqual(
        new Set(r01.accentRoles.flatMap((role) => role.assetIds)),
      );
      for (const placement of accentPlacements) {
        const surface = sampleIslandSurfaceV2(blueprint, placement.x, placement.z);
        const label = `${routeArchetype}/${placement.id}`;
        expect(surface.inside, label).toBe(true);
        expect(surface.radial, label).toBeLessThanOrEqual(0.88);
        expect(distanceToIslandRouteV2(blueprint, placement)).toBeGreaterThan(
          blueprint.route.roadWidth / 2,
        );
        expect(
          Math.hypot(placement.x - blueprint.hero.x, placement.z - blueprint.hero.z),
        ).toBeGreaterThanOrEqual(blueprint.hero.radius + 1.4);
      }
    }
  });

  it("stages the academy kit as arrival, journey, and summit beats", () => {
    const blueprint = makeBlueprint();
    const accents = planIslandDressingV2(blueprint, "course").placements.filter(
      (placement) => placement.packId === "fantasy-town-kit",
    );
    const segments = new Map<string, typeof accents>();
    for (const placement of accents) {
      const segment = placement.segment;
      expect(segment).toBeDefined();
      const entries = segments.get(segment!) ?? [];
      entries.push(placement);
      segments.set(segment!, entries);
    }
    expect([...segments.keys()].sort()).toEqual(["arrival", "journey", "summit"]);
    expect(segments.get("arrival")?.some(({ assetId }) => assetId === "wall-doorway-square")).toBe(
      true,
    );
    expect(segments.get("journey")?.some(({ assetId }) => assetId === "fountain-round")).toBe(true);
    expect(segments.get("summit")?.some(({ assetId }) => assetId === "roof-gable")).toBe(true);

    const nearestRouteFraction = (placement: (typeof accents)[number]) => {
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      blueprint.centerline.forEach((point, index) => {
        const distance = Math.hypot(placement.x - point.x, placement.z - point.z);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      return nearestIndex / Math.max(1, blueprint.centerline.length - 1);
    };
    const averageFraction = (segment: string) => {
      const entries = segments.get(segment) ?? [];
      return (
        entries.reduce((sum, placement) => sum + nearestRouteFraction(placement), 0) /
        entries.length
      );
    };
    expect(averageFraction("arrival")).toBeLessThan(0.3);
    expect(averageFraction("journey")).toBeGreaterThan(0.25);
    expect(averageFraction("journey")).toBeLessThan(0.75);
    expect(averageFraction("summit")).toBeGreaterThan(0.7);
  });

  it("makes the world plan a semantic subset, not a second random island", () => {
    const blueprint = makeBlueprint();
    const course = planIslandDressingV2(blueprint, "course");
    const world = planIslandDressingV2(blueprint, "world");
    const courseById = new Map(course.placements.map((placement) => [placement.id, placement]));
    expect(world.placements.length).toBeGreaterThan(4);
    expect(world.placements.length).toBeLessThanOrEqual(12);
    expect(world.placements.some((placement) => ROOF_ASSETS.has(placement.assetId))).toBe(true);
    expect(world.placements.some((placement) => placement.assetId === "fountain-round")).toBe(true);
    expect(world.placements.some((placement) => placement.kind === "tree")).toBe(true);
    expect(
      world.placements.filter((placement) => placement.kind === "tree").length,
    ).toBeLessThanOrEqual(2);
    expect(world.placements.every((placement) => !WORLD_MINOR_ASSETS.has(placement.assetId))).toBe(
      true,
    );
    expect(
      world.placements.every((placement) => ["landmark", "tree"].includes(placement.kind)),
    ).toBe(true);
    for (const placement of world.placements) {
      expect(courseById.get(placement.id)).toEqual(placement);
      expect(placement.importance).toBeGreaterThanOrEqual(0.76);
    }
  });

  it("does not turn unit boundaries into physical landscape boundaries", () => {
    const oneUnit = makeBlueprint(Array.from({ length: 41 }, () => "unit-a"));
    const manyUnits = makeBlueprint(
      Array.from({ length: 41 }, (_, index) => `unit-${Math.floor(index / 6) + 1}`),
    );
    expect(planIslandDressingV2(oneUnit, "course")).toEqual(
      planIslandDressingV2(manyUnits, "course"),
    );
  });

  it("refuses a recipe that does not match the blueprint physical-pack budget", () => {
    const blueprint = makeBlueprint();
    const starport = recipeById("R03-starport") as IslandRecipe;
    expect(() => planIslandDressingV2(blueprint, "course", starport)).toThrow(/does not match/);
  });
});
