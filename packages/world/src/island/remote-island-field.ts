/**
 * Shared low-cost continuous remote island view projection.
 *
 * Inherits the exact same IslandBlueprint (silhouette outline, seed, height field,
 * theme identity) as the course view, and reuses buildIslandGeometry's "world"
 * detail tier (640 triangles per island, zero grass, zero centerline route clips,
 * zero lesson nodes/markers).
 *
 * Batches all archipelago / planet islands into a single merged BufferGeometry
 * for 1-draw-call rendering, while tracking per-island face index ranges so that
 * pointer pick, hover, and selection state remain precise.
 *
 * Base geometry is cached as pure Float32Array/Uint16Array/Uint32Array buffers
 * to eliminate procedural terrain resampling on selection, hovering, or lift updates.
 */
import * as THREE from "three";
import type { IslandBlueprint } from "./island-blueprint.js";
import { buildIslandGeometry } from "./island-geometry.js";

export {
  REMOTE_ISLAND_TERRAIN_TRIANGLES,
  REMOTE_TREE_TRIANGLES,
  REMOTE_PAVILION_TRIANGLES,
  REMOTE_PROPS_PER_ISLAND_MIN,
  REMOTE_PROPS_PER_ISLAND_MAX,
  REMOTE_PROPS_MAX_TRIANGLES_PER_ISLAND,
  REMOTE_ISLAND_BUDGET_PER_ISLAND,
} from "./remote-props.js";

export interface RemoteBaseGeometry {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly bounds: THREE.Box3;
  readonly radius: number;
}

let baseGeometryBuildCount = 0;

export function getRemoteBaseGeometryBuildCount(): number {
  return baseGeometryBuildCount;
}

export function resetRemoteBaseGeometryBuildCount(): void {
  baseGeometryBuildCount = 0;
}

// Weak ownership alone cannot bound radius churn while a preview stays open.
// Four learner states plus preview variants fit without a permanent resize log.
const REMOTE_BASE_RADIUS_CACHE_LIMIT = 8;
const baseGeometryCache = new WeakMap<IslandBlueprint, Map<number, RemoteBaseGeometry>>();

export function buildRemoteBaseGeometry(
  blueprint: IslandBlueprint,
  targetRadius?: number,
): RemoteBaseGeometry {
  baseGeometryBuildCount += 1;
  const radius = targetRadius ?? blueprint.bounds.maxHalf;
  const shape = buildIslandGeometry(blueprint, "world", radius);
  const terrain = shape.terrain;

  try {
    const posAttr = terrain.getAttribute("position");
    const colAttr = terrain.getAttribute("color");
    const normAttr = terrain.getAttribute("normal");
    const indexAttr = terrain.getIndex();

    const vertexCount = posAttr ? posAttr.count : 0;
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const bounds = new THREE.Box3();

    for (let v = 0; v < vertexCount; v += 1) {
      const vx = posAttr.getX(v);
      const vy = posAttr.getY(v);
      const vz = posAttr.getZ(v);
      positions[v * 3] = vx;
      positions[v * 3 + 1] = vy;
      positions[v * 3 + 2] = vz;
      bounds.expandByPoint(new THREE.Vector3(vx, vy, vz));

      if (normAttr) {
        normals[v * 3] = normAttr.getX(v);
        normals[v * 3 + 1] = normAttr.getY(v);
        normals[v * 3 + 2] = normAttr.getZ(v);
      } else {
        normals[v * 3] = 0;
        normals[v * 3 + 1] = 1;
        normals[v * 3 + 2] = 0;
      }

      if (colAttr) {
        colors[v * 3] = colAttr.getX(v);
        colors[v * 3 + 1] = colAttr.getY(v);
        colors[v * 3 + 2] = colAttr.getZ(v);
      } else {
        colors[v * 3] = 0.5;
        colors[v * 3 + 1] = 0.7;
        colors[v * 3 + 2] = 0.3;
      }
    }

    if (vertexCount === 0) {
      bounds.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
    }

    let triangleCount = 0;
    let indices: Uint16Array | Uint32Array;

    if (indexAttr && indexAttr.count > 0) {
      triangleCount = Math.floor(indexAttr.count / 3);
      const maxIdx = vertexCount > 0 ? vertexCount - 1 : 0;
      indices =
        maxIdx > 65535 ? new Uint32Array(indexAttr.count) : new Uint16Array(indexAttr.count);
      for (let i = 0; i < indexAttr.count; i += 1) {
        indices[i] = indexAttr.getX(i);
      }
    } else {
      triangleCount = Math.floor(vertexCount / 3);
      const maxIdx = vertexCount > 0 ? vertexCount - 1 : 0;
      indices = maxIdx > 65535 ? new Uint32Array(vertexCount) : new Uint16Array(vertexCount);
      for (let i = 0; i < vertexCount; i += 1) {
        indices[i] = i;
      }
    }

    return {
      positions,
      normals,
      colors,
      indices,
      vertexCount,
      triangleCount,
      bounds,
      radius,
    };
  } finally {
    terrain.dispose();
  }
}

