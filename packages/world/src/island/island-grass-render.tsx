/**
 * R3F adapter for the bounded IslandGrass plan.
 *
 * One course owns one low-poly blade geometry, one material, and one
 * InstancedMesh. Wind updates the material's uniform through the Stage-owned
 * `useFrame` loop; this component never creates a renderer or a second loop.
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
// value ramp in the clump makes volume read even when the key light is flat.
const DEFAULT_GRASS_BOTTOM = new THREE.Color(0x2d5c2f);
const DEFAULT_GRASS_TOP = new THREE.Color(0xb0df83);
const GRASS_BOTTOM_LSTAR = 35; // CIELAB L* at each leaf root.
const GRASS_TOP_LSTAR = 88; // CIELAB L* at the brightest leaf tips.

export interface IslandGrassStyle {
  readonly bottom?: THREE.ColorRepresentation;
  readonly top?: THREE.ColorRepresentation;
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
  uGrassHeightScale: THREE.IUniform<number>;
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
  const length = Math.hypot(direction[0] ?? 0, direction[1] ?? 0) || 1;
  return {
    // Theme styles retain their hue/chroma but share the same perceptual
    // endpoint values: the meadow's identity comes from value first here.
    bottom: normalizeColorLStar(style?.bottom, DEFAULT_GRASS_BOTTOM, GRASS_BOTTOM_LSTAR),
    top: normalizeColorLStar(style?.top, DEFAULT_GRASS_TOP, GRASS_TOP_LSTAR),
    windStrength: Math.max(0, finiteOr(style?.windStrength, 0.065)),
    windSpeed: Math.max(0, finiteOr(style?.windSpeed, 1.15)),
    windFrequency: Math.max(0, finiteOr(style?.windFrequency, 0.24)),
    windDirection: new THREE.Vector2((direction[0] ?? 0) / length, (direction[1] ?? 0) / length),
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
    uGrassHeightScale: { value: 1 },
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
}

export const ISLAND_GRASS_LEAF_COUNT = 5 as const;
export const ISLAND_GRASS_LEAF_SEGMENTS = 5 as const;
export const ISLAND_GRASS_CLUMP_TRIANGLES =
  ISLAND_GRASS_LEAF_COUNT * (ISLAND_GRASS_LEAF_SEGMENTS * 2 - 1);

interface GrassLeafRecipe {
  readonly angle: number;
  readonly offsetX: number;
  readonly offsetZ: number;
  readonly height: number;
  readonly width: number;
  /** Horizontal tip displacement; atan(bend / height) is 20–35°. */
  readonly bend: number;
  readonly variation: number;
}

/**
 * A single instance contains five curved ribbons. Their roots occupy roughly
 * a 0.8-unit disc and their normals face five different azimuths, including
 * opposing directions, so no camera sees only an edge-on card.
 */
const GRASS_LEAF_RECIPES: readonly GrassLeafRecipe[] = [
  { angle: 0.12, offsetX: 0, offsetZ: 0, height: 1.0, width: 1.0, bend: 0.46, variation: 0.18 },
  {
    angle: 1.28,
    offsetX: 0.25,
    offsetZ: -0.04,
    height: 0.9,
    width: 0.9,
    bend: 0.4,
    variation: 0.42,
  },
  {
    angle: 2.53,
    offsetX: -0.22,
    offsetZ: 0.12,
    height: 1.06,
    width: 0.92,
    bend: 0.54,
    variation: 0.72,
  },
  {
    angle: 3.72,
    offsetX: 0.04,
    offsetZ: 0.25,
    height: 0.95,
    width: 0.86,
    bend: 0.5,
    variation: 0.9,
  },
  {
    angle: 5.05,
    offsetX: -0.08,
    offsetZ: -0.23,
    height: 0.84,
    width: 0.96,
    bend: 0.43,
    variation: 0.3,
  },
];

