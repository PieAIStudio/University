/**
 * One unit of a course, one biome.
 *
 * The problem this solves is not "the ground is empty" — that is a symptom.
 * A 41-lesson course has six authored units, and before this module the island
 * expressed that structure nowhere: forty-one identical markers on one green
 * field. A learner could not tell chapter two from chapter five by looking,
 * and there is nothing to *discover* by walking, because every part of the
 * island already looked like every other part.
 *
 * So the unit becomes the art unit. Climbing the island is reading the
 * course's table of contents: unit one is a pine ridge, unit two a quarry,
 * unit three a fall grove. Richness comes from subject change rather than from
 * raising the density of one kind of scatter, which is the failure mode a
 * denser meadow always lands in.
 *
 * Two rules keep this from becoming a collage, and both are load-bearing:
 *
 * 1. **Every biome starts from kenney nature-kit and adds at most one accent
 *    family.** Six units built from six different Kenney packs would be six
 *    art styles fighting on one island. The admitted accent kits are baked
 *    into the same vertex-colour contract, so the whole library shares one
 *    material and the entire prop field is one BatchedMesh submission —
 *    variety costs bytes, not draw calls.
 * 2. **A biome shifts the ground, it does not replace it.** The course palette
 *    still owns the island's identity (LOOK-V2 §12); a biome only nudges hue,
 *    saturation and value inside the earth gamut. Otherwise every course would
 *    converge on the same six colours and course identity would die.
 *
 * This module imports no renderer and no `three`. Every question worth asking
 * about a layout — is that prop too wide, is it standing on its own cell, can
 * the learner see any of it from the road — is arithmetic, and arithmetic is
 * something a test can refuse to merge.
 */

import { hash } from "../island/random.js";
import manifest from "./grid-assets.json";

export type GridPropRole = "canopy" | "understory" | "ground" | "landmark";

export interface GridNatureAsset {
  readonly assetId: string;
  readonly sourceAssetId?: string;
  readonly pack?: string;
  readonly role: string;
  readonly biomes?: readonly string[];
  readonly src: string;
  readonly triangles: number;
  readonly aspect: { readonly width: number; readonly depth: number };
}

const GRID_ASSETS = manifest.assets as readonly GridNatureAsset[];
const NATURE_ASSETS = GRID_ASSETS.filter((asset) => asset.pack === "nature-kit");

const ASSET_BY_ID = new Map(GRID_ASSETS.map((asset) => [asset.assetId, asset]));

export const GRID_NATURE_LICENSE = manifest.license.spdx;
export const GRID_NATURE_SOURCE = "Kenney nature-kit (local authorised donor)";
export const GRID_NATURE_ASSET_IDS: readonly string[] = NATURE_ASSETS.map((asset) => asset.assetId);

/** Assets from a baked accent kit that are judged appropriate for one biome. */
export function gridPackAssetIds(
  packId: string,
  role: GridPropRole,
  biomeId: GridBiomeId,
): readonly string[] {
  return GRID_ASSETS.filter(
    (asset) =>
      asset.pack === packId && asset.role === role && (asset.biomes ?? []).includes(biomeId),
  ).map((asset) => asset.assetId);
}

/** Runtime URL for one library asset. Throws rather than rendering nothing. */
export function gridNatureAssetSrc(assetId: string): string {
  const asset = ASSET_BY_ID.get(assetId);
  if (!asset) throw new Error(`Unknown grid asset: ${assetId}`);
  return asset.src;
}

export function gridNatureAsset(assetId: string): GridNatureAsset {
  const asset = ASSET_BY_ID.get(assetId);
  if (!asset) throw new Error(`Unknown grid asset: ${assetId}`);
  return asset;
}

/**
 * The natural ground footprint of a donor mesh once it is normalised to height
 * one, which is what the renderer does before applying a placement's height.
 * A pine is 0.26; a flat shore pebble is 7.6. Sizing anything by height alone
 * is what turns the second one into a paving slab four hexes wide.
 */
export function gridNatureAspect(assetId: string): number {
  const asset = gridNatureAsset(assetId);
  return Math.max(asset.aspect.width, asset.aspect.depth);
}

export interface GridPropRoleSizing {
  /** World-unit height band. A hex is 2.0 across, so 1.0 is half a cell. */
  readonly height: readonly [number, number];
  /** World-unit ground footprint band. Both ends are asserted. */
  readonly footprint: readonly [number, number];
  /**
   * Deliberate thickening at its strongest, for the most slender mesh in the
   * band. LOOK-V2 §11 rule 6: everything in this art family is a size fatter
   * than life, which is where "readable" and "cute" come from.
   *
   * It tapers to nothing as a mesh approaches square, because the rule is
   * about rescuing slender silhouettes, not about inflating round ones. A flat
   * multiplier applied to an already-round stone pushed it wider than the hex
   * it stands on, which is how this taper was found.
   */
  readonly fatten: number;
}

