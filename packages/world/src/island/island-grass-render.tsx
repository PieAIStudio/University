/**
 * R3F adapter for the bounded IslandGrass plan.
 *
 * One course owns one three-vertex blade geometry, one material, and one
 * InstancedMesh. The vertex shader supplies the taper, wind bend, camera-facing
 * rotation, and terrain-normal replacement; the CPU only supplies roots and
 * deterministic per-instance transforms. Wind updates the material's uniform
 * through the Stage-owned `useFrame` loop; this component never creates a
 * renderer or a second loop.
 * The blueprint and any terrain geometry remain caller-owned and are never
 * disposed here.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
  planIslandGrass,
  islandGrassInstanceCountForLod,
  islandGrassLodForDistance,
  ISLAND_GRASS_LOD_PROFILES,
  type IslandGrassPlan,
  type IslandGrassPlanOptions,
  type IslandGrassSafetyZone,
  type IslandGrassDistanceTier,
  type IslandGrassRenderTier,
} from "./island-grass.js";
import { islandGeometryScale, type IslandGeometryDetail } from "./island-geometry.js";
import { islandLookFrozen } from "./island-surface-style.js";
import type { IslandBlueprint } from "./island-blueprint.js";
import { renderTier } from "../sky/tier.js";

// These are authored sRGB endpoints before the shared renderer grade:
// #2d5c2f is CIELAB L* 34.8 and #b0df83 is CIELAB L* 83.8. Keeping a full
// value ramp in each card makes a blade read even when the key light is flat.
const DEFAULT_GRASS_BOTTOM = new THREE.Color(0x3f7138);
const DEFAULT_GRASS_TOP = new THREE.Color(0xb0df83);
const DEFAULT_GRASS_SHADOW = new THREE.Color(0x2d5c2f);
const GRASS_BOTTOM_LSTAR = 43; // CIELAB L* at each blade root.
const GRASS_TOP_LSTAR = 88; // CIELAB L* at the brightest blade tips.
const GRASS_SHADOW_LSTAR = 30; // Non-linear root shadow endpoint.

export interface IslandGrassStyle {
  readonly bottom?: THREE.ColorRepresentation;
  readonly top?: THREE.ColorRepresentation;
  readonly shadow?: THREE.ColorRepresentation;
  readonly windStrength?: number;
  readonly windSpeed?: number;
  readonly windFrequency?: number;
  readonly windDirection?: readonly [number, number];
}

export interface IslandGrassProps {
  readonly blueprint: IslandBlueprint;
  readonly detail: IslandGeometryDetail;
  readonly targetRadius?: number;
  readonly style?: IslandGrassStyle;
  readonly options?: Omit<IslandGrassPlanOptions, "tier" | "safetyZones"> & {
    readonly safetyZones?: readonly IslandGrassSafetyZone[];
  };
}

interface GrassUniforms extends Record<string, THREE.IUniform<unknown>> {
  uTime: THREE.IUniform<number>;
  uWindStrength: THREE.IUniform<number>;
  uWindSpeed: THREE.IUniform<number>;
  uWindFrequency: THREE.IUniform<number>;
  uWindDirection: THREE.IUniform<THREE.Vector2>;
  uGrassBottom: THREE.IUniform<THREE.Color>;
  uGrassTop: THREE.IUniform<THREE.Color>;
  uGrassShadow: THREE.IUniform<THREE.Color>;
  uGrassHeightScale: THREE.IUniform<number>;
  uGroundNormalStrength: THREE.IUniform<number>;
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function yForLStar(lightness: number): number {
  const fy = (lightness + 16) / 116;
  return lightness > 8 ? fy * fy * fy : lightness / 903.2962963;
}

function normalizeColorLStar(
  value: THREE.ColorRepresentation | undefined,
  fallback: THREE.Color,
  targetLStar: number,
): THREE.Color {
  const color = value === undefined ? fallback.clone() : new THREE.Color(value);
  const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  if (luminance <= Number.EPSILON) return color;
  return color.multiplyScalar(yForLStar(targetLStar) / luminance);
}

function styleValues(style: IslandGrassStyle | undefined) {
  const direction = style?.windDirection ?? [0.78, 0.62];
  const directionLength = Math.hypot(direction[0] ?? 0, direction[1] ?? 0);
  const safeDirection = directionLength > Number.EPSILON ? direction : ([1, 0] as const);
  const length = directionLength > Number.EPSILON ? directionLength : 1;
  return {
    // Theme styles retain their hue/chroma but share the same perceptual
    // endpoint values: the meadow's identity comes from value first here.
    bottom: normalizeColorLStar(style?.bottom, DEFAULT_GRASS_BOTTOM, GRASS_BOTTOM_LSTAR),
    top: normalizeColorLStar(style?.top, DEFAULT_GRASS_TOP, GRASS_TOP_LSTAR),
    shadow: normalizeColorLStar(style?.shadow, DEFAULT_GRASS_SHADOW, GRASS_SHADOW_LSTAR),
    windStrength: Math.max(0, finiteOr(style?.windStrength, 0.065)),
    windSpeed: Math.max(0, finiteOr(style?.windSpeed, 1.15)),
    windFrequency: Math.max(0, finiteOr(style?.windFrequency, 0.24)),
    windDirection: new THREE.Vector2(
      (safeDirection[0] ?? 0) / length,
      (safeDirection[1] ?? 0) / length,
    ),
  };
}

function createGrassUniforms(style?: IslandGrassStyle): GrassUniforms {
  const values = styleValues(style);
  return {
    uTime: { value: 0 },
    uWindStrength: { value: values.windStrength },
    uWindSpeed: { value: values.windSpeed },
    uWindFrequency: { value: values.windFrequency },
    uWindDirection: { value: values.windDirection },
    uGrassBottom: { value: values.bottom },
    uGrassTop: { value: values.top },
    uGrassShadow: { value: values.shadow },
    uGrassHeightScale: { value: 1 },
    uGroundNormalStrength: { value: 0.72 },
  };
}

function updateGrassUniforms(uniforms: GrassUniforms, style?: IslandGrassStyle): void {
  const values = styleValues(style);
  uniforms.uWindStrength.value = values.windStrength;
  uniforms.uWindSpeed.value = values.windSpeed;
  uniforms.uWindFrequency.value = values.windFrequency;
  uniforms.uWindDirection.value.copy(values.windDirection);
  uniforms.uGrassBottom.value.copy(values.bottom);
  uniforms.uGrassTop.value.copy(values.top);
  uniforms.uGrassShadow.value.copy(values.shadow);
}

/** Compatibility names retained for diagnostics; one instance is one blade. */
export const ISLAND_GRASS_LEAF_COUNT = 1 as const;
export const ISLAND_GRASS_LEAF_SEGMENTS = 1 as const;
export const ISLAND_GRASS_BLADE_TRIANGLES = 1 as const;
export const ISLAND_GRASS_CLUMP_TRIANGLES = ISLAND_GRASS_BLADE_TRIANGLES;

