/**
 * Import the hex grid's Kenney biome library from the authorised local donor.
 *
 *   pnpm --filter @pieai/university-app kenney:grid
 *
 * The grid is allowed to have a larger *asset* library than the R01 island
 * recipe, but it is not allowed to have a larger material vocabulary. Nature
 * kit already has vertex colours and no texture. Castle, Survival and Pirate
 * are admitted only after their 512x512 colormap has been sampled at every
 * triangle vertex and baked into COLOR_0. The result is one material contract
 * for the whole field, so the library's size costs bytes and memory, not draw
 * calls.
 *
 * The whitelist is explicit. A donor update cannot silently change the game:
 * an unlisted GLB is a coverage error and must be judged here before it enters
 * the public payload. Rejections are explicit for the same reason — the
 * report can say what was considered and why it did not make the world.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  APP_ROOT,
  LICENSE_SPDX,
  PROVENANCE_SOURCE_ROOT,
  copyVerified,
  measureGlb,
  readGlbJson,
  resolveDonorRoot,
  sha256,
  verifyLicense,
  writeIfChanged,
} from "./kenney-donor.mjs";
import {
  GridBakeError,
  auditGlbColormap,
  assertBakedGlbLossless,
  bakeColormapToVertexColors,
} from "./kenney-grid-bake.mjs";

const OUTPUT_ROOT = join(APP_ROOT, "public/kenney/grid");
const MANIFEST_PATH = resolve(APP_ROOT, "../../packages/world/src/grid/grid-assets.json");
const OXFMT_PATH = join(
  APP_ROOT,
  "node_modules/.bin",
  process.platform === "win32" ? "oxfmt.cmd" : "oxfmt",
);
const RUNTIME_BASE_PATH = "/kenney/grid";
const ROLE_ORDER = Object.freeze(["canopy", "understory", "ground", "landmark"]);
const SIZE_ROLLS = Object.freeze([0, 0.25, 0.5, 0.75, 1]);
const ROLE_SIZING = Object.freeze({
  canopy: Object.freeze({ height: [1.3, 2.3], footprint: [0.4, 1.45], fatten: 1.45 }),
  understory: Object.freeze({ height: [0.6, 1.18], footprint: [0.28, 1.15], fatten: 1.3 }),
  ground: Object.freeze({ height: [0.1, 0.66], footprint: [0.16, 0.98], fatten: 1.15 }),
  landmark: Object.freeze({ height: [1.35, 3.1], footprint: [0.7, 2.4], fatten: 1.35 }),
});

const NATURE_PACK = Object.freeze({
  id: "nature-kit",
  folder: "kenney_nature-kit",
  title: "Nature Kit",
  version: "2.1",
  source: "https://kenney.nl/assets/nature-kit",
  modelsDirectory: "Models/GLTF format",
  outputDirectory: "nature",
  namespace: "nature",
  materialMode: "unlit-color",
  licenseSha256: "cb96b75e3560ac78d7a53ce6f083f4cdb5c53faea6141b62d63458dcfe1e4b9d",
});

const BAKED_PACKS = Object.freeze([
  Object.freeze({
    id: "castle-kit",
    folder: "kenney_castle-kit",
    title: "Castle Kit",
    version: "local-donor-snapshot",
    source: "https://kenney.nl/assets/castle-kit",
    modelsDirectory: "Models/GLB format",
    outputDirectory: "castle",
    namespace: "castle",
    primaryBiome: "old-ruins",
    licenseSha256: "aac944f18106b3a3e29c6fdeec02523d4cab4c735abc01f5a8fa88a79ae173ef",
  }),
  Object.freeze({
    id: "survival-kit",
    folder: "kenney_survival-kit",
    title: "Survival Kit",
    version: "local-donor-snapshot",
    source: "https://kenney.nl/assets/survival-kit",
    modelsDirectory: "Models/GLB format",
    outputDirectory: "survival",
    namespace: "survival",
    primaryBiome: "logging-camp",
    licenseSha256: "62c8356876481204fa4d40dc59183dfed777adf987d7f2a1390fffe8a699f3ff",
  }),
  Object.freeze({
    id: "pirate-kit",
    folder: "kenney_pirate-kit",
    title: "Pirate Kit",
    version: "local-donor-snapshot",
    source: "https://kenney.nl/assets/pirate-kit",
    modelsDirectory: "Models/GLB format",
    outputDirectory: "pirate",
    namespace: "pirate",
    primaryBiome: "palm-shore",
    licenseSha256: "5e99246a5a65fa3420a1a1c7a8616f096202c78866f73d7aacfe73c0aab0ca36",
  }),
]);

const HOLIDAY_TRIPWIRE_PACK = Object.freeze({
  id: "holiday-kit",
  folder: "kenney_holiday-kit",
  modelsDirectory: "Models/GLB format",
  licenseSha256: "6010f677d95f3ab7935faf873d8f4eb96ad1e5f02fd0e4659c9d92852b768d6a",
  sourceAssetId: "train-locomotive",
});

/** Existing nature-kit whitelist, kept byte-for-byte as the first library tier. */
const NATURE_ASSETS = Object.freeze([
  ["tree_pineTallA_detailed", "canopy"],
  ["tree_pineTallC_detailed", "canopy"],
  ["tree_pineRoundA", "canopy"],
  ["tree_pineRoundC", "canopy"],
  ["tree_pineSmallA", "understory"],
  ["tree_pineSmallC", "understory"],
  ["grass_leafsLarge", "ground"],
  ["mushroom_red", "ground"],
  ["rock_tallB", "landmark"],
  ["tree_oak_fall", "canopy"],
  ["tree_thin_fall", "canopy"],
  ["tree_fat_fall", "canopy"],
  ["tree_plateau_fall", "canopy"],
  ["tree_small_fall", "understory"],
  ["mushroom_tanGroup", "ground"],
  ["tree_detailed_fall", "landmark"],
  ["stone_tallA", "canopy"],
  ["stone_tallB", "canopy"],
  ["stone_tallH", "canopy"],
  ["stone_largeA", "understory"],
  ["stone_largeD", "understory"],
  ["stone_smallTopA", "understory"],
  ["stone_smallA", "ground"],
  ["stone_smallFlatA", "ground"],
  ["statue_obelisk", "landmark"],
  ["tree_fat", "canopy"],
  ["tree_small", "canopy"],
  ["grass_large", "understory"],
  ["flower_purpleA", "ground"],
  ["flower_purpleB", "ground"],
  ["flower_redA", "ground"],
  ["flower_yellowA", "ground"],
  ["statue_ring", "landmark"],
  ["tree_thin_dark", "canopy"],
  ["tree_plateau_dark", "canopy"],
  ["mushroom_redTall", "understory"],
  ["mushroom_tanTall", "understory"],
  ["plant_bushLargeTriangle", "understory"],
  ["mushroom_redGroup", "ground"],
  ["hanging_moss", "ground"],
  ["tree_pineDefaultA", "canopy"],
  ["tree_pineRoundE", "canopy"],
  ["log_stack", "understory"],
  ["stump_oldTall", "understory"],
  ["tent_smallOpen", "understory"],
  ["log", "ground"],
  ["campfire_logs", "ground"],
  ["tent_detailedOpen", "landmark"],
  ["crops_cornStageD", "canopy"],
  ["crops_bambooStageA", "canopy"],
  ["crops_wheatStageB", "understory"],
  ["crop_pumpkin", "understory"],
  ["fence_simple", "ground"],
  ["crop_carrot", "ground"],
  ["crop_turnip", "ground"],
  ["crops_bambooStageB", "landmark"],
  ["cactus_tall", "canopy"],
  ["tree_palmShort", "canopy"],
  ["cactus_short", "understory"],
  ["rock_largeB", "understory"],
  ["rock_smallFlatA", "ground"],
  ["rock_smallA", "ground"],
  ["plant_flatShort", "ground"],
  ["statue_columnDamaged", "landmark"],
  ["statue_column", "canopy"],
  ["statue_block", "understory"],
  ["stone_largeC", "understory"],
  ["plant_bushLarge", "understory"],
  ["stone_smallFlatB", "ground"],
  ["plant_bushSmall", "ground"],
  ["statue_head", "landmark"],
  ["tree_palmDetailedTall", "canopy"],
  ["tree_palmTall", "canopy"],
  ["tree_palmBend", "canopy"],
  ["lily_large", "ground"],
  ["grass_leafs", "ground"],
  ["rock_smallFlatC", "ground"],
]);

