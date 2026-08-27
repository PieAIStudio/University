/**
 * Import the deliberately small R01 asset whitelist from the local Kenney
 * donor.
 *
 * This is an import manifest, not an asset browser.  Do not replace the
 * explicit list below with a glob: the donor contains many more files than
 * the first island needs, and the runtime should only ship what the recipe
 * actually asks for.
 *
 * R01 is Nature (global base) + Fantasy Town (one physical accent).  Fantasy
 * Town GLBs use one external `Textures/colormap.png`; the output keeps that
 * relative dependency beside the copied models so GLTFLoader can resolve it
 * without a special runtime path rewrite.
 *
 *   pnpm --filter @pieai/university-app kenney:r01
 */
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const DEFAULT_DONOR_ROOTS = [
  // Normal checkout: PieAI/University/apps/university → PieAI/_donors.
  resolve(appRoot, "../../../_donors/Kenney"),
  // In-repository worktree: University/.worktrees/<name>/apps/university.
  resolve(appRoot, "../../../../../_donors/Kenney"),
];
// Manifests are committed and must not capture one developer's absolute home
// path. The resolved path is used only while importing; provenance keeps this
// portable source identity and the script documents the overridable location.
const PROVENANCE_SOURCE_ROOT = "local-donor:Kenney";
const OUTPUT_ROOT = join(appRoot, "public/kenney/r01");
const MANIFEST_PATH = resolve(appRoot, "../../packages/world/src/island/kenney-r01-assets.json");

const PACKS = Object.freeze({
  "nature-kit": Object.freeze({
    id: "nature-kit",
    folder: "kenney_nature-kit",
    title: "Nature Kit",
    version: "2.1",
    source: "https://kenney.nl/assets/nature-kit",
    modelsDirectory: "Models/GLTF format",
    materialMode: "unlit-color",
    licenseSha256: "cb96b75e3560ac78d7a53ce6f083f4cdb5c53faea6141b62d63458dcfe1e4b9d",
  }),
  "fantasy-town-kit": Object.freeze({
    id: "fantasy-town-kit",
    folder: "kenney_fantasy-town-kit_2.0",
    title: "Fantasy Town Kit",
    version: "2.0",
    source: "https://kenney.nl/assets/fantasy-town-kit",
    modelsDirectory: "Models/GLB format",
    materialMode: "external-colormap",
    licenseSha256: "fb8e4817197ef9f62215e95b4451a0f09c769c8e03e416e3a2ce108dfa6117e4",
  }),
});

/**
 * The R01 whitelist.  `file` is intentionally a literal donor filename.
 * `assetId` remains the original Kenney basename so recipe role references
 * stay easy to read; `id` is the namespaced runtime identity.
 */