/** One shared three-vertex triangle card for every instance. */
export function createIslandGrassClumpGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array([-0.14, 0, 0, 0.14, 0, 0, 0, 1, 0]);
  const uvs = new Float32Array([0, 0, 1, 0, 0.5, 1]);
  const geometry = new THREE.BufferGeometry();
  geometry.name = "IslandGrassBladeGeometry";
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Compatibility export for code that has not renamed the old placement yet. */
export const createIslandGrassBladeGeometry = createIslandGrassClumpGeometry;

const GRASS_SHADER_MARKER = "/* university island donor grass, lit */";

/**
 * The billboard shader, injected into a lit material rather than replacing one.
 *
 * The donor architecture is intentionally narrow: one triangle gets its
 * taper, wind bend, camera-facing Y rotation, and normal replacement in the
 * vertex shader. MeshStandardMaterial supplies the lighting the rest of the
 * island already uses, and the card, wind, normal, and ramp ride in through
 * onBeforeCompile. This keeps a single instance at one triangle instead of
 * paying for a five-leaf clump that is only a few pixels wide in the aerial
 * shot.
 *
 * The tip/root ramp is the donor idea from elemental-serenity
 * `Shaders/Chunks/grass/grass.fragment_color_chunk.glsl` at
 * `6b8cebefa0ee10e1bdd081dd342a01b3fe753e09`, without its displacement map.
 */
