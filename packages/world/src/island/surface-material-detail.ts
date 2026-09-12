/**
 * A small, shared, stylized surface swatch, not another terrain/biome field.
 * The blueprint's existing vertex colours and ground atlas still own material
 * identity. This tile supplies only worn surface tone, roughness and shallow
 * relief from the SAME cause. No photographic assets, displacement, lights,
 * output conversion, extra mesh or render pass.
 */
import * as THREE from "three";
import type { IslandBlueprint } from "./island-blueprint.js";
import { acquireCourseSurface, COURSE_COURTYARD_COLOUR } from "./course-surface-atlas.js";
import { surfaceWearAt } from "./surface-wear.js";

export type SurfaceDetailRole = "terrain" | "stone";
export const SURFACE_DETAIL_SIZE = 128;
export const SURFACE_DETAIL_PROGRAM = "university-surface-swatch-v3";

/** Periodic, low-contrast rounded flakes; no independent ecological noise. */
export function surfaceSwatchData(size = SURFACE_DETAIL_SIZE): Uint8Array {
  if (!Number.isInteger(size) || size < 4 || size > 512)
    throw new RangeError("Invalid surface swatch size");
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const worn = surfaceWearAt((x + 0.5) / size, (y + 0.5) / size);
      const i = (y * size + x) * 4;
      data[i] = Math.round(worn * 255); // shallow relief
      data[i + 1] = Math.round((0.96 - worn * 0.12) * 255); // worn peaks are smoother
      data[i + 2] = Math.round((0.76 + worn * 0.24) * 255); // shared tonal cause
      data[i + 3] = 255;
    }
  }
  return data;
}

interface SharedSwatch {
  readonly texture: THREE.DataTexture;
  owners: number;
}
let shared: SharedSwatch | null = null;

export function acquireSurfaceSwatch() {
  if (!shared) {
    const texture = new THREE.DataTexture(
      surfaceSwatchData(),
      SURFACE_DETAIL_SIZE,
      SURFACE_DETAIL_SIZE,
      THREE.RGBAFormat,
    );
    texture.name = "stylized-worn-surface-height-roughness-tone";
    // Packed scalar data, not an sRGB photograph or colour-map encoding.
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    shared = { texture, owners: 0 };
  }
  const owner = shared;
  owner.owners++;
  let released = false;
  return {
    texture: owner.texture,
    dispose() {
      if (released) return;
      released = true;
      if (--owner.owners === 0) {
        owner.texture.dispose();
        if (shared === owner) shared = null;
      }
    },
  };
}

/** Additional coordinates only: no position, index, normal or hit-shape edit. */
export function prepareSurfaceDetailCoordinates(
  geometry: THREE.BufferGeometry,
  geometryScale = 1,
): void {
  if (!Number.isFinite(geometryScale) || geometryScale <= 0)
    throw new RangeError("Invalid surface coordinate scale");
  if (geometry.hasAttribute("surfaceCoordinate")) return;
  const position = geometry.getAttribute("position");
  const coordinate = position.clone();
  // IslandRender can pre-scale its emitted geometry for the inspector. The
  // atlas and swatch still belong to canonical island coordinates; a wrapper
  // scale must not shift a forest-edge mark away from its actual tree.
  if (geometryScale !== 1)
    for (let i = 0; i < coordinate.count; i++)
      coordinate.setXYZ(
        i,
        coordinate.getX(i) / geometryScale,
        coordinate.getY(i) / geometryScale,
        coordinate.getZ(i) / geometryScale,
      );
  geometry.setAttribute("surfaceCoordinate", coordinate);
}

const DECLARATIONS = /* glsl */ `
uniform sampler2D uSurfaceSwatch;
uniform float uSurfaceDetailMode;
uniform float uSurfaceToneStrength;
uniform float uSurfaceReliefStrength;
uniform float uSurfaceMatteStrength;
uniform float uSurfaceTextureScale;
varying vec3 vSurfaceCoordinate;
varying float vSurfaceUp;
`;

