import {
  setIslandRuntimeAssetOverrides,
  type IslandAssetPackId,
} from "../island/island-asset-registry.js";

export type PreviewRole = "tree" | "bush" | "rock" | "landmark" | "prop";

export interface PreviewTuningValues {
  readonly keyLightIntensity: number;
  readonly ambientLightIntensity: number;
  readonly grassDensityMultiplier: number;
  readonly grassHeightMultiplier: number;
  readonly terrainBrightness: number;
}

export interface PreviewAssetTarget {
  readonly pack: IslandAssetPackId;
  readonly assetId: string;
}

export interface PreviewRoleOverride {
  readonly role: PreviewRole;
  readonly fromKeys: readonly string[];
  readonly target: PreviewAssetTarget;
}

export interface PreviewSceneMetrics {
  readonly grassInstances: number;
}

/** Install only the current page's in-memory substitutions. Nothing is saved. */
export function applyPreviewAssetOverrides(overrides: readonly PreviewRoleOverride[]): void {
  const mapping: Record<string, PreviewAssetTarget> = {};
  for (const override of overrides) {
    for (const fromKey of override.fromKeys) mapping[fromKey] = override.target;
  }
  setIslandRuntimeAssetOverrides(mapping);
}

export function clearPreviewAssetOverrides(): void {
  setIslandRuntimeAssetOverrides({});
}