const GRASS_VERTEX_DECLARATIONS = `${GRASS_SHADER_MARKER}
uniform float uTime;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform float uWindFrequency;
uniform vec2 uWindDirection;
uniform float uGrassHeightScale;
uniform float uGroundNormalStrength;
attribute vec3 aGrassGroundNormal;
varying float vBladeHeight;
vec2 grassWindAt(vec3 grassBaseWorld) {
  vec2 grassDirection = uWindDirection;
  float grassDirectionLength = length(grassDirection);
  grassDirection = grassDirectionLength > 0.0001
    ? grassDirection / grassDirectionLength
    : vec2(1.0, 0.0);
  vec2 grassCross = vec2(-grassDirection.y, grassDirection.x);
  float grassWavePhase = dot(grassBaseWorld.xz, grassDirection) * uWindFrequency;
  float grassGustPhase = dot(grassBaseWorld.xz, grassCross) * uWindFrequency * 0.58;
  float grassWave =
    sin(grassWavePhase + uTime * uWindSpeed) * 0.78 +
    sin(grassGustPhase + uTime * uWindSpeed * 0.72 + 1.7) * 0.22;
  float grassGust = sin(grassGustPhase + uTime * uWindSpeed * 0.51 + 0.9) * 0.2;
  return (grassDirection * grassWave + grassCross * grassGust) * uWindStrength;
}

vec3 grassRotateAxis(vec3 point, vec3 axis, float angle) {
  float cosine = cos(angle);
  float sine = sin(angle);
  return point * cosine + cross(axis, point) * sine + axis * dot(axis, point) * (1.0 - cosine);
}
`;

const GRASS_VERTEX_NORMAL = `${GRASS_SHADER_MARKER}
#ifdef USE_INSTANCING
  mat4 grassNormalInstanceWorld = modelMatrix * instanceMatrix;
#else
  mat4 grassNormalInstanceWorld = modelMatrix;
#endif
vec3 grassNormalBase = (grassNormalInstanceWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
vec3 grassNormalToCamera = cameraPosition - grassNormalBase;
vec3 grassBillboardNormal = vec3(0.0, 1.0, 0.0);
if (length(grassNormalToCamera.xz) > 0.0001) {
  vec2 grassCameraDirection = normalize(grassNormalToCamera.xz);
  grassBillboardNormal = vec3(grassCameraDirection.x, 0.0, grassCameraDirection.y);
}
vec3 grassTerrainNormal = aGrassGroundNormal;
if (dot(grassTerrainNormal, grassTerrainNormal) < 0.0001) {
  grassTerrainNormal = vec3(0.0, 1.0, 0.0);
}
vec3 grassWorldNormal = normalize(
  mix(grassBillboardNormal, normalize(grassTerrainNormal), uGroundNormalStrength)
);
float grassNormalHeight = clamp(position.y, 0.0, 1.0);
vec2 grassNormalWind = grassWindAt(grassNormalBase);
vec3 grassNormalWindDirection = vec3(grassNormalWind.x, 0.0, grassNormalWind.y);
float grassNormalWindAmount = length(grassNormalWindDirection);
if (grassNormalWindAmount > 0.0001) {
  vec3 grassNormalBendAxis = normalize(cross(vec3(0.0, 1.0, 0.0), grassNormalWindDirection));
  grassWorldNormal = grassRotateAxis(
    grassWorldNormal,
    grassNormalBendAxis,
    grassNormalWindAmount * grassNormalHeight * grassNormalHeight * 2.4
  );
}
transformedNormal = normalize(mat3(viewMatrix) * grassWorldNormal);
`;

const GRASS_VERTEX_WIND = `${GRASS_SHADER_MARKER}
float grassHeight = clamp(position.y, 0.0, 1.0);
vBladeHeight = grassHeight;
#ifdef USE_INSTANCING
  mat4 grassProjectInstanceWorld = modelMatrix * instanceMatrix;
  float grassProjectInstanceYaw = atan(instanceMatrix[2].x, instanceMatrix[2].z);
#else
  mat4 grassProjectInstanceWorld = modelMatrix;
  float grassProjectInstanceYaw = 0.0;
#endif
vec3 grassBase = (grassProjectInstanceWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
vec3 grassLocal = transformed;
grassLocal.y *= uGrassHeightScale;
float grassTaper = max(0.08, pow(max(0.0, 1.0 - grassHeight), 0.72));
grassLocal.xz *= grassTaper;
float grassBillboardAngle = atan(cameraPosition.x - grassBase.x, cameraPosition.z - grassBase.z);
float grassLocalBillboardAngle = grassBillboardAngle - grassProjectInstanceYaw;
float grassBillboardCosine = cos(grassLocalBillboardAngle);
float grassBillboardSine = sin(grassLocalBillboardAngle);
vec2 grassBillboardXZ = vec2(
  grassLocal.x * grassBillboardCosine + grassLocal.z * grassBillboardSine,
  -grassLocal.x * grassBillboardSine + grassLocal.z * grassBillboardCosine
);
grassLocal.xz = grassBillboardXZ;
vec3 grassWorldOffset = (grassProjectInstanceWorld * vec4(grassLocal, 0.0)).xyz;
vec2 grassWind = grassWindAt(grassBase);
vec3 grassWindDirection = vec3(grassWind.x, 0.0, grassWind.y);
float grassWindAmount = length(grassWindDirection);
if (grassWindAmount > 0.0001) {
  vec3 grassBendAxis = normalize(cross(vec3(0.0, 1.0, 0.0), grassWindDirection));
  grassWorldOffset = grassRotateAxis(
    grassWorldOffset,
    grassBendAxis,
    grassWindAmount * grassHeight * grassHeight * 2.4
  );
}
vec4 grassWorld = vec4(grassBase + grassWorldOffset, 1.0);
vec4 mvPosition = viewMatrix * grassWorld;
gl_Position = projectionMatrix * mvPosition;
`;