/**
 * Selected non-nature models. The list is intentionally explicit: new donor
 * files must be reviewed instead of becoming a payload by accident.
 */
const BAKED_ASSET_IDS = Object.freeze({
  "castle-kit": Object.freeze([
    "bridge-straight",
    "bridge-straight-pillar",
    "door",
    "flag",
    "flag-banner-long",
    "flag-banner-short",
    "flag-pennant",
    "flag-wide",
    "gate",
    "ground-hills",
    "metal-gate",
    "rocks-large",
    "rocks-small",
    "siege-ballista",
    "siege-ballista-demolished",
    "siege-catapult",
    "siege-catapult-demolished",
    "siege-ram",
    "siege-ram-demolished",
    "siege-trebuchet-demolished",
    "stairs-stone",
    "stairs-stone-square",
    "tower-hexagon-base",
    "tower-hexagon-mid",
    "tower-hexagon-roof",
    "tower-hexagon-roof-secondary",
    "tower-hexagon-top",
    "tower-hexagon-top-wood",
    "tower-slant-roof",
    "tower-square",
    "tower-square-base",
    "tower-square-base-border",
    "tower-square-base-color",
    "tower-square-mid",
    "tower-square-mid-color",
    "tower-square-mid-door",
    "tower-square-mid-open",
    "tower-square-mid-open-simple",
    "tower-square-mid-windows",
    "tower-square-roof",
    "tower-square-top",
    "tower-square-top-color",
    "tower-square-top-roof",
    "tower-square-top-roof-high",
    "tower-square-top-roof-high-windows",
    "tower-square-top-roof-rounded",
    "tower-top",
    "tree-large",
    "tree-log",
    "tree-small",
    "tree-trunk",
    "wall",
    "wall-corner",
    "wall-corner-half",
    "wall-doorway",
    "wall-half",
    "wall-half-modular",
    "wall-narrow",
    "wall-narrow-corner",
    "wall-narrow-gate",
    "wall-narrow-wood",
    "wall-narrow-wood-fence",
    "wall-stud",
    "wall-to-narrow",
  ]),
  "survival-kit": Object.freeze([
    "barrel",
    "barrel-open",
    "bedroll",
    "bedroll-frame",
    "bedroll-packed",
    "bottle",
    "bottle-large",
    "box",
    "box-large",
    "box-large-open",
    "box-open",
    "bucket",
    "campfire-fishing-stand",
    "campfire-pit",
    "campfire-stand",
    "chest",
    "fence",
    "fence-doorway",
    "fence-fortified",
    "fish",
    "fish-large",
    "floor",
    "floor-hole",
    "floor-old",
    "grass",
    "grass-large",
    "metal-panel",
    "metal-panel-narrow",
    "metal-panel-screws",
    "metal-panel-screws-half",
    "metal-panel-screws-narrow",
    "resource-planks",
    "resource-stone",
    "resource-stone-large",
    "resource-wood",
    "rock-a",
    "rock-b",
    "rock-c",
    "rock-flat",
    "rock-flat-grass",
    "rock-sand-a",
    "rock-sand-b",
    "rock-sand-c",
    "signpost",
    "signpost-single",
    "structure",
    "structure-canvas",
    "structure-floor",
    "structure-metal",
    "structure-metal-doorway",
    "structure-metal-floor",
    "structure-metal-roof",
    "structure-metal-wall",
    "structure-roof",
    "tent",
    "tent-canvas",
    "tent-canvas-half",
    "tool-axe",
    "tool-axe-upgraded",
    "tool-hammer",
    "tool-hammer-upgraded",
    "tool-hoe",
    "tool-hoe-upgraded",
    "tool-pickaxe",
    "tool-pickaxe-upgraded",
    "tool-shovel",
    "tool-shovel-upgraded",
    "tree",
    "tree-autumn",
    "tree-autumn-tall",
    "tree-autumn-trunk",
    "tree-log",
    "tree-log-small",
    "tree-tall",
    "tree-trunk",
    "workbench",
    "workbench-anvil",
    "workbench-grind",
  ]),
  "pirate-kit": Object.freeze([
    "barrel",
    "boat-row-large",
    "boat-row-small",
    "bottle",
    "bottle-large",
    "cannon",
    "cannon-ball",
    "cannon-mobile",
    "castle-door",
    "castle-gate",
    "castle-wall",
    "castle-window",
    "chest",
    "crate",
    "crate-bottles",
    "flag",
    "flag-high",
    "flag-high-pennant",
    "flag-pennant",
    "flag-pirate",
    "flag-pirate-high",
    "flag-pirate-high-pennant",
    "flag-pirate-pennant",
    "grass",
    "grass-patch",
    "grass-plant",
    "hole",
    "mast",
    "mast-ropes",
    "palm-bend",
    "palm-detailed-bend",
    "palm-detailed-straight",
    "palm-straight",
    "patch-grass-foliage",
    "platform-planks",
    "rocks-a",
    "rocks-b",
    "rocks-c",
    "rocks-sand-a",
    "rocks-sand-b",
    "rocks-sand-c",
    "structure",
    "structure-fence",
    "structure-fence-sides",
    "structure-platform",
    "structure-platform-dock",
    "structure-platform-dock-small",
    "structure-platform-small",
    "structure-roof",
    "tool-paddle",
    "tool-shovel",
    "tower-base",
    "tower-base-door",
    "tower-complete-large",
    "tower-complete-small",
    "tower-middle",
    "tower-middle-windows",
    "tower-roof",
    "tower-top",
    "tower-watch",
  ]),
});

