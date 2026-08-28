/**
 * Image-based lighting from the world's own procedural sky.
 *
 * The visible sky remains a mesh (and `scene.background` remains owned by
 * Weather). This component renders the same skydome shader into a tiny linear
 * half-float cubemap, prefilters it once with PMREM, and assigns only
 * `scene.environment`. A study change replaces the three colour stops, which
 * changes the stable key below and triggers one new capture; ordinary frames
 * only compare that key.
 *
 * Colour ownership is deliberately boring: capture and PMREM stay linear and
 * run with `NoToneMapping`. Stage's scene target is still linear, and the
 * standalone grade fragment remains the only ACES + sRGB output in the real
 * frame. Nothing in this file is an output pass.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";

import {
  createSkyDomeUniforms,
  SKY_DOME_FRAGMENT_SHADER,
  SKY_DOME_NAME,
  SKY_DOME_STOPS_KEY,
  SKY_DOME_VERTEX_SHADER,
  type SkyDomeStops,
} from "./skydome.js";

import { renderTier } from "./tier.js";

export const WORLD_ENVIRONMENT = {
  /** Sky radiance is low-frequency; a larger capture only spends first-frame time. */
  get cubeSize() {
    return renderTier() === "mobile" ? 32 : 64;
  },
  /**
   * Three passes this scene value to every Standard/Physical material as its
   * `envMapIntensity` when the material uses `scene.environment`. One global
   * number is the tuning point; material files do not grow scattered copies.
   * 0.8 is the measured sky fill for the 2026-08-28 black-hole pass; together
   * with the hemisphere and ambient lights it keeps the course look inside a
   * 2–4:1 stylized key-to-fill range without changing the sky's visible stops.
   */
  intensity: 0.8,
} as const;

/** A Stage without a visible map sky (the planet picker) still shares this IBL. */
export const DEFAULT_WORLD_ENVIRONMENT_STOPS: SkyDomeStops = {
  zenith: 0x2e7fd4,
  mid: 0x8ec8ea,
  horizon: 0xf2d4b0,
};

const BYTES_PER_HALF_FLOAT_RGBA_TEXEL = 8;

export type EnvironmentTextureMemory = {
  /** The PMREM CubeUV atlas retained while the Stage is mounted. */
  readonly persistent: number;
  /** Cube input + output atlas + PMREM ping-pong during the one-time build. */
  readonly generationPeak: number;
  readonly atlasWidth: number;
  readonly atlasHeight: number;
};

/** Mirrors Three 0.185's PMREM atlas packing so the budget is reviewable. */
export function estimateEnvironmentTextureMemory(
  requestedCubeSize = WORLD_ENVIRONMENT.cubeSize,
): EnvironmentTextureMemory {
  const safeSize =
    Number.isFinite(requestedCubeSize) && requestedCubeSize >= 1 ? requestedCubeSize : 1;
  const cubeSize = 2 ** Math.floor(Math.log2(safeSize));
  const atlasWidth = 3 * Math.max(cubeSize, 16 * 7);
  const atlasHeight = 4 * cubeSize;
  const atlas = atlasWidth * atlasHeight * BYTES_PER_HALF_FLOAT_RGBA_TEXEL;
  const cube = cubeSize * cubeSize * 6 * BYTES_PER_HALF_FLOAT_RGBA_TEXEL;
  return {
    persistent: atlas,
    generationPeak: atlas * 2 + cube,
    atlasWidth,
    atlasHeight,
  };
}

export function skyEnvironmentKey(stops: SkyDomeStops): string {
  const hex = (value: number) => (value >>> 0).toString(16).padStart(6, "0");
  return `${hex(stops.zenith)}:${hex(stops.mid)}:${hex(stops.horizon)}`;
}

type EnvironmentResource = {
  readonly key: string;
  readonly target: THREE.WebGLRenderTarget;
  readonly generationMs: number;
};

function stopsFromScene(scene: THREE.Scene): SkyDomeStops {
  const candidate = scene.getObjectByName(SKY_DOME_NAME)?.userData[SKY_DOME_STOPS_KEY] as
    | Partial<SkyDomeStops>
    | undefined;
  if (
    candidate &&
    Number.isFinite(candidate.zenith) &&
    Number.isFinite(candidate.mid) &&
    Number.isFinite(candidate.horizon)
  ) {
    return candidate as SkyDomeStops;
  }
  return DEFAULT_WORLD_ENVIRONMENT_STOPS;
}