const GRASS_FRAGMENT_DECLARATIONS = `${GRASS_SHADER_MARKER}
uniform vec3 uGrassBottom;
uniform vec3 uGrassTop;
uniform vec3 uGrassShadow;
varying float vBladeHeight;
`;

const GRASS_FRAGMENT_RAMP = `${GRASS_SHADER_MARKER}
float grassBladeMask = clamp(vBladeHeight, 0.0, 1.0);
vec3 grassColor = mix(uGrassBottom, uGrassTop, smoothstep(0.04, 0.96, grassBladeMask));
// Donor-aligned nonlinear root shadow: roots stay dark while the card opens
// into the full bright ramp toward its tip.
float grassRootToTip = pow(smoothstep(0.2, 0.98, grassBladeMask), 0.5);
grassColor = mix(uGrassShadow, grassColor, grassRootToTip);
diffuseColor.rgb = grassColor;
`;

export function createIslandGrassMaterial(style?: IslandGrassStyle): THREE.MeshStandardMaterial {
  const uniforms = createGrassUniforms(style);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.68,
    metalness: 0,
    // A small working-linear lift keeps receiveShadow roots from collapsing
    // into black on the near camera; the donor ramp and the island light still
    // provide the actual colour and value range.
    emissive: 0x3d5f24,
    emissiveIntensity: 0.11,
    side: THREE.FrontSide,
    // Stage owns the one ACES/sRGB grade. Grass emits working-linear colour.
    toneMapped: false,
  });
  material.name = "IslandGrassMaterial";
  material.userData.grassUniforms = uniforms;
  material.customProgramCacheKey = () => "island-grass-billboard-triangle-lit-1";
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (!shader.vertexShader.includes(GRASS_SHADER_MARKER)) {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>\n${GRASS_VERTEX_DECLARATIONS}`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <defaultnormal_vertex>",
        `#include <defaultnormal_vertex>\n${GRASS_VERTEX_NORMAL}`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        GRASS_VERTEX_WIND,
      );
    }
    if (!shader.fragmentShader.includes(GRASS_SHADER_MARKER)) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>\n${GRASS_FRAGMENT_DECLARATIONS}`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>\n${GRASS_FRAGMENT_RAMP}`,
      );
    }
  };
  return material;
}

function materialUniforms(material: THREE.Material): GrassUniforms | null {
  const uniforms = material.userData.grassUniforms as GrassUniforms | undefined;
  return uniforms ?? null;
}

/** Resources made by IslandGrass only; never pass terrain resources here. */
export function disposeIslandGrassResources(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
): void {
  geometry.dispose();
  material.dispose();
}

function mergeOptions(
  options: IslandGrassProps["options"],
  tier: IslandGrassRenderTier,
): IslandGrassPlanOptions {
  return {
    ...options,
    tier,
  };
}

/** World projection deliberately mounts no hooks, mesh, geometry, or material. */
export function IslandGrass(props: IslandGrassProps) {
  if (props.detail === "world") return null;
  return <CourseIslandGrass {...props} />;
}

/** One bounded, instanced course field inside the Stage-owned render loop. */
function CourseIslandGrass({ blueprint, detail, targetRadius, style, options }: IslandGrassProps) {
  const tier = renderTier();
  // IslandRender allocates a new `options` object each render; the fields
  // are the plan. Object identity here re-ran planIslandGrass on first pan.
  const density = options?.density;
  const maxCount = options?.maxCount;
  const seed = options?.seed;
  const routeGap = options?.routeGap;
  const nodeGap = options?.nodeGap;
  const heroGap = options?.heroGap;
  const safetyZones = options?.safetyZones;
  const planOptions = useMemo(
    () => mergeOptions({ density, maxCount, seed, routeGap, nodeGap, heroGap, safetyZones }, tier),
    [density, maxCount, seed, routeGap, nodeGap, heroGap, safetyZones, tier],
  );
  const plan = useMemo(
    () => planIslandGrass(blueprint, detail, planOptions),
    [blueprint, detail, planOptions],
  );
  const scale = islandGeometryScale(blueprint, detail, targetRadius);

  if (plan.placements.length === 0) return null;
  return <CourseIslandGrassField plan={plan} scale={scale} style={style} />;
}