const REJECTED_ASSETS = Object.freeze({
  "castle-kit": Object.freeze({
    "bridge-draw": "horizontal aspect 10.0207 cannot satisfy any role's two-sided size band",
    ground: "zero-height donor geometry; not a drawable prop",
    "tower-base":
      "48/332 triangles cross two atlas colour blocks; bake would not be one block per triangle",
    "tower-square-arch":
      "8/308 triangles cross two atlas colour blocks; bake would not be one block per triangle",
    "wall-corner-half-tower":
      "38/632 triangles cross two atlas colour blocks; bake would not be one block per triangle",
    "wall-corner-slant":
      "4/140 triangles cross two atlas colour blocks; bake would not be one block per triangle",
    "wall-narrow-stairs-rail":
      "2/430 triangles cross two atlas colour blocks; bake would not be one block per triangle",
    "wall-narrow-stairs":
      "2/262 triangles cross two atlas colour blocks; bake would not be one block per triangle",
    "wall-pillar":
      "4/186 triangles cross two atlas colour blocks; bake would not be one block per triangle",
    "siege-tower": "1598 triangles exceeds the 1200-triangle decoration ceiling",
    "siege-tower-demolished": "1390 triangles exceeds the 1200-triangle decoration ceiling",
    "siege-trebuchet": "1518 triangles exceeds the 1200-triangle decoration ceiling",
  }),
  "survival-kit": Object.freeze({
    "patch-grass": "zero-height donor geometry; a terrain decal rather than a prop",
    "patch-grass-large": "zero-height donor geometry; a terrain decal rather than a prop",
  }),
  "pirate-kit": Object.freeze({
    "patch-grass": "horizontal aspect 21.0923 cannot satisfy any role's two-sided size band",
    "patch-sand-foliage": "horizontal aspect 13.7182 cannot satisfy any role's two-sided size band",
    "patch-sand": "horizontal aspect 30.9452 cannot satisfy any role's two-sided size band",
    platform: "horizontal aspect 11.0206 cannot satisfy any role's two-sided size band",
    "ship-ghost": "1703 triangles exceeds the 1200-triangle decoration ceiling",
    "ship-large": "1849 triangles exceeds the 1200-triangle decoration ceiling",
    "ship-medium": "1723 triangles exceeds the 1200-triangle decoration ceiling",
    "ship-pirate-large": "1938 triangles exceeds the 1200-triangle decoration ceiling",
    "ship-pirate-medium": "1812 triangles exceeds the 1200-triangle decoration ceiling",
    "ship-pirate-small": "1461 triangles exceeds the 1200-triangle decoration ceiling",
    "ship-small": "1370 triangles exceeds the 1200-triangle decoration ceiling",
    "ship-wreck": "2282 triangles exceeds the 1200-triangle decoration ceiling",
  }),
});

