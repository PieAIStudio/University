import * as THREE from "three";
import type { AssetMaterialTreatment } from "../kit.js";

/** Restrained craft marks on the existing authored Kenney colormap. These
 * profiles do not replace geometry, donor maps, alpha or material identities.
 * All coordinates are normalized model-local, before each placed instance.
 * Analytic footprint filtering fades marks that cannot occupy a screen pixel.
 */
function facilityTreatment(profile: "roof" | "timber"): AssetMaterialTreatment {
  return (material, normalizedModelMatrix) => {
    if (!(material instanceof THREE.MeshStandardMaterial)) return;
    const uniforms = {
      uFacilityModel: { value: normalizedModelMatrix.clone() },
      uFacilityCraft: { value: 1 },
    };
    material.userData.facilityCraft = {
      profile,
      uniforms,
      source: "University authored analytic finish; donor maps preserved",
    };
    material.customProgramCacheKey = () => `university-facility-craft-v1/${profile}`;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform mat4 uFacilityModel;\nvarying vec3 vFacilityPoint;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvFacilityPoint = (uFacilityModel * vec4(transformed, 1.0)).xyz;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float uFacilityCraft;\nvarying vec3 vFacilityPoint;",
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          ${
            profile === "roof"
              ? `
          // The donated roof contains plaster gables as well as teal panels.
          // Its actual sampled pigment, not mesh names, selects those panels.
          float craftMask = smoothstep(0.018, 0.075, diffuseColor.g - diffuseColor.r)
            * smoothstep(0.0, 0.045, diffuseColor.b - diffuseColor.r);
          float craftAxis = vFacilityPoint.z * 5.0;
          float craftAA = max(fwidth(craftAxis), 0.0001);
          float craftSeam = 1.0 - smoothstep(0.025 - craftAA, 0.055 + craftAA,
            abs(fract(craftAxis + 0.5) - 0.5));
          float craftVisibility = 1.0 - smoothstep(0.12, 0.36, craftAA);
          float craftWear = craftSeam * craftVisibility * craftMask * uFacilityCraft;
          diffuseColor.rgb *= 1.0 + craftWear * 0.28;
          `
              : `
          float craftMask = smoothstep(0.015, 0.11, diffuseColor.r - diffuseColor.g);
          float craftAxis = vFacilityPoint.x * 28.0 + sin(vFacilityPoint.z * 2.7) * 0.4;
          float craftVisibility = 1.0 - smoothstep(0.5, 2.0, fwidth(craftAxis));
          float craftWear = sin(craftAxis) * craftVisibility * craftMask * uFacilityCraft;
          diffuseColor.rgb *= 1.0 + craftWear * 0.035;
          `
          }
        `,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor - abs(craftWear) * ${profile === "roof" ? "0.12" : "0.035"}, 0.5, 1.0);
        `,
        );
    };
  };
}

const roof = facilityTreatment("roof"),
  timber = facilityTreatment("timber");
export function courseFacilityTreatment(key: string): AssetMaterialTreatment | undefined {
  if (/^fantasy-town-kit\/roof(?:-gable)?$/.test(key)) return roof;
  if (/^fantasy-town-kit\/stall(?:-bench)?$/.test(key)) return timber;
  return undefined;
}
