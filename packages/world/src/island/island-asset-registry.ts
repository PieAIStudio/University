import donorManifestJson from "./elemental-serenity-assets.json";
import kenneyManifestJson from "./kenney-r01-assets.json";
import type { KenneyPackId } from "./kenney-recipes.js";

export type IslandAssetPackId = KenneyPackId | "elemental-serenity";

interface RuntimeManifestAsset {
  readonly type: "model";
  readonly assetId: string;
  readonly src: string;
  readonly pack: IslandAssetPackId;
  readonly bytes?: number;
  readonly source?: string;
}

interface RuntimeFallback {
  readonly pack: IslandAssetPackId;
  readonly assetId: string;
  readonly reason: string;
}

interface KenneyRuntimeManifest {
  readonly assets: readonly RuntimeManifestAsset[];
  readonly runtimeFallbacks?: Readonly<Record<string, RuntimeFallback>>;
}

interface DonorRuntimeManifest {
  readonly assets: readonly RuntimeManifestAsset[];
}

export interface IslandRuntimeAsset {
  readonly pack: IslandAssetPackId;
  readonly assetId: string;
  readonly src: string;
  readonly bytes?: number;
  /** The donor-relative file recorded by the checked-in manifest. */
  readonly source?: string;
}

export interface IslandRuntimeAssetResolution extends IslandRuntimeAsset {
  readonly requestedPack: IslandAssetPackId;
  readonly requestedAssetId: string;
  readonly usedFallback: boolean;
  readonly fallbackReason?: string;
}

const kenneyManifest = kenneyManifestJson as KenneyRuntimeManifest;
const donorManifest = donorManifestJson as DonorRuntimeManifest;

const runtimeAssets = new Map<string, IslandRuntimeAsset>();
for (const asset of [...kenneyManifest.assets, ...donorManifest.assets]) {
  if (asset.type !== "model") continue;
  runtimeAssets.set(`${asset.pack}/${asset.assetId}`, {
    pack: asset.pack,
    assetId: asset.assetId,
    src: asset.src,
    bytes: asset.bytes,
    source: asset.source,
  });
}

/**
 * Authoring-only, in-memory model substitutions.
 *
 * The map is intentionally keyed by the requested placement rather than by a
 * semantic role. `island-dressing` is the source of truth for whether a
 * placement is a tree, bush, rock, landmark or prop; the inspector resolves
 * those placements into exact keys before installing an override. This keeps
 * the renderer's existing grouping and instancing path unchanged.
 */
const runtimeOverrides = new Map<string, IslandRuntimeAsset>();

export function setIslandRuntimeAssetOverrides(
  overrides: Readonly<Record<string, Pick<IslandRuntimeAsset, "pack" | "assetId">>>,
): void {
  runtimeOverrides.clear();
  for (const [requestedKey, target] of Object.entries(overrides)) {
    const resolved = runtimeAssets.get(`${target.pack}/${target.assetId}`);
    if (resolved) runtimeOverrides.set(requestedKey, resolved);
  }
}

export function clearIslandRuntimeAssetOverrides(): void {
  runtimeOverrides.clear();
}

export function islandRuntimeAssetOverrideCount(): number {
  return runtimeOverrides.size;
}

/** The complete runtime catalog, in manifest order, for authoring pickers. */
export function islandRuntimeAssets(): readonly IslandRuntimeAsset[] {
  return [...runtimeAssets.values()];
}

/**
 * Recipe metadata intentionally keeps the complete Kenney catalog. The
 * checked-in runtime only has R01's Nature + Fantasy Town whitelist, so the
 * fallback table is an explicit, reviewable part of that manifest rather than
 * a silent "missing asset" branch in the renderer.
 */
const runtimeFallbacks = kenneyManifest.runtimeFallbacks ?? {};

function resolveIslandRuntimeAssetFromCatalog(
  requestedPack: IslandAssetPackId,
  requestedAssetId: string,
): IslandRuntimeAssetResolution | null {
  const requestedKey = `${requestedPack}/${requestedAssetId}`;
  const exact = runtimeAssets.get(requestedKey);
  if (exact) {
    return {
      ...exact,
      requestedPack,
      requestedAssetId,
      usedFallback: false,
    };
  }

  const fallback = runtimeFallbacks[requestedKey];
  if (!fallback) return null;

  const fallbackAsset = runtimeAssets.get(`${fallback.pack}/${fallback.assetId}`);
  if (!fallbackAsset) return null;

  return {
    ...fallbackAsset,
    requestedPack,
    requestedAssetId,
    usedFallback: true,
    fallbackReason: fallback.reason,
  };
}

/** Resolve the checked-in recipe without applying an authoring preview swap. */
export function resolveIslandRuntimeAssetFromRecipe(
  requestedPack: IslandAssetPackId,
  requestedAssetId: string,
): IslandRuntimeAssetResolution | null {
  return resolveIslandRuntimeAssetFromCatalog(requestedPack, requestedAssetId);
}

/** Resolve a placement for the live renderer, including authoring overrides. */
export function resolveIslandRuntimeAsset(
  requestedPack: IslandAssetPackId,
  requestedAssetId: string,
): IslandRuntimeAssetResolution | null {
  const requestedKey = `${requestedPack}/${requestedAssetId}`;
  const override = runtimeOverrides.get(requestedKey);
  if (!override) return resolveIslandRuntimeAssetFromCatalog(requestedPack, requestedAssetId);
  return {
    ...override,
    requestedPack,
    requestedAssetId,
    usedFallback: false,
  };
}

export function islandRuntimeAssetCount(): number {
  return runtimeAssets.size;
}