const SURVIVAL_FARMSTEAD_ASSETS = new Set([
  "barrel",
  "barrel-open",
  "bedroll-packed",
  "bottle",
  "bottle-large",
  "box",
  "box-large",
  "box-open",
  "bucket",
  "chest",
  "fence",
  "fence-doorway",
  "fence-fortified",
  "grass",
  "grass-large",
  "resource-planks",
  "resource-stone",
  "resource-stone-large",
  "resource-wood",
  "rock-a",
  "rock-b",
  "rock-c",
  "rock-sand-a",
  "rock-sand-b",
  "rock-sand-c",
  "signpost",
  "signpost-single",
  "structure-canvas",
  "structure-floor",
  "structure-roof",
  "tent",
  "tent-canvas",
  "tent-canvas-half",
  "tool-hoe",
  "tool-hoe-upgraded",
  "tool-shovel",
  "tool-shovel-upgraded",
  "tree",
  "tree-autumn",
  "tree-autumn-tall",
  "tree-trunk",
  "workbench",
]);

function packAssetId(pack, sourceId) {
  return `${pack.namespace}_${sourceId}`;
}

function aspectOf(measured) {
  return Math.max(measured.aspect.width, measured.aspect.depth);
}

function sizeAtRole(role, aspect, roll) {
  const sizing = ROLE_SIZING[role];
  const slenderness = Math.min(1, Math.max(0, 1 - aspect));
  const fatten = 1 + (sizing.fatten - 1) * slenderness;
  let height = sizing.height[0] + (sizing.height[1] - sizing.height[0]) * roll;
  let footprint = height * aspect * fatten;
  if (footprint > sizing.footprint[1]) {
    height *= sizing.footprint[1] / footprint;
    footprint = sizing.footprint[1];
  } else if (footprint < sizing.footprint[0]) {
    height = Math.min(sizing.height[1], (height * sizing.footprint[0]) / footprint);
    footprint = height * aspect * fatten;
  }
  return { height, footprint };
}

function fitsRole(role, measured) {
  const sizing = ROLE_SIZING[role];
  const aspect = aspectOf(measured);
  return SIZE_ROLLS.every((roll) => {
    const size = sizeAtRole(role, aspect, roll);
    return (
      size.height >= sizing.height[0] - 1e-6 &&
      size.height <= sizing.height[1] + 1e-6 &&
      size.footprint >= sizing.footprint[0] - 1e-6 &&
      size.footprint <= sizing.footprint[1] + 1e-6
    );
  });
}

