import * as THREE from "three";

/** Slice-local art study, not a second grade or a published material library.
 * Per-light forward scattering is an approximation, using authored role depth.
 * It is NOT a measured thickness map or a full subsurface transport solution.
 * Reference inspected: Three r185 SubsurfaceScatteringShader (not copied).
 * Promotion boundary: ADR-0008, Owner-authorized wax slice.
 */
export type WaxRole =
  | "terrain"
  | "plant"
  | "stone"
  | "prop"
  | "avatar"
  | "thin"
  | "detail"
  | "water";
export type WaxSurface = THREE.MeshStandardMaterial;
export const WAX_ROLES = {
  terrain: { roughness: 0.9, scatter: 0.13, depth: 2.8, scale: 0.7 },
  plant: { roughness: 0.86, scatter: 0.72, depth: 0.8, scale: 2.2 },
  stone: { roughness: 0.86, scatter: 0.25, depth: 2.0, scale: 1.4 },
  prop: { roughness: 0.8, scatter: 0.34, depth: 1.4, scale: 2.0 },
  avatar: { roughness: 0.86, scatter: 0.82, depth: 0.65, scale: 3.4 },
  thin: { roughness: 0.84, scatter: 0.95, depth: 0.18, scale: 3.4 },
  detail: { roughness: 0.52, scatter: 0.04, depth: 2.8, scale: 3.4 },
  water: { roughness: 0.65, scatter: 0.22, depth: 1.5, scale: 0.6 },
} as const;
export const WAX_PROGRAM = "university-wax-slice-v1";

export function isWaxSurface(material: THREE.Material): material is WaxSurface {
  return (
    Boolean((material as WaxSurface).isMeshStandardMaterial) &&
    material.visible &&
    material.colorWrite
  );
}
export function waxRole(name: string, inherited: WaxRole): WaxRole {
  if (name === "university-avatar-occlusion-target") return "avatar";
  if (inherited === "avatar" && /ear|wing/i.test(name)) return "thin";
  if (inherited === "avatar" && /eye|pupil|mouth|teeth/i.test(name)) return "detail";
  if (inherited === "avatar" || inherited === "thin" || inherited === "detail") return inherited;
  if (/terrain/.test(name)) return "terrain";
  if (/tree|crown|bush|flora|grass|plant/.test(name)) return "plant";
  if (/stone|rock|cliff/.test(name)) return "stone";
  if (/water|spring/.test(name)) return "water";
  return inherited;
}

const declarations = /* glsl */ `
uniform float uWaxStrength;
uniform float uWaxRoughness;
uniform float uWaxScatter;
uniform float uWaxDepth;
uniform float uWaxScale;
uniform float uWaxScatteringEnabled;
varying vec3 vWaxPoint;
float waxPigment(vec3 p) {
  return sin(p.x * 1.7 + sin(p.z * 1.4)) * sin(p.y * 1.2 + p.z * 0.9);
}
vec3 waxScattering(vec3 lightColor, vec3 lightDirection, vec3 N, vec3 V, vec3 pigment) {
  vec3 halfDirection = normalize(lightDirection + N * 0.35);
  float forwardAmount = pow(max(dot(V, -halfDirection), 0.0), 3.0);
  float backAmount = 1.0 - smoothstep(-0.75, 0.15, dot(N, lightDirection));
  vec3 tint = mix(pigment, sqrt(max(pigment, vec3(0.0))), 0.22);
  float dotNL = dot(N, lightDirection);
  float wrap = max(0.0, (dotNL + 0.5) / 1.5) - max(0.0, dotNL);
  float lobe = backAmount * (0.22 + forwardAmount * 1.4) + max(0.0, wrap) * 0.75;
  return lightColor * tint * uWaxStrength * uWaxScatteringEnabled * uWaxScatter * exp(-uWaxDepth * 0.8)
    * lobe * RECIPROCAL_PI;
}
`;
const directCall =
  "RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );";

