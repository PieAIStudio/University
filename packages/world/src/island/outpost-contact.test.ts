import { describe, expect, it } from "vitest";
import { islandBlueprint, ISLAND_ROUTE_ARCHETYPES } from "./island-blueprint.js";
import { footprintSamplePoints, worldSizeForAsset } from "./island-composition.js";
import {
  distanceToIslandRoute,
  islandRouteClearance,
  outpostFootprint,
  placementFootprintRadius,
  placeBridgeRestClearing,
  planIslandDressing,
} from "./island-dressing.js";
import { islandTerrainFootprintRange } from "./island-geometry.js";
import { islandFieldFor, sampleIslandField } from "./island-field.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";

describe("ordinary outposts use the physical model, not the semantic role", () => {
  it("reserves the same measured large rock when used as a landmark or a prop", () => {
    const size = worldSizeForAsset("rock_largeA", 0.7);
    for (const kind of ["landmark", "prop", "rock"] as const) {
      expect(placementFootprintRadius({ kind, assetId: "rock_largeA", height: 0.7 })).toBeCloseTo(
        Math.hypot(size.x, size.z) / 2,
        8,
      );
    }
  });

  it("never certifies an unmeasured solid from a guessed height", () => {
    expect(
      placementFootprintRadius({ kind: "prop", assetId: "not-a-measured-model", height: 1 }),
    ).toBe(Infinity);
  });

  it("uses a complete compact rest only where the normal group cannot fit, and still rejects occupied ground", () => {
    const blueprint = islandBlueprint({
      studyId: "outpost-physical",
      courseId: "horseshoe-6",
      lessonCount: 6,
      routeArchetype: "horseshoe",
      themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
    });
    const plan = planIslandDressing(blueprint, "course");
    const field = islandFieldFor(blueprint);
    const rest = plan.placements.filter((part) => part.outpostId === "bridge-rest-clearing");
    const reserved = plan.placements.filter((part) => part.assemblyId);
    expect(placeBridgeRestClearing(blueprint, field, reserved)).toEqual([]);
    expect(rest.map((part) => part.assetId)).toEqual(["rock_largeA", "rock_smallA", "bushEmitter"]);
    expect(rest.map((part) => part.height)).toEqual([0.42, 0.25, 0.3]);
    expect(plan.decisions?.find((entry) => entry.assemblyId === "route-bridge")).toMatchObject({
      status: "omitted",
      fallback: "stone-rest-clearing",
      members: rest.map((part) => part.id),
    });
    expect(
      placeBridgeRestClearing(blueprint, field, [{ ...rest[0]!, x: 0, z: 0, height: 100 }], true),
    ).toEqual([]);
    expect(planIslandDressing(blueprint, "course")).toBe(plan);
  });

  it.each(ISLAND_ROUTE_ARCHETYPES)(
    "checks actual outpost footprints, contact and separation on %s",
    (routeArchetype) => {
      let checked = 0;
      for (const lessonCount of [6, 24, 41]) {
        const blueprint = islandBlueprint({
          studyId: "outpost-physical",
          courseId: `${routeArchetype}-${lessonCount}`,
          lessonCount,
          routeArchetype,
          themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
        });
        const plan = planIslandDressing(blueprint, "course");
        const field = islandFieldFor(blueprint);
        const outposts = plan.placements.filter((p) => p.outpostId && !p.assemblyId);
        // One successful long island must not conceal an empty short/medium
        // case. Every route/length fixture is a real positive witness.
        expect(
          outposts.length,
          `${routeArchetype}/${lessonCount}: actual outpost members`,
        ).toBeGreaterThan(0);
        checked += outposts.length;
        for (const part of outposts) {
          const footprint = outpostFootprint(part);
          expect(footprint, part.id).not.toBeNull();
          const samples = footprintSamplePoints(footprint!);
          for (const point of samples) {
            const fieldPoint = sampleIslandField(field, point.x, point.z);
            expect(fieldPoint.inside, part.id).toBe(true);
            expect(fieldPoint.shore, part.id).toBeLessThanOrEqual(0.975);
            expect(distanceToIslandRoute(blueprint, point), part.id).toBeGreaterThanOrEqual(
              islandRouteClearance(blueprint),
            );
          }
          const ground = islandTerrainFootprintRange(blueprint, samples.slice(1, 5));
          expect(ground, part.id).not.toBeNull();
          expect(part.y, part.id).toBeCloseTo(ground!.minY + (part.lift ?? 0), 7);
          expect(ground!.maxY - ground!.minY, part.id).toBeLessThanOrEqual(0.25);
          expect(part.y + part.height, part.id).toBeGreaterThan(ground!.maxY);
          for (const other of plan.placements.filter(
            (p) => p.id !== part.id && (p.outpostId || p.assemblyId),
          )) {
            const needed = placementFootprintRadius(part) + placementFootprintRadius(other);
            expect(
              Math.hypot(part.x - other.x, part.z - other.z),
              `${part.id}/${other.id}`,
            ).toBeGreaterThanOrEqual(needed);
          }
        }
      }
      expect(checked, "a safe planner must retain actual positive examples").toBeGreaterThan(0);
    },
    60_000,
  );
});