function preferredRole(pack, assetId) {
  if (pack.id === "castle-kit") {
    if (assetId === "tower-square") return "landmark";
    if (/^(?:flag|metal-gate)/.test(assetId)) return "canopy";
    if (/^tree-/.test(assetId)) return "canopy";
    if (/^(?:ground-hills|rocks)/.test(assetId)) return "ground";
    return "understory";
  }
  if (pack.id === "survival-kit") {
    if (/^tree(?:-|$)/.test(assetId)) return "canopy";
    if (assetId === "tent") return "landmark";
    if (
      /^(?:grass|resource|rock|floor|bedroll|fish|tool|metal-panel|barrel|box|bucket|bottle)/.test(
        assetId,
      )
    ) {
      return "ground";
    }
    if (/^(?:fence|signpost|structure|campfire|workbench|chest|tent)/.test(assetId)) {
      return "understory";
    }
    return "understory";
  }
  if (assetId === "tower-complete-small") return "landmark";
  if (/^(?:palm|mast|flag)/.test(assetId)) return "canopy";
  if (/^(?:grass|rock|hole|patch|platform|boat-row|structure-platform)/.test(assetId)) {
    return "ground";
  }
  if (/^(?:tower|castle|structure|cannon)/.test(assetId)) return "understory";
  if (/^(?:barrel|bottle|chest|crate|tool|cannon-ball)/.test(assetId)) return "ground";
  return "understory";
}

function chooseRole(pack, assetId, measured) {
  const preferred = preferredRole(pack, assetId);
  const candidates = [preferred, ...ROLE_ORDER.filter((role) => role !== preferred)];
  const role = candidates.find((candidate) => fitsRole(candidate, measured));
  if (!role) {
    throw new Error(
      `${pack.id}/${assetId}: no role satisfies both height and footprint bands at all five rolls`,
    );
  }
  return role;
}

function isTreeAsset(assetId) {
  return /^(?:tree|palm)(?:-|$)/.test(assetId);
}

function triangleCeiling(assetId) {
  return isTreeAsset(assetId) ? 900 : 1200;
}

function sourcePathFor(donorRoot, pack, sourceId) {
  return join(donorRoot, pack.folder, pack.modelsDirectory, `${sourceId}.glb`);
}

function colormapPathFor(donorRoot, pack) {
  return join(donorRoot, pack.folder, pack.modelsDirectory, "Textures/colormap.png");
}

function inventoryFor(donorRoot, pack) {
  const directory = join(donorRoot, pack.folder, pack.modelsDirectory);
  return readdirSync(directory)
    .filter((file) => file.endsWith(".glb"))
    .map((file) => file.slice(0, -4))
    .sort();
}

function validateExplicitCoverage(donorRoot, pack) {
  const inventory = inventoryFor(donorRoot, pack);
  const selected = new Set(BAKED_ASSET_IDS[pack.id]);
  const rejected = new Set(Object.keys(REJECTED_ASSETS[pack.id]));
  const overlap = [...selected].filter((assetId) => rejected.has(assetId));
  const missing = inventory.filter((assetId) => !selected.has(assetId) && !rejected.has(assetId));
  const unknownSelected = [...selected].filter((assetId) => !inventory.includes(assetId));
  const unknownRejected = [...rejected].filter((assetId) => !inventory.includes(assetId));
  if (overlap.length || missing.length || unknownSelected.length || unknownRejected.length) {
    throw new Error(
      `${pack.id}: explicit coverage failed; ` +
        `overlap=${overlap.join(",") || "none"}, ` +
        `unjudged=${missing.join(",") || "none"}, ` +
        `unknown-selected=${unknownSelected.join(",") || "none"}, ` +
        `unknown-rejected=${unknownRejected.join(",") || "none"}`,
    );
  }
  return { inventory, selected, rejected };
}

function measureForRecord(sourceBytes, sourceRelative) {
  const sourceJson = readGlbJson(sourceBytes, sourceRelative);
  try {
    return { measured: measureGlb(sourceJson, sourceRelative), measurementError: null };
  } catch (error) {
    return { measured: null, measurementError: error.message };
  }
}

function rejectedRecords(donorRoot, pack, coverage, license, colormapBytes) {
  return [...coverage.rejected].sort().map((sourceId) => {
    const sourceRelative = join(pack.folder, pack.modelsDirectory, `${sourceId}.glb`);
    const sourceBytes = readFileSync(sourcePathFor(donorRoot, pack, sourceId));
    const measured = measureForRecord(sourceBytes, sourceRelative);
    const reason = REJECTED_ASSETS[pack.id][sourceId];
    const audit = reason.includes("atlas colour blocks")
      ? auditGlbColormap({ sourceBytes, colormapBytes, label: sourceRelative })
      : null;
    return {
      type: "rejected-model",
      pack: pack.id,
      sourceAssetId: sourceId,
      source: sourceRelative,
      sourceSha256: sha256(sourceBytes),
      triangles: measured.measured?.triangles ?? null,
      aspect: measured.measured?.aspect ?? null,
      measurementError: measured.measurementError,
      reason,
      exactColourVariationTriangles: audit?.exactColourVariationTriangles ?? null,
      crossColourTriangles: audit?.crossColourTriangles.length ?? null,
      crossColourRatio: audit?.crossColourRatio ?? null,
      license,
      provenance: {
        sourceRoot: PROVENANCE_SOURCE_ROOT,
        sourceRelative,
        importedBy: "apps/university/scripts/import-kenney-grid.mjs",
        status: "reviewed and rejected; not copied to the public payload",
      },
    };
  });
}