const ASSETS = Object.freeze([
  {
    id: "nature-tree_default",
    assetId: "tree_default",
    packId: "nature-kit",
    file: "tree_default.glb",
    outputDirectory: "nature",
    roles: ["vegetation", "canopy"],
  },
  {
    id: "nature-tree_detailed",
    assetId: "tree_detailed",
    packId: "nature-kit",
    file: "tree_detailed.glb",
    outputDirectory: "nature",
    roles: ["vegetation", "hero-vegetation"],
  },
  {
    id: "nature-tree_pineDefaultB",
    assetId: "tree_pineDefaultB",
    packId: "nature-kit",
    file: "tree_pineDefaultB.glb",
    outputDirectory: "nature",
    roles: ["vegetation", "silhouette"],
  },
  {
    id: "nature-rock_largeA",
    assetId: "rock_largeA",
    packId: "nature-kit",
    file: "rock_largeA.glb",
    outputDirectory: "nature",
    roles: ["rock", "terrain-dressing"],
  },
  {
    id: "nature-rock_smallA",
    assetId: "rock_smallA",
    packId: "nature-kit",
    file: "rock_smallA.glb",
    outputDirectory: "nature",
    roles: ["rock", "terrain-dressing"],
  },
  {
    id: "nature-plant_bushDetailed",
    assetId: "plant_bushDetailed",
    packId: "nature-kit",
    file: "plant_bushDetailed.glb",
    outputDirectory: "nature",
    roles: ["vegetation", "shore-dressing"],
  },
  {
    id: "fantasy-town-wall",
    assetId: "wall",
    packId: "fantasy-town-kit",
    file: "wall.glb",
    outputDirectory: "fantasy-town",
    roles: ["structure", "settlement-anchor"],
  },
  {
    id: "fantasy-town-wall-corner",
    assetId: "wall-corner",
    packId: "fantasy-town-kit",
    file: "wall-corner.glb",
    outputDirectory: "fantasy-town",
    roles: ["structure", "settlement-anchor"],
  },
  {
    id: "fantasy-town-wall-doorway-square",
    assetId: "wall-doorway-square",
    packId: "fantasy-town-kit",
    file: "wall-doorway-square.glb",
    outputDirectory: "fantasy-town",
    roles: ["structure", "landmark"],
  },
  {
    id: "fantasy-town-roof",
    assetId: "roof",
    packId: "fantasy-town-kit",
    file: "roof.glb",
    outputDirectory: "fantasy-town",
    roles: ["structure", "silhouette"],
  },
  {
    id: "fantasy-town-roof-gable",
    assetId: "roof-gable",
    packId: "fantasy-town-kit",
    file: "roof-gable.glb",
    outputDirectory: "fantasy-town",
    roles: ["structure", "hero-architecture"],
  },
  {
    id: "fantasy-town-fountain-round",
    assetId: "fountain-round",
    packId: "fantasy-town-kit",
    file: "fountain-round.glb",
    outputDirectory: "fantasy-town",
    roles: ["landmark", "water-feature"],
    notes: "Water material contains alpha; retain the source material settings.",
  },
  {
    id: "fantasy-town-stall",
    assetId: "stall",
    packId: "fantasy-town-kit",
    file: "stall.glb",
    outputDirectory: "fantasy-town",
    roles: ["prop", "settlement-dressing"],
  },
  {
    id: "fantasy-town-lantern",
    assetId: "lantern",
    packId: "fantasy-town-kit",
    file: "lantern.glb",
    outputDirectory: "fantasy-town",
    roles: ["prop", "wayfinding"],
  },
]);

const LICENSE_SPDX = "CC0-1.0";
const LICENSE_MATCH = /Creative Commons Zero,?\s*CC0/i;
const COMMERCIAL_MATCH = /commercial/i;
const FANTASY_TEXTURE_RELATIVE_URI = "Textures/colormap.png";

// These are narrow leftovers from earlier whitelist drafts. The route is now
// baked into the procedural terrain, so neither road tiles nor standalone
// ground cards belong in the R01 runtime payload.
// Keep the cleanup explicit and narrow; never recursively delete the output
// directory, since a local developer may keep unrelated inspection files
// beside the imported assets.
const STALE_OUTPUTS = Object.freeze([
  "fantasy-town/fence-gate.glb",
  "fantasy-town/road.glb",
  "fantasy-town/road-bend.glb",
  "nature/ground_grass.glb",
  "nature/ground_pathStraight.glb",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readGlbJson(bytes, label) {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67) {
    throw new Error(`${label}: expected a glTF 2.0 GLB header`);
  }

  const declaredLength = bytes.readUInt32LE(8);
  if (declaredLength !== bytes.length) {
    throw new Error(`${label}: GLB length header does not match file length`);
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > bytes.length) {
      throw new Error(`${label}: GLB chunk exceeds file length`);
    }

    // JSON chunk type is ASCII "JSON" in little-endian byte order.
    if (chunkType === 0x4e4f534a) {
      const jsonText = bytes
        .subarray(chunkStart, chunkEnd)
        .toString("utf8")
        .replace(/\0+$/, "")
        .trim();
      try {
        return JSON.parse(jsonText);
      } catch (error) {
        throw new Error(`${label}: invalid GLB JSON: ${error.message}`);
      }
    }

    offset = chunkEnd;
  }

  throw new Error(`${label}: GLB has no JSON chunk`);
}

