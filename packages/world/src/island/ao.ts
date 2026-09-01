/**
 * Screen-space ambient occlusion, as a linear pass that never encodes.
 *
 * Pipeline, counted with `grade.ts`: the scene renders linear into the grade
 * target (now with a readable depth texture); this pass reads that colour and
 * depth, darkens occluded creases, and writes linear colour into its own
 * target; the kit's standalone fragment then does ACES, the look, and the one
 * sRGB encode. Inserting AO after the encode, or letting it gamma-correct,
 * would be baseline rule 2 broken twice — once as a wash, once as a lie the
 * guard cannot see if we hide the encode in a library pass.
 *
 * Why this file exists rather than a packaged AO:
 *   - drei's `ContactShadows` is a ground-plane trick. This map has islands at
 *     different heights and a road that climbs, so one plane would shade the
 *     waterline and leave every tree-to-ground junction as a sticker.
 *   - `n8ao` (what v3 names) is an EffectComposer pass that re-renders the
 *     scene and defaults `gammaCorrection` on. Both fight the counted blit this
 *     product already owns. Taking the composer would silently move the encode.
 *   - `@react-three/postprocessing` is the other composer, which the kit's
 *     `library` owner is for, and which this product does not use.
 *
 * The look we want from N8AO is contact darkening at object-ground junctions.
 * A small SAO (scalable ambient obscurance) that samples the depth we already
 * paid for does that, owns no encode, and can be skipped on the mobile tier.
 *
 * Baseline rules this file answers: 2 (no tone map, no sRGB — the guard is
 * pointed at the grade fragment, not this one) and 4 (desktop only; a phone
 * keeps the directional shadow map and skips this pass).
 */
import { GRADE_VERTEX_SHADER } from "@pieai/swimmer-render-kit/shader";
import * as THREE from "three";

/**
 * SAO in view space. Spiral kernel. Normals come from a one-texel depth tap
 * rather than `dFdx`: this canvas is WebGL2, GLSL ES 1.00 does not get
 * `GL_OES_standard_derivatives` here, and GLSL 3.00 is a second blit language
 * the grade pass does not speak. Same vertex shader as the grade, on purpose.
 *
 * Background (depth at the far plane) is skipped so the sky does not film over.
 * No ACES, no sRGB. RawShaderMaterial so three cannot inject them if this draw
 * ever lands on the canvas by mistake.
 */
export const AO_FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uIntensity;
uniform float uRadius;
uniform float uBias;
uniform mat4 inverseProjectionMatrix;

varying vec2 vUv;

vec3 viewFromDepth(const in vec2 uv, const in float depth) {
  vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 view = inverseProjectionMatrix * clip;
  return view.xyz / view.w;
}

vec2 spiral(const in int index, const in int count) {
  float n = float(index);
  float theta = n * 2.399963;
  float r = sqrt((n + 0.5) / float(count));
  return vec2(cos(theta), sin(theta)) * r;
}