function biomeIdsFor(pack, sourceId) {
  if (pack.id === "survival-kit" && SURVIVAL_FARMSTEAD_ASSETS.has(sourceId)) {
    return ["logging-camp", "farmstead"];
  }
  return [pack.primaryBiome];
}

function importNatureAssets(donorRoot, license) {
  const seen = new Set();
  const assets = [];
  for (const [assetId, role] of NATURE_ASSETS) {
    if (seen.has(assetId)) throw new Error(`${assetId}: duplicated in the grid whitelist`);
    seen.add(assetId);
    const file = `${assetId}.glb`;
    const sourceRelative = join(NATURE_PACK.folder, NATURE_PACK.modelsDirectory, file);
    const sourcePath = join(donorRoot, sourceRelative);
    if (!existsSync(sourcePath))
      throw new Error(`${sourceRelative}: whitelisted donor file is missing`);
    const sourceBytes = readFileSync(sourcePath);
    const json = readGlbJson(sourceBytes, sourceRelative);
    const imageUris = (json.images ?? []).map((image) => image.uri).filter(Boolean);
    if (imageUris.length > 0) {
      throw new Error(`${sourceRelative}: nature-kit grid assets must carry no external texture`);
    }
    const measured = measureGlb(json, sourceRelative);
    const outputRelative = join(NATURE_PACK.outputDirectory, file);
    const copied = copyVerified(sourcePath, join(OUTPUT_ROOT, outputRelative), sourceRelative);
    assets.push({
      type: "model",
      id: `grid-nature-${assetId}`,
      assetId,
      sourceAssetId: assetId,
      role,
      biomes: [],
      src: `${RUNTIME_BASE_PATH}/${outputRelative}`,
      bytes: copied.bytes,
      sha256: copied.sha256,
      sourceSha256: copied.sha256,
      triangles: measured.triangles,
      aspect: measured.aspect,
      source: sourceRelative,
      pack: NATURE_PACK.id,
      version: NATURE_PACK.version,
      license,
      provenance: {
        sourceRoot: PROVENANCE_SOURCE_ROOT,
        sourceRelative,
        importedBy: "apps/university/scripts/import-kenney-grid.mjs",
        status: "prototype/local donor; PGS donor registered",
      },
    });
  }
  return assets;
}

