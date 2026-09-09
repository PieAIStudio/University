import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { glbModelInfo } from "../inspector/triangle-count.js";
import { ISLAND_ROUTE_ARCHETYPES, islandBlueprint } from "./island-blueprint.js";
import { COMPOSITION_SOURCE_EXTENTS, footprintSamplePoints } from "./island-composition.js";
import {
  outpostFootprint,
  planIslandDressing,
  distanceToIslandRoute,
  placementFootprintRadius,
} from "./island-dressing.js";
import { islandTerrainFootprintRange } from "./island-geometry.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";

describe("facility companions use real assets and the same safe ground", () => {
  it.each(["cart", "stall-bench"] as const)("checks the actual transformed %s GLB", (assetId) => {
    const bytes = readFileSync(
      new URL(
        `../../../../apps/university/public/kenney/r01/fantasy-town/${assetId}.glb`,
        import.meta.url,
      ),
    );
    const info = glbModelInfo(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    const extent = COMPOSITION_SOURCE_EXTENTS[assetId];
    expect(info?.size).not.toBeNull();
    for (const [i, axis] of (["x", "y", "z"] as const).entries())
      expect(info!.size![i]).toBeCloseTo(extent[axis], 4);
    expect(info!.triangles).toBe(assetId === "cart" ? 608 : 180);
    expect(info!.triangles).toBeLessThan(1200);
    expect(info!.hasTexture).toBe(true);
  });

  it("keeps furniture tied to existing facilities across all five routes", () => {
    const witnessed = new Set<string>();
    for (const routeArchetype of ISLAND_ROUTE_ARCHETYPES) {
      for (const lessonCount of [6, 24, 41]) {
        const blueprint = islandBlueprint({
          studyId: "turing-pact",
          courseId: "foundations-before-zero",
          lessonCount,
          routeArchetype,
          themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
        });
        const plan = planIslandDressing(blueprint, "course");
        expect(planIslandDressing(blueprint, "course")).toBe(plan);
        const furniture = plan.placements.filter((p) => p.id.startsWith("furniture-"));
        expect(furniture.length).toBeLessThanOrEqual(4);
        for (const piece of furniture) {
          witnessed.add(piece.assetId);
          const anchor = plan.placements.find((p) => p.id === piece.companionOf);
          expect(anchor, piece.id).toBeDefined();
          if (piece.assetId === "cart") expect(anchor!.assetId).toBe("stall");
          const footprint = outpostFootprint(piece)!;
          const ground = islandTerrainFootprintRange(
            blueprint,
            footprintSamplePoints(footprint).slice(1, 5),
          )!;
          expect(ground).not.toBeNull();
          expect(piece.y).toBeCloseTo(ground.minY, 8);
          expect(ground.maxY - piece.y).toBeLessThanOrEqual(0.25);
          expect(ground.maxSlope).toBeLessThanOrEqual(0.32);
          expect(distanceToIslandRoute(blueprint, piece)).toBeGreaterThan(
            blueprint.route.roadWidth / 2 + placementFootprintRadius(piece),
          );
        }
      }
    }
    expect(witnessed).toEqual(new Set(["stall-bench", "cart"]));
  });
});