/** Copies borrowed material state without serializing live userData graphs. */
export function createWaxSurface(source: WaxSurface, role: WaxRole) {
  const view = Object.create(source) as WaxSurface;
  view.userData = {};
  const physical = Boolean((source as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial);
  const material = physical
    ? new THREE.MeshPhysicalMaterial().copy(view as THREE.MeshPhysicalMaterial)
    : new THREE.MeshStandardMaterial().copy(view);
  const profile = WAX_ROLES[role];
  const uniforms = {
    uWaxStrength: { value: 1 },
    uWaxScatteringEnabled: { value: 1 },
    uWaxRoughness: { value: profile.roughness as number },
    uWaxScatter: { value: profile.scatter as number },
    uWaxDepth: { value: profile.depth as number },
    uWaxScale: { value: profile.scale as number },
  };
  material.name = `${source.name || source.type}/matte-colored-wax`;
  // Keep the source response as the blend's starting point. The shader moves
  // it toward the wax profile with uWaxStrength; pre-setting it to the target
  // would make the strength slider unable to relax a glossy source surface.
  material.metalness = source.metalness;
  material.roughness = source.roughness;
  material.flatShading = false;
  if (physical) {
    const p = material as THREE.MeshPhysicalMaterial;
    p.clearcoat = 0;
    p.transmission = 0;
    p.iridescence = 0;
    p.sheen = 0;
    p.anisotropy = 0;
    p.specularIntensity = role === "detail" ? 0.65 : 0.38;
  }
  material.userData = { ...source.userData, waxSlice: { source: source.uuid, role, uniforms } };
  const sourceKey = source.customProgramCacheKey();
  material.customProgramCacheKey = () => `${sourceKey}/${WAX_PROGRAM}/${role}`;
  material.onBeforeCompile = (shader, renderer) => {
    source.onBeforeCompile.call(material, shader, renderer);
    const anchors = [
      "#include <common>",
      "#include <normal_fragment_maps>",
      "#include <lights_physical_fragment>",
      "#include <lights_fragment_begin>",
    ];
    if (
      !anchors.every((a) => shader.fragmentShader.includes(a)) ||
      !["#include <common>", "#include <begin_vertex>"].every((a) =>
        shader.vertexShader.includes(a),
      ) ||
      !THREE.ShaderChunk.lights_fragment_begin.includes(directCall)
    )
      throw new Error("Wax slice requires the pinned Three Standard/Physical lighting chunks");
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWaxPoint;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWaxPoint = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${declarations}`)
      .replace(
        "#include <lights_physical_fragment>",
        /* glsl */ `
        // Keep the source pigment and role colors; a wax body is not white paint.
        float waxGrain = waxPigment(vWaxPoint * uWaxScale);
        float waxFootprint = max(length(dFdx(vWaxPoint)), length(dFdy(vWaxPoint))) * uWaxScale;
        float waxDetail = 1.0 - smoothstep(0.08, 0.45, waxFootprint);
        diffuseColor.rgb *= 1.0 + waxGrain * 0.025 * waxDetail * uWaxStrength;
        roughnessFactor = mix(roughnessFactor, clamp(uWaxRoughness + waxGrain * 0.025, 0.5, 0.96), uWaxStrength);
        metalnessFactor *= 1.0 - uWaxStrength;
        // Smooth the old rock/wood relief. This doesn't move a vertex or alter a hit surface.
        normal = normalize(mix(normal, nonPerturbedNormal, uWaxStrength * 0.88));
        #include <lights_physical_fragment>
      `,
      )
      .replace(
        "#include <lights_fragment_begin>",
        THREE.ShaderChunk.lights_fragment_begin.replaceAll(
          directCall,
          /* glsl */ `
        ${directCall}
        // Shadowed light color, not an emissive edge; a function stays safe when Three unrolls lights.
        reflectedLight.directDiffuse += waxScattering(directLight.color, directLight.direction,
          geometryNormal, geometryViewDir, material.diffuseColor);
      `,
        ),
      );
  };
  material.onBeforeRender = source.onBeforeRender;
  return { material, uniforms };
}