/** One shared five-leaf, five-segment clump geometry for every instance. */
export function createIslandGrassClumpGeometry(): THREE.BufferGeometry {
  const verticesPerLeaf = ISLAND_GRASS_LEAF_SEGMENTS * 2 + 1;
  const vertexCount = GRASS_LEAF_RECIPES.length * verticesPerLeaf;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const occlusions = new Float32Array(vertexCount);
  const variations = new Float32Array(vertexCount);
  const indices: number[] = [];

  for (const [leafIndex, recipe] of GRASS_LEAF_RECIPES.entries()) {
    const growthX = Math.cos(recipe.angle);
    const growthZ = Math.sin(recipe.angle);
    const widthAxisX = -growthZ;
    const widthAxisZ = growthX;
    const leafVertex = leafIndex * verticesPerLeaf;
    const outerness = Math.min(1, Math.hypot(recipe.offsetX, recipe.offsetZ) / 0.34);
    const bendAngle = Math.atan2(recipe.bend, recipe.height);

    for (let row = 0; row < ISLAND_GRASS_LEAF_SEGMENTS; row += 1) {
      const t = row / ISLAND_GRASS_LEAF_SEGMENTS;
      const height = t * recipe.height;
      const width = 0.17 * recipe.width * (1 - t) ** 0.88;
      const curve = recipe.bend * t ** 1.72;
      const centreX = recipe.offsetX + growthX * curve;
      const centreZ = recipe.offsetZ + growthZ * curve;
      const vertex = leafVertex + row * 2;
      positions.set(
        [
          centreX - widthAxisX * width,
          height,
          centreZ - widthAxisZ * width,
          centreX + widthAxisX * width,
          height,
          centreZ + widthAxisZ * width,
        ],
        vertex * 3,
      );
      uvs.set([0, t, 1, t], vertex * 2);
      occlusions[vertex] = outerness;
      occlusions[vertex + 1] = outerness;
      variations[vertex] = recipe.variation;
      variations[vertex + 1] = recipe.variation;
      if (row < ISLAND_GRASS_LEAF_SEGMENTS - 1) {
        indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3);
      }
    }

    const tip = leafVertex + ISLAND_GRASS_LEAF_SEGMENTS * 2;
    positions.set(
      [
        recipe.offsetX + growthX * recipe.bend,
        recipe.height,
        recipe.offsetZ + growthZ * recipe.bend,
      ],
      tip * 3,
    );
    uvs.set([0.5, 1], tip * 2);
    occlusions[tip] = outerness;
    variations[tip] = recipe.variation;
    const finalLeft = leafVertex + (ISLAND_GRASS_LEAF_SEGMENTS - 1) * 2;
    indices.push(finalLeft, tip, finalLeft + 1);

    // Keep the angle calculation live in the recipe rather than burying a
    // magic bend in the shader; this assertion is also useful when recipes
    // are tuned by eye. Every leaf stays in the requested 20–35° envelope.
    if (bendAngle < THREE.MathUtils.degToRad(20) || bendAngle > THREE.MathUtils.degToRad(35)) {
      throw new RangeError("Island grass leaf bend must stay between 20 and 35 degrees");
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.name = "IslandGrassClumpGeometry";
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("aClumpOcclusion", new THREE.Float32BufferAttribute(occlusions, 1));
  geometry.setAttribute("aLeafVariation", new THREE.Float32BufferAttribute(variations, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Compatibility export for code that has not renamed the old placement yet. */
export const createIslandGrassBladeGeometry = createIslandGrassClumpGeometry;

const GRASS_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uWindStrength;
  uniform float uWindSpeed;
  uniform float uWindFrequency;
  uniform vec2 uWindDirection;
  uniform float uGrassHeightScale;
  attribute float aClumpOcclusion;
  attribute float aLeafVariation;
  varying float vBladeHeight;
  varying float vClumpOcclusion;
  varying float vLeafVariation;

  void main() {
    vBladeHeight = uv.y;
    vClumpOcclusion = aClumpOcclusion;
    vLeafVariation = aLeafVariation;
    mat4 instanceWorldMatrix = modelMatrix * instanceMatrix;
    vec3 baseWorldPosition = (instanceWorldMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    // The phase is world-space, never instance-id space: nearby clumps lean
    // together and the two crossed waves read as one sweep over the meadow.
    vec2 crossWind = vec2(-uWindDirection.y, uWindDirection.x);
    float wavePhase = dot(baseWorldPosition.xz, uWindDirection) * uWindFrequency;
    float gustPhase = dot(baseWorldPosition.xz, crossWind) * uWindFrequency * 0.58;
    float wave =
      sin(wavePhase + uTime * uWindSpeed) * 0.78 +
      sin(gustPhase + uTime * uWindSpeed * 0.72 + 1.7) * 0.22;
    float tipMask = smoothstep(0.04, 1.0, uv.y) * uv.y;
    vec3 localPosition = position;
    localPosition.y *= uGrassHeightScale;
    vec4 worldPosition = instanceWorldMatrix * vec4(localPosition, 1.0);
    worldPosition.xz += uWindDirection * wave * uWindStrength * tipMask;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const GRASS_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uGrassBottom;
  uniform vec3 uGrassTop;
  varying float vBladeHeight;
  varying float vClumpOcclusion;
  varying float vLeafVariation;

  void main() {
    vec3 grassColor = mix(uGrassBottom, uGrassTop, smoothstep(0.04, 0.96, vBladeHeight));
    grassColor *= mix(0.94, 1.06, vLeafVariation);
    // Cheap self-AO: inner roots begin at 0.64, while outer/taller tips open
    // toward the full ramp. This darkens the centre and the lower leaflets
    // without a shadow pass or a second material.
    float selfOcclusion = mix(
      0.64,
      1.0,
      clamp(vClumpOcclusion + smoothstep(0.18, 1.0, vBladeHeight) * 0.42, 0.0, 1.0)
    );
    grassColor *= selfOcclusion;
    gl_FragColor = vec4(grassColor, 1.0);
    // ShaderMaterial does not append Three's output conversion for a custom
    // fragment. Keep the authored ramp working-linear, then perform the one
    // renderer-owned sRGB encode required by Stage's post=off path.
    #include <colorspace_fragment>
  }
`;

function createIslandGrassMaterial(style?: IslandGrassStyle): THREE.ShaderMaterial {
  const uniforms = createGrassUniforms(style);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: GRASS_VERTEX_SHADER,
    fragmentShader: GRASS_FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
    transparent: false,
    // Stage owns the one ACES/sRGB grade. Grass emits working-linear colour.
    toneMapped: false,
  });
  material.name = "IslandGrassMaterial";
  material.customProgramCacheKey = () => "island-grass-clump-v2";
  return material;
}

function materialUniforms(material: THREE.Material): GrassUniforms | null {
  if (!(material instanceof THREE.ShaderMaterial)) return null;
  return material.uniforms as unknown as GrassUniforms;
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
  const planOptions = useMemo(() => mergeOptions(options, tier), [options, tier]);
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
  readonly material: THREE.ShaderMaterial;
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
    }
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
    <instancedMesh
      ref={mesh}
      args={[owned.geometry, owned.material, plan.placements.length]}
      frustumCulled
    />
  );
}
