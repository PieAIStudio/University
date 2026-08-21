/**
 * Host adapter for the world-map colour grade. Shader source, pipeline order
 * and the single-encode guard come from `@pieai/swimmer-render-kit`. This file
 * still owns the blit itself, because the kit deliberately does not own an
 * EffectComposer, a material, or any React wrapper.
 *
 * Pipeline, counted in one place so it stays counted: the scene renders linear
 * into `target`; the kit's `standalone` fragment then does ACES, the look, and
 * exactly one sRGB encode; the renderer is told to own neither for that draw.
 *
 * Starting look is `diorama`. This world is a low-poly archipelago seen from
 * above — a miniature board — and that is the look `diorama` was measured for.
 * `night-street` is a night exterior that holds practicals hot; `stage` is a
 * single lit subject on a clean frame edge. Neither describes a study map.
 * `neutral` would install the pipeline and throw the miniature starting point
 * away. Overrides below are this scene's measurements, not a second preset.
 *
 * The previous local shader recorded real tuning against the dungeon donor
 * (threejs-procedural-dungeon@0a2aa0980028cbbc77af6642b4232b45713dc5de). Those
 * numbers survive as `defineGrade` overrides rather than as a forked GLSL
 * file, because copying YaZu's board values here would be the same mistake
 * the donor's 0.5 pivot was for YaZu.
 *
 * Rejected from the diorama preset, with reasons that still hold:
 *   - Tilt-shift. Blurring the far end of the frame is exactly wrong for a map
 *     whose whole job is "you can see the summit from the bottom".
 *   - Film grain. This canvas sits under projected DOM labels; per-pixel noise
 *     under small text is a readability cost with no upside here.
 *   - Bloom is not a kit preset, and is still rejected: nothing here is
 *     emissive, and bloom on a map bleeds label-adjacent geometry into the
 *     DOM text sitting on top of it.
 *
 * Baseline rules this file answers: 2 (one tone map, one sRGB encode, both in
 * the kit fragment, asserted by the kit guard) and 3 (a grade exists, started
 * from a named kit look, with scene-specific overrides recorded below).
 */
import { defineGrade } from "@pieai/swimmer-render-kit";
import { assertSingleColorEncode } from "@pieai/swimmer-render-kit/guard";
import {
  buildGradeFragment,
  createGradeUniformValues,
  GRADE_MATERIAL_NAME,
  GRADE_VERTEX_SHADER,
} from "@pieai/swimmer-render-kit/shader";
import * as THREE from "three";

/**
 * Diorama plus the numbers this map actually measured.
 *
 * `contrastPivot` is 0.34 because that is the working-space value the previous
 * blit expanded around after ACES, read off this scene rather than inherited.
 * The dungeon donor used 0.5; YaZu's board used 0.066. Both are wrong here.
 *
 * Cool/warm amounts stay 0.22 / 0.16 (against the donor's 0.38 / 0.28). A map
 * has to stay legible, and a strong split starts to read as "these islands are
 * different colours", which is a lie the map must not tell. The tints and luma
 * ramps travel with those amounts: they were one calibration, and substituting
 * YaZu's much stronger cyan/amber pair at the weaker weights would rebuild the
 * lie from the other end. The ramps also have to cover this scene's mid-tone
 * band around 0.34; diorama's 0.09 / 0.10–0.25 band was cut for YaZu's 0.066
 * and would leave the cool tint with almost nothing to hold onto.
 *
 * `edgeGain` 0.76 is the old `uVignette = 0.24` expressed as the kit's mix
 * (`mix(edgeGain, centerGain, vg)` equals `mix(1.0 - 0.24, 1.0, vg)`).
 */
export const WORLD_GRADE = defineGrade("diorama", {
  tiltShift: false,
  grain: 0,
  saturation: 1,
  contrast: 1.06,
  contrastPivot: 0.34,
  coolShadow: {
    amount: 0.22,
    rangeEnd: 0.4,
    tint: [0.92, 0.97, 1.1],
  },
  warmHighlight: {
    amount: 0.16,
    rangeStart: 0.45,
    rangeEnd: 1,
    tint: [1.06, 1.01, 0.94],
  },
  vignette: {
    inner: 0.48,
    outer: 1.32,
    scale: 1.5,
    edgeGain: 0.76,
    centerGain: 1,
  },
});

/** Standalone fragment: this blit owns ACES and the one sRGB encode. */
export const WORLD_GRADE_FRAGMENT = buildGradeFragment(WORLD_GRADE, {
  target: "standalone",
});