/**
 * A mesh at or above this natural aspect is already chunky and receives no
 * thickening at all.
 */
export const GRID_PROP_FATTEN_REFERENCE_ASPECT = 1;

/** The thickening actually applied to one mesh, given how slender it is. */
export function gridPropFatten(role: GridPropRole, aspect: number): number {
  const slenderness = Math.min(1, Math.max(0, 1 - aspect / GRID_PROP_FATTEN_REFERENCE_ASPECT));
  return 1 + (GRID_PROP_ROLE_SIZING[role].fatten - 1) * slenderness;
}

/**
 * Four scale bands, which is the scale hierarchy the reference has and a flat
 * scatter does not: something tall enough to break the horizon, something at
 * knee height, something you only notice up close, and one large thing per
 * unit that says a chapter started.
 *
 * The lower ground bound is not zero on purpose. Below it a donor mesh has
 * stopped being a prop and become a decal lying in the terrain — that is how
 * `crops_dirtRow` (aspect 20:1) was caught and dropped from the library rather
 * than shipped as a z-fighting smear.
 *
 * The ceiling moved, and the floor did not. The band ran to 0.54 against a hex
 * 2.0 units across — at most twenty-seven percent of one tile — while ground
 * was 74 of the island's 137 props. Rings 2-3 therefore carried 66 props over
 * 90 cells, which is dense, and still photographed as an empty lawn, because
 * most of the budget was spent below the height the road camera can resolve.
 * Raising the floor as well was tried and reverted: a wide flat mesh clamped
 * into one cell cannot also clear a taller floor, so it turns the pebble this
 * bound exists to protect back into a slab.
 */
export const GRID_PROP_ROLE_SIZING: Readonly<Record<GridPropRole, GridPropRoleSizing>> = {
  canopy: { height: [1.3, 2.3], footprint: [0.4, 1.45], fatten: 1.45 },
  understory: { height: [0.6, 1.18], footprint: [0.28, 1.15], fatten: 1.3 },
  ground: { height: [0.1, 0.66], footprint: [0.16, 0.98], fatten: 1.15 },
  landmark: { height: [1.35, 3.1], footprint: [0.7, 2.4], fatten: 1.35 },
};

export interface GridPropSize {
  /** World-unit height the renderer scales the normalised mesh to. */
  readonly height: number;
  /** World-unit horizontal scale. */
  readonly width: number;
  /** World-unit ground footprint: the number the occlusion rules care about. */
  readonly footprint: number;
}

/**
 * Turn a role, a mesh's natural proportions and one deterministic roll into a
 * placement's size.
 *
 * Height is chosen first, then the footprint that height implies is clamped
 * into the role's band, and the height follows the clamp down. That ordering
 * is why a flat pebble becomes a flat pebble instead of a slab: it keeps the
 * mesh's own proportions and gives up height, rather than keeping height and
 * spilling across three cells.
 */
export function gridPropSize(role: GridPropRole, aspect: number, roll: number): GridPropSize {
  const sizing = GRID_PROP_ROLE_SIZING[role];
  const [minHeight, maxHeight] = sizing.height;
  const [minFootprint, maxFootprint] = sizing.footprint;
  const fatten = gridPropFatten(role, aspect);
  const clampedRoll = Math.min(1, Math.max(0, roll));
  let height = minHeight + (maxHeight - minHeight) * clampedRoll;
  let footprint = height * aspect * fatten;

  if (footprint > maxFootprint) {
    height *= maxFootprint / footprint;
    footprint = maxFootprint;
  } else if (footprint < minFootprint) {
    height = Math.min(maxHeight, (height * minFootprint) / footprint);
    footprint = height * aspect * fatten;
  }

  return {
    height,
    width: height * fatten,
    footprint,
  };
}

export interface GridPropSizeViolation {
  readonly assetId: string;
  readonly role: GridPropRole;
  readonly reason: "height-below" | "height-above" | "footprint-below" | "footprint-above";
  readonly value: number;
}

/**
 * Both ends of both bands, for the whole roll range.
 *
 * Only writing the upper bound is how "the trees are too big" gets solved by
 * squeezing a tree into a black needle that still passes. A tripwire that can
 * be satisfied by degenerating the thing it guards is not a tripwire.
 */
