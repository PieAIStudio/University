import * as THREE from "three";

/**
 * The resources a GLTF field owns after projecting one source mesh.
 *
 * `geometry` is cloned for the projection. `material` is also a projection
 * clone, although its `map` may still point at a texture owned by the GLTF
 * loader cache.
 */
export interface OwnedPartResources {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

/**
 * Clone geometry for one projection and detach Three's shared userData object.
 *
 * BufferGeometry.clone() copies attributes but aliases `userData` in the
 * Three.js version used here. Projection-only transforms (for example the
 * baked-colour lift in kit.tsx) must be free to annotate their clone without
 * changing the cached useGLTF source.
 */
export function cloneOwnedPartGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = source.clone();
  geometry.userData = { ...source.userData };
  return geometry;
}

/**
 * Release projection-owned resources without touching cached GLTF data.
 *
 * R3F disposes the `InstancedMesh` object but does not recurse into the
 * geometry/material passed through its constructor args. Keep this explicit,
 * and deduplicate each resource kind so a repeated part cannot double-release
 * one owned object. Shared source geometry and texture maps never enter these
 * sets, so they remain available to `useGLTF`'s cache and other projections.
 */
export function disposeOwnedPartResources(parts: readonly OwnedPartResources[]): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const part of parts) {
    geometries.add(part.geometry);
    materials.add(part.material);
  }
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
