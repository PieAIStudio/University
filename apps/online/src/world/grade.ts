/**
 * The colour grade, and the only place this product converts to sRGB.
 *
 * Absorbed from: threejs-procedural-dungeon
 *   https://github.com/majidmanzarpour/threejs-procedural-dungeon
 *   commit 0a2aa0980028cbbc77af6642b4232b45713dc5de, `src/main.js` (the POST
 *   block, roughly lines 826-900).
 *
 * Reused: the single-composite structure — scene renders linear into a target,
 * one full-screen pass does tone map, grade, vignette and gamma, and nothing
 * else touches colour. Also the shape of the grade itself: tint shadows cool,
 * tint highlights warm, expand contrast slightly, then vignette.
 *
 * Changed: every constant. The donor's mid-tone sits where a torch-lit dungeon
 * puts it; this scene is flat grey geometry on a dark ground under a hemisphere
 * light, and its measured mid-tone is far lower, so the donor's contrast pivot
 * of 0.5 crushes it. The pivot here is 0.34, read off this scene rather than
 * inherited. The cool/warm split is also weaker (0.22/0.16 against the donor's
 * 0.38/0.28): a map has to stay legible, and a strong split starts to read as
 * "these islands are different colours", which is a lie the map must not tell.
 *
 * Rejected, with reasons:
 *   - Bloom. It exists to make emissive heroes glow. Nothing here is emissive,
 *     and bloom on a map bleeds label-adjacent geometry into the DOM text
 *     sitting on top of it.
 *   - Tilt-shift. Blurring the far end of the frame is exactly wrong for a map
 *     whose whole job is "you can see the summit from the bottom".
 *   - Film grain. This canvas sits under projected DOM labels; per-pixel noise
 *     under small text is a readability cost with no upside here.
 *
 * Baseline rules this file answers: 2 (one tone map, one sRGB encode, both
 * here) and 3 (a grade exists, and its source is recorded above).
 */
import * as THREE from "three";

export const GRADE_SOURCE =
  "threejs-procedural-dungeon@0a2aa0980028cbbc77af6642b4232b45713dc5de src/main.js POST";

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/*
 * ACES is applied here in the shader rather than by the renderer, because the
 * renderer only tone-maps when it draws to the canvas and this chain draws to
 * a target first. Letting both do it is the "two tone maps, no error message,
 * picture goes grey" failure the capability baseline warns about; counting the
 * operations in one file is how it stays counted.
 */
const FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uScene;
  uniform float uVignette;

  vec3 aces(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  void main() {
    vec3 col = texture2D(uScene, vUv).rgb;

    col = aces(col * 1.05);

    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, col * vec3(0.92, 0.97, 1.10), (1.0 - smoothstep(0.0, 0.4, lum)) * 0.22);
    col = mix(col, col * vec3(1.06, 1.01, 0.94), smoothstep(0.45, 1.0, lum) * 0.16);

    // Pivot measured on this scene, not inherited. See the header.
    col = (col - 0.34) * 1.06 + 0.34;

    float vg = smoothstep(1.32, 0.48, length(vUv - 0.5) * 1.5);
    col *= mix(1.0 - uVignette, 1.0, vg);

    gl_FragColor = vec4(pow(max(col, 0.0), vec3(0.4545)), 1.0);
  }
`;

export interface GradePass {
  readonly target: THREE.WebGLRenderTarget;
  resize(width: number, height: number): void;
  /** Draw the target to the canvas. The caller has already filled the target. */
  render(renderer: THREE.WebGLRenderer): void;
  dispose(): void;
}

export function createGradePass(vignette = 0.24): GradePass {
  // A single full-screen triangle, not a quad: no seam down the diagonal and
  // one fewer vertex to think about.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );

  const target = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false,
    samples: 4,
    // Linear in, always. The conversion happens once, in the shader below.
    colorSpace: THREE.LinearSRGBColorSpace,
    type: THREE.HalfFloatType,
  });

  const material = new THREE.ShaderMaterial({
    uniforms: { uScene: { value: target.texture }, uVignette: { value: vignette } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });

  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    target,
    resize(width, height) {
      target.setSize(Math.max(1, width), Math.max(1, height));
    },
    render(renderer) {
      const previousColorSpace = renderer.outputColorSpace;
      const previousToneMapping = renderer.toneMapping;
      // Tell the renderer to leave the result alone: the shader has already
      // tone-mapped and gamma-encoded. This is the one line that keeps the
      // encode count at exactly one.
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