interface IslandGrassOwnedResources {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.MeshStandardMaterial;
}

/**
 * Own the one committed grass batch. Resource creation lives after commit so
 * React StrictMode can probe setup/cleanup/setup without removing a primitive
 * behind R3F's back or reusing a resource that the probe already disposed.
 */
function CourseIslandGrassField({
  plan,
  scale,
  style,
}: {
  readonly plan: IslandGrassPlan;
  readonly scale: number;
  readonly style?: IslandGrassStyle;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const ownedRef = useRef<IslandGrassOwnedResources | null>(null);
  const [owned, setOwned] = useState<IslandGrassOwnedResources | null>(null);
  const camera = useThree(({ camera: activeCamera }) => activeCamera);
  const lodRef = useRef<IslandGrassDistanceTier | null>(null);
  const islandCenter = useRef(new THREE.Vector3());

  useLayoutEffect(() => {
    const resources: IslandGrassOwnedResources = {
      geometry: createIslandGrassClumpGeometry(),
      material: createIslandGrassMaterial(style),
    };
    ownedRef.current = resources;
    setOwned(resources);

    return () => {
      if (ownedRef.current === resources) ownedRef.current = null;
      disposeIslandGrassResources(resources.geometry, resources.material);
    };
  }, []);

  useEffect(() => {
    if (owned) updateGrassUniforms(materialUniforms(owned.material)!, style);
  }, [owned, style]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const dummy = new THREE.Object3D();
    const groundNormals = new Float32Array(plan.placements.length * 3);
    lodRef.current = null;
    target.count = plan.placements.length;
    for (const [index, placement] of plan.placements.entries()) {
      dummy.position.set(placement.x * scale, (placement.y + 0.008) * scale, placement.z * scale);
      dummy.rotation.set(0, placement.rotation + placement.phase * 0.08, 0);
      dummy.scale.set(
        placement.width * scale,
        placement.height * scale * (0.86 + placement.phase * 0.28),
        placement.width * scale,
      );
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
      groundNormals[index * 3] = placement.groundNormal[0];
      groundNormals[index * 3 + 1] = placement.groundNormal[1];
      groundNormals[index * 3 + 2] = placement.groundNormal[2];
    }
    target.geometry.setAttribute(
      "aGrassGroundNormal",
      new THREE.InstancedBufferAttribute(groundNormals, 3),
    );
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
    if (target.boundingSphere) {
      // Wind moves only the blade tips. Inflate the instance sphere once so
      // culling stays correct without turning frustum culling off globally.
      const wind = Math.max(0, finiteOr(style?.windStrength, 0.065));
      target.boundingSphere.radius += (0.42 * scale + wind) * 1.5;
    }
  }, [owned, plan, scale, style?.windStrength]);

  useFrame(({ clock }) => {
    const target = mesh.current;
    if (!target || !owned) return;
    target.getWorldPosition(islandCenter.current);
    const distance = camera.position.distanceTo(islandCenter.current);
    const distanceTier = islandGrassLodForDistance(distance, lodRef.current);
    if (distanceTier !== lodRef.current) {
      lodRef.current = distanceTier;
      target.count = islandGrassInstanceCountForLod(plan, distanceTier);
    }
    const uniforms = materialUniforms(owned.material);
    if (uniforms) {
      uniforms.uGrassHeightScale.value = ISLAND_GRASS_LOD_PROFILES[distanceTier].heightMultiplier;
      if (!(import.meta.env.DEV && islandLookFrozen())) {
        uniforms.uTime.value = clock.elapsedTime;
      }
    }
  });

  if (!owned) return null;
  return (
    // Receives the island's shadows, casts none of its own. A dense field of
    // tiny casters in one 2048 map buys moire and dark speckle, not shadow;
    // the donor's grass makes the same trade. Without the receive side the
    // meadow sat outside the lighting entirely — a tree's shadow crossed the
    // ground and stopped at the grass.
    <instancedMesh
      name="island-grass"
      castShadow={false}
      receiveShadow
      ref={mesh}
      args={[owned.geometry, owned.material, plan.placements.length]}
      frustumCulled
    />
  );
}
