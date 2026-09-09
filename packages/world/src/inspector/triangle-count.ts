import { islandRuntimeAssets, type IslandRuntimeAsset } from "../island/island-asset-registry.js";
import * as THREE from "three";
import type { InspectorModelInfo } from "./types.js";

interface GltfDocument {
  readonly accessors?: readonly {
    readonly count?: number;
    readonly min?: number[];
    readonly max?: number[];
  }[];
  readonly meshes?: readonly {
    readonly primitives?: readonly {
      readonly mode?: number;
      readonly indices?: number;
      readonly attributes?: Readonly<Record<string, number>>;
    }[];
  }[];
  readonly nodes?: readonly {
    readonly mesh?: number;
    readonly matrix?: number[];
    readonly translation?: number[];
    readonly rotation?: number[];
    readonly scale?: number[];
    readonly children?: number[];
  }[];
  readonly scenes?: readonly { readonly nodes?: readonly number[] }[];
  readonly scene?: number;
  readonly materials?: readonly {
    readonly alphaMode?: string;
    readonly pbrMetallicRoughness?: {
      readonly metallicFactor?: number;
      readonly baseColorTexture?: unknown;
      readonly metallicRoughnessTexture?: unknown;
    };
    readonly normalTexture?: unknown;
    readonly emissiveTexture?: unknown;
  }[];
}

function glbDocument(bytes: ArrayBuffer): GltfDocument | null {
  if (bytes.byteLength < 20) return null;
  const view = new DataView(bytes);
  if (
    view.getUint32(0, false) !== 0x676c5446 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(16, true) !== 0x4e4f534a
  )
    return null;
  const length = view.getUint32(12, true);
  if (length > bytes.byteLength - 20) return null;
  try {
    return JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, length))) as GltfDocument;
  } catch {
    return null;
  }
}

/** Original scene bounds include the same node matrices as the GLTF loader. */
export function glbModelInfo(bytes: ArrayBuffer): InspectorModelInfo | null {
  const document = glbDocument(bytes);
  if (!document) return null;
  let triangles = 0;
  let primitives = 0;
  for (const mesh of document.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.mode !== undefined && primitive.mode !== 4) continue;
      const accessor = primitive.indices ?? primitive.attributes?.POSITION;
      triangles += accessor === undefined ? 0 : (document.accessors?.[accessor]?.count ?? 0) / 3;
      primitives += 1;
    }
  }
  const bounds = new THREE.Box3();
  const visited = new Set<number>();
  const visit = (index: number, parent: THREE.Matrix4) => {
    const node = document.nodes?.[index];
    if (!node || visited.has(index)) return;
    visited.add(index);
    const local = node.matrix
      ? new THREE.Matrix4().fromArray(node.matrix)
      : new THREE.Matrix4().compose(
          new THREE.Vector3().fromArray(node.translation ?? [0, 0, 0]),
          new THREE.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
          new THREE.Vector3().fromArray(node.scale ?? [1, 1, 1]),
        );
    const matrix = parent.clone().multiply(local);
    if (node.mesh !== undefined) {
      for (const primitive of document.meshes?.[node.mesh]?.primitives ?? []) {
        const position = document.accessors?.[primitive.attributes?.POSITION ?? -1];
        if (!position?.min || !position.max) continue;
        const part = new THREE.Box3(
          new THREE.Vector3().fromArray(position.min),
          new THREE.Vector3().fromArray(position.max),
        ).applyMatrix4(matrix);
        bounds.union(part);
      }
    }
    for (const child of node.children ?? []) visit(child, matrix);
    visited.delete(index);
  };
  const roots = document.scenes?.[document.scene ?? 0]?.nodes ?? [];
  for (const root of roots) visit(root, new THREE.Matrix4());
  const dimensions = bounds.getSize(new THREE.Vector3()).toArray() as [number, number, number];
  const materials = document.materials ?? [];
  return {
    triangles,
    primitives,
    size: !bounds.isEmpty() && dimensions.every(Number.isFinite) ? dimensions : null,
    transparent: materials.some(
      (material) => material.alphaMode === "BLEND" || material.alphaMode === "MASK",
    ),
    metallic: materials.some(
      (material) => (material.pbrMetallicRoughness?.metallicFactor ?? 1) > 0,
    ),
    hasTexture: materials.some((material) =>
      Boolean(
        material.pbrMetallicRoughness?.baseColorTexture ||
        material.pbrMetallicRoughness?.metallicRoughnessTexture ||
        material.normalTexture ||
        material.emissiveTexture,
      ),
    ),
  };
}

export async function loadIslandAssetModelInfo(
  assets: readonly IslandRuntimeAsset[] = islandRuntimeAssets(),
): Promise<ReadonlyMap<string, InspectorModelInfo>> {
  const records = await Promise.all(
    assets.map(async (asset) => {
      try {
        const response = await fetch(asset.src);
        const model = response.ok ? glbModelInfo(await response.arrayBuffer()) : null;
        return model ? ([assetKey(asset), model] as const) : null;
      } catch {
        return null;
      }
    }),
  );
  return new Map(
    records.filter((entry): entry is readonly [string, InspectorModelInfo] => entry !== null),
  );
}

export function assetKey(asset: Pick<IslandRuntimeAsset, "pack" | "assetId">): string {
  return `${asset.pack}/${asset.assetId}`;
}

/** Count the same glTF primitive indices that the runtime loader will draw. */
export function glbTriangleCount(bytes: ArrayBuffer): number | null {
  return glbModelInfo(bytes)?.triangles ?? null;
}

/**
 * Inspect every registered runtime model once. A broken or unavailable file
 * stays visible as `null` instead of turning the whole recipe panel into a
 * false number.
 */
export async function loadIslandAssetTriangleCounts(
  assets: readonly IslandRuntimeAsset[] = islandRuntimeAssets(),
): Promise<ReadonlyMap<string, number>> {
  const models = await loadIslandAssetModelInfo(assets);
  return new Map([...models].map(([key, model]) => [key, model.triangles]));
}