void main() {
  vec4 colour = texture2D(tDiffuse, vUv);
  float depth = texture2D(tDepth, vUv).x;
  if (depth > 0.999) {
    gl_FragColor = colour;
    return;
  }

  vec2 texel = 1.0 / uRes;
  vec3 origin = viewFromDepth(vUv, depth);
  vec3 px = viewFromDepth(vUv + vec2(texel.x, 0.0), texture2D(tDepth, vUv + vec2(texel.x, 0.0)).x);
  vec3 py = viewFromDepth(vUv + vec2(0.0, texel.y), texture2D(tDepth, vUv + vec2(0.0, texel.y)).x);
  vec3 normal = normalize(cross(px - origin, py - origin));

  float radiusUv = uRadius / max(8.0, -origin.z);

  const int SAMPLES = 16;
  float occlusion = 0.0;
  float taken = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    vec2 offset = spiral(i, SAMPLES) * radiusUv;
    vec2 sampleUv = vUv + offset;
    if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) continue;
    float sampleDepth = texture2D(tDepth, sampleUv).x;
    if (sampleDepth > 0.999) continue;
    vec3 samplePos = viewFromDepth(sampleUv, sampleDepth);
    vec3 delta = samplePos - origin;
    float dist2 = dot(delta, delta);
    float vn = dot(normal, delta);
    float range = 1.0 - smoothstep(0.0, uRadius * uRadius * 4.0, dist2);
    occlusion += range * max(0.0, vn - uBias) / (dist2 + 0.001);
    taken += 1.0;
  }

  // The contact cue should preserve a crease, not turn a whole vertical
  // hex-side into a black/red block once the diorama grade lifts warm soil.
  // Keep the same sixteen taps and one blit, but cap the linear darkening at
  // a measured contact cue instead of the old 72% ceiling.
  float ao = 1.0 - clamp((occlusion / max(taken, 1.0)) * uIntensity, 0.0, 0.2);
  gl_FragColor = vec4(colour.rgb * ao, colour.a);
}
`;

type AoUniforms = {
  tDiffuse: { value: THREE.Texture | null };
  tDepth: { value: THREE.Texture | null };
  uRes: { value: THREE.Vector2 };
  uIntensity: { value: number };
  uRadius: { value: number };
  uBias: { value: number };
  inverseProjectionMatrix: { value: THREE.Matrix4 };
};

export interface AoPass {
  readonly target: THREE.WebGLRenderTarget;
  resize(width: number, height: number): void;
  /**
   * Darken `input` in place as far as the caller is concerned: reads its
   * colour and `depthTexture`, writes linear colour into `this.target`.
   */
  render(renderer: THREE.WebGLRenderer, input: THREE.WebGLRenderTarget, camera: THREE.Camera): void;
  dispose(): void;
}

/**
 * Depth attachment the scene target must carry so this pass can see geometry.
 *
 * Built here so the grade target and the AO pass agree on format without a
 * third file owning the contract.
 */
export function createSceneDepthTexture(): THREE.DepthTexture {
  const depth = new THREE.DepthTexture(1, 1);
  depth.format = THREE.DepthFormat;
  depth.type = THREE.UnsignedIntType;
  depth.minFilter = THREE.NearestFilter;
  depth.magFilter = THREE.NearestFilter;
  depth.generateMipmaps = false;
  return depth;
}

export function createAoPass(): AoPass {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, 3, 0, -1, -1, 0, 3, -1, 0]), 3),
  );
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 2, 0, 0, 2, 0]), 2));

  const target = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    stencilBuffer: false,
    samples: 0,
    colorSpace: THREE.LinearSRGBColorSpace,
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });

  const uniforms: AoUniforms = {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    // Modest on purpose. Townscaper's contact is a crease, not a cave, and
    // this canvas sits under DOM labels that have to stay readable.
    uIntensity: { value: 0.2 },
    // World units. A tree is ~1.5 tall; this catches the trunk-to-ground
    // junction without halo-ing the whole island.
    uRadius: { value: 0.7 },
    uBias: { value: 0.04 },
    inverseProjectionMatrix: { value: new THREE.Matrix4() },
  };

  const material = new THREE.RawShaderMaterial({
    name: "PieUniversityAo",
    uniforms,
    vertexShader: GRADE_VERTEX_SHADER,
    fragmentShader: AO_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });

  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    target,
    resize(width, height) {
      const nextWidth = Math.max(1, width);
      const nextHeight = Math.max(1, height);
      target.setSize(nextWidth, nextHeight);
      uniforms.uRes.value.set(nextWidth, nextHeight);
    },
    render(renderer, input, viewCamera) {
      uniforms.tDiffuse.value = input.texture;
      uniforms.tDepth.value = input.depthTexture;
      uniforms.inverseProjectionMatrix.value.copy(viewCamera.projectionMatrixInverse);
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      target.dispose();
    },
  };
}
