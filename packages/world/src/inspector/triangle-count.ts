import { islandRuntimeAssets, type IslandRuntimeAsset } from "../island/island-asset-registry.js";

export function assetKey(asset: Pick<IslandRuntimeAsset, "pack" | "assetId">): string {
  return `${asset.pack}/${asset.assetId}`;
}

/** Count the same glTF primitive indices that the runtime loader will draw. */
export function glbTriangleCount(bytes: ArrayBuffer): number | null {
  if (bytes.byteLength < 20) return null;
  const view = new DataView(bytes);
  if (view.getUint32(0, false) !== 0x676c5446) return null;
  const jsonLength = view.getUint32(12, true);
  const jsonStart = 20;
  const jsonEnd = jsonStart + jsonLength;
  if (jsonEnd > bytes.byteLength) return null;

  let document: {
    readonly accessors?: readonly { readonly count?: number }[];
    readonly meshes?: readonly {
      readonly primitives?: readonly {
        readonly indices?: number;
        readonly attributes?: Readonly<Record<string, number>>;
      }[];
    }[];
  };
  try {
    const json = new TextDecoder().decode(new Uint8Array(bytes, jsonStart, jsonLength));
    document = JSON.parse(json) as typeof document;
  } catch {
    return null;
  }

  let triangles = 0;
  for (const mesh of document.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION;
      const count =
        accessorIndex === undefined ? 0 : (document.accessors?.[accessorIndex]?.count ?? 0);
      triangles += count / 3;
    }
  }
  return Number.isFinite(triangles) ? triangles : null;
}

/**
 * Inspect every registered runtime model once. A broken or unavailable file
 * stays visible as `null` instead of turning the whole recipe panel into a
 * false number.
 */
export async function loadIslandAssetTriangleCounts(
  assets: readonly IslandRuntimeAsset[] = islandRuntimeAssets(),
): Promise<ReadonlyMap<string, number>> {
  const measured = await Promise.all(
    assets.map(async (asset) => {
      try {
        const response = await fetch(asset.src);
        if (!response.ok) return null;
        const triangles = glbTriangleCount(await response.arrayBuffer());
        return triangles === null ? null : ([assetKey(asset), triangles] as const);
      } catch {
        return null;
      }
    }),
  );
  return new Map(measured.filter((entry): entry is readonly [string, number] => entry !== null));
}
