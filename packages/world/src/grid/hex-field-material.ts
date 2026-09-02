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

import { hash } from "../island/random.js";
import type { HexMap } from "./course-grid.js";
import { GRID_ROUTE_BEVEL_ALBEDO } from "./grid-palette.js";

export type HexLayer = "land" | "route" | "detached";

export function createHexFieldMaterial(
  map: HexMap,
  dimmed: boolean,
  layer: HexLayer,
): THREE.MeshStandardMaterial {
  const usesCourseSurfaceSlope = map.projection === "course" && layer === "land";
  const seamStrength =
    layer === "route"
      ? map.seamStrength.route
      : layer === "detached"
        ? map.seamStrength.detached
        : map.seamStrength.land;
  // Course land uses the seam-safe bevel profile from HexField: its outer edge
  // is exactly the ideal hex radius, even though the shared land seam remains
  // a small overlap for the flat/remote projection. Keep the shader's edge
  // measure on that same radius or the rim would stop at the wrong place.
  const gridEdgeRadius = usesCourseSurfaceSlope ? 1 : 1 - seamStrength;
  const gridRimStrength = layer === "route" ? 0.18 : layer === "detached" ? 0.34 : 0.32;
  const gridBevelLift = layer === "land" ? 1.025 : 1.08;
  const gridBevelTint =
    layer === "route" ? new THREE.Color(GRID_ROUTE_BEVEL_ALBEDO) : new THREE.Color(0xffffff);
  const gridBevelTintStrength = layer === "route" ? 0.68 : 0;
  const gridSeamAoStrength = layer === "land" ? 0.15 : layer === "route" ? 0.1 : 0.12;
  const gridGroundStrength = layer === "route" ? 0 : layer === "detached" ? 0.42 : 0.54;
  const gridGroundFrequency = map.projection === "world" ? 0.08 : 0.13;
  const gridGroundPhase = hash(`${map.seed}/ground-colour-phase`) * 6.2831853;
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
    shader.uniforms.gridSoilShadowValue = { value: map.projection === "world" ? 0.72 : 0.78 };
    shader.uniforms.gridEdgeRadius = { value: gridEdgeRadius };
    shader.uniforms.gridRim = { value: new THREE.Color(map.palette.rim) };
    shader.uniforms.gridRimStrength = { value: gridRimStrength };
    shader.uniforms.gridGroundFrequency = { value: gridGroundFrequency };
    shader.uniforms.gridGroundPhase = { value: gridGroundPhase };
    shader.uniforms.gridGroundStrength = { value: gridGroundStrength };
    shader.uniforms.gridBevelLift = { value: gridBevelLift };
    shader.uniforms.gridBevelTint = { value: gridBevelTint };
    shader.uniforms.gridBevelTintStrength = { value: gridBevelTintStrength };
    shader.uniforms.gridSeamAoStrength = { value: gridSeamAoStrength };
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      "#include <common>\nattribute float gridFace;\nattribute float gridRim;\nvarying float vGridFace;\nvarying float vGridDepth;\nvarying float vGridEdge;\nvarying float vGridRim;\nvarying vec3 vGridWorldPosition;\nuniform float gridEdgeRadius;",
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vGridFace = gridFace;
vGridDepth = position.y;
vGridEdge = clamp(length(position.xz) / max(gridEdgeRadius, 0.001), 0.0, 1.0);
vGridRim = gridRim;
${usesCourseSurfaceSlope ? "transformed.y += dot(transformed.xz, gridSlope);" : ""}`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      "#include <worldpos_vertex>\nvGridWorldPosition = worldPosition.xyz;",
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
      "#include <common>\nvarying float vGridFace;\nvarying float vGridDepth;\nvarying float vGridEdge;\nvarying float vGridRim;\nvarying vec3 vGridWorldPosition;\nuniform vec3 gridCliff;\nuniform vec3 gridShadow;\nuniform vec3 gridRim;\nuniform float gridDim;\nuniform float gridSoilTopValue;\nuniform float gridSoilBottomValue;\nuniform float gridSoilShadowValue;\nuniform float gridRimStrength;\nuniform float gridGroundFrequency;\nuniform float gridGroundPhase;\nuniform float gridGroundStrength;\nuniform float gridBevelLift;\nuniform vec3 gridBevelTint;\nuniform float gridBevelTintStrength;\nuniform float gridSeamAoStrength;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\nfloat gridGroundWave = sin(vGridWorldPosition.x * gridGroundFrequency + sin(vGridWorldPosition.z * gridGroundFrequency * 0.73 + gridGroundPhase) * 1.7 + gridGroundPhase * 0.4);\nfloat gridGroundMix = smoothstep(-0.82, 0.82, gridGroundWave);\nvec3 gridGroundTone = mix(vec3(0.92, 0.97, 1.02), vec3(1.08, 1.04, 0.90), gridGroundMix * 0.32);\nif (vGridFace < 0.5) diffuseColor.rgb *= mix(vec3(1.0), gridGroundTone, gridGroundStrength);\nfloat gridSoilDepth = clamp((0.48 - vGridDepth) / 4.4, 0.0, 1.0);\nfloat gridSoilValue = mix(gridSoilTopValue, gridSoilBottomValue, gridSoilDepth);\nvec3 gridSoil = min(mix(gridCliff, gridShadow, gridSoilDepth) * gridSoilValue, vec3(1.0));\nfloat gridStrataPhase = fract(gridSoilDepth * 2.4);\nfloat gridStrataBand = 1.0 - smoothstep(0.025, 0.115, abs(gridStrataPhase - 0.52));\ngridSoil *= mix(vec3(0.94, 0.97, 1.02), vec3(1.24, 1.10, 0.86), gridStrataBand * 0.42);\nfloat gridOuterEdge = smoothstep(0.72, 0.98, vGridEdge);\nfloat gridSeamAo = smoothstep(0.86, 0.99, vGridEdge) * gridSeamAoStrength;\nif (vGridFace > 1.5) {\n  diffuseColor.rgb *= vec3(gridBevelLift, gridBevelLift * 0.98, gridBevelLift * 0.9);\n  diffuseColor.rgb *= 1.0 - gridSeamAo * 0.26;\n  if (vGridRim > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, gridRim, gridRimStrength * 0.52);\n} else if (vGridFace > 0.5) {\n  diffuseColor.rgb = gridSoil;\n} else {\n  if (vGridRim > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, gridRim, gridOuterEdge * gridRimStrength);\n  diffuseColor.rgb *= 1.0 - gridSeamAo * 0.18;\n}\ndiffuseColor.rgb *= gridDim;",
    );
    // The route's cream top is shared with the map palette. Only its steep
    // bevel gets the warm edge tint, so cool fill cannot turn that band navy.
    shader.fragmentShader = shader.fragmentShader.replace(
      "diffuseColor.rgb *= vec3(gridBevelLift, gridBevelLift * 0.98, gridBevelLift * 0.9);",
      "diffuseColor.rgb *= vec3(gridBevelLift, gridBevelLift * 0.98, gridBevelLift * 0.9);\ndiffuseColor.rgb = mix(diffuseColor.rgb, gridBevelTint, gridBevelTintStrength);",
    );
    // The soil should remain legible at the low-poly camera even when the
    // directional shadow falls between two cells. This is a floor, not an
    // unlit material: the warm key and cool hemisphere still provide the form.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "if (vGridFace > 0.5 && vGridFace < 1.5) outgoingLight = mix(gridSoil * gridSoilShadowValue, outgoingLight, 0.34);\n#include <opaque_fragment>",
    );
  };
  material.customProgramCacheKey = () =>
    `hex-field-${map.palette.cliff}-${map.projection}-${layer}-${usesCourseSurfaceSlope ? "slope" : "flat"}-${dimmed ? "dim" : "full"}`;
  return material;
}
