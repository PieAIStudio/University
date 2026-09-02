/**
 * Import the hex grid's Kenney biome library from the authorised local donor.
 *
 *   pnpm --filter @pieai/university-app kenney:grid
 *
 * Why this is a second payload rather than more entries in the R01 manifest:
 * R01 is one *island recipe* — a deliberately tiny slice bounded by
 * `rawGlbBudget`, whose whole point is that an island loads ten models and not
 * an asset browser. The hex grid asks a different question. A course has
 * units, one unit gets one biome, and a biome needs its own canopy, understory
 * and ground vocabulary or it is just a recolour. Folding sixty models into
 * the recipe manifest would make that budget meaningless, so the two payloads
 * stay separate and this script is the only producer of the grid library.
 *
 * Everything here is nature-kit and nothing else. That is an art-direction
 * decision with a cost consequence, and both halves matter:
 *  - nature-kit is `unlit-color` with no external texture, so every model in
 *    the library shares one material language and one BatchedMesh can draw the
 *    entire prop field in a single submission.
 *  - a biome built from one pack cannot read as a collage. Six units drawn
 *    from six *different* Kenney packs would be six art styles on one island.
 *
 * The list below is explicit filenames, never a donor glob. The biome table in
 * `packages/world/src/grid/grid-theme.ts` is what actually chooses among them,
 * and `grid-theme.test.ts` asserts that every id it names is present here — so
 * the two cannot drift into a runtime 404.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  APP_ROOT,
  copyVerified,
  LICENSE_SPDX,
  measureGlb,
  PROVENANCE_SOURCE_ROOT,
  readGlbJson,
  resolveDonorRoot,
  sha256,
  verifyLicense,
  writeIfChanged,
} from "./kenney-donor.mjs";

const OUTPUT_ROOT = join(APP_ROOT, "public/kenney/grid");
const MANIFEST_PATH = resolve(APP_ROOT, "../../packages/world/src/grid/grid-nature-assets.json");
const RUNTIME_BASE_PATH = "/kenney/grid";

const NATURE_PACK = Object.freeze({
  id: "nature-kit",
  folder: "kenney_nature-kit",
  title: "Nature Kit",
  version: "2.1",
  source: "https://kenney.nl/assets/nature-kit",
  modelsDirectory: "Models/GLTF format",
  materialMode: "unlit-color",
  licenseSha256: "cb96b75e3560ac78d7a53ce6f083f4cdb5c53faea6141b62d63458dcfe1e4b9d",
});

/**
 * The biome library, grouped the way the art direction reads it. `role` is the
 * scale band the planner sizes a prop by: canopy carries the silhouette,
 * understory fills the middle, ground is punctuation, landmark is the single
 * large thing that opens a unit.
 */
const ASSETS = Object.freeze([
  // --- pine-ridge -----------------------------------------------------
  ["tree_pineTallA_detailed", "canopy"],
  ["tree_pineTallC_detailed", "canopy"],
  ["tree_pineRoundA", "canopy"],
  ["tree_pineRoundC", "canopy"],
  ["tree_pineSmallA", "understory"],
  ["tree_pineSmallC", "understory"],
  ["grass_leafsLarge", "ground"],
  ["mushroom_red", "ground"],
  ["rock_tallB", "landmark"],
  // --- fall-grove -----------------------------------------------------
  ["tree_oak_fall", "canopy"],
  ["tree_thin_fall", "canopy"],
  ["tree_fat_fall", "canopy"],
  ["tree_plateau_fall", "canopy"],
  ["tree_small_fall", "understory"],
  ["mushroom_tanGroup", "ground"],
  ["tree_detailed_fall", "landmark"],
  // --- stone-quarry ---------------------------------------------------
  ["stone_tallA", "canopy"],
  ["stone_tallB", "canopy"],
  ["stone_tallH", "canopy"],
  ["stone_largeA", "understory"],
  ["stone_largeD", "understory"],
  ["stone_smallTopA", "understory"],
  ["stone_smallA", "ground"],
  ["stone_smallFlatA", "ground"],
  ["statue_obelisk", "landmark"],
  // --- flower-meadow --------------------------------------------------
  ["tree_fat", "canopy"],
  ["tree_small", "canopy"],
  ["grass_large", "understory"],
  ["flower_purpleA", "ground"],
  ["flower_purpleB", "ground"],
  ["flower_redA", "ground"],
  ["flower_yellowA", "ground"],
  ["statue_ring", "landmark"],
  // --- mushroom-hollow ------------------------------------------------
  ["tree_thin_dark", "canopy"],
  ["tree_plateau_dark", "canopy"],
  ["mushroom_redTall", "understory"],
  ["mushroom_tanTall", "understory"],
  ["plant_bushLargeTriangle", "understory"],
  ["mushroom_redGroup", "ground"],
  ["hanging_moss", "ground"],
  // --- logging-camp ---------------------------------------------------
  ["tree_pineDefaultA", "canopy"],
  ["tree_pineRoundE", "canopy"],
  ["log_stack", "understory"],
  ["stump_oldTall", "understory"],
  ["tent_smallOpen", "understory"],
  ["log", "ground"],
  ["campfire_logs", "ground"],
  ["tent_detailedOpen", "landmark"],
  // --- farmstead ------------------------------------------------------
  ["crops_cornStageD", "canopy"],
  ["crops_bambooStageA", "canopy"],
  ["crops_wheatStageB", "understory"],
  ["crop_pumpkin", "understory"],
  ["fence_simple", "ground"],
  ["crop_carrot", "ground"],
  ["crop_turnip", "ground"],
  // A stand of bamboo, not `fence_gate`. The gate is 2.9 times wider than it
  // is tall, so at any landmark height its footprint spilled across three
  // cells; shrinking it to fit made it 0.56 tall, which is not a gateway.
  // `crops_dirtRow` left for the same reason at 20:1 — that is a ground decal,
  // and the size band refused it rather than being widened to admit it.
  ["crops_bambooStageB", "landmark"],
  // --- dry-mesa -------------------------------------------------------
  ["cactus_tall", "canopy"],
  ["tree_palmShort", "canopy"],
  ["cactus_short", "understory"],
  ["rock_largeB", "understory"],
  ["rock_smallFlatA", "ground"],
  ["rock_smallA", "ground"],
  ["plant_flatShort", "ground"],
  ["statue_columnDamaged", "landmark"],
  // --- old-ruins ------------------------------------------------------
  ["statue_column", "canopy"],
  ["statue_block", "understory"],
  ["stone_largeC", "understory"],
  ["plant_bushLarge", "understory"],
  ["stone_smallFlatB", "ground"],
  ["plant_bushSmall", "ground"],
  ["statue_head", "landmark"],
  // --- palm-shore -----------------------------------------------------
  ["tree_palmDetailedTall", "canopy"],
  ["tree_palmTall", "canopy"],
  ["tree_palmBend", "canopy"],
  ["lily_large", "ground"],
  ["grass_leafs", "ground"],
  ["rock_smallFlatC", "ground"],
]);

