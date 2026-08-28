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
  });
}

/**
 * Recipe metadata intentionally keeps the complete Kenney catalog. The
 * checked-in runtime only has R01's Nature + Fantasy Town whitelist, so the
 * fallback table is an explicit, reviewable part of that manifest rather than
 * a silent "missing asset" branch in the renderer.
 */
const runtimeFallbacks = kenneyManifest.runtimeFallbacks ?? {};

export function resolveIslandRuntimeAsset(
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

export function islandRuntimeAssetCount(): number {
  return runtimeAssets.size;
}
