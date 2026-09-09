import {
  setIslandRuntimeAssetOverrides,
  resolveIslandRuntimeAssetFromRecipe,
  type IslandAssetPackId,
} from "../island/island-asset-registry.js";
import type { InspectorRuntimeMetrics } from "./types.js";
import type { InspectorModelInfo } from "./types.js";

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
  readonly heightScale?: number;
}

export interface PreviewRoleOverride {
  readonly role: PreviewRole;
  readonly fromKeys: readonly string[];
  readonly target: PreviewAssetTarget;
}

export interface PreviewSceneMetrics extends InspectorRuntimeMetrics {
  readonly grassInstances: number;
}

/** A preview cannot silently break a fitted assembly or an effect anchor. */
export function previewReplacementReason(
  override: PreviewRoleOverride,
  models: ReadonlyMap<string, InspectorModelInfo>,
): string | null {
  if (override.role !== "rock") return "成套建筑、树冠骨架与效果锚点需重新生成整组，不能逐件替换。";
  const targetKey = `${override.target.pack}/${override.target.assetId}`;
  const target = resolveIslandRuntimeAssetFromRecipe(override.target.pack, override.target.assetId);
  if (!target || target.usedFallback || target.pack !== "nature-kit")
    return "只允许已登记的自然石头，不把建筑或效果模型当岩石。";
  if (!/^rock[-_]/u.test(target.assetId)) return "目标不是登记的静态自然石头。";
  const geometry = models.get(targetKey);
  if (!geometry?.size || geometry.size[1] <= 0) return "原始尺寸尚未测得，不能验证接地与占地。";
  if (geometry.transparent) return "透明材质不符合静态石头的绘制合同。";
  for (const sourceKey of override.fromKeys) {
    const [pack, assetId] = sourceKey.split("/");
    const source = resolveIslandRuntimeAssetFromRecipe(pack as IslandAssetPackId, assetId ?? "");
    const shape = source ? models.get(`${source.pack}/${source.assetId}`) : undefined;
    if (!shape?.size || shape.size[1] <= 0) return "原资产尺寸缺失。";
    if (
      geometry.hasTexture !== shape.hasTexture ||
      geometry.metallic !== shape.metallic ||
      shape.transparent !== geometry.transparent
    )
      return "材质合同不同，需重新审查纹理、透明与金属工作流。";
    if (previewReplacementScale(sourceKey, targetKey, models) < 0.5)
      return "目标需缩小到原高度一半以下才能容纳，拒绝破坏尺度关系。";
  }
  return null;
}

export function previewReplacementScale(
  sourceKey: string,
  targetKey: string,
  models: ReadonlyMap<string, InspectorModelInfo>,
): number {
  const source = models.get(sourceKey)?.size;
  const target = models.get(targetKey)?.size;
  if (!source || !target || source[1] <= 0 || target[1] <= 0) return 0;
  return Math.min(
    1,
    ...[0, 2].map((axis) => source[axis]! / source[1] / (target[axis]! / target[1])),
  );
}

/** Install only the current page's in-memory substitutions. Nothing is saved. */
export function applyPreviewAssetOverrides(
  overrides: readonly PreviewRoleOverride[],
  models: ReadonlyMap<string, InspectorModelInfo> = new Map(),
): void {
  const mapping: Record<string, PreviewAssetTarget> = {};
  for (const override of overrides) {
    if (previewReplacementReason(override, models) !== null) continue;
    for (const fromKey of override.fromKeys)
      mapping[fromKey] = {
        ...override.target,
        heightScale: previewReplacementScale(
          fromKey,
          `${override.target.pack}/${override.target.assetId}`,
          models,
        ),
      };
  }
  setIslandRuntimeAssetOverrides(mapping);
}

export function clearPreviewAssetOverrides(): void {
  setIslandRuntimeAssetOverrides({});
}
