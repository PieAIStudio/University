import * as THREE from "three";

/** One colour/material family for globe, catalogue, carrier and course clouds.
 * The continuous bank owns its underside value ramp. Separate dark intersecting
 * belly primitives are no longer needed to manufacture depth.
 */
export const CLOUD_TONES = {
  pearl: 0xfff7ee,
  ivory: 0xe9eef6,
  warm: 0xdccbb8,
  underbelly: 0x8a7464,
} as const;

export const CLOUD_DIMMED_SCALAR = 0.64;

export interface CloudMaterials {
  readonly crown: THREE.MeshStandardMaterial;
  readonly underbelly: THREE.MeshStandardMaterial;
}

/** A single-shell caller allocates only the material it will actually draw. */
export function createCloudMaterial(dimmed = false): THREE.MeshStandardMaterial {
  const color = new THREE.Color(0xffffff);
  if (dimmed) color.multiplyScalar(CLOUD_DIMMED_SCALAR);
  return new THREE.MeshStandardMaterial({
    color,
    vertexColors: true,
    roughness: 0.82,
    metalness: 0,
    // Preserve the existing scattered-light fill; this is not a brightness
    // pass. The silhouette improvement comes from the continuous geometry.
    emissive: 0x6d6a64,
    emissiveIntensity: 0.3,
    transparent: false,
    fog: false,
    depthTest: true,
    depthWrite: false,
  });
}

/** Complementary halves have identical shading at their shared welded rim.
 * Each material has its own lifetime; the pair does not share disposable state.
 */
export function createCloudMaterials(dimmed = false): CloudMaterials {
  return { crown: createCloudMaterial(dimmed), underbelly: createCloudMaterial(dimmed) };
}

/** Depth test behind the opaque scene, without injecting scenery into AO. */
export const CLOUD_RENDER_ORDER = {
  underbelly: 3,
  upper: 4,
} as const;
