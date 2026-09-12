import * as THREE from "three";
import { acquireSurfaceSwatch, SURFACE_DETAIL_SIZE } from "./surface-material-detail.js";

/** One role-aware extension of the existing merged opaque draw. Reuses the
 * terrain/stone scalar texture; natural leaves and flowers are unchanged.
 * No per-building materials, extra meshes, painted shadows or output pass.
 */
export function createCraftMaterialDetail() {
  let lease: ReturnType<typeof acquireSurfaceSwatch> | null = null;
  const uniforms = {
    uSurfaceSwatch: { value: null as THREE.DataTexture | null },
    uSurfaceDetailMode: { value: 2 },
  };
  const activate = () => {
    lease ??= acquireSurfaceSwatch();
    uniforms.uSurfaceSwatch.value = lease.texture;
  };
  return {
    uniforms,
    activate,
    info: {
      role: "crafted-facilities",
      textureSize: SURFACE_DETAIL_SIZE,
      shared: true,
      incrementalTextureBytes: 0,
      coordinateBytesPerVertex: 12,
      source: "University authored material roles and filtered craft marks; shared scalar swatch",
    },
    customProgramCacheKey: () => "university-crafted-scenery-v1",
    onBeforeCompile(shader: THREE.WebGLProgramParametersWithUniforms) {
      for (const chunk of ["color_fragment", "roughnessmap_fragment"])
        if (!shader.fragmentShader.includes(`#include <${chunk}>`))
          throw new Error("Crafted scenery needs the supported StandardMaterial chunks");
      activate();
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute vec3 craftSurface;\nvarying vec3 vCraftSurface;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvCraftSurface = craftSurface;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vCraftSurface;
          uniform sampler2D uSurfaceSwatch;
          uniform float uSurfaceDetailMode;
        `,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float craftTimber = 1.0 - step(0.25, abs(vCraftSurface.z - 1.0));
          float craftRoof = 1.0 - step(0.25, abs(vCraftSurface.z - 2.0));
          float craftPlaster = 1.0 - step(0.25, abs(vCraftSurface.z - 3.0));
          float craftCloth = 1.0 - step(0.25, abs(vCraftSurface.z - 4.0));
          float craftGlass = 1.0 - step(0.25, abs(vCraftSurface.z - 5.0));
          float craftEnabled = step(0.5, uSurfaceDetailMode);
          float craftPhysical = step(1.5, uSurfaceDetailMode);
          vec3 craftWear = vec3(0.5, 0.9, 0.88);
          if (vCraftSurface.z > 0.5) {
            craftWear = texture2D(uSurfaceSwatch, vCraftSurface.xy * 1.35).rgb;
          }
          float craftGrainAxis = vCraftSurface.x * 32.0 + craftWear.r * 1.2;
          float craftGrain = sin(craftGrainAxis) *
            (1.0 - smoothstep(0.4, 1.5, fwidth(craftGrainAxis)));
          // The roof's ridges are filtered pigment, not subpixel geometry.
          // They disappear before minification can turn them into dotted edges.
          float craftSeamAxis = vCraftSurface.x * 3.0;
          float craftAA = max(fwidth(craftSeamAxis), 0.0001);
          float craftSeam = (1.0 - smoothstep(0.012 - craftAA, 0.035 + craftAA,
            abs(fract(craftSeamAxis + 0.5) - 0.5))) *
            (1.0 - smoothstep(0.055, 0.15, craftAA));
          float craftTone = (craftWear.b - 0.88) *
            (craftTimber * 0.32 + craftRoof * 0.3 + craftPlaster * 0.12 + craftCloth * 0.12)
            + craftGrain * craftTimber * 0.025 + craftSeam * craftRoof * 0.1;
          diffuseColor.rgb *= 1.0 + craftEnabled * craftTone;
        `,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
          float craftTarget = roughnessFactor;
          craftTarget = mix(craftTarget, clamp(craftWear.g - 0.08, 0.78, 0.94), craftTimber);
          craftTarget = mix(craftTarget, clamp(craftWear.g - 0.19 - craftSeam * 0.03, 0.65, 0.82), craftRoof);
          craftTarget = mix(craftTarget, 0.98, craftPlaster + craftCloth);
          craftTarget = mix(craftTarget, 0.44, craftGlass);
          roughnessFactor = mix(roughnessFactor, craftTarget, craftPhysical);
        `,
        );
    },
    dispose() {
      lease?.dispose();
      lease = null;
      uniforms.uSurfaceSwatch.value = null;
    },
  };
}
