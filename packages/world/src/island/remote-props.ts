/**
 * Lightweight remote props pure planning module and shared budget constants.
 *
 * Plans low-cost identity silhouettes (up to 1 pavilion and 4 cone trees,
 * omitting candidates that cannot fit) using canonical blueprint anchors
 * (hero, geometryNodes, zones) without creating a second random terrain or
 * calling course dressing/field192.
 *
 * Ground anchors are derived directly from sampleIslandTerrainTop(blueprint, "world", x, z)
 * matching the worldmesh height at the anchor. A sloping footprint is not flat.
 */
import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import type { IslandBlueprint } from "./island-blueprint.js";
import { sampleIslandTerrainTop } from "./island-geometry.js";
import { hash } from "./random.js";

// Shared exported budget constants (single source of truth for remote budget)
export const REMOTE_ISLAND_TERRAIN_TRIANGLES = 640;
export const REMOTE_TREE_TRIANGLES = 12; // ConeGeometry(0.38, 0.72, 6)
export const REMOTE_PAVILION_ROOF_TRIANGLES = 12; // ConeGeometry(0.52, 0.36, 6)
export const REMOTE_PAVILION_BASE_TRIANGLES = 24; // CylinderGeometry(0.38, 0.44, 0.38, 6)
export const REMOTE_PAVILION_TRIANGLES =
  REMOTE_PAVILION_ROOF_TRIANGLES + REMOTE_PAVILION_BASE_TRIANGLES; // 36
export const REMOTE_PROPS_PER_ISLAND_MIN = 3;
export const REMOTE_PROPS_PER_ISLAND_MAX = 5;
export const REMOTE_PROPS_MAX_TRIANGLES_PER_ISLAND =
  REMOTE_PAVILION_TRIANGLES + 4 * REMOTE_TREE_TRIANGLES; // conservative maximum, not measured
export const REMOTE_ISLAND_BUDGET_PER_ISLAND =
  REMOTE_ISLAND_TERRAIN_TRIANGLES + REMOTE_PROPS_MAX_TRIANGLES_PER_ISLAND; // 724 maximum

export type RemotePropKind = "landmark" | "tree";

export interface RemotePropPlacement {
  readonly kind: RemotePropKind;
  /** World-space position, grounded precisely on the worldmesh */
  readonly position: THREE.Vector3;
  /** World-space scale */
  readonly scale: number;
  /** Rotation around Y axis in radians */
  readonly rotationY: number;
  /** Identifier of the host island */
  readonly islandId: string;
  readonly dimmed: boolean;
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

/**
 * Pure planning function targeting 3-5 lightweight silhouettes for one island.
 * Deterministic and seed-driven; optional props may be omitted when no footprint fits.
 */
export function planRemoteIslandProps({
  blueprint,
  islandPosition,
  islandRadius,
  scale = 1,
  dimmed = false,
  lift = 0,
  islandId,
}: PlanRemoteIslandPropsOptions): readonly RemotePropPlacement[] {
  const terrainScale = islandRadius / Math.max(0.001, blueprint.bounds.maxHalf);
  const count = 3 + Math.floor(hash(`${blueprint.seed}/remote-props-count`) * 3);
  const props: RemotePropPlacement[] = [];
  const occupied: Array<{ x: number; z: number; radius: number }> = [];
  for (let i = 0; i < count; i += 1) {
    const kind = i === 0 ? "landmark" : "tree";
    const nodes = blueprint.geometryNodes;
    const anchor =
      i === 0
        ? blueprint.hero
        : (nodes[Math.floor(((i - 1) * Math.max(0, nodes.length - 1)) / Math.max(1, count - 2))] ??
          blueprint.zones[1]!);
    // Keep distant silhouettes readable as courses grow, within the island footprint.
    const size = islandRadius * (kind === "landmark" ? 0.32 : 0.36);
    const radius = (size * (kind === "landmark" ? 0.52 : 0.38)) / terrainScale;
    // Omit optional silhouettes if bounded inward candidates cannot fit.
    // Never fall back to height zero outside the terrain.
    for (const inward of [1, 0.85, 0.7, 0.55, 0.4, 0.25]) {
      const x = anchor.x * inward,
        z = anchor.z * inward;
      if (occupied.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + radius)) continue;
      const samples = [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].map(([dx, dz]) =>
        sampleIslandTerrainTop(blueprint, "world", x + dx! * radius, z + dz! * radius),
      );
      if (samples.some((s) => !s.inside)) continue;
      props.push({
        kind,
        position: new THREE.Vector3(
          islandPosition.x + x * terrainScale * scale,
          islandPosition.y + lift + samples[0]!.y * terrainScale * scale,
          islandPosition.z + z * terrainScale * scale,
        ),
        scale: size * scale,
        rotationY:
          kind === "landmark"
            ? -blueprint.hero.heading
            : hash(`${blueprint.seed}/tree-${i}`) * Math.PI * 2,
        islandId,
        dimmed,
      });
      occupied.push({ x, z, radius });
      break;
    }
  }
  return props;
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

export interface RemotePropsCataloguePlan {
  readonly landmarks: readonly RemotePropPlacement[];
  readonly trees: readonly RemotePropPlacement[];
  readonly totalProps: number;
  readonly totalTriangles: number;
}

/**
 * Plans remote props for the entire catalogue of islands in one shot.
 */
export function planRemotePropsCatalogue(
  islands: readonly RemoteCatalogueIslandInput[],
): RemotePropsCataloguePlan {
  const landmarks: RemotePropPlacement[] = [];
  const trees: RemotePropPlacement[] = [];

  for (let i = 0; i < islands.length; i += 1) {
    const island = islands[i]!;
    const props = planRemoteIslandProps({
      blueprint: island.blueprint,
      islandPosition: island.position,
      islandRadius: island.radius ?? island.blueprint.bounds.maxHalf,
      lift: island.lift ?? 0,
      scale: island.scale,
      dimmed: island.dimmed,
      islandId: island.id ?? `island-${i}`,
    });
    for (const prop of props) {
      if (prop.kind === "landmark") {
        landmarks.push(prop);
      } else {
        trees.push(prop);
      }
    }
  }

  const totalProps = landmarks.length + trees.length;
  const totalTriangles =
    landmarks.length * REMOTE_PAVILION_TRIANGLES + trees.length * REMOTE_TREE_TRIANGLES;

  return { landmarks, trees, totalProps, totalTriangles };
}

/**
 * Creates low-cost hexagonal cone tree silhouette geometry (12 triangles).
 * Base sits on y = 0.
 */
export function createRemoteTreeGeometry(): THREE.BufferGeometry {
  const canopy = new THREE.ConeGeometry(0.38, 0.72, 6);
  canopy.translate(0, 0.36, 0);
  return canopy;
}

/**
 * Creates low-cost stone pavilion silhouette geometry (36 triangles total:
 * 24 base plinth + 12 roof canopy).
 * Base sits on y = 0.
 */
export function createRemotePavilionGeometry(): THREE.BufferGeometry {
  const plinth = new THREE.CylinderGeometry(0.38, 0.44, 0.38, 6);
  plinth.translate(0, 0.19, 0);

  const roof = new THREE.ConeGeometry(0.52, 0.36, 6);
  roof.translate(0, 0.38 + 0.18, 0);

  const merged = mergeBufferGeometries([plinth, roof]);
  plinth.dispose();
  roof.dispose();
  if (!merged) throw new Error("Remote pavilion attributes must match");
  return merged;
}