/** Extends the existing StandardMaterial, including its shadows and grade. */
export function createSurfaceMaterialDetail(role: SurfaceDetailRole, blueprint?: IslandBlueprint) {
  // A React render can be abandoned before its effects are committed. Do not
  // reserve shared GPU ownership from useMemo: its missing cleanup would pin
  // one atlas on each navigation. Activation belongs to the committed owner.
  let swatch: ReturnType<typeof acquireSurfaceSwatch> | null = null;
  let garden: ReturnType<typeof acquireCourseSurface> | null = null;
  const uniforms = {
    uSurfaceSwatch: { value: null as THREE.DataTexture | null },
    // 0 = exact material baseline, 1 = tone only, 2 = full hybrid surface.
    // Inspection changes this uniform, never a camera, light or geometry.
    uSurfaceDetailMode: { value: 2 },
    // Keep the shared wear field readable across broad course clearings; the
    // lower-frequency sample avoids turning the stylized ground into noise.
    uSurfaceToneStrength: { value: role === "stone" ? 0.32 : 0.24 },
    uSurfaceReliefStrength: { value: role === "stone" ? 0.025 : 0.008 },
    uSurfaceMatteStrength: { value: role === "stone" ? 0.5 : 0.84 },
    uSurfaceTextureScale: { value: 0.075 },
    ...(blueprint
      ? {
          uCourseSurface: { value: null as THREE.DataTexture | null },
          uCourseSurfaceExtent: { value: 1 },
          uCourseCourtyardColour: { value: new THREE.Color(COURSE_COURTYARD_COLOUR) },
        }
      : {}),
  };
  const activate = () => {
    swatch ??= acquireSurfaceSwatch();
    uniforms.uSurfaceSwatch.value = swatch.texture;
    if (blueprint && uniforms.uCourseSurface && uniforms.uCourseSurfaceExtent) {
      garden ??= acquireCourseSurface(blueprint);
      uniforms.uCourseSurface.value = garden.texture;
      uniforms.uCourseSurfaceExtent.value = garden.extent;
    }
  };
  return {
    uniforms,
    activate,
    // Rematerialize a changed blueprint while reusing the same GPU program
    // key. Compiled uniforms belong to a material instance, not the shader key.
    materialKey: THREE.MathUtils.generateUUID(),
    info: {
      role,
      textureSize: SURFACE_DETAIL_SIZE,
      baseBytes: SURFACE_DETAIL_SIZE ** 2 * 4,
      mipBytesApproximate: Math.ceil((SURFACE_DETAIL_SIZE ** 2 * 4 * 4) / 3),
      shared: true,
      gardenColourBytes: blueprint ? 256 * 256 * 4 : 0,
      source: "University authored periodic scalar swatch; no external media",
    },
    customProgramCacheKey: () => `${SURFACE_DETAIL_PROGRAM}/${blueprint ? "garden" : "swatch"}`,
    onBeforeCompile(shader: THREE.WebGLProgramParametersWithUniforms) {
      const vertexAnchor = "#include <begin_vertex>";
      const colourAnchor = "#include <color_fragment>";
      const roughnessAnchor = "#include <roughnessmap_fragment>";
      const normalAnchor = "#include <normal_fragment_maps>";
      if (
        !shader.vertexShader.includes(vertexAnchor) ||
        ![colourAnchor, roughnessAnchor, normalAnchor].every((s) =>
          shader.fragmentShader.includes(s),
        )
      ) {
        throw new Error("Surface swatch requires the supported Three StandardMaterial chunks");
      }
      activate();
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute vec3 surfaceCoordinate;\nvarying vec3 vSurfaceCoordinate;\nvarying float vSurfaceUp;",
        )
        .replace(
          vertexAnchor,
          `${vertexAnchor}\nvSurfaceCoordinate = surfaceCoordinate;\nvSurfaceUp = normal.y;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>\n${DECLARATIONS}\n${garden ? "uniform sampler2D uCourseSurface;\nuniform float uCourseSurfaceExtent;\nuniform vec3 uCourseCourtyardColour;" : ""}`,
        )
        .replace(
          colourAnchor,
          `${colourAnchor}
          // Continuous oblique projection: no atlas seams or per-face switches.
          // Model-locked coordinates do not follow the camera or world matrix.
          vec2 surfaceUV = (vSurfaceCoordinate.xz + vSurfaceCoordinate.y * vec2(0.37, 0.71)) * uSurfaceTextureScale;
          vec3 surfaceSample = texture2D(uSurfaceSwatch, surfaceUV).rgb;
          float surfaceEnabled = step(0.5, uSurfaceDetailMode);
          float surfacePhysical = step(1.5, uSurfaceDetailMode);
          float surfaceWear = surfaceSample.r;
          vec3 surfaceTone = mix(vec3(0.93, 0.96, 1.02), vec3(1.05, 1.02, 0.95), surfaceWear);
          surfaceTone *= 1.0 + (surfaceSample.b - 0.88) * 1.6;
          ${
            garden
              ? `
          vec4 gardenSurface = texture2D(uCourseSurface, vSurfaceCoordinate.xz / (uCourseSurfaceExtent * 2.0) + 0.5);
          float gardenFace = smoothstep(0.35, 0.85, vSurfaceUp);
          diffuseColor.rgb *= mix(vec3(1.0), gardenSurface.rgb, surfaceEnabled * gardenFace);
          // Pigment is already the canopy cause; recover its bounded strength
          // for micro-shading only, never for placement or biome decisions.
          float gardenLush = clamp((0.99 - gardenSurface.r) / 0.24, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, uCourseCourtyardColour,
            surfaceEnabled * gardenFace * gardenSurface.a * 0.82);
          `
              : ""
          }
          // The long-course colour-only witness exposed repeated albedo
          // waves, even with all relief disabled. Keep fine pigment at real
          // forest edges, not over every clearing or vertical root face.
          diffuseColor.rgb *= mix(vec3(1.0), surfaceTone,
            surfaceEnabled * uSurfaceToneStrength ${garden ? "* gardenFace * gardenLush" : ""});
        `,
        )
        .replace(
          roughnessAnchor,
          `${roughnessAnchor}
          roughnessFactor = mix(roughnessFactor, surfaceSample.g,
            surfacePhysical * uSurfaceMatteStrength);
          ${
            garden
              ? `roughnessFactor = mix(roughnessFactor, 0.96,
            surfacePhysical * gardenFace * (0.35 + gardenLush * 0.65) * 0.65);`
              : ""
          }
        `,
        )
        .replace(
          normalAnchor,
          `${normalAnchor}
          // Screen derivatives of the SAME shallow relief cause. Mips and a
          // footprint fade suppress subpixel normals; nothing moves a vertex.
          float surfaceFootprint = max(length(dFdx(surfaceUV)), length(dFdy(surfaceUV)));
          float surfaceRelief = surfaceWear * uSurfaceReliefStrength * surfacePhysical
            ${garden ? "* gardenFace * gardenLush" : ""}
            * (1.0 - smoothstep(0.035, 0.14, surfaceFootprint));
          vec3 surfaceDx = dFdx(-vViewPosition);
          vec3 surfaceDy = dFdy(-vViewPosition);
          vec3 surfaceRx = cross(surfaceDy, normal);
          vec3 surfaceRy = cross(normal, surfaceDx);
          float surfaceDet = dot(surfaceDx, surfaceRx);
          vec3 surfaceGradient = sign(surfaceDet) *
            (dFdx(surfaceRelief) * surfaceRx + dFdy(surfaceRelief) * surfaceRy);
          if (abs(surfaceDet) > 1e-10 && surfacePhysical > 0.5) {
            normal = normalize(abs(surfaceDet) * normal - surfaceGradient);
          }
        `,
        );
    },
    dispose() {
      swatch?.dispose();
      garden?.dispose();
      swatch = null;
      garden = null;
      uniforms.uSurfaceSwatch.value = null;
      if (uniforms.uCourseSurface) uniforms.uCourseSurface.value = null;
    },
  };
}