function verifyLicense(donorRoot, pack) {
  const licenseRelative = join(pack.folder, "License.txt");
  const licensePath = join(donorRoot, licenseRelative);
  const bytes = readFileSync(licensePath);
  const text = bytes.toString("utf8");
  const actualSha256 = sha256(bytes);

  if (actualSha256 !== pack.licenseSha256) {
    throw new Error(
      `${licenseRelative}: SHA-256 changed; expected ${pack.licenseSha256}, got ${actualSha256}`,
    );
  }
  if (!LICENSE_MATCH.test(text) || !COMMERCIAL_MATCH.test(text)) {
    throw new Error(`${licenseRelative}: CC0/commercial-use text was not verified`);
  }

  return {
    spdx: LICENSE_SPDX,
    file: licenseRelative,
    sha256: actualSha256,
    textCheck: "Creative Commons Zero, CC0 + commercial use",
    commercialUse: true,
  };
}

function copyVerified(sourcePath, targetPath, label) {
  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath);
  const sourceBytes = readFileSync(sourcePath);
  const targetBytes = readFileSync(targetPath);
  const sourceSha256 = sha256(sourceBytes);
  const targetSha256 = sha256(targetBytes);
  if (sourceBytes.length !== targetBytes.length || sourceSha256 !== targetSha256) {
    throw new Error(`${label}: copied bytes do not match the donor`);
  }
  return { bytes: targetBytes.length, sha256: targetSha256 };
}

function writeIfChanged(path, text) {
  let current = null;
  try {
    current = readFileSync(path, "utf8");
  } catch {
    // The manifest is created on the first import.
  }
  if (current !== text) writeFileSync(path, text);
  return current !== text;
}

function resolveDonorRoot(requestedRoot) {
  const candidates = requestedRoot ? [resolve(requestedRoot)] : DEFAULT_DONOR_ROOTS;
  for (const candidate of candidates) {
    if (existsSync(candidate)) return realpathSync(candidate);
  }
  throw new Error(
    `Kenney donor not found at ${candidates.join(" or ")}. ` +
      "Set KENNEY_DONOR_ROOT to the local donor directory.",
  );
}

