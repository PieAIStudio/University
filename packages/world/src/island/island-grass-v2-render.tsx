/**
 * R3F adapter for the bounded IslandGrass V2 plan.
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
  planIslandGrassV2,
  type IslandGrassPlanV2,
  type IslandGrassPlanOptionsV2,
  type IslandGrassSafetyZoneV2,
  type IslandGrassRenderTierV2,
} from "./island-grass-v2.js";
import { islandGeometryV2Scale, type IslandGeometryV2Detail } from "./island-geometry-v2.js";
import type { IslandBlueprintV2 } from "./island-blueprint-v2.js";
import { renderTier } from "../sky/tier.js";

const DEFAULT_GRASS_BOTTOM = new THREE.Color(0x4f7c38);
const DEFAULT_GRASS_TOP = new THREE.Color(0x9fc862);

export interface IslandGrassStyleV2 {
  readonly bottom?: THREE.ColorRepresentation;
  readonly top?: THREE.ColorRepresentation;
  readonly windStrength?: number;
  readonly windSpeed?: number;
  readonly windFrequency?: number;
  readonly windDirection?: readonly [number, number];
}

export interface IslandGrassV2Props {
  readonly blueprint: IslandBlueprintV2;
  readonly detail: IslandGeometryV2Detail;
  readonly targetRadius?: number;
  readonly style?: IslandGrassStyleV2;
  readonly options?: Omit<IslandGrassPlanOptionsV2, "tier" | "safetyZones"> & {
    readonly safetyZones?: readonly IslandGrassSafetyZoneV2[];
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

function styleValues(style: IslandGrassStyleV2 | undefined) {
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

function createGrassUniforms(style?: IslandGrassStyleV2): GrassUniforms {
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

function updateGrassUniforms(uniforms: GrassUniforms, style?: IslandGrassStyleV2): void {
  const values = styleValues(style);
  uniforms.uWindStrength.value = values.windStrength;
  uniforms.uWindSpeed.value = values.windSpeed;
  uniforms.uWindFrequency.value = values.windFrequency;
  uniforms.uWindDirection.value.copy(values.windDirection);
  uniforms.uGrassBottom.value.copy(values.bottom);
  uniforms.uGrassTop.value.copy(values.top);
}

/** One shared three-plane tuft, deliberately tiny enough for a course field. */
export function createIslandGrassBladeGeometryV2(): THREE.BufferGeometry {
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

const GRASS_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uWindStrength;
  uniform float uWindSpeed;
  uniform float uWindFrequency;
  uniform vec2 uWindDirection;
  varying float vBladeHeight;
  varying float vBladeVariation;

  void main() {
    vBladeHeight = uv.y;
    mat4 instanceWorldMatrix = modelMatrix * instanceMatrix;
    vec3 baseWorldPosition = (instanceWorldMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vBladeVariation = fract(
      sin(dot(baseWorldPosition.xz, vec2(127.1, 311.7))) * 43758.5453123
    );
    // A stable per-instance phase keeps the field from breathing in lockstep,
    // while the shared frequency/speed remain one cheap material uniform.
    float wave = sin(
      dot(baseWorldPosition.xz, uWindDirection) * uWindFrequency +
      uTime * uWindSpeed +
      vBladeVariation * 6.28318 * 0.65
    );
    float tipMask = uv.y * uv.y;
    vec4 worldPosition = instanceWorldMatrix * vec4(position, 1.0);
    worldPosition.xz += uWindDirection * wave * uWindStrength * tipMask;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const GRASS_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uGrassBottom;
  uniform vec3 uGrassTop;
  varying float vBladeHeight;
  varying float vBladeVariation;

  void main() {
    vec3 grassColor = mix(uGrassBottom, uGrassTop, smoothstep(0.08, 1.0, vBladeHeight));
    grassColor *= mix(0.86, 1.08, vBladeVariation);
    grassColor *= mix(0.78, 1.02, smoothstep(0.0, 1.0, vBladeHeight));
    gl_FragColor = vec4(grassColor, 1.0);
  }
`;

function createIslandGrassMaterialV2(style?: IslandGrassStyleV2): THREE.ShaderMaterial {
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
  material.name = "IslandGrassV2Material";
  return material;
}

function materialUniforms(material: THREE.Material): GrassUniforms | null {
  if (!(material instanceof THREE.ShaderMaterial)) return null;
  return material.uniforms as unknown as GrassUniforms;
}

/** Resources made by IslandGrassV2 only; never pass terrain resources here. */
export function disposeIslandGrassV2Resources(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
): void {
  geometry.dispose();
  material.dispose();
}

function mergeOptions(
  options: IslandGrassV2Props["options"],
  tier: IslandGrassRenderTierV2,
): IslandGrassPlanOptionsV2 {
  return {
    ...options,
    tier,
  };
}

/** World projection deliberately mounts no hooks, mesh, geometry, or material. */
export function IslandGrassV2(props: IslandGrassV2Props) {
  if (props.detail === "world") return null;
  return <CourseIslandGrassV2 {...props} />;
}

/** One bounded, instanced course field inside the Stage-owned render loop. */
function CourseIslandGrassV2({
  blueprint,
  detail,
  targetRadius,
  style,
  options,
}: IslandGrassV2Props) {
  const tier = renderTier();
  const planOptions = useMemo(() => mergeOptions(options, tier), [options, tier]);
  const plan = useMemo(
    () => planIslandGrassV2(blueprint, detail, planOptions),
    [blueprint, detail, planOptions],
  );
  const scale = islandGeometryV2Scale(blueprint, detail, targetRadius);

  if (plan.placements.length === 0) return null;
  return <CourseIslandGrassField plan={plan} scale={scale} style={style} />;
}

interface IslandGrassOwnedResourcesV2 {
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
  readonly plan: IslandGrassPlanV2;
  readonly scale: number;
  readonly style?: IslandGrassStyleV2;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const ownedRef = useRef<IslandGrassOwnedResourcesV2 | null>(null);
  const [owned, setOwned] = useState<IslandGrassOwnedResourcesV2 | null>(null);

  useLayoutEffect(() => {
    const resources: IslandGrassOwnedResourcesV2 = {
      geometry: createIslandGrassBladeGeometryV2(),
      material: createIslandGrassMaterialV2(style),
    };
    ownedRef.current = resources;
    setOwned(resources);

    return () => {
      if (ownedRef.current === resources) ownedRef.current = null;
      disposeIslandGrassV2Resources(resources.geometry, resources.material);
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
