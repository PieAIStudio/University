/**
 * R3F adapter for the bounded IslandGrass plan.
 *
 * One course owns one low-poly blade geometry, one material, and one
 * InstancedMesh. Wind updates the material's uniform through the Stage-owned
 * `useFrame` loop; this component never creates a renderer or a second loop.
 * The blueprint and any terrain geometry remain caller-owned and are never
 * disposed here.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
  planIslandGrass,
  type IslandGrassPlan,
  type IslandGrassPlanOptions,
  type IslandGrassSafetyZone,
  type IslandGrassRenderTier,
} from "./island-grass.js";
import { islandGeometryScale, type IslandGeometryDetail } from "./island-geometry.js";
import { islandLookFrozen } from "./island-surface-style.js";
import type { IslandBlueprint } from "./island-blueprint.js";
import { renderTier } from "../sky/tier.js";

const DEFAULT_GRASS_BOTTOM = new THREE.Color(0x4f7c38);
const DEFAULT_GRASS_TOP = new THREE.Color(0x9fc862);

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
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function colorOr(value: THREE.ColorRepresentation | undefined, fallback: THREE.Color): THREE.Color {
  return value === undefined ? fallback.clone() : new THREE.Color(value);
}

function styleValues(style: IslandGrassStyle | undefined) {
  const direction = style?.windDirection ?? [0.78, 0.62];
  const length = Math.hypot(direction[0] ?? 0, direction[1] ?? 0) || 1;
  return {
    bottom: colorOr(style?.bottom, DEFAULT_GRASS_BOTTOM),
    top: colorOr(style?.top, DEFAULT_GRASS_TOP),
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

/** One shared three-plane tuft, deliberately tiny enough for a course field. */
export function createIslandGrassBladeGeometry(): THREE.BufferGeometry {
  const segments = 2;
  const planes = 3;
  const verticesPerPlane = segments * 2 + 1;
  const positions = new Float32Array(planes * verticesPerPlane * 3);
  const uvs = new Float32Array(planes * verticesPerPlane * 2);
  const indices: number[] = [];
  for (let plane = 0; plane < planes; plane += 1) {
    const angle = (plane / planes) * Math.PI;
    const axisX = Math.cos(angle);
    const axisZ = Math.sin(angle);
    const bendX = -axisZ;
    const bendZ = axisX;
    const planeVertex = plane * verticesPerPlane;
    for (let row = 0; row < segments; row += 1) {
      const t = row / segments;
      const width = 0.5 * Math.pow(1 - t, 1.2);
      const bend = 0.08 * t * t;
      const vertex = planeVertex + row * 2;
      positions.set(
        [
          -axisX * width + bendX * bend,
          t,
          -axisZ * width + bendZ * bend,
          axisX * width + bendX * bend,
          t,
          axisZ * width + bendZ * bend,
        ],
        vertex * 3,
      );
      uvs.set([0, t, 1, t], vertex * 2);
      if (row < segments - 1) {
        indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3);
      }
    }
    const tip = planeVertex + segments * 2;
    positions.set([bendX * 0.08, 1, bendZ * 0.08], tip * 3);
    uvs.set([0.5, 1], tip * 2);
    const finalLeft = planeVertex + (segments - 1) * 2;
    indices.push(finalLeft, tip, finalLeft + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const GRASS_SHADER_MARKER = "/* university island grass lit v1 */";

/**
 * Grass used to be an unlit ShaderMaterial. That capped land p95 at the
 * albedo of the blade tip: no amount of sun could light a field that never
 * asked the lights. The wind and height ramp stay; MeshStandardMaterial is
 * the one lighting model the rest of the island already uses. Stage still
 * owns ACES and the sRGB encode.
 *
 * Tip/root ramp is the donor idea from elemental-serenity
 * `Shaders/Chunks/grass/grass.fragment_color_chunk.glsl` at
 * `6b8cebefa0ee10e1bdd081dd342a01b3fe753e09`, without its displacement map.
 */
const GRASS_VERTEX_DECLARATIONS = `${GRASS_SHADER_MARKER}
uniform float uTime;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform float uWindFrequency;
uniform vec2 uWindDirection;
varying float vBladeHeight;
varying float vBladeVariation;
`;

const GRASS_VERTEX_WIND = `${GRASS_SHADER_MARKER}
vBladeHeight = uv.y;
#ifdef USE_INSTANCING
  vec4 grassInstanceOrigin = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec4 grassLocal = instanceMatrix * vec4(transformed, 1.0);
#else
  vec4 grassInstanceOrigin = vec4(0.0, 0.0, 0.0, 1.0);
  vec4 grassLocal = vec4(transformed, 1.0);
#endif
vec3 grassBase = (modelMatrix * grassInstanceOrigin).xyz;
vBladeVariation = fract(sin(dot(grassBase.xz, vec2(127.1, 311.7))) * 43758.5453123);
float grassWave = sin(
  dot(grassBase.xz, uWindDirection) * uWindFrequency +
  uTime * uWindSpeed +
  vBladeVariation * 6.28318 * 0.65
);
vec4 grassWorld = modelMatrix * grassLocal;
grassWorld.xz += uWindDirection * grassWave * uWindStrength * uv.y * uv.y;
vec4 mvPosition = viewMatrix * grassWorld;
gl_Position = projectionMatrix * mvPosition;
`;

const GRASS_FRAGMENT_DECLARATIONS = `${GRASS_SHADER_MARKER}
uniform vec3 uGrassBottom;
uniform vec3 uGrassTop;
varying float vBladeHeight;
varying float vBladeVariation;
`;

const GRASS_FRAGMENT_RAMP = `${GRASS_SHADER_MARKER}
vec3 grassColor = mix(uGrassBottom, uGrassTop, smoothstep(0.08, 1.0, vBladeHeight));
grassColor *= mix(0.9, 1.22, vBladeVariation);
grassColor *= mix(0.82, 1.28, smoothstep(0.0, 1.0, vBladeHeight));
diffuseColor.rgb = grassColor * 1.28;
`;

function createIslandGrassMaterial(style?: IslandGrassStyle): THREE.MeshStandardMaterial {
  const uniforms = createGrassUniforms(style);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.62,
    metalness: 0,
    emissive: 0x6a8a3c,
    emissiveIntensity: 0.08,
    side: THREE.DoubleSide,
    // Stage owns the one ACES/sRGB grade. Grass emits working-linear colour.
    toneMapped: false,
  });
  material.name = "IslandGrassMaterial";
  material.userData.grassUniforms = uniforms;
  material.customProgramCacheKey = () => "island-grass-lit-1";
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (!shader.vertexShader.includes(GRASS_SHADER_MARKER)) {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>\n${GRASS_VERTEX_DECLARATIONS}`,
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

  useLayoutEffect(() => {
    const resources: IslandGrassOwnedResources = {
      geometry: createIslandGrassBladeGeometry(),
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
    for (const [index, placement] of plan.placements.entries()) {
      dummy.position.set(placement.x * scale, (placement.y + 0.008) * scale, placement.z * scale);
      dummy.rotation.set(0, placement.rotation + placement.phase * 0.08, 0);
      dummy.scale.set(
        placement.width * scale,
        placement.height * scale * (0.86 + placement.phase * 0.28),
        scale * (0.72 + placement.phase * 0.36),
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
    if (import.meta.env.DEV && islandLookFrozen()) return;
    const uniforms = owned ? materialUniforms(owned.material) : null;
    if (uniforms) uniforms.uTime.value = clock.elapsedTime;
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