function importBakedPack(donorRoot, pack) {
  const license = verifyLicense(donorRoot, pack);
  const coverage = validateExplicitCoverage(donorRoot, pack);
  const colormapPath = colormapPathFor(donorRoot, pack);
  const colormapRelative = join(pack.folder, pack.modelsDirectory, "Textures/colormap.png");
  if (!existsSync(colormapPath)) throw new Error(`${colormapRelative}: colormap is missing`);
  const colormapBytes = readFileSync(colormapPath);
  const colormapSha256 = sha256(colormapBytes);
  const assets = [];

  // A previous reviewed selection may have left a generated GLB behind. Keep
  // rejected files out of the public payload when the whitelist changes.
  for (const sourceId of coverage.rejected) {
    const stalePath = join(OUTPUT_ROOT, pack.outputDirectory, `${sourceId}.glb`);
    if (existsSync(stalePath)) unlinkSync(stalePath);
  }

  for (const sourceId of [...coverage.selected].sort()) {
    const sourceRelative = join(pack.folder, pack.modelsDirectory, `${sourceId}.glb`);
    const sourcePath = sourcePathFor(donorRoot, pack, sourceId);
    const sourceBytes = readFileSync(sourcePath);
    const sourceMeasurement = measureForRecord(sourceBytes, sourceRelative);
    if (!sourceMeasurement.measured) {
      throw new Error(
        `${sourceRelative}: selected model cannot be measured: ${sourceMeasurement.measurementError}`,
      );
    }
    const ceiling = triangleCeiling(sourceId);
    if (sourceMeasurement.measured.triangles > ceiling) {
      throw new Error(
        `${sourceRelative}: ${sourceMeasurement.measured.triangles} triangles exceeds ${ceiling}`,
      );
    }
    const role = chooseRole(pack, sourceId, sourceMeasurement.measured);
    const baked = bakeColormapToVertexColors({
      sourceBytes,
      colormapBytes,
      label: sourceRelative,
    });
    const outputRelative = join(pack.outputDirectory, `${sourceId}.glb`);
    const outputPath = join(OUTPUT_ROOT, outputRelative);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, baked.bytes);
    const bakedBytes = readFileSync(outputPath);
    if (sha256(bakedBytes) !== sha256(baked.bytes)) {
      throw new Error(`${outputRelative}: baked output changed while being written`);
    }
    const lossless = assertBakedGlbLossless({
      sourceBytes,
      bakedBytes,
      colormapBytes,
      label: sourceRelative,
    });
    const bakedMeasurement = measureGlb(
      readGlbJson(bakedBytes, `${sourceRelative} baked output`),
      `${sourceRelative} baked output`,
    );
    if (
      bakedMeasurement.triangles !== sourceMeasurement.measured.triangles ||
      JSON.stringify(bakedMeasurement.aspect) !== JSON.stringify(sourceMeasurement.measured.aspect)
    ) {
      throw new Error(`${sourceRelative}: baking changed measured geometry proportions`);
    }
    assets.push({
      type: "model",
      id: `grid-${pack.namespace}-${sourceId}`,
      assetId: packAssetId(pack, sourceId),
      sourceAssetId: sourceId,
      role,
      biomes: biomeIdsFor(pack, sourceId),
      src: `${RUNTIME_BASE_PATH}/${outputRelative}`,
      bytes: bakedBytes.length,
      sha256: sha256(bakedBytes),
      sourceSha256: sha256(sourceBytes),
      triangles: bakedMeasurement.triangles,
      aspect: bakedMeasurement.aspect,
      source: sourceRelative,
      pack: pack.id,
      version: pack.version,
      license,
      colormap: {
        source: colormapRelative,
        sha256: colormapSha256,
        width: baked.audit.colormap.width,
        height: baked.audit.colormap.height,
      },
      bake: {
        method: "colormap-rgb-nearest-to-COLOR_0",
        sourceExactColourVariationTriangles: baked.audit.exactColourVariationTriangles,
        sourceCrossColourTriangles: baked.audit.crossColourTriangles,
        sourceCrossColourRatio: baked.audit.crossColourRatio,
        bakedVertexCount: baked.audit.bakedVertexCount,
        removed: ["UV attributes", "TANGENT", "baseColorTexture", "images", "textures"],
      },
      measuredFrom: "baked output; source geometry equality asserted",
      provenance: {
        sourceRoot: PROVENANCE_SOURCE_ROOT,
        sourceRelative,
        sourceColormap: colormapRelative,
        importedBy: "apps/university/scripts/import-kenney-grid.mjs",
        status: "prototype/local donor; PGS donor registered",
      },
      losslessCheck: {
        comparedVertices: lossless.comparedVertices,
        triangles: lossless.triangles,
        status: "passed",
      },
    });
  }

  return {
    assets,
    rejected: rejectedRecords(donorRoot, pack, coverage, license, colormapBytes),
    license,
    colormap: {
      source: colormapRelative,
      sha256: colormapSha256,
      bytes: colormapBytes.length,
      size: [assets[0]?.colormap.width ?? null, assets[0]?.colormap.height ?? null],
    },
    counts: {
      donor: coverage.inventory.length,
      selected: assets.length,
      rejected: coverage.rejected.size,
    },
  };
}

function runHolidayTripwire(donorRoot) {
  const license = verifyLicense(donorRoot, HOLIDAY_TRIPWIRE_PACK);
  const sourceRelative = join(
    HOLIDAY_TRIPWIRE_PACK.folder,
    HOLIDAY_TRIPWIRE_PACK.modelsDirectory,
    `${HOLIDAY_TRIPWIRE_PACK.sourceAssetId}.glb`,
  );
  const sourceBytes = readFileSync(join(donorRoot, sourceRelative));
  const colormapRelative = join(
    HOLIDAY_TRIPWIRE_PACK.folder,
    HOLIDAY_TRIPWIRE_PACK.modelsDirectory,
    "Textures/colormap.png",
  );
  const colormapBytes = readFileSync(join(donorRoot, colormapRelative));
  try {
    bakeColormapToVertexColors({
      sourceBytes,
      colormapBytes,
      label: sourceRelative,
    });
  } catch (error) {
    if (!(error instanceof GridBakeError) || error.code !== "CROSS_COLOUR_TRIANGLE") throw error;
    return {
      pack: HOLIDAY_TRIPWIRE_PACK.id,
      sourceAssetId: HOLIDAY_TRIPWIRE_PACK.sourceAssetId,
      source: sourceRelative,
      license,
      crossColourTriangles: error.crossColourTriangles,
      totalTriangles: error.totalTriangles,
      crossColourRatio: error.crossColourRatio,
      status: "passed: importer rejected the known cross-colour model",
      message: error.message,
    };
  }
  throw new Error(`${sourceRelative}: holiday cross-colour tripwire unexpectedly passed`);
}

function packLicenseMap(natureLicense, bakedResults) {
  return Object.fromEntries([
    [NATURE_PACK.id, natureLicense],
    ...bakedResults.map((result) => [result.packId, result.license]),
  ]);
}

