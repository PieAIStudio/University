/** The sole remote scenery plan, shared by rendering and the inspector. */
import * as THREE from "three";
import type { IslandBlueprint } from "./island-blueprint.js";
import { miniatureLayoutFor, miniatureMetrics, type MiniaturePool } from "./miniature-layout.js";
import { createMiniatureAsset, type MiniatureAssetKind } from "./miniature-assets.js";

/** Worst-case closed geology, including adaptive splits at concave bays. */
export const REMOTE_ISLAND_TERRAIN_TRIANGLES = 1600;
export const REMOTE_PROPS_PER_ISLAND_MIN = 3;
export const REMOTE_PROPS_PER_ISLAND_MAX = 26;
export const REMOTE_TREE_MAX_PER_ISLAND = 5;
/** Opaque kit, water, bank and contact geometry together; not a whole frame. */
export const REMOTE_PROPS_MAX_TRIANGLES_PER_ISLAND = 6000;
export const REMOTE_ISLAND_BUDGET_PER_ISLAND =
  REMOTE_ISLAND_TERRAIN_TRIANGLES + REMOTE_PROPS_MAX_TRIANGLES_PER_ISLAND;
// Canonical sample asset counts, NOT an estimate for mixed miniature variants.
export const REMOTE_TREE_TRIANGLES = 292;
export const REMOTE_PAVILION_TRIANGLES = 160;

export type RemotePropKind = "landmark" | "tree" | "accent";
export interface RemotePropPlacement {
  readonly kind: RemotePropKind;
  readonly asset: MiniatureAssetKind;
  readonly position: THREE.Vector3;
  readonly scale: number;
  readonly rotationY: number;
  readonly islandId: string;
  readonly dimmed: boolean;
  readonly triangles: number;
}
export interface PlanRemoteIslandPropsOptions {
  readonly blueprint: IslandBlueprint;
  readonly islandPosition: THREE.Vector3;
  readonly islandRadius: number;
  readonly scale?: number;
  readonly dimmed?: boolean;
  readonly lift?: number;
  readonly islandId: string;
}

export function planRemoteIslandProps({
  blueprint,
  islandPosition,
  islandRadius,
  scale = 1,
  dimmed = false,
  lift = 0,
  islandId,
}: PlanRemoteIslandPropsOptions): readonly RemotePropPlacement[] {
  const radius = islandRadius * scale;
  return miniatureLayoutFor(blueprint).props.map((prop) => ({
    kind: prop.role,
    asset: prop.asset,
    position: new THREE.Vector3(
      islandPosition.x + prop.x * radius,
      islandPosition.y + lift + prop.y * radius,
      islandPosition.z + prop.z * radius,
    ),
    scale: prop.size * radius,
    rotationY: prop.turn,
    islandId,
    dimmed,
    triangles: miniatureMetrics(prop.asset).triangles,
  }));
}

export interface RemoteCatalogueIslandInput {
  readonly id?: string;
  readonly blueprint: IslandBlueprint;
  readonly position: THREE.Vector3;
  readonly radius?: number;
  readonly scale?: number;
  readonly dimmed?: boolean;
  readonly lift?: number;
}
export interface RemoteWaterPlacement {
  readonly island: RemoteCatalogueIslandInput;
  readonly pool: MiniaturePool;
}
export interface RemotePropsCataloguePlan {
  readonly landmarks: readonly RemotePropPlacement[];
  readonly trees: readonly RemotePropPlacement[];
  readonly accents: readonly RemotePropPlacement[];
  readonly water: readonly RemoteWaterPlacement[];
  readonly totalProps: number;
  /** Actual opaque kit geometry; water/contact are counted by the submitted batch. */
  readonly totalTriangles: number;
}

export function planRemotePropsCatalogue(
  islands: readonly RemoteCatalogueIslandInput[],
): RemotePropsCataloguePlan {
  const landmarks: RemotePropPlacement[] = [],
    trees: RemotePropPlacement[] = [],
    accents: RemotePropPlacement[] = [];
  const water: RemoteWaterPlacement[] = [];
  for (const [i, island] of islands.entries()) {
    const props = planRemoteIslandProps({
      blueprint: island.blueprint,
      islandPosition: island.position,
      islandRadius: island.radius ?? island.blueprint.bounds.maxHalf,
      lift: island.lift,
      scale: island.scale,
      dimmed: island.dimmed,
      islandId: island.id ?? `island-${i}`,
    });
    for (const prop of props)
      (prop.kind === "tree" ? trees : prop.kind === "landmark" ? landmarks : accents).push(prop);
    const pool = miniatureLayoutFor(island.blueprint).pool;
    if (pool) water.push({ island, pool });
  }
  const all = [...landmarks, ...trees, ...accents];
  return {
    landmarks,
    trees,
    accents,
    water,
    totalProps: all.length,
    totalTriangles: all.reduce((total, prop) => total + prop.triangles, 0),
  };
}

// Public sample-geometry helpers delegate to the one kit, not a retained R43 renderer.
export function createRemoteTreeGeometry(): THREE.BufferGeometry {
  return createMiniatureAsset("broadleaf");
}
export function createRemotePavilionGeometry(): THREE.BufferGeometry {
  return createMiniatureAsset("gate");
}