export function gridPropSizeViolations(
  assetId: string,
  role: GridPropRole,
): readonly GridPropSizeViolation[] {
  const sizing = GRID_PROP_ROLE_SIZING[role];
  const aspect = gridNatureAspect(assetId);
  const violations: GridPropSizeViolation[] = [];
  for (const roll of [0, 0.25, 0.5, 0.75, 1]) {
    const size = gridPropSize(role, aspect, roll);
    if (size.height < sizing.height[0] - 1e-6) {
      violations.push({ assetId, role, reason: "height-below", value: size.height });
    }
    if (size.height > sizing.height[1] + 1e-6) {
      violations.push({ assetId, role, reason: "height-above", value: size.height });
    }
    if (size.footprint < sizing.footprint[0] - 1e-6) {
      violations.push({ assetId, role, reason: "footprint-below", value: size.footprint });
    }
    if (size.footprint > sizing.footprint[1] + 1e-6) {
      violations.push({ assetId, role, reason: "footprint-above", value: size.footprint });
    }
  }
  return violations;
}

/**
 * How a biome moves the course's ground colour.
 *
 * These are deliberately small. The course palette is the island's identity
 * across the world map; a biome is a chapter inside one island, so it changes
 * the ground the way weather changes a field, not the way paint changes a
 * wall. Hue is in turns (1.0 = full wheel) and stays inside the earth gamut
 * the palette table already fought for.
 */
export interface GridBiomeGroundTint {
  /*
   * Hue and saturation carry the biome; value is kept on a short leash.
   *
   * The terrain already spends value on elevation — `GRID_TERRAIN_VALUE_RAMP`
   * moves the four terraces across roughly eight percent — and that ramp is
   * what makes a terrace read as a step rather than as a seam. A biome swinging
   * value by a third would simply overwrite it, and the island would go flat in
   * exchange for looking varied. So elevation owns value, a biome owns hue and
   * saturation, and the two cues stop competing for the same channel.
   */
  readonly hue: number;
  readonly saturation: number;
  readonly value: number;
}

export type GridBiomeId =
  | "pine-ridge"
  | "fall-grove"
  | "stone-quarry"
  | "flower-meadow"
  | "mushroom-hollow"
  | "logging-camp"
  | "farmstead"
  | "dry-mesa"
  | "old-ruins"
  | "palm-shore";

export interface GridBiome {
  readonly id: GridBiomeId;
  /** Shown in the debug inspector, never in learner copy. */
  readonly label: string;
  readonly canopy: readonly string[];
  readonly understory: readonly string[];
  readonly ground: readonly string[];
  /** The one large thing that opens the unit. */
  readonly landmark: string;
  readonly groundTint: GridBiomeGroundTint;
  /**
   * Share of eligible cells that receive a canopy prop, before the spacing
   * rule thins them. A quarry is sparse and open; a pine ridge is dense.
   */
  readonly canopyDensity: number;
  readonly understoryDensity: number;
  readonly groundDensity: number;
  /**
   * Whether this biome is calm enough to open a course. A learner arriving at
   * lesson one should not land in a ruin.
   */
  readonly opening: boolean;
}

/**
 * Ten biomes share the nature-kit base; four also receive one compatible
 * accent family from the baked grid library.
 *
 * Nature-kit ships 61 trees, 30 stones, 30 rocks, 17 crops, 12 fences, 9
 * flowers, 7 stumps, 6 statues, 6 mushrooms and 4 tents. That is enough
 * subject matter for ten genuinely different places without ever leaving the
 * one material language, which is the whole reason this reads as a world
 * rather than as an asset browser.
 */
