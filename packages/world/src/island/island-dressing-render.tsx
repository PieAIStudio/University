/** Render a semantic dressing plan through the shared instanced GLB adapter. */
import { useMemo } from "react";
import * as THREE from "three";

import { AssetField, type Placement } from "../kit.js";
import { resolveIslandRuntimeAsset, type IslandAssetPackId } from "./island-asset-registry.js";
import { IslandCardVegetation } from "./island-card-vegetation-render.js";
import {
  planIslandDressing,
  type IslandDressingPlacement,
  type IslandDressingDetail,
  type IslandDressingPlan,
} from "./island-dressing.js";
import { islandGeometryScale } from "./island-geometry.js";
import type { IslandBlueprint } from "./island-blueprint.js";

export interface IslandDressingField {
  readonly key: string;
  readonly pack: IslandAssetPackId;
  readonly src: string;
  readonly at: readonly Placement[];
}

/**
 * Resolve data before JSX so missing whitelist entries are measurable in a
 * unit test and never become one-off loader logic in the scene.
 */
export function islandDressingFields(
  plan: IslandDressingPlan,
  scale: number,
  heightMultiplier = 1,
): readonly IslandDressingField[] {
  const grouped = new Map<string, { pack: IslandAssetPackId; src: string; at: Placement[] }>();
  for (const placement of plan.placements) {
    const resolution = resolveIslandRuntimeAsset(placement.packId, placement.assetId);
    if (!resolution) continue;
    const key = `${resolution.pack}/${resolution.assetId}`;
    const field = grouped.get(key) ?? {
      pack: resolution.pack,
      src: resolution.src,
      at: [],
    };
    field.at.push({
      position: new THREE.Vector3(placement.x * scale, placement.y * scale, placement.z * scale),
      height: placement.height * scale * heightMultiplier,
      turn: placement.turn,
    });
    grouped.set(key, field);
  }
  return [...grouped.entries()].map(([key, field]) => ({ key, ...field }));
}

export function IslandDressing({
  blueprint,
  detail,
  targetRadius,
}: {
  readonly blueprint: IslandBlueprint;
  readonly detail: IslandDressingDetail;
  readonly targetRadius?: number;
}) {
  const plan = useMemo(() => planIslandDressing(blueprint, detail), [blueprint, detail]);
  const scale = islandGeometryScale(blueprint, detail, targetRadius);
  // A mathematically faithful world projection turns a tree into a dark
  // three-pixel pin. Slight silhouette exaggeration is the same convention a
  // board-game miniature uses: positions stay identical, only readable height
  // survives the LOD.
  const heightMultiplier = detail === "world" ? 3.2 : 1;
  const fields = useMemo(
    () => islandDressingFields(plan, scale, heightMultiplier),
    [heightMultiplier, plan, scale],
  );
  const vegetationPlacements = useMemo(
    () =>
      plan.placements.filter(
        (placement): placement is IslandDressingPlacement =>
          placement.kind === "tree" || placement.kind === "bush",
      ),
    [plan],
  );
  const vegetationFieldKeys = useMemo(
    () =>
      new Set(
        vegetationPlacements.flatMap((placement) => {
          const resolution = resolveIslandRuntimeAsset(placement.packId, placement.assetId);
          return resolution ? [`${resolution.pack}/${resolution.assetId}`] : [];
        }),
      ),
    [vegetationPlacements],
  );
  return (
    <>
      <IslandCardVegetation
        placements={vegetationPlacements}
        seed={plan.seed}
        scale={scale}
        heightMultiplier={heightMultiplier}
      />
      {fields.map((field) =>
        vegetationFieldKeys.has(field.key) ? null : (
          <AssetField
            key={field.key}
            src={field.src}
            at={field.at}
            preserveMap={field.pack !== "nature-kit"}
            // Bushes are crossed leaf cards. Their silhouette is useful, but a
            // directional shadow turns those cards into black starbursts across
            // the turf. Trees and architecture still cast the grounding shadow.
            castShadow={detail === "course" && !field.key.endsWith("/plant_bushDetailed")}
          />
        ),
      )}
    </>
  );
}