export function runImport({ donorRoot = process.env.KENNEY_DONOR_ROOT } = {}) {
  const sourceRoot = resolveDonorRoot(donorRoot);
  const natureLicense = verifyLicense(sourceRoot, NATURE_PACK);
  const natureAssets = importNatureAssets(sourceRoot, natureLicense);
  const bakedResults = BAKED_PACKS.map((pack) => ({
    packId: pack.id,
    ...importBakedPack(sourceRoot, pack),
  }));
  const tripwire = runHolidayTripwire(sourceRoot);
  const bakedAssets = bakedResults.flatMap((result) => result.assets);
  const rejected = bakedResults.flatMap((result) => result.rejected);
  const assets = [...natureAssets, ...bakedAssets].sort((first, second) =>
    first.assetId.localeCompare(second.assetId),
  );
  const licenses = packLicenseMap(natureLicense, bakedResults);
  const manifest = {
    schemaVersion: 2,
    assetSet: "grid-biome-library",
    status: "prototype/local donor; PGS donor registered",
    sourceRoot: PROVENANCE_SOURCE_ROOT,
    sourceRootHint: "../../../_donors/Kenney or KENNEY_DONOR_ROOT",
    outputRoot: "public/kenney/grid",
    runtimeBasePath: RUNTIME_BASE_PATH,
    selection: {
      packIds: [NATURE_PACK.id, ...BAKED_PACKS.map((pack) => pack.id)],
      whitelistPolicy: "explicit filenames only; every donor GLB must be selected or rejected",
      materialMode: "shared-batched-COLOR_0",
      texturePolicy:
        "colormap baked to normalized RGB COLOR_0; output keeps zero images, textures and UVs",
      rationale:
        "Nature, Castle, Survival and Pirate are admitted as one material language: the latter three are useful only where every sampled triangle is one colormap colour.",
    },
    biomeAssignments: {
      "old-ruins": {
        basePack: "nature-kit",
        accentPack: "castle-kit",
        style: "stone-and-structure",
      },
      "logging-camp": {
        basePack: "nature-kit",
        accentPack: "survival-kit",
        style: "woodland-worksite",
      },
      farmstead: { basePack: "nature-kit", accentPack: "survival-kit", style: "quiet-rural" },
      "palm-shore": { basePack: "nature-kit", accentPack: "pirate-kit", style: "shoreline-dock" },
    },
    provenance: {
      donor: "Kenney CC0 asset packs from the authorised local donor cache",
      packs: Object.fromEntries(
        [NATURE_PACK, ...BAKED_PACKS].map((pack) => [
          pack.id,
          { title: pack.title, source: pack.source, version: pack.version },
        ]),
      ),
      tripwire: "holiday-kit/train-locomotive is test-only and is not copied",
    },
    license: {
      spdx: LICENSE_SPDX,
      textCheck: "Creative Commons Zero, CC0 + commercial use",
      commercialUse: true,
      file: natureLicense.file,
      sha256: natureLicense.sha256,
      packs: licenses,
    },
    assets,
    rejected,
    tripwire,
    summary: {
      modelCount: assets.length,
      natureModelCount: natureAssets.length,
      bakedModelCount: bakedAssets.length,
      externalTextureCount: 0,
      bakedUvCount: 0,
      totalBytes: assets.reduce((total, asset) => total + asset.bytes, 0),
      maxTriangles: assets.reduce((peak, asset) => Math.max(peak, asset.triangles), 0),
      totalTriangles: assets.reduce((total, asset) => total + asset.triangles, 0),
      sourceExactColourVariationTriangles: bakedAssets.reduce(
        (total, asset) => total + asset.bake.sourceExactColourVariationTriangles,
        0,
      ),
      sourceCrossColourTriangles: bakedAssets.reduce(
        (total, asset) => total + asset.bake.sourceCrossColourTriangles,
        0,
      ),
      selectedByPack: Object.fromEntries([
        [NATURE_PACK.id, natureAssets.length],
        ...bakedResults.map((result) => [result.packId, result.assets.length]),
      ]),
      rejectedByPack: Object.fromEntries(
        bakedResults.map((result) => [result.packId, result.rejected.length]),
      ),
    },
  };

  const changed = writeIfChanged(MANIFEST_PATH, formatGeneratedManifest(manifest));
  return { manifest, changed };
}

function formatGeneratedManifest(manifest) {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "university-kenney-grid-"));
  const temporaryManifest = join(temporaryRoot, "grid-assets.json");
  try {
    writeFileSync(temporaryManifest, `${JSON.stringify(manifest, null, 2)}\n`);
    execFileSync(OXFMT_PATH, [temporaryManifest], { stdio: "pipe" });
    return readFileSync(temporaryManifest, "utf8");
  } catch (error) {
    throw new Error(`could not format generated grid manifest with oxfmt: ${error.message}`);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

const invokedDirectly = process.argv[1]?.endsWith("import-kenney-grid.mjs");
if (invokedDirectly) {
  const { manifest, changed } = runImport();
  console.log(
    `grid biome library: ${manifest.summary.modelCount} models, ` +
      `${(manifest.summary.totalBytes / 1024).toFixed(1)} KiB, ` +
      `max ${manifest.summary.maxTriangles} triangles, ` +
      `holiday tripwire ${(manifest.tripwire.crossColourRatio * 100).toFixed(2)}% ` +
      `(manifest ${changed ? "updated" : "unchanged"})`,
  );
}