type GradeUniforms = {
  tDiffuse: { value: THREE.Texture };
  uRes: { value: THREE.Vector2 };
  uTime: { value: number };
  uTilt: { value: number };
  uGrain: { value: number };
  uContrast: { value: number };
  uContrastPivot: { value: number };
  uLevelGain: { value: number };
  toneMappingExposure: { value: number };
};

function createUniforms(sceneTexture: THREE.Texture): GradeUniforms {
  const values = createGradeUniformValues(WORLD_GRADE);
  return {
    tDiffuse: { value: sceneTexture },
    uRes: { value: new THREE.Vector2(...values.uRes) },
    uTime: { value: values.uTime },
    uTilt: { value: values.uTilt },
    uGrain: { value: values.uGrain },
    uContrast: { value: values.uContrast },
    uContrastPivot: { value: values.uContrastPivot },
    uLevelGain: { value: values.uLevelGain },
    toneMappingExposure: { value: values.toneMappingExposure },
  };
}

/**
 * Assert the frame tone-maps once and sRGB-encodes once.
 *
 * `outputOwner` is `composer` even though this product does not use
 * EffectComposer: the kit's word for that owner is "a blit you can read
 * (`standalone`)", and this pass is that blit. Declaring it is load-bearing.
 * R3F leaves the renderer on ACES + `srgb` so an ungraded frame could still
 * encode; counting those settings would report a false 2/2. The fragment
 * string is what the guard can actually see — three's `Pass` exposes neither
 * `name` nor `material`.
 */
export function assertWorldGradePipeline(renderer: THREE.WebGLRenderer): void {
  assertSingleColorEncode(renderer, [WORLD_GRADE_FRAGMENT], {
    outputOwner: "composer",
  });
}

export interface GradePass {
  readonly target: THREE.WebGLRenderTarget;
  resize(width: number, height: number): void;
  /** Draw the target to the canvas. The caller has already filled the target. */
  render(renderer: THREE.WebGLRenderer): void;
  dispose(): void;
}

export function createGradePass(): GradePass {
  // A single full-screen triangle, not a quad: no seam down the diagonal, and
  // the kit vertex shader samples `uv`, so the attribute has to come with it.
  // Positions and UVs match three's own fullscreen triangle so the ortho
  // camera below maps them onto the canvas the way GRADE_VERTEX_SHADER expects.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, 3, 0, -1, -1, 0, 3, -1, 0]), 3),
  );
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 2, 0, 0, 2, 0]), 2));

  const target = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false,
    samples: WORLD_GRADE.msaaSamples,
    // Linear in, always. The conversion happens once, in the kit fragment.
    colorSpace: THREE.LinearSRGBColorSpace,
    type: THREE.HalfFloatType,
  });

  const uniforms = createUniforms(target.texture);
  // RawShaderMaterial is the contract, not a style choice. A plain
  // ShaderMaterial lets three inject a second tonemap and encode from the
  // renderer settings, which is the silent grey-picture failure the kit exists
  // to stop. The defines keep three's ACES / sRGB includes alive while the
  // renderer itself is told to do neither.
  const material = new THREE.RawShaderMaterial({
    name: GRADE_MATERIAL_NAME,
    defines: { ACES_FILMIC_TONE_MAPPING: "", SRGB_TRANSFER: "" },
    uniforms,
    vertexShader: GRADE_VERTEX_SHADER,
    fragmentShader: WORLD_GRADE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });

  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let guarded = false;

  return {
    target,
    resize(width, height) {
      const nextWidth = Math.max(1, width);
      const nextHeight = Math.max(1, height);
      target.setSize(nextWidth, nextHeight);
      uniforms.uRes.value.set(nextWidth, nextHeight);
    },
    render(renderer) {
      if (import.meta.env.DEV && !guarded) {
        assertWorldGradePipeline(renderer);
        guarded = true;
      }
      uniforms.uTime.value = performance.now() / 1000;
      const previousColorSpace = renderer.outputColorSpace;
      const previousToneMapping = renderer.toneMapping;
      // Still correct once the kit owns the fragment: this draw is to the
      // canvas, so renderer settings are not inert. The standalone blit owns
      // ACES and the encode; NoToneMapping + linear output is how the
      // renderer is told it owns neither for this pass. Restored afterwards
      // because R3F's defaults must remain able to encode if the grade is
      // ever switched off.
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      renderer.outputColorSpace = previousColorSpace;
      renderer.toneMapping = previousToneMapping;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      target.dispose();
    },
  };
}
