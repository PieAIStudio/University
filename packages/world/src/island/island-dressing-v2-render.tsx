/** Render a semantic dressing plan through the shared instanced GLB adapter. */
import { useMemo } from "react";
import * as THREE from "three";

import { AssetField, type Placement } from "../kit.js";
import manifestJson from "./kenney-r01-assets.json";
import {
  planIslandDressingV2,
  type IslandDressingDetailV2,
  type IslandDressingPlanV2,
} from "./island-dressing-v2.js";
import { islandGeometryV2Scale } from "./island-geometry-v2.js";
import type { IslandBlueprintV2 } from "./island-blueprint-v2.js";

interface RuntimeAsset {
  readonly type: "model";
  readonly assetId: string;
  readonly src: string;
  readonly pack: string;
}

interface RuntimeManifest {
  readonly assetSet: string;
  readonly assets: readonly RuntimeAsset[];
}

const manifest = manifestJson as RuntimeManifest;
const runtimeAssets = new Map<string, RuntimeAsset>(
  manifest.assets.map((asset) => [`${asset.pack}/${asset.assetId}`, asset] as const),
);

export interface IslandDressingFieldV2 {
  readonly key: string;
  readonly pack: string;
  readonly src: string;
  readonly at: readonly Placement[];
}

/**
 * Resolve data before JSX so missing whitelist entries are measurable in a
 * unit test and never become one-off loader logic in the scene.
 */
export function islandDressingFieldsV2(
  plan: IslandDressingPlanV2,
  scale: number,
  heightMultiplier = 1,
): readonly IslandDressingFieldV2[] {
  const grouped = new Map<string, { pack: string; src: string; at: Placement[] }>();
  for (const placement of plan.placements) {
    const key = `${placement.packId}/${placement.assetId}`;
    const asset = runtimeAssets.get(key);
    if (!asset) continue;
    const field = grouped.get(key) ?? { pack: asset.pack, src: asset.src, at: [] };
    field.at.push({
      position: new THREE.Vector3(placement.x * scale, placement.y * scale, placement.z * scale),
      height: placement.height * scale * heightMultiplier,
      turn: placement.turn,
    });
    grouped.set(key, field);
  }
  return [...grouped.entries()].map(([key, field]) => ({ key, ...field }));
}

export function IslandDressingV2({
  blueprint,
  detail,
  targetRadius,
}: {
  readonly blueprint: IslandBlueprintV2;
  readonly detail: IslandDressingDetailV2;
  readonly targetRadius?: number;
}) {
  const plan = useMemo(() => planIslandDressingV2(blueprint, detail), [blueprint, detail]);
  const scale = islandGeometryV2Scale(blueprint, detail, targetRadius);
  // A mathematically faithful world projection turns a tree into a dark
  // three-pixel pin. Slight silhouette exaggeration is the same convention a
  // board-game miniature uses: positions stay identical, only readable height
  // survives the LOD.
  const heightMultiplier = detail === "world" ? 3.2 : 1;
  const fields = useMemo(
    () => islandDressingFieldsV2(plan, scale, heightMultiplier),
    [heightMultiplier, plan, scale],
  );
  return (
    <>
      {fields.map((field) => (
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
      ))}
    </>
  );
}
