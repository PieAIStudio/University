/**
 * The small, flat-colour subset used by the hex prototype.
 *
 * These files are copied from the authorised local Kenney nature-kit donor at
 * build time and served with the existing R01 public asset root. Keeping the
 * source path beside the runtime URL makes the provenance reviewable without
 * making the pure prop planner know anything about a loader.
 */

export const GRID_KENNEY_NATURE_LICENSE = "CC0 1.0 Universal" as const;
export const GRID_KENNEY_NATURE_SOURCE =
  "Kenney nature-kit / Models / GLTF format (local authorised donor)" as const;

export const GRID_KENNEY_NATURE_ASSETS = {
  tree_pineRoundA: "/kenney/r01/nature/tree_pineRoundA.glb",
  tree_oak: "/kenney/r01/nature/tree_oak.glb",
  tree_simple: "/kenney/r01/nature/tree_simple.glb",
  plant_bushLarge: "/kenney/r01/nature/plant_bushLarge.glb",
  mushroom_redGroup: "/kenney/r01/nature/mushroom_redGroup.glb",
  flower_yellowA: "/kenney/r01/nature/flower_yellowA.glb",
  rock_largeA: "/kenney/r01/nature/rock_largeA.glb",
  rock_smallA: "/kenney/r01/nature/rock_smallA.glb",
  stump_round: "/kenney/r01/nature/stump_round.glb",
} as const;

export type GridKenneyNatureAssetId = keyof typeof GRID_KENNEY_NATURE_ASSETS;
