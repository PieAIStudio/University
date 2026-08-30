/** Render a semantic dressing plan through the shared instanced GLB adapter. */
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import { AssetField, type Placement } from "../kit.js";
import { buildCourseGrid, type HexMap } from "../grid/course-grid.js";
import { PropField } from "../grid/PropField.js";
import { resolveIslandRuntimeAsset, type IslandAssetPackId } from "./island-asset-registry.js";
import { IslandFoliage, isIslandFoliagePlacement } from "./island-foliage-render.js";
import {
  planIslandDressing,
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
    if (isIslandFoliagePlacement(placement)) continue;
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
  grid,
}: {
  readonly blueprint: IslandBlueprint;
  readonly detail: IslandDressingDetail;
  readonly targetRadius?: number;
  readonly grid?: HexMap;
}) {
  const courseMap = useMemo(() => {
    if (detail !== "course") return null;
    if (grid) return grid;
    return buildCourseGrid({
      studyId: blueprint.studyId,
      courseId: blueprint.courseId,
      seed: blueprint.seed,
      routeArchetype: blueprint.route.archetype,
      routeAnchors: blueprint.geometryNodes,
      lessons: blueprint.nodes.map((node) => ({
        lessonId: node.id,
        unitId: node.unitId,
        unitIndex: node.unitIndex,
        state: "idle" as const,
      })),
    });
  }, [blueprint, detail, grid]);
  const [visibleCourseMap, setVisibleCourseMap] = useState<HexMap | null>(null);
  useEffect(() => {
    if (detail !== "course" || courseMap === null) return;
    setVisibleCourseMap(null);
    // Let the grid, markers and camera commit one frame before GLB parsing and
    // GPU resource cloning begin. The props still arrive immediately after
    // entry, but they cannot hide the first useful map frame behind Suspense.
    let secondFrame: number | undefined;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setVisibleCourseMap(courseMap));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
    };
  }, [courseMap, detail]);
  const plan = useMemo(
    () => (detail === "course" ? null : planIslandDressing(blueprint, detail)),
    [blueprint, detail],
  );
  const scale = islandGeometryScale(blueprint, detail, targetRadius);
  // A mathematically faithful world projection turns a tree into a dark
  // three-pixel pin. Slight silhouette exaggeration is the same convention a
  // board-game miniature uses: positions stay identical, only readable height
  // survives the LOD.
  const heightMultiplier = detail === "world" ? 3.2 : 1;
  const fields = useMemo(
    () => (plan ? islandDressingFields(plan, scale, heightMultiplier) : []),
    [heightMultiplier, plan, scale],
  );
  if (detail === "course" && courseMap) {
    return (
      <group name="hex-grid-dressing">
        {visibleCourseMap === courseMap ? <PropField map={courseMap} /> : null}
      </group>
    );
  }
  if (!plan) return null;
  return (
    <>
      {fields.map((field) => (
        <AssetField
          key={field.key}
          src={field.src}
          at={field.at}
          preserveMap={field.pack !== "nature-kit"}
          // The world projection is a silhouette/value read at roughly 40px
          // per island. Its props do not need a second shadow-map pass.
          castShadow={detail === "course"}
        />
      ))}
      <IslandFoliage
        plan={plan}
        detail={detail}
        scale={scale}
        heightMultiplier={heightMultiplier}
      />
    </>
  );
}