export function runImport({ donorRoot = process.env.KENNEY_DONOR_ROOT } = {}) {
  const sourceRoot = resolveDonorRoot(donorRoot);
  const license = verifyLicense(sourceRoot, NATURE_PACK);
  const seen = new Set();
  const assets = [];

  for (const [assetId, role] of ASSETS) {
    if (seen.has(assetId)) throw new Error(`${assetId}: duplicated in the grid whitelist`);
    seen.add(assetId);

    const file = `${assetId}.glb`;
    const sourceRelative = join(NATURE_PACK.folder, NATURE_PACK.modelsDirectory, file);
    const sourcePath = join(sourceRoot, sourceRelative);
    if (!existsSync(sourcePath)) {
      throw new Error(`${sourceRelative}: whitelisted donor file is missing`);
    }

    const sourceBytes = readFileSync(sourcePath);
    const json = readGlbJson(sourceBytes, sourceRelative);
    const imageUris = (json.images ?? []).map((image) => image.uri).filter(Boolean);
    if (imageUris.length > 0) {
      // nature-kit is the only pack in this library precisely because it is
      // untextured. An external image here would mean one BatchedMesh can no
      // longer draw the whole field, so it is an error rather than a copy.
      throw new Error(`${sourceRelative}: grid library assets must carry no external texture`);
    }

    const measured = measureGlb(json, sourceRelative);
    const outputRelative = join("nature", file);
    const copied = copyVerified(sourcePath, join(OUTPUT_ROOT, outputRelative), sourceRelative);

    assets.push({
      type: "model",
      id: `grid-nature-${assetId}`,
      assetId,
      role,
      src: `${RUNTIME_BASE_PATH}/${outputRelative}`,
      bytes: copied.bytes,
      sha256: sha256(sourceBytes),
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

  assets.sort((first, second) => first.assetId.localeCompare(second.assetId));

  const manifest = {
    schemaVersion: 1,
    assetSet: "grid-biome-library",
    status: "prototype/local donor; PGS donor registered",
    sourceRoot: PROVENANCE_SOURCE_ROOT,
    sourceRootHint: "../../../_donors/Kenney or KENNEY_DONOR_ROOT",
    outputRoot: "public/kenney/grid",
    runtimeBasePath: RUNTIME_BASE_PATH,
    selection: {
      packIds: [NATURE_PACK.id],
      whitelistPolicy: "explicit filenames only; no donor glob",
      materialMode: NATURE_PACK.materialMode,
      rationale:
        "One pack, one material language, one BatchedMesh for the whole prop field.",
    },
    license: { spdx: LICENSE_SPDX, ...license },
    assets,
    summary: {
      modelCount: assets.length,
      externalTextureCount: 0,
      totalBytes: assets.reduce((total, asset) => total + asset.bytes, 0),
      maxTriangles: assets.reduce((peak, asset) => Math.max(peak, asset.triangles), 0),
      totalTriangles: assets.reduce((total, asset) => total + asset.triangles, 0),
    },
  };

  const changed = writeIfChanged(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, changed };
}

const invokedDirectly = process.argv[1]?.endsWith("import-kenney-grid.mjs");
if (invokedDirectly) {
  const { manifest, changed } = runImport();
  console.log(
    `grid biome library: ${manifest.summary.modelCount} models, ` +
      `${(manifest.summary.totalBytes / 1024).toFixed(1)} KiB, ` +
      `max ${manifest.summary.maxTriangles} triangles ` +
      `(manifest ${changed ? "updated" : "unchanged"})`,
  );
}
