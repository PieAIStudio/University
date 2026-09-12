import * as THREE from "three";

/** The existing surface texture's alpha is a land mask, not transparency.
 * One opaque draw; no extra texture, water mesh, light or post-processing pass.
 */
export function createGlobeMaterial(texture: THREE.Texture | null, time: { value: number }) {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    vertexColors: texture === null,
    roughness: 0.95,
    metalness: 0,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlobeTime = time;
    shader.vertexShader = `varying vec3 vGlobeSurface;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvGlobeSurface = position;",
    );
    shader.fragmentShader =
      `uniform float uGlobeTime;\nvarying vec3 vGlobeSurface;\n${shader.fragmentShader}`
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
        #ifdef USE_MAP
          diffuseColor.a = opacity;
        #endif`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
        #ifdef USE_MAP
          float land = sampledDiffuseColor.a;
          float swell = sin(dot(vGlobeSurface, vec3(18.0, 8.0, 11.0)) + uGlobeTime * 0.7)
                      * cos(dot(vGlobeSurface, vec3(9.0, 12.0, -7.0)) - uGlobeTime * 0.4);
          roughnessFactor = mix(0.43 + swell * 0.035, roughnessFactor, land);
          diffuseColor.rgb *= 1.0 + (1.0 - land) * swell * 0.018;
        #endif`,
        );
  };
  material.customProgramCacheKey = () => "university-globe-land-mask-v1";
  return material;
}