export function getOrCreateRemoteBaseGeometry(
  blueprint: IslandBlueprint,
  radius?: number,
): RemoteBaseGeometry {
  const safeRadius = radius ?? blueprint.bounds.maxHalf;
  let byRadius = baseGeometryCache.get(blueprint);
  if (!byRadius) {
    byRadius = new Map();
    baseGeometryCache.set(blueprint, byRadius);
  }
  let cached = byRadius.get(safeRadius);
  if (!cached) {
    cached = buildRemoteBaseGeometry(blueprint, safeRadius);
  } else {
    byRadius.delete(safeRadius);
  }
  byRadius.set(safeRadius, cached);
  if (byRadius.size > REMOTE_BASE_RADIUS_CACHE_LIMIT) {
    byRadius.delete(byRadius.keys().next().value!);
  }
  return cached;
}

export interface RemoteIslandPlacement {
  readonly id: string;
  readonly blueprint: IslandBlueprint;
  readonly baseGeometry?: RemoteBaseGeometry;
  readonly position: THREE.Vector3;
  readonly scale?: number;
  readonly radius?: number;
  readonly dimmed?: boolean;
  readonly lift?: number;
}

export interface RemoteIslandRange {
  readonly id: string;
  readonly islandIndex: number;
  readonly startTriangle: number;
  readonly triangleCount: number;
  readonly bounds: THREE.Box3;
}

export interface RemoteIslandBatch {
  readonly geometry: THREE.BufferGeometry;
  readonly islandRanges: readonly RemoteIslandRange[];
  readonly islandCount: number;
  readonly triangleCount: number;
  readonly bounds: THREE.Box3;
  islandIndexForFace(faceIndex: number): number | null;
  dispose(): void;
}

export function buildRemoteIslandBatch(
  islands: readonly RemoteIslandPlacement[],
): RemoteIslandBatch {
  const islandRanges: RemoteIslandRange[] = [];
  const allPositions: number[] = [];
  const allColors: number[] = [];
  const allNormals: number[] = [];
  const allIndices: number[] = [];
  const batchBounds = new THREE.Box3();

  let vertexOffset = 0;
  let triangleOffset = 0;

  for (let islandIndex = 0; islandIndex < islands.length; islandIndex += 1) {
    const island = islands[islandIndex]!;
    const {
      blueprint,
      baseGeometry: suppliedBase,
      position,
      scale = 1,
      radius,
      dimmed = false,
      lift = 0,
    } = island;
    const base = suppliedBase ?? getOrCreateRemoteBaseGeometry(blueprint, radius);
    const { positions, normals, colors, indices, vertexCount, triangleCount } = base;

    const islandBounds = new THREE.Box3();
    const dimMultiplier = dimmed ? 0.62 : 1.0;

    const px = position.x;
    const py = position.y + lift;
    const pz = position.z;

    if (vertexCount === 0) {
      islandBounds.set(new THREE.Vector3(px, py, pz), new THREE.Vector3(px, py, pz));
    } else {
      for (let v = 0; v < vertexCount; v += 1) {
        const vx = positions[v * 3]! * scale + px;
        const vy = positions[v * 3 + 1]! * scale + py;
        const vz = positions[v * 3 + 2]! * scale + pz;
        allPositions.push(vx, vy, vz);
        islandBounds.expandByPoint(new THREE.Vector3(vx, vy, vz));

        allColors.push(
          colors[v * 3]! * dimMultiplier,
          colors[v * 3 + 1]! * dimMultiplier,
          colors[v * 3 + 2]! * dimMultiplier,
        );

        allNormals.push(normals[v * 3]!, normals[v * 3 + 1]!, normals[v * 3 + 2]!);
      }
      batchBounds.union(islandBounds);
    }

    const startTriangle = triangleOffset;
    for (let i = 0; i < indices.length; i += 1) {
      allIndices.push(indices[i]! + vertexOffset);
    }

    islandRanges.push({
      id: island.id,
      islandIndex,
      startTriangle,
      triangleCount,
      bounds: islandBounds,
    });

    vertexOffset += vertexCount;
    triangleOffset += triangleCount;
  }

  const geometry = new THREE.BufferGeometry();
  if (allPositions.length > 0) {
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(allPositions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(allColors, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(allNormals, 3));
    const maxIndex = vertexOffset > 0 ? vertexOffset - 1 : 0;
    if (maxIndex > 65535) {
      geometry.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(allIndices), 1));
    } else {
      geometry.setIndex(new THREE.Uint16BufferAttribute(new Uint16Array(allIndices), 1));
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  } else {
    batchBounds.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
  }

  return {
    geometry,
    islandRanges,
    islandCount: islands.length,
    triangleCount: triangleOffset,
    bounds: batchBounds,
    islandIndexForFace(faceIndex: number): number | null {
      if (
        typeof faceIndex !== "number" ||
        !Number.isFinite(faceIndex) ||
        !Number.isInteger(faceIndex) ||
        faceIndex < 0 ||
        islandRanges.length === 0
      ) {
        return null;
      }
      let low = 0;
      let high = islandRanges.length - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const range = islandRanges[mid]!;
        if (faceIndex < range.startTriangle) {
          high = mid - 1;
        } else if (faceIndex >= range.startTriangle + range.triangleCount) {
          low = mid + 1;
        } else {
          return range.islandIndex;
        }
      }
      return null;
    },
    dispose() {
      geometry.dispose();
    },
  };
}
