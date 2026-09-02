import * as THREE from "three";

/**
 * How a cloud is lit, in one place.
 *
 * There were two answers to that question. `cloud-sea.tsx` lit the world map's
 * clouds with a `MeshStandardMaterial` pair — a crown that takes the key and a
 * warm underbelly that does not — while `GridCloudLayers.tsx` drew the course
 * island's clouds with an unlit `MeshBasicMaterial`, pure white, semi-
 * transparent, with no underbelly at all.
 *
 * Both build the same 3D body from `createCloudVolumeGeometry`, so the course
 * clouds were never flat *geometry*; they were flat *shading*. Unlit means the
 * warm key and cool fill the rest of the island is lit by land on the clouds as
 * nothing at all, transparency washes out the baked vertex ramp behind the sky
 * colour, and a single tone leaves the body with no dark side. Three separate
 * flattenings, which together made a modelled cloud read as a paper cut-out.
 *
 * So the tones and the material pair live here and both call sites take them.
 * A second cloud material is not an option a caller has any more.
 */

/**
 * Ivory through warm, and one distinctly darker belly.
 *
 * The belly is not grey: a cloud's underside is lit by ground bounce, so it
 * goes warm rather than neutral, and that warmth is what separates it from the
 * cool sky behind it.
 */
export const CLOUD_TONES = {
  pearl: 0xfff7ee,
  ivory: 0xe9eef6,
  warm: 0xdccbb8,
  underbelly: 0x8a7464,
} as const;

/**
 * The multiplier an idle or unfocused island's colours are scaled by. This is
 * the same 0.64 `island-render.tsx` applies to every other dimmed element, so a
 * dimmed cloud recedes by exactly as much as the island under it rather than by
 * a bespoke grey picked to look about right.
 */
export const CLOUD_DIMMED_SCALAR = 0.64;

export interface CloudMaterials {
  /** Takes the key light. The lit silhouette. */
  readonly crown: THREE.MeshStandardMaterial;
  /** Deliberately does not. The dark side that makes the body read as a body. */
  readonly underbelly: THREE.MeshStandardMaterial;
}

function tone(colour: number, dimmed: boolean): THREE.Color {
  const value = new THREE.Color(colour);
  return dimmed ? value.multiplyScalar(CLOUD_DIMMED_SCALAR) : value;
}

/**
 * Both cloud fields' materials.
 *
 * `transparent: false` is load-bearing rather than incidental. A transparent
 * cloud lets the sky gradient through its own value ramp, which is most of why
 * the course clouds had no visible form; opaque bodies with `depthWrite: false`
 * still sort correctly against the island because they render after the opaque
 * scene and `depthTest` rejects the pixels behind it.
 *
 * They stay out of the ambient-occlusion volume for the reason `cloud-sea`
 * found first: decorative lobes overlap by design, and feeding those internal
 * intersections to a screen-space AO pass turns a white sculpture into a solid
 * black cut-out.
 */
export function createCloudMaterials(dimmed = false): CloudMaterials {
  const crown = new THREE.MeshStandardMaterial({
    color: tone(0xffffff, dimmed),
    vertexColors: true,
    roughness: 0.82,
    metalness: 0,
    // A cloud lights itself, and that is physics rather than a cheat: light
    // entering a cloud scatters inside it and leaves in every direction, which
    // is why a real cloud's shaded side stays bright and slightly warm.
    //
    // The rig makes this necessary. The key is 5.4 and everything else — fill,
    // ambient, hemisphere sky — totals 0.81 and is deliberately cool, so any
    // face turned away from the sun sits near fifteen percent brightness in
    // blue light. On terrain that reads as shadow; on a white cloud it read as
    // a navy wedge, and no albedo, tone or vertex-ramp change touched it,
    // because none of them were what was dark.
    emissive: 0x6d6a64,
    emissiveIntensity: 0.3,
    transparent: false,
    fog: false,
    depthTest: true,
    depthWrite: false,
  });
  const underbelly = new THREE.MeshStandardMaterial({
    color: tone(0xffffff, dimmed),
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
    emissive: 0x241c18,
    emissiveIntensity: 0.04,
    transparent: false,
    fog: false,
    depthTest: true,
    depthWrite: false,
  });
  return { crown, underbelly };
}

/**
 * Clouds draw after the opaque scene, belly first.
 *
 * They write no depth, so ordering is what keeps a crown over its own belly;
 * `depthTest` is what keeps both behind the island. The course field used to
 * sit at `renderOrder: -1` — before the opaque pass — which only worked while
 * it was transparent, and is the other half of why it could not be made solid
 * without this change.
 */
export const CLOUD_RENDER_ORDER = {
  underbelly: 3,
  upper: 4,
} as const;