function buildEnvironment(
  renderer: THREE.WebGLRenderer,
  stops: SkyDomeStops,
  key: string,
): EnvironmentResource {
  const startedAt = performance.now();
  const geometry = new THREE.SphereGeometry(420, 32, 20);
  const material = new THREE.ShaderMaterial({
    name: "WorldEnvironmentSky",
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: createSkyDomeUniforms(stops),
    vertexShader: SKY_DOME_VERTEX_SHADER,
    fragmentShader: SKY_DOME_FRAGMENT_SHADER,
  });
  const captureScene = new THREE.Scene();
  captureScene.add(new THREE.Mesh(geometry, material));

  const cubeTarget = new THREE.WebGLCubeRenderTarget(WORLD_ENVIRONMENT.cubeSize, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    colorSpace: THREE.LinearSRGBColorSpace,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  cubeTarget.texture.name = `WorldEnvironment.cube.${key}`;
  const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeTarget);
  captureScene.add(cubeCamera);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let output: THREE.WebGLRenderTarget | null = null;

  const previousTarget = renderer.getRenderTarget();
  const previousCubeFace = renderer.getActiveCubeFace();
  const previousMipmapLevel = renderer.getActiveMipmapLevel();
  const previousColorSpace = renderer.outputColorSpace;
  const previousToneMapping = renderer.toneMapping;

  try {
    // The sky shader already writes working-linear colour. Do not let a
    // renderer output setting turn this capture into a hidden second grade.
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    cubeCamera.update(renderer, captureScene);
    output = pmrem.fromCubemap(cubeTarget.texture);
    output.texture.name = `WorldEnvironment.pmrem.${key}`;
    output.texture.colorSpace = THREE.LinearSRGBColorSpace;
    return {
      key,
      target: output,
      generationMs: performance.now() - startedAt,
    };
  } catch (error) {
    output?.dispose();
    throw error;
  } finally {
    renderer.setRenderTarget(previousTarget, previousCubeFace, previousMipmapLevel);
    renderer.outputColorSpace = previousColorSpace;
    renderer.toneMapping = previousToneMapping;
    pmrem.dispose();
    cubeTarget.dispose();
    geometry.dispose();
    material.dispose();
  }
}

/**
 * Owns the one environment texture for a Stage.
 *
 * Priority stays negative so capture happens before Pipeline's priority-1
 * scene draw without taking render-loop ownership away from Stage. The check
 * runs on ordinary frames; the six cube renders and PMREM only run when the
 * deterministic stop key changes.
 */
export function WorldEnvironment({ children }: { readonly children: ReactNode }) {
  const resource = useRef<EnvironmentResource | null>(null);
  const failedKey = useRef<string | null>(null);
  const original = useRef<{
    readonly environment: THREE.Texture | null;
    readonly intensity: number;
  } | null>(null);

  useFrame(({ gl, scene }) => {
    original.current ??= {
      environment: scene.environment,
      intensity: scene.environmentIntensity,
    };
    const stops = stopsFromScene(scene);
    const key = skyEnvironmentKey(stops);
    if (resource.current?.key === key || failedKey.current === key) return;

    try {
      const next = buildEnvironment(gl, stops, key);
      const previous = resource.current;
      resource.current = next;
      scene.environment = next.target.texture;
      scene.environmentIntensity = WORLD_ENVIRONMENT.intensity;
      scene.userData.worldEnvironment = {
        key,
        cubeSize: WORLD_ENVIRONMENT.cubeSize,
        intensity: WORLD_ENVIRONMENT.intensity,
        generationMs: next.generationMs,
        atlasWidth: next.target.width,
        atlasHeight: next.target.height,
        colorSpace: next.target.texture.colorSpace,
        type: next.target.texture.type,
      };
      failedKey.current = null;
      previous?.target.dispose();
    } catch (error) {
      // One error per configuration: a broken capability must be visible, but
      // retrying six cube renders on every frame would turn it into a hang.
      failedKey.current = key;
      console.error("World environment capture failed", error);
    }
  }, -1000);

  useEffect(
    () => () => {
      const current = resource.current;
      const initial = original.current;
      if (current) current.target.dispose();
      resource.current = null;
      // Restore only what this owner installed. Another owner replacing the
      // environment before cleanup must not have its texture nulled here.
      const scene = current?.target.texture.userData.scene as THREE.Scene | undefined;
      if (scene && scene.environment === current?.target.texture && initial) {
        scene.environment = initial.environment;
        scene.environmentIntensity = initial.intensity;
      }
    },
    [],
  );

  return children;
}