export const GRID_BIOMES: readonly GridBiome[] = [
  {
    id: "pine-ridge",
    label: "松岭",
    canopy: [
      "tree_pineTallA_detailed",
      "tree_pineTallC_detailed",
      "tree_pineRoundA",
      "tree_pineRoundC",
    ],
    understory: ["tree_pineSmallA", "tree_pineSmallC", "plant_bushLarge"],
    ground: ["grass_leafsLarge", "mushroom_red", "rock_smallA"],
    landmark: "rock_tallB",
    groundTint: { hue: -0.052, saturation: 1.02, value: 0.94 },
    canopyDensity: 0.48,
    understoryDensity: 0.3,
    groundDensity: 0.165,
    opening: true,
  },
  {
    id: "fall-grove",
    label: "秋林",
    canopy: ["tree_oak_fall", "tree_thin_fall", "tree_fat_fall", "tree_plateau_fall"],
    understory: ["tree_small_fall", "plant_bushLarge"],
    ground: ["mushroom_tanGroup", "grass_leafsLarge", "flower_yellowA"],
    landmark: "tree_detailed_fall",
    groundTint: { hue: 0.086, saturation: 1.24, value: 1.04 },
    canopyDensity: 0.416,
    understoryDensity: 0.25,
    groundDensity: 0.154,
    opening: true,
  },
  {
    id: "stone-quarry",
    label: "采石场",
    canopy: ["stone_tallA", "stone_tallB", "stone_tallH"],
    understory: ["stone_tallH", "stone_largeD"],
    ground: ["stone_smallA", "stone_smallFlatA", "stone_largeA", "stone_smallTopA"],
    landmark: "statue_obelisk",
    groundTint: { hue: -0.014, saturation: 0.58, value: 0.97 },
    canopyDensity: 0.256,
    understoryDensity: 0.25,
    groundDensity: 0.187,
    opening: false,
  },
  {
    id: "flower-meadow",
    label: "花野",
    canopy: ["tree_fat", "tree_small"],
    understory: ["grass_large", "plant_bushLarge"],
    ground: ["flower_purpleA", "flower_purpleB", "flower_redA", "flower_yellowA"],
    landmark: "statue_ring",
    groundTint: { hue: 0.03, saturation: 1.3, value: 1.06 },
    canopyDensity: 0.192,
    understoryDensity: 0.325,
    groundDensity: 0.231,
    opening: true,
  },
  {
    id: "mushroom-hollow",
    label: "菌谷",
    canopy: ["tree_thin_dark", "tree_plateau_dark"],
    understory: ["mushroom_redTall", "mushroom_tanTall"],
    ground: ["mushroom_redGroup", "hanging_moss", "plant_bushLargeTriangle"],
    landmark: "tree_thin_dark",
    groundTint: { hue: -0.082, saturation: 1.0, value: 0.88 },
    canopyDensity: 0.384,
    understoryDensity: 0.375,
    groundDensity: 0.187,
    opening: false,
  },
  {
    id: "logging-camp",
    label: "伐木营",
    canopy: [
      "tree_pineDefaultA",
      "tree_pineRoundE",
      ...gridPackAssetIds("survival-kit", "canopy", "logging-camp"),
    ],
    understory: [
      "stump_oldTall",
      "tent_smallOpen",
      ...gridPackAssetIds("survival-kit", "understory", "logging-camp"),
    ],
    ground: [
      "log",
      "campfire_logs",
      "log_stack",
      ...gridPackAssetIds("survival-kit", "ground", "logging-camp"),
    ],
    landmark: "survival_tent",
    groundTint: { hue: 0.05, saturation: 0.86, value: 1.0 },
    canopyDensity: 0.288,
    understoryDensity: 0.325,
    groundDensity: 0.165,
    opening: false,
  },
  {
    id: "farmstead",
    label: "田垄",
    canopy: [
      "crops_cornStageD",
      "crops_bambooStageA",
      ...gridPackAssetIds("survival-kit", "canopy", "farmstead"),
    ],
    understory: [
      "crops_wheatStageB",
      "crop_pumpkin",
      ...gridPackAssetIds("survival-kit", "understory", "farmstead"),
    ],
    ground: [
      "crop_carrot",
      "crop_turnip",
      "fence_simple",
      ...gridPackAssetIds("survival-kit", "ground", "farmstead"),
    ],
    landmark: "survival_tent",
    groundTint: { hue: 0.07, saturation: 1.2, value: 1.03 },
    canopyDensity: 0.32,
    understoryDensity: 0.4,
    groundDensity: 0.198,
    opening: true,
  },
  {
    id: "dry-mesa",
    label: "旱原",
    canopy: ["cactus_tall", "tree_palmShort"],
    understory: ["cactus_short", "stone_largeD"],
    ground: ["rock_smallFlatA", "rock_smallA", "plant_flatShort", "rock_largeB"],
    landmark: "statue_columnDamaged",
    groundTint: { hue: 0.092, saturation: 0.94, value: 1.1 },
    canopyDensity: 0.224,
    understoryDensity: 0.225,
    groundDensity: 0.165,
    opening: false,
  },
  {
    id: "old-ruins",
    label: "遗迹",
    canopy: [
      "statue_column",
      "tree_thin_dark",
      ...gridPackAssetIds("castle-kit", "canopy", "old-ruins"),
    ],
    understory: [
      "statue_block",
      "plant_bushLarge",
      ...gridPackAssetIds("castle-kit", "understory", "old-ruins"),
    ],
    ground: [
      "stone_smallFlatB",
      "stone_largeC",
      "plant_bushSmall",
      ...gridPackAssetIds("castle-kit", "ground", "old-ruins"),
    ],
    landmark: "castle_tower-square",
    groundTint: { hue: -0.066, saturation: 0.6, value: 0.93 },
    canopyDensity: 0.256,
    understoryDensity: 0.275,
    groundDensity: 0.176,
    opening: false,
  },
  {
    id: "palm-shore",
    label: "棕榈岸",
    canopy: [
      "tree_palmDetailedTall",
      "tree_palmTall",
      "tree_palmBend",
      ...gridPackAssetIds("pirate-kit", "canopy", "palm-shore"),
    ],
    understory: [
      "tree_palmShort",
      "plant_bushLarge",
      ...gridPackAssetIds("pirate-kit", "understory", "palm-shore"),
    ],
    ground: [
      "lily_large",
      "grass_leafs",
      "rock_smallFlatC",
      ...gridPackAssetIds("pirate-kit", "ground", "palm-shore"),
    ],
    landmark: "pirate_tower-complete-small",
    groundTint: { hue: 0.014, saturation: 1.28, value: 1.08 },
    canopyDensity: 0.32,
    understoryDensity: 0.25,
    groundDensity: 0.165,
    opening: true,
  },
];

