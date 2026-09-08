import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ISLAND_ROUTE_ARCHETYPES, islandBlueprint } from "./island-blueprint.js";
import {
  planIslandDressing,
  routeVegetationCentres,
  distanceToIslandRoute,
  islandRouteClearance,
} from "./island-dressing.js";
import { islandRouteFrameAtIndex, islandRouteIndexNear } from "./island-route-geometry.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";
import {
  foliageFootprintRadius,
  bushCrownLobes,
  createSmoothIcosahedron,
} from "./foliage-geometry.js";
import { toFoliageRenderPlacement } from "./island-foliage-render.js";
import { sampleIslandTerrainTop } from "./island-geometry.js";

const selection = islandThemeSelectionForCourse("turing-pact", "foundations-before-zero");

describe("route-side vegetation beats (synthetic length/seed matrix)", () => {
  it.each(ISLAND_ROUTE_ARCHETYPES)(
    "keeps %s's route legible across 6/12/24/41 lessons and three seeds",
    (routeArchetype) => {
      for (const courseId of ["foundations-before-zero", "verge-meadow", "verge-shoulder"]) {
        const treeCounts: number[] = [];
        for (const lessonCount of [6, 12, 24, 41]) {
          const blueprint = islandBlueprint({
            studyId: "turing-pact",
            courseId,
            lessonCount,
            routeArchetype,
            themeSelection: selection,
          });
          const plan = planIslandDressing(blueprint, "course");
          expect(planIslandDressing(blueprint, "course")).toBe(plan);
          const natural = plan.placements.filter(
            (p) => p.id.startsWith("nature-") && (p.kind === "tree" || p.kind === "bush"),
          );
          const trees = natural.filter((p) => p.kind === "tree");
          const verge = natural.filter((p) => p.clusterId?.startsWith("verge-"));
          const reserved = plan.placements.filter((p) => !p.id.startsWith("nature-"));
          const groveCentres = routeVegetationCentres(blueprint, "grove", reserved);
          const vergeCentres = routeVegetationCentres(blueprint, "verge", reserved);
          treeCounts.push(trees.length);
          expect(groveCentres.length).toBeLessThanOrEqual(
            lessonCount <= 8 ? 3 : lessonCount <= 24 ? 7 : 9,
          );
          expect(verge.length).toBeGreaterThan(0);
          const tones = new Map<string, number>();
          for (const placement of natural) {
            const centreIndex = Number(placement.clusterId!.split("-").at(-1)) - 1;
            const isVerge = placement.clusterId!.startsWith("verge-");
            const centre = (isVerge ? vergeCentres : groveCentres)[centreIndex]!;
            expect(centre, placement.id).toBeDefined();
            // No foliage fallback to a random annulus: every member stays in a
            // route-derived patch. The existing 3.65 grove radius is retained.
            expect(Math.hypot(placement.x - centre.x, placement.z - centre.z)).toBeLessThanOrEqual(
              isVerge ? 1.7 : placement.kind === "tree" ? 4.1 : 3.2,
            );
            expect(
              distanceToIslandRoute(blueprint, placement) - islandRouteClearance(blueprint),
            ).toBeGreaterThanOrEqual(
              foliageFootprintRadius(placement.kind as "tree" | "bush", placement.height) - 1e-8,
            );
            expect(placement.y).toBeCloseTo(
              sampleIslandTerrainTop(blueprint, "course", placement.x, placement.z).y,
              8,
            );
            expect(placement.foliageTint).toBeDefined();
            const prior = tones.get(placement.clusterId!);
            if (prior !== undefined) expect(placement.foliageTint).toBe(prior);
            tones.set(placement.clusterId!, placement.foliageTint!);
            if (isVerge) {
              expect(placement.kind).toBe("bush");
              expect(placement.height).toBeGreaterThanOrEqual(0.35);
              expect(placement.height).toBeLessThanOrEqual(0.5);
              expect(distanceToIslandRoute(blueprint, placement)).toBeLessThanOrEqual(
                islandRouteClearance(blueprint) + 3,
              );
            }
          }
          const sides = new Set<number>();
          const bins = new Set<number>();
          for (const placement of verge) {
            const index = islandRouteIndexNear(blueprint, placement)!;
            const frame = islandRouteFrameAtIndex(blueprint, index)!;
            sides.add(
              Math.sign(
                (placement.x - frame.point.x) * frame.baseNormal.x +
                  (placement.z - frame.point.z) * frame.baseNormal.z,
              ),
            );
            bins.add(Math.min(7, Math.floor((index / (blueprint.centerline.length - 1)) * 8)));
          }
          expect(sides.size, `${courseId}/${lessonCount}`).toBe(2);
          expect(bins.size, `${courseId}/${lessonCount}`).toBeGreaterThanOrEqual(
            lessonCount <= 8 ? 3 : 6,
          );
          expect(selection.accentPackIds).toEqual(["fantasy-town-kit"]);
        }
        expect(treeCounts[0]).toBeLessThan(treeCounts[3]!);
      }
    },
  );
});

it("keeps every emitted low shrub lobe grounded on the same terrain after preview scaling", () => {
  const geometry = createSmoothIcosahedron(0);
  const positions = geometry.getAttribute("position");
  const scratch = new THREE.Vector3();
  for (const routeArchetype of ISLAND_ROUTE_ARCHETYPES) {
    const blueprint = islandBlueprint({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonCount: 41,
      routeArchetype,
      themeSelection: selection,
    });
    const bushes = planIslandDressing(blueprint, "course").placements.filter(
      (p) => p.kind === "bush",
    );
    for (const placement of bushes) {
      expect(placement.foliageGroundOffsets).toHaveLength(3);
      for (const offset of placement.foliageGroundOffsets!) {
        expect(offset).toBeLessThanOrEqual(0);
        expect(Math.abs(offset)).toBeLessThanOrEqual(0.25);
        expect(Math.abs(offset)).toBeLessThan(placement.height * 0.32);
      }
      for (const scale of [0.35, 1, 2]) {
        const renderPlacement = toFoliageRenderPlacement(placement, scale);
        const lobes = bushCrownLobes(renderPlacement);
        for (const lobe of lobes) {
          const bottom = new THREE.Vector3(0, Infinity, 0);
          for (let index = 0; index < positions.count; index += 1) {
            scratch
              .fromBufferAttribute(positions, index)
              .multiply(lobe.scale)
              .applyQuaternion(lobe.quaternion)
              .add(lobe.position);
            if (scratch.y < bottom.y) bottom.copy(scratch);
          }
          const ground =
            sampleIslandTerrainTop(blueprint, "course", bottom.x / scale, bottom.z / scale).y *
            scale;
          expect(
            bottom.y - ground,
            `${routeArchetype}/${placement.id}/${scale}`,
          ).toBeLessThanOrEqual(-0.01 * scale + 1e-7);
        }
      }
    }
  }
  geometry.dispose();
});
