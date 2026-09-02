/**
 * Host adapter for the world-map colour grade. Shader source, pipeline order
 * and the single-encode guard come from `@pieai/swimmer-render-kit`. This file
 * still owns the blit itself, because the kit deliberately does not own an
 * EffectComposer, a material, or any React wrapper.
 *
 * Pipeline, counted in one place so it stays counted: the scene renders linear
 * into `target` (with a readable depth texture); `ao.ts` may darken that
 * linear colour; the kit's `standalone` fragment then does ACES, the look, and
 * exactly one sRGB encode; the renderer is told to own neither for that draw.
 * AO is a linear multiply. It is not a second grade, and it must not encode.
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
import { defineGrade, srgbToDisplayLinear } from "@pieai/swimmer-render-kit";
import { assertSingleColorEncode } from "@pieai/swimmer-render-kit/guard";
import {
  buildGradeFragment,
  createGradeUniformValues,
  GRADE_MATERIAL_NAME,
  GRADE_VERTEX_SHADER,
} from "@pieai/swimmer-render-kit/shader";
import * as THREE from "three";

import { createSceneDepthTexture } from "./ao";

/**
 * Ungraded scene-linear median after the low-sun pass, as 8-bit sRGB.
 *
 * `measureScene()` reads linear luminance before this blit. Convert that
 * midtone with the kit helper — never pass the 0–1 fraction, which is the
 * documented way to set this value wrong. The grade pivot is deliberately
 * below that median so the dark soil's green/blue channels stay positive when
 * contrast expands the frame.
 *
 * Re-measured 2026-09-02 after the cold-sky / steeper-key pass, same conditions
 * (course-design, 1440×900, post=off, `turing-pact/foundations-before-zero`,
 * 41 lessons): linear median **0.252**, which is 137/255 sRGB.
 *
 * Two readings were taken, because the first one did not match this comment.
 * Measuring the branch *before* any of this pass's changes gave median 0.561,
 * not the 0.316 recorded above — so the number this file documented had already
 * stopped describing the code, most likely across the scene rebuild that
 * predates this pass. It is recorded here rather than quietly overwritten: a
 * stale measurement in a comment is worse than none, because the next reader
 * budgets against it.
 *
 * The pivot keeps its documented *relationship* to the median rather than
 * either remembered constant: it was specified as sitting below the median, at
 * 80/152 = 0.53 of it, so 0.53 × 137 ≈ 72.
 *
 * Also read then, and worth keeping next to it: scene-linear p05 0.047,
 * p95 0.498. p05 is comfortably above zero, which is the check `sun.ts` asks
 * for — the fill was cut hard, and the shadows still have colour in them
 * rather than clipping to a black that low-poly faces would merge into.
 *
 * The judge scores `post=off`, so these numbers do not move S1. They are
 * the product look once the grade is on: contrast opens the new range,
 * vignette must not crush the sun disc that A4 and p98 now live in.
 */
export const WORLD_GRADE_PIVOT_SRGB8 = 72;

/**
 * Diorama plus the numbers this map actually measured.
 *
 * Cool/warm amounts stay moderate. A map has to stay legible, and a strong
 * split starts to read as "these islands are different colours". The ramps
 * cover the new mid-tone band around the measured pivot, not YaZu's 0.066
 * or the dungeon's 0.5.
 *
 * Exported on purpose: this table is the colour-pipeline contract, not a
 * private helper. knip flags it because no other file names it; the blit
 * in this file is the consumer.
 */
export const WORLD_GRADE = defineGrade("diorama", {
  tiltShift: false,
  grain: 0,
  saturation: 1.06,
  contrast: 1.17,
  contrastPivot: srgbToDisplayLinear(WORLD_GRADE_PIVOT_SRGB8),
  coolShadow: {
    // 2026-09-02: 0.26 → 0.15. Not because cool shadows stopped being wanted —
    // they are the point of this pass — but because they are now produced by
    // the lights (blue hemisphere, blue PMREM, cool rim) instead of by the
    // grade, and running both was counting the same decision twice. The
    // visible symptom was the lesson plinths' bevel, a white-albedo face the
    // low key never reaches: light-side cool plus grade-side cool took it past
    // "shadow with hue" into a saturated blue band across the one control a
    // learner clicks. A grade should bias a relationship the render already
    // has, not manufacture one.
    amount: 0.15,
    rangeStart: 0,
    rangeEnd: 0.36,
    tint: [0.88, 0.95, 1.14],
  },
  warmHighlight: {
    // The old amount pushed the warm cliff into a red block after ACES. The
    // scene already has value separation from its real key/rim lights.
    //
    // 2026-09-02: 0.14 → 0.05. This ramp covers 0.4–1.0, which is where the
    // sky lives, so it was tinting the brightest and largest region of the
    // frame warm. Against the old sunset stops that was invisible; against a
    // blue sky it is the grade arguing with the art direction, and the grade
    // loses. Warmth is the key light's job here — `keyColor` is 0xffefd2 and
    // it lands on the ground, which is the half of the frame that should be
    // warm. Not zero: a trace of it still keeps the lit grass from reading
    // acid-green next to so much blue.
    amount: 0.05,
    rangeStart: 0.4,
    rangeEnd: 1,
    tint: [1.14, 1.03, 0.88],
  },
  vignette: {
    inner: 0.58,
    outer: 1.42,
    scale: 1.28,
    edgeGain: 0.94,
    centerGain: 1.03,
  },
});

/**
 * Standalone fragment: this blit owns ACES and the one sRGB encode.
 * Exported with `WORLD_GRADE` — same contract, same knip false-positive.
 */
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

interface GradePass {
  readonly target: THREE.WebGLRenderTarget;
  resize(width: number, height: number): void;
  /**
   * Draw `input` (or the scene target) to the canvas. The caller has already
   * filled the scene target, and may have run AO into a different texture.
   */
  render(renderer: THREE.WebGLRenderer, input?: THREE.Texture): void;
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
    depthTexture: createSceneDepthTexture(),
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
    render(renderer, input) {
      if (import.meta.env.DEV && !guarded) {
        assertWorldGradePipeline(renderer);
        guarded = true;
      }
      uniforms.tDiffuse.value = input ?? target.texture;
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