export const GRID_BIOME_BY_ID = new Map(GRID_BIOMES.map((biome) => [biome.id, biome]));

export function gridBiomeById(id: GridBiomeId): GridBiome {
  const biome = GRID_BIOME_BY_ID.get(id);
  if (!biome) throw new Error(`Unknown grid biome: ${id}`);
  return biome;
}

/** Every asset a biome can place, in one list, for budget and manifest checks. */
export function gridBiomeAssetIds(biome: GridBiome): readonly string[] {
  return [...new Set([...biome.canopy, ...biome.understory, ...biome.ground, biome.landmark])];
}

export function gridBiomeRoleFor(biome: GridBiome, assetId: string): GridPropRole | null {
  if (biome.canopy.includes(assetId)) return "canopy";
  if (biome.understory.includes(assetId)) return "understory";
  if (biome.ground.includes(assetId)) return "ground";
  if (biome.landmark === assetId) return "landmark";
  return null;
}

/**
 * Assign one biome per unit.
 *
 * Three properties, all of them things a reader can check:
 *  - deterministic in `(seed, unitIds)`, so a prose edit never reshuffles the
 *    world;
 *  - no two adjacent units share a biome, because the entire point is that
 *    crossing a unit boundary looks like arriving somewhere;
 *  - biomes are drawn without replacement until the pool runs out, so a
 *    six-unit course gets six different places rather than three used twice.
 *
 * The first unit is drawn from the calm subset. Lesson one is the learner's
 * first impression of the course and it should not be a ruin.
 */
export function gridBiomesForUnits(
  unitIds: readonly string[],
  seed: string,
): ReadonlyMap<string, GridBiome> {
  const assignment = new Map<string, GridBiome>();
  if (unitIds.length === 0) return assignment;

  const pool = [...GRID_BIOMES];
  let available: GridBiome[] = [];
  let previous: GridBiome | null = null;

  unitIds.forEach((unitId, index) => {
    if (available.length === 0) available = [...pool];
    let candidates = available.filter((biome) => biome.id !== previous?.id);
    if (index === 0) {
      const opening = candidates.filter((biome) => biome.opening);
      if (opening.length > 0) candidates = opening;
    }
    if (candidates.length === 0) candidates = available;
    const pick =
      candidates[Math.floor(hash(`${seed}/unit-biome/${index}/${unitId}`) * candidates.length)] ??
      candidates[0]!;
    assignment.set(unitId, pick);
    available = available.filter((biome) => biome.id !== pick.id);
    previous = pick;
  });

  return assignment;
}

/**
 * Does this plan actually read as a sequence of places?
 *
 * A course whose units all landed on one biome is not a defect the renderer
 * can see; it is a defect only arithmetic can see, which is exactly the kind
 * this architecture exists to catch.
 */
export function gridBiomeSequenceIsVaried(
  unitIds: readonly string[],
  assignment: ReadonlyMap<string, GridBiome>,
): boolean {
  for (let index = 1; index < unitIds.length; index += 1) {
    const current = assignment.get(unitIds[index]!);
    const previous = assignment.get(unitIds[index - 1]!);
    if (!current || !previous || current.id === previous.id) return false;
  }
  return true;
}
