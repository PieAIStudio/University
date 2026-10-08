/**
 * Development-time source for the deterministic SwimInAI render inputs.
 *
 * The generated JSON is the website-facing artifact. This module stays in
 * University tooling and is never imported by the renderer bundle.
 */
import { islandBlueprint } from "../../packages/world/src/island/island-blueprint.ts";
import { recipeById } from "../../packages/world/src/island/kenney-recipes.ts";

export const ISLAND_BLUEPRINT_SCHEMA_VERSION = 1;
export const ISLAND_BLUEPRINT_GENERATOR = "swiminai-island-blueprints-v1";
export const LESSON_COUNT = 12;

export const ISLANDS = [
  {
    id: "break",
    displayName: "BREAK",
    seed: "swiminai/plan-0002/break-v1",
    recipeId: "R06-forest-fortress",
    routeArchetype: "switchback",
    portalColor: 0xff8a45,
    groundTint: 0xc88d61,
    themeAssets: ["gate", "fence", "stone"],
  },
  {
    id: "uni",
    displayName: "University",
    seed: "swiminai/plan-0002/university-v1",
    recipeId: "R01-forest-academy",
    routeArchetype: "horseshoe",
    portalColor: 0x5fe0c8,
    groundTint: 0xc7dca1,
    themeAssets: ["gate", "flowers", "fence"],
  },
  {
    id: "dir",
    displayName: "Directing",
    seed: "swiminai/plan-0002/directing-v1",
    recipeId: "R07-training-arena",
    routeArchetype: "serpentine",
    portalColor: 0xffc266,
    groundTint: 0xc09ad9,
    themeAssets: ["gate", "windmill", "fence"],
  },
  {
    id: "party",
    displayName: "SWIMMER PARTY",
    seed: "swiminai/plan-0002/swimmer-party-v1",
    recipeId: "R12-garden-sports",
    routeArchetype: "arc",
    portalColor: 0xff66c8,
    groundTint: 0xe9b5cf,
    themeAssets: ["blossom", "flowers", "crystal"],
  },
];

export const CENTER = {
  id: "center",
  displayName: "Swim In AI",
  seed: "swiminai/plan-0002/center-v1",
  recipeId: "R01-forest-academy",
  routeArchetype: "loop-around-hill",
  portalColor: 0x5fe0c8,
  groundTint: 0xd2dfad,
};

export function recipeSelection(recipeId) {
  const recipe = recipeById(recipeId);
  if (!recipe) throw new Error(`Unknown island recipe: ${recipeId}`);
  return {
    naturalBasePackId: recipe.base.packId,
    accentPackIds: [...recipe.accentPackIds],
    recipeId: recipe.id,
  };
}

export function buildBlueprint(spec) {
  const lessonIds = Array.from(
    { length: LESSON_COUNT },
    (_, index) => `${spec.id}-lesson-${String(index + 1).padStart(2, "0")}`,
  );
  return islandBlueprint({
    studyId: "swiminai",
    courseId: `plan-0002-${spec.id}`,
    lessonCount: LESSON_COUNT,
    lessonIds,
    seed: spec.seed,
    routeArchetype: spec.routeArchetype,
    themeSelection: recipeSelection(spec.recipeId),
    checkpointGaps: [3, 7],
  });
}

export function buildRenderBlueprints() {
  return {
    schemaVersion: ISLAND_BLUEPRINT_SCHEMA_VERSION,
    generator: ISLAND_BLUEPRINT_GENERATOR,
    source: "packages/world/src/island/island-blueprint.ts",
    fixedSeedNamespace: "swiminai/plan-0002",
    lessonCount: LESSON_COUNT,
    center: buildBlueprint(CENTER),
    break: buildBlueprint(ISLANDS[0]),
    uni: buildBlueprint(ISLANDS[1]),
    dir: buildBlueprint(ISLANDS[2]),
    party: buildBlueprint(ISLANDS[3]),
  };
}
