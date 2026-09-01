/**
 * The lit material shared by the course and world hex projections.
 *
 * This module owns the surface response of a hex cell: vertex colours, soil
 * value bands, and the course slope normal. It deliberately does not create
 * lights or decide how the scene is framed; `sky/lighting.tsx` owns that rig.
 * Keeping those decisions apart is what lets a material experiment stay a
 * material experiment.
 */
import * as THREE from "three";

import type { HexMap } from "./course-grid.js";

export type HexLayer = "land" | "route" | "detached";

export function createHexFieldMaterial(
  map: HexMap,
  dimmed: boolean,
  layer: HexLayer,
): THREE.MeshStandardMaterial {
  const usesCourseSurfaceSlope = map.projection === "course" && layer === "land";
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: layer === "route" ? 0.72 : 0.88,
    metalness: 0,
    flatShading: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.gridCliff = { value: new THREE.Color(map.palette.cliff) };
    shader.uniforms.gridShadow = { value: new THREE.Color(map.palette.shadow) };
    shader.uniforms.gridDim = { value: dimmed ? 0.62 : 1 };
    // World cells are read as small floating landforms, so their same soil
    // family catches more of the shared key than a close course cliff. These
    // three values form a vertical wall response; they are not a second brown
    // palette or a post-process exposure lift.
    shader.uniforms.gridSoilTopValue = { value: map.projection === "world" ? 5.4 : 1 };
    shader.uniforms.gridSoilBottomValue = { value: map.projection === "world" ? 3.8 : 1 };
    shader.uniforms.gridSoilShadowValue = { value: map.projection === "world" ? 0.72 : 0.58 };
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      "#include <common>\nattribute float gridFace;\nvarying float vGridFace;\nvarying float vGridDepth;",
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vGridFace = gridFace;
vGridDepth = position.y;
${usesCourseSurfaceSlope ? "transformed.y += dot(transformed.xz, gridSlope);" : ""}`,
    );
    if (usesCourseSurfaceSlope) {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        "#include <common>\nattribute vec2 gridSlope;",
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <beginnormal_vertex>",
        "#include <beginnormal_vertex>\nif (gridFace < 0.5) objectNormal = normalize(vec3(-gridSlope.x, 1.0, -gridSlope.y));",
      );
    }
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nvarying float vGridFace;\nvarying float vGridDepth;\nuniform vec3 gridCliff;\nuniform vec3 gridShadow;\nuniform float gridDim;\nuniform float gridSoilTopValue;\nuniform float gridSoilBottomValue;\nuniform float gridSoilShadowValue;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\nfloat gridSoilDepth = clamp((0.48 - vGridDepth) / 4.4, 0.0, 1.0);\nfloat gridSoilValue = mix(gridSoilTopValue, gridSoilBottomValue, gridSoilDepth);\nvec3 gridSoil = min(mix(gridCliff, gridShadow, gridSoilDepth) * gridSoilValue, vec3(1.0));\nif (vGridFace > 0.5) diffuseColor.rgb = gridSoil;\ndiffuseColor.rgb *= gridDim;",
    );
    // The soil should remain legible at the low-poly camera even when the
    // directional shadow falls between two cells. This is a floor, not an
    // unlit material: the warm key and cool hemisphere still provide the form.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "if (vGridFace > 0.5) outgoingLight = mix(gridSoil * gridSoilShadowValue, outgoingLight, 0.34);\n#include <opaque_fragment>",
    );
  };
  material.customProgramCacheKey = () =>
    `hex-field-${map.palette.cliff}-${map.projection}-${layer}-${usesCourseSurfaceSlope ? "slope" : "flat"}-${dimmed ? "dim" : "full"}`;
  return material;
}