export function runImport({ donorRoot = process.env.KENNEY_DONOR_ROOT } = {}) {
  const sourceRoot = resolveDonorRoot(donorRoot);
  const licenseByPack = new Map();

  for (const outputRelative of STALE_OUTPUTS) {
    const stalePath = join(OUTPUT_ROOT, outputRelative);
    if (existsSync(stalePath)) unlinkSync(stalePath);
  }

  for (const pack of Object.values(PACKS)) {
    licenseByPack.set(pack.id, verifyLicense(sourceRoot, pack));
  }

  const copiedAssets = [];
  const copiedDependencies = new Map();

  for (const asset of ASSETS) {
    const pack = PACKS[asset.packId];
    if (!pack) throw new Error(`${asset.id}: unknown pack ${asset.packId}`);

    const sourceRelative = join(pack.folder, pack.modelsDirectory, asset.file);
    const sourcePath = join(sourceRoot, sourceRelative);
    if (!existsSync(sourcePath)) {
      throw new Error(`${sourceRelative}: whitelisted donor file is missing`);
    }

    const sourceBytes = readFileSync(sourcePath);
    const sourceJson = readGlbJson(sourceBytes, sourceRelative);
    const imageUris = (sourceJson.images ?? [])
      .map((image) => image.uri)
      .filter((uri) => typeof uri === "string");

    if (pack.id === "fantasy-town-kit") {
      if (!imageUris.includes(FANTASY_TEXTURE_RELATIVE_URI)) {
        throw new Error(
          `${sourceRelative}: expected ${FANTASY_TEXTURE_RELATIVE_URI} in GLB image references`,
        );
      }
      if (!sourceJson.extensionsUsed?.includes("KHR_texture_transform")) {
        throw new Error(`${sourceRelative}: expected KHR_texture_transform`);
      }
    } else if (imageUris.length > 0) {
      throw new Error(`${sourceRelative}: Nature R01 asset unexpectedly has external images`);
    }

    const sourceSha256 = sha256(sourceBytes);
    const outputRelative = join(asset.outputDirectory, asset.file);
    const targetPath = join(OUTPUT_ROOT, outputRelative);
    const copied = copyVerified(sourcePath, targetPath, sourceRelative);
    const license = licenseByPack.get(pack.id);
    const dependencies = [];

    if (pack.id === "fantasy-town-kit") {
      const textureSourceRelative = join(
        pack.folder,
        pack.modelsDirectory,
        FANTASY_TEXTURE_RELATIVE_URI,
      );
      const textureSourcePath = join(sourceRoot, textureSourceRelative);
      if (!existsSync(textureSourcePath)) {
        throw new Error(`${textureSourceRelative}: required texture is missing`);
      }
      const textureOutputRelative = join(asset.outputDirectory, FANTASY_TEXTURE_RELATIVE_URI);
      const textureTargetPath = join(OUTPUT_ROOT, textureOutputRelative);
      let textureRecord = copiedDependencies.get(textureOutputRelative);
      if (!textureRecord) {
        const textureCopied = copyVerified(
          textureSourcePath,
          textureTargetPath,
          textureSourceRelative,
        );
        textureRecord = {
          type: "texture",
          uri: FANTASY_TEXTURE_RELATIVE_URI,
          src: `/kenney/r01/${textureOutputRelative}`,
          bytes: textureCopied.bytes,
          sha256: textureCopied.sha256,
          source: textureSourceRelative,
          pack: pack.id,
          version: pack.version,
          license,
          provenance: {
            sourceRoot: PROVENANCE_SOURCE_ROOT,
            sourceRelative: textureSourceRelative,
            importedBy: "apps/university/scripts/import-kenney-r01.mjs",
            status: "prototype/local donor; PGS donor registered",
          },
        };
        copiedDependencies.set(textureOutputRelative, textureRecord);
      }
      dependencies.push(textureRecord);
    }

    copiedAssets.push({
      type: "model",
      id: asset.id,
      assetId: asset.assetId,
      src: `/kenney/r01/${outputRelative}`,
      bytes: copied.bytes,
      sha256: sourceSha256,
      source: sourceRelative,
      pack: pack.id,
      version: pack.version,
      license,
      roles: asset.roles,
      dependencies: dependencies.map((dependency) => dependency.src),
      provenance: {
        sourceRoot: PROVENANCE_SOURCE_ROOT,
        sourceRelative,
        importedBy: "apps/university/scripts/import-kenney-r01.mjs",
        recipe: "R01-forest-academy",
        status: "prototype/local donor; PGS donor registered",
        notes: asset.notes ?? null,
      },
    });
  }

  const dependencies = [...copiedDependencies.values()];
  const totalBytes = [...copiedAssets, ...dependencies].reduce(
    (sum, asset) => sum + asset.bytes,
    0,
  );
  const manifest = {
    schemaVersion: 1,
    assetSet: "R01-forest-academy",
    status: "prototype/local donor; PGS donor registered",
    sourceRoot: PROVENANCE_SOURCE_ROOT,
    sourceRootHint: "../../../_donors/Kenney or KENNEY_DONOR_ROOT",
    outputRoot: "public/kenney/r01",
    runtimeBasePath: "/kenney/r01",
    selection: {
      naturalBasePackId: "nature-kit",
      accentPackIds: ["fantasy-town-kit"],
      physicalAccentCount: 1,
      rawGlbBudget: 14,
      whitelistPolicy: "explicit filenames only; no donor glob",
    },
    packs: Object.values(PACKS).map((pack) => ({
      id: pack.id,
      folder: pack.folder,
      title: pack.title,
      version: pack.version,
      source: pack.source,
      materialMode: pack.materialMode,
      license: licenseByPack.get(pack.id),
    })),
    assets: copiedAssets,
    dependencies,
    summary: {
      modelCount: copiedAssets.length,
      dependencyCount: dependencies.length,
      totalBytes,
    },
  };

  const manifestChanged = writeIfChanged(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  const modelMegabytes = (
    copiedAssets.reduce((sum, asset) => sum + asset.bytes, 0) /
    1024 /
    1024
  ).toFixed(2);
  const dependencyMegabytes = (
    dependencies.reduce((sum, asset) => sum + asset.bytes, 0) /
    1024 /
    1024
  ).toFixed(2);
  console.log(
    `import-kenney-r01: ${copiedAssets.length} explicit GLBs (${modelMegabytes} MB), ` +
      `${dependencies.length} dependency (${dependencyMegabytes} MB); ` +
      `${manifestChanged ? "manifest written" : "manifest unchanged"}.`,
  );
  console.log(`  → ${OUTPUT_ROOT}`);
  console.log(`  → ${MANIFEST_PATH}`);
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runImport();
}
