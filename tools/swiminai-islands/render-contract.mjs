#!/usr/bin/env node
/**
 * Renderer-free contract receipt for the website A/B comparison.
 *
 * It uses the same blueprint, dressing and grass planners as the R3F entry,
 * then records geometry and layer budgets. Pixel brightness requires the
 * consuming browser's actual Canvas/Stage and is therefore reported as a
 * deliberate capture handoff rather than guessed from source colours.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildIslandGeometry } from "../../packages/world/src/island/island-geometry.ts";
import { islandBlueprint } from "../../packages/world/src/island/island-blueprint.ts";
import { planIslandDressing } from "../../packages/world/src/island/island-dressing.ts";
import { planIslandGrass } from "../../packages/world/src/island/island-grass.ts";
import { measureIslandCodeMetrics } from "../../packages/world/src/island/look-metrics.ts";
import { islandLookSceneSource } from "../../packages/world/src/island/island-look.ts";
import { ISLAND_LOOK_CONTRACT } from "../../packages/world/src/island/look-contract.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = resolve(root, "tools/swiminai-islands/render-contract.json");
const seed = "swiminai/plan-0002/university-v1";
const recipeId = "R01-forest-academy";
const blueprint = islandBlueprint({
  studyId: "swiminai",
  courseId: "plan-0002-uni",
  lessonCount: 12,
  lessonIds: Array.from(
    { length: 12 },
    (_, index) => `uni-lesson-${String(index + 1).padStart(2, "0")}`,
  ),
  seed,
  routeArchetype: "horseshoe",
  themeSelection: {
    naturalBasePackId: "nature-kit",
    accentPackIds: ["fantasy-town-kit"],
    recipeId,
  },
  checkpointGaps: [3, 7],
});
const course = buildIslandGeometry(blueprint, "course");
const world = buildIslandGeometry(blueprint, "world", 3.2);
const dressing = planIslandDressing(blueprint, "course");
const worldDressing = planIslandDressing(blueprint, "world");
const grass = planIslandGrass(blueprint, "course", { tier: "desktop" });
const source = islandLookSceneSource("course", [blueprint]);

const receipt = {
  schemaVersion: 1,
  renderer: "@pieai/university-world/swiminai-island-render",
  seed,
  recipeId,
  detail: "course",
  cameraContract: {
    viewport: [390, 844],
    dpr: 1,
    note: "The consuming website must capture this same seed/camera for pixel metrics.",
  },
  geometry: {
    course: {
      triangles: course.counts.total,
      topTriangles: course.counts.topTriangles,
      routeTriangles: course.counts.routeTriangles,
      cliffTriangles: course.counts.cliffTriangles,
    },
    world: {
      triangles: world.counts.total,
      topTriangles: world.counts.topTriangles,
      routeTriangles: world.counts.routeTriangles,
      cliffTriangles: world.counts.cliffTriangles,
    },
  },
  layers: {
    dressingPlacements: dressing.placements.length,
    worldDressingPlacements: worldDressing.placements.length,
    grassInstances: grass.placements.length,
    routeSamples: blueprint.centerline.length,
    terrainPatches: blueprint.terrainPatches.length,
  },
  draws: {
    lowerBound: 3,
    layers: ["terrain", "instanced-grass", "grouped-dressing"],
    note: "The external host owns the Stage light/AO/grade pass and may add grouped asset fields.",
  },
  lookMetrics: measureIslandCodeMetrics(source),
  brightness: {
    status: "capture-required",
    measured: null,
    required: {
      landCoverageMin: ISLAND_LOOK_CONTRACT.landCoverageMin,
      landMedianLightness: [
        ISLAND_LOOK_CONTRACT.landMedianLightnessMin,
        ISLAND_LOOK_CONTRACT.landMedianLightnessMax,
      ],
      landP95LightnessMin: ISLAND_LOOK_CONTRACT.landP95LightnessMin,
      landLightnessRiseMin: ISLAND_LOOK_CONTRACT.landLightnessRiseMin,
      lightnessStdDevMin: ISLAND_LOOK_CONTRACT.lightnessStdDevMin,
    },
  },
  lighting: {
    status: "Stage-owned",
    keyToFillRatio: null,
    requiredKeyToFillMin: ISLAND_LOOK_CONTRACT.keyToFillMin,
    note: "No duplicate light, AO or grade is created by the pure island entry.",
  },
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`Wrote ${output}`);
