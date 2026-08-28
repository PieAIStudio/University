/**
 * Elemental-Serenity foliage projection.
 *
 * The donor reference is elemental-serenity at 6b8cebefa0ee10e1bdd081dd342a01b3fe753e09:
 * `BushManager.class.js` samples `bushEmitter.glb` with `MeshSurfaceSampler`,
 * and `Shaders/Materials/bush/{vertex,fragment}.glsl` uses a three-stop normal
 * colour ramp plus a custom alpha-aware depth material. This module keeps that
 * technique while making the unregistered alpha image unnecessary: the same
 * procedural UV mask is evaluated by the colour and depth shaders.
 * The registered donor `leaf.glb` remains available for other future-use
 * paths; this projection follows BushManager and uses the cheaper shared
 * `PlaneGeometry(1,1)` card for both trees and bushes.
 *
 * Placement is deliberately not authored here. IslandDressing passes the
 * positions compiled from IslandField; this module only projects those points
 * into donor trunks, leaf cards, and the world silhouette.
 */
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three-stdlib";

import { useIslandGLTF, type Placement } from "../kit.js";
import { resolveIslandRuntimeAsset, type IslandAssetPackId } from "./island-asset-registry.js";
import type { IslandDressingPlacement, IslandDressingPlan } from "./island-dressing.js";
import { seeded } from "./random.js";

const ELEMENTAL_SERENITY_PACK: IslandAssetPackId = "elemental-serenity";
const TREE_ASSET_ID = "treeTrunks";
const BUSH_ASSET_ID = "bushEmitter";

function donorSource(assetId: string): string {
  const asset = resolveIslandRuntimeAsset(ELEMENTAL_SERENITY_PACK, assetId);
  if (!asset) {
    throw new Error(`Missing registered elemental-serenity asset: ${assetId}`);
  }
  return asset.src;
}

const TREE_SRC = donorSource(TREE_ASSET_ID);
const BUSH_SRC = donorSource(BUSH_ASSET_ID);

const UP = new THREE.Vector3(0, 1, 0);
const PLANE_NORMAL = new THREE.Vector3(0, 0, 1);

const FOLIAGE_COLOURS = {
  shadow: new THREE.Color(0x27472d),
  mid: new THREE.Color(0x5e9549),
  highlight: new THREE.Color(0xb4d86c),
  multiplier: new THREE.Color(0.92, 0.98, 0.82),
} as const;

interface FoliageInstance {
  readonly position: THREE.Vector3;
  readonly normal: THREE.Vector3;
  readonly scale: number;
  readonly multiplier: THREE.Color;
  readonly seed: number;
}

interface FoliageResources {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.ShaderMaterial;
  readonly depthMaterial: THREE.ShaderMaterial;
}

interface TrunkVariant {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
  readonly triangles: number;
}

function disposeTrunkVariants(variants: readonly TrunkVariant[]) {
  for (const variant of variants) {
    variant.geometry.dispose();
    variant.material.dispose();
  }
}

const FOLIAGE_VERTEX_SHADER = /* glsl */ `
#include <common>
#include <fog_pars_vertex>

precision highp float;

attribute vec3 instanceNormal;
attribute vec3 instanceShadowColor;
attribute vec3 instanceMidColor;
attribute vec3 instanceHighlightColor;
attribute vec3 instanceColorMultiplier;
attribute float instanceSeed;

varying vec3 vInstanceNormal;
varying vec3 vInstanceShadowColor;
varying vec3 vInstanceMidColor;
varying vec3 vInstanceHighlightColor;
varying vec3 vInstanceColorMultiplier;
varying vec2 vUv;
varying float vWorldY;

uniform float uTime;

void main() {
  mat4 instance = mat4(1.0);
  #ifdef USE_INSTANCING
    instance = instanceMatrix;
  #endif

  vec4 worldPosition = modelMatrix * instance * vec4(position, 1.0);
  // Keep the donor's gentle movement vocabulary, but apply it identically to
  // the depth pass. There is no placement noise here; the seed belongs only to
  // a leaf card's small animated offset.
  float heightMask = smoothstep(0.05, 0.9, abs(position.x) + abs(position.y) + abs(position.z));
  float breeze = sin(uTime * 0.55 + instanceSeed * 17.0 + worldPosition.x * 0.11 + worldPosition.z * 0.07);
  worldPosition.x += breeze * 0.018 * heightMask;
  worldPosition.z += breeze * 0.012 * heightMask;

  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;

  vInstanceNormal = normalize(instanceNormal);
  vInstanceShadowColor = instanceShadowColor;
  vInstanceMidColor = instanceMidColor;
  vInstanceHighlightColor = instanceHighlightColor;
  vInstanceColorMultiplier = instanceColorMultiplier;
  vUv = uv;
  vWorldY = worldPosition.y;

  #include <fog_vertex>
}
`;

const LEAF_MASK = /* glsl */ `
float leafMask(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float y = abs(p.y);
  float halfWidth = mix(0.84, 0.16, smoothstep(0.0, 1.0, y));
  float sides = 1.0 - smoothstep(halfWidth, halfWidth + 0.085, abs(p.x));
  float tips = 1.0 - smoothstep(0.92, 1.0, y);
  return sides * tips;
}
`;

const FOLIAGE_FRAGMENT_SHADER = /* glsl */ `
#include <common>
#include <fog_pars_fragment>

precision highp float;

varying vec3 vInstanceNormal;
varying vec3 vInstanceShadowColor;
varying vec3 vInstanceMidColor;
varying vec3 vInstanceHighlightColor;
varying vec3 vInstanceColorMultiplier;
varying vec2 vUv;
varying float vWorldY;

uniform vec3 uLightDirection;
uniform bool uMaskEnabled;

${LEAF_MASK}

vec3 colorRamp(float t, vec3 shadowColor, vec3 midColor, vec3 highlightColor) {
  if (t < 0.5) return mix(shadowColor, midColor, t * 2.0);
  return mix(midColor, highlightColor, (t - 0.5) * 2.0);
}

void main() {
  float alpha = uMaskEnabled ? leafMask(vUv) : 1.0;
  if (alpha < 0.45) discard;

  vec3 normal = normalize(vInstanceNormal);
  float ndl = dot(normal, normalize(uLightDirection));
  ndl = ndl * 0.6 + 0.4;
  float height = clamp(vWorldY * 0.08, 0.0, 1.0);
  float ramp = clamp(ndl * 0.78 + height * 0.22, 0.0, 1.0);
  vec3 colour = colorRamp(
    ramp,
    vInstanceShadowColor,
    vInstanceMidColor,
    vInstanceHighlightColor
  ) * vInstanceColorMultiplier;

  gl_FragColor = vec4(colour, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

const FOLIAGE_DEPTH_FRAGMENT_SHADER = /* glsl */ `
#include <packing>

varying vec2 vUv;
uniform bool uMaskEnabled;

${LEAF_MASK}

void main() {
  if (uMaskEnabled && leafMask(vUv) < 0.45) discard;
  gl_FragColor = packDepthToRGBA(gl_FragCoord.z);
}
`;

function foliageLightDirection(scene: THREE.Scene): THREE.Vector3 {
  let direction = new THREE.Vector3(-0.35, 0.82, -0.44).normalize();
  let found = false;
  scene.traverse((object) => {
    if (object.type !== "DirectionalLight") return;
    if (found) return;
    direction = object.position.clone().normalize();
    found = true;
  });
  return direction;
}

function writeColour(target: Float32Array, index: number, colour: THREE.Color) {
  target[index * 3] = colour.r;
  target[index * 3 + 1] = colour.g;
  target[index * 3 + 2] = colour.b;
}

function projectFoliageGeometry(
  source: THREE.BufferGeometry,
  instances: readonly FoliageInstance[],
): THREE.BufferGeometry {
  const geometry = source.clone();
  const count = instances.length;
  const normals = new Float32Array(count * 3);
  const shadows = new Float32Array(count * 3);
  const mids = new Float32Array(count * 3);
  const highlights = new Float32Array(count * 3);
  const multipliers = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  instances.forEach((instance, index) => {
    normals[index * 3] = instance.normal.x;
    normals[index * 3 + 1] = instance.normal.y;
    normals[index * 3 + 2] = instance.normal.z;
    writeColour(shadows, index, FOLIAGE_COLOURS.shadow);
    writeColour(mids, index, FOLIAGE_COLOURS.mid);
    writeColour(highlights, index, FOLIAGE_COLOURS.highlight);
    writeColour(multipliers, index, instance.multiplier);
    seeds[index] = instance.seed;
  });

  geometry.setAttribute("instanceNormal", new THREE.InstancedBufferAttribute(normals, 3));
  geometry.setAttribute("instanceShadowColor", new THREE.InstancedBufferAttribute(shadows, 3));
  geometry.setAttribute("instanceMidColor", new THREE.InstancedBufferAttribute(mids, 3));
  geometry.setAttribute(
    "instanceHighlightColor",
    new THREE.InstancedBufferAttribute(highlights, 3),
  );
  geometry.setAttribute(
    "instanceColorMultiplier",
    new THREE.InstancedBufferAttribute(multipliers, 3),
  );
  geometry.setAttribute("instanceSeed", new THREE.InstancedBufferAttribute(seeds, 1));
  return geometry;
}

function createFoliageResources(
  source: THREE.BufferGeometry,
  instances: readonly FoliageInstance[],
  lightDirection: THREE.Vector3,
  maskEnabled: boolean,
): FoliageResources {
  const geometry = projectFoliageGeometry(source, instances);
  const fogUniforms = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
  const material = new THREE.ShaderMaterial({
    defines: { USE_INSTANCING: "" },
    uniforms: {
      ...fogUniforms,
      uTime: { value: 0 },
      uLightDirection: { value: lightDirection.clone() },
      uMaskEnabled: { value: maskEnabled },
    },
    vertexShader: FOLIAGE_VERTEX_SHADER,
    fragmentShader: FOLIAGE_FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    fog: true,
    depthTest: true,
    depthWrite: true,
    transparent: false,
  });
  const depthMaterial = new THREE.ShaderMaterial({
    defines: { USE_INSTANCING: "" },
    uniforms: { uTime: { value: 0 }, uMaskEnabled: { value: maskEnabled } },
    vertexShader: FOLIAGE_VERTEX_SHADER,
    fragmentShader: FOLIAGE_DEPTH_FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
    transparent: false,
  });
  return { geometry, material, depthMaterial };
}

function FoliageInstancedField({
  source,
  baseNormal,
  instances,
  lightDirection,
  maskEnabled = true,
  castShadow = true,
}: {
  readonly source: THREE.BufferGeometry;
  readonly baseNormal: THREE.Vector3;
  readonly instances: readonly FoliageInstance[];
  readonly lightDirection: THREE.Vector3;
  readonly maskEnabled?: boolean;
  readonly castShadow?: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const resources = useMemo(
    () => createFoliageResources(source, instances, lightDirection, maskEnabled),
    [instances, lightDirection, maskEnabled, source],
  );

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const quaternion = new THREE.Quaternion();
    const dummy = new THREE.Object3D();
    instances.forEach((instance, index) => {
      dummy.position.copy(instance.position);
      quaternion.setFromUnitVectors(baseNormal, instance.normal);
      dummy.quaternion.copy(quaternion);
      dummy.scale.setScalar(instance.scale);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
    target.customDepthMaterial = resources.depthMaterial;
    target.customDistanceMaterial = resources.depthMaterial;
  }, [baseNormal, instances, resources]);

  useEffect(
    () => () => {
      resources.geometry.dispose();
      resources.material.dispose();
      resources.depthMaterial.dispose();
    },
    [resources],
  );

  if (instances.length === 0) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[resources.geometry, resources.material, instances.length]}
      castShadow={castShadow}
      receiveShadow
      frustumCulled={false}
      userData={{ islandLookFoliageInstanceCount: instances.length }}
    />
  );
}

function normalizedTrunkVariants(
  scene: THREE.Object3D,
  maxVariants = Number.POSITIVE_INFINITY,
): readonly TrunkVariant[] {
  scene.updateMatrixWorld(true);
  const variants: TrunkVariant[] = [];
  scene.traverse((object) => {
    if (variants.length >= maxVariants) return;
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const sourceMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!sourceMaterial) return;
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) return;
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const height = Math.max(size.y, 1e-5);
    const normalise = new THREE.Matrix4()
      .makeScale(1 / height, 1 / height, 1 / height)
      .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z));
    geometry.applyMatrix4(normalise);
    const material = sourceMaterial.clone();
    if (material instanceof THREE.MeshStandardMaterial) {
      material.flatShading = true;
      material.roughness = Math.max(0.78, material.roughness);
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    }
    variants.push({
      geometry,
      material,
      triangles: geometry.index
        ? geometry.index.count / 3
        : (geometry.getAttribute("position")?.count ?? 0) / 3,
    });
  });
  if (variants.length === 0) throw new Error("elemental-serenity treeTrunks.glb has no meshes");
  return variants;
}

function TrunkVariantField({
  variant,
  at,
  castShadow = true,
}: {
  readonly variant: TrunkVariant;
  readonly at: readonly Placement[];
  readonly castShadow?: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const resources = useMemo(
    () => ({ geometry: variant.geometry.clone(), material: variant.material.clone() }),
    [variant],
  );

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const quaternion = new THREE.Quaternion();
    const dummy = new THREE.Object3D();
    at.forEach((placement, index) => {
      dummy.position.copy(placement.position);
      quaternion.setFromAxisAngle(UP, placement.turn);
      dummy.quaternion.copy(quaternion);
      dummy.scale.setScalar(placement.height);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [at, resources]);

  useEffect(
    () => () => {
      resources.geometry.dispose();
      resources.material.dispose();
    },
    [resources],
  );

  if (at.length === 0) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[resources.geometry, resources.material, at.length]}
      castShadow={castShadow}
      frustumCulled={false}
      userData={{
        islandLookTreeTrunkTriangles: variant.triangles,
        islandLookPlacementCount: at.length,
      }}
    />
  );
}

function TreeTrunks({
  variants,
  placements,
  castShadow = true,
}: {
  readonly variants: readonly TrunkVariant[];
  readonly placements: readonly Placement[];
  readonly castShadow?: boolean;
}) {
  const assignments = useMemo(() => {
    const grouped = variants.map(() => [] as Placement[]);
    placements.forEach((placement, index) => {
      const variantIndex = Math.floor(
        seeded(`tree-trunk/${index}/${placement.turn}`)() * variants.length,
      );
      grouped[variantIndex]!.push(placement);
    });
    return grouped;
  }, [placements, variants]);
  return (
    <>
      {variants.map((variant, index) => (
        <TrunkVariantField
          key={`tree-trunk-${index}`}
          variant={variant}
          at={assignments[index]!}
          castShadow={castShadow}
        />
      ))}
    </>
  );
}

function rotatedOffset(
  placement: Placement,
  offset: THREE.Vector3,
  normal: THREE.Vector3,
): { readonly position: THREE.Vector3; readonly normal: THREE.Vector3 } {
  const turn = new THREE.Quaternion().setFromAxisAngle(UP, placement.turn);
  return {
    position: offset.applyQuaternion(turn).add(placement.position),
    normal: normal.clone().applyQuaternion(turn).normalize(),
  };
}

function treeLeafInstances(placements: readonly Placement[]): readonly FoliageInstance[] {
  const instances: FoliageInstance[] = [];
  for (const placement of placements) {
    const random = seeded(`tree-leaves/${placement.position.x}/${placement.position.z}`);
    const count = 12;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + random() * 0.28;
      const band = index % 3;
      const radius = placement.height * (0.13 + band * 0.06 + random() * 0.05);
      const offset = new THREE.Vector3(
        Math.cos(angle) * radius,
        placement.height * (0.68 + band * 0.095 + random() * 0.045),
        Math.sin(angle) * radius,
      );
      const normal = new THREE.Vector3(
        Math.cos(angle) * 0.82,
        0.38 + random() * 0.26,
        Math.sin(angle) * 0.82,
      ).normalize();
      const world = rotatedOffset(placement, offset, normal);
      instances.push({
        position: world.position,
        normal: world.normal,
        scale: placement.height * (0.31 + random() * 0.09),
        multiplier: FOLIAGE_COLOURS.multiplier.clone().multiplyScalar(0.9 + random() * 0.12),
        seed: random(),
      });
    }
  }
  return instances;
}

function CourseTreeFoliage({
  placements,
  lightDirection,
}: {
  readonly placements: readonly Placement[];
  readonly lightDirection: THREE.Vector3;
}) {
  const tree = useIslandGLTF(TREE_SRC);
  const variants = useMemo(() => normalizedTrunkVariants(tree.scene), [tree]);
  const instances = useMemo(() => treeLeafInstances(placements), [placements]);
  const plane = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  useEffect(
    () => () => {
      disposeTrunkVariants(variants);
      plane.dispose();
    },
    [plane, variants],
  );
  return (
    <>
      {/* Leaf cards keep the donor's alpha-aware shadow pass. A second shadow
          pass for the low-pixel trunk faces costs 42,768 frame triangles in
          this pressure island without adding a readable grounding edge. */}
      <TreeTrunks variants={variants} placements={placements} castShadow={false} />
      <FoliageInstancedField
        source={plane}
        baseNormal={PLANE_NORMAL}
        instances={instances}
        lightDirection={lightDirection}
      />
    </>
  );
}

function bushLeafInstances(
  scene: THREE.Object3D,
  placements: readonly Placement[],
): readonly FoliageInstance[] {
  scene.updateMatrixWorld(true);
  const emitter = scene.getObjectByProperty("isMesh", true) as THREE.Mesh | undefined;
  if (!emitter) throw new Error("elemental-serenity bushEmitter.glb has no mesh");
  const transformedEmitterGeometry = emitter.geometry.clone();
  transformedEmitterGeometry.applyMatrix4(emitter.matrixWorld);
  const emitterGeometry = transformedEmitterGeometry.toNonIndexed();
  transformedEmitterGeometry.dispose();
  emitterGeometry.computeBoundingBox();
  const bounds =
    emitterGeometry.boundingBox ??
    new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const instances: FoliageInstance[] = [];

  for (const placement of placements) {
    const random = seeded(`bush-leaves/${placement.position.x}/${placement.position.z}`);
    const samplerMesh = new THREE.Mesh(emitterGeometry);
    const sampler = new MeshSurfaceSampler(samplerMesh).setRandomGenerator(random).build();
    const leafCount = 12;
    const point = new THREE.Vector3();
    const normal = new THREE.Vector3();
    for (let index = 0; index < leafCount; index += 1) {
      sampler.sample(point, normal);
      const offset = new THREE.Vector3(
        ((point.x - centre.x) / Math.max(size.y, 1e-5)) * placement.height * 2.2,
        ((point.y - bounds.min.y) / Math.max(size.y, 1e-5)) * placement.height,
        ((point.z - centre.z) / Math.max(size.y, 1e-5)) * placement.height * 2.2,
      );
      const world = rotatedOffset(placement, offset, normal.lengthSq() > 0 ? normal : UP);
      instances.push({
        position: world.position,
        normal: world.normal,
        scale: placement.height * (0.48 + random() * 0.2),
        multiplier: FOLIAGE_COLOURS.multiplier.clone().multiplyScalar(0.88 + random() * 0.16),
        seed: random(),
      });
    }
  }
  emitterGeometry.dispose();
  return instances;
}

function CourseBushFoliage({
  placements,
  lightDirection,
}: {
  readonly placements: readonly Placement[];
  readonly lightDirection: THREE.Vector3;
}) {
  const emitter = useIslandGLTF(BUSH_SRC);
  const instances = useMemo(
    () => bushLeafInstances(emitter.scene, placements),
    [emitter, placements],
  );
  const plane = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  useEffect(() => () => plane.dispose(), [plane]);
  return (
    <FoliageInstancedField
      source={plane}
      baseNormal={PLANE_NORMAL}
      instances={instances}
      lightDirection={lightDirection}
    />
  );
}

function TreeSilhouette({
  variants,
  placements,
  castShadow = true,
}: {
  readonly variants: readonly TrunkVariant[];
  readonly placements: readonly Placement[];
  readonly castShadow?: boolean;
}) {
  const geometry = useMemo(() => {
    const canopy = new THREE.ConeGeometry(0.42, 0.7, 6);
    canopy.translate(0, 0.72, 0);
    return canopy;
  }, []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x5d9045, flatShading: true, roughness: 0.95 }),
    [],
  );
  const mesh = useRef<THREE.InstancedMesh>(null);
  const assignments = useMemo(() => {
    const grouped = variants.map(() => [] as Placement[]);
    placements.forEach((placement, index) => {
      grouped[Math.floor(index % variants.length)]!.push(placement);
    });
    return grouped;
  }, [placements, variants]);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const dummy = new THREE.Object3D();
    assignments.flat().forEach((placement, index) => {
      dummy.position.copy(placement.position);
      dummy.scale.setScalar(placement.height);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [assignments]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  if (placements.length === 0) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, placements.length]}
      castShadow={castShadow}
      frustumCulled={false}
      userData={{
        islandLookWorldTreeSilhouetteTriangles: 12,
        islandLookPlacementCount: placements.length,
      }}
    />
  );
}

function WorldTreeSilhouette({ placements }: { readonly placements: readonly Placement[] }) {
  const tree = useIslandGLTF(TREE_SRC);
  // The aerial projection has no pixels for six trunk silhouettes. One
  // selected donor trunk keeps the source material while avoiding six draw
  // calls per island; foliage cards never enter this branch.
  const variants = useMemo(() => normalizedTrunkVariants(tree.scene, 1), [tree]);
  useEffect(() => () => disposeTrunkVariants(variants), [variants]);
  return (
    <>
      <TreeTrunks variants={variants} placements={placements} castShadow={false} />
      <TreeSilhouette variants={variants} placements={placements} castShadow={false} />
    </>
  );
}

export function isIslandFoliagePlacement(placement: IslandDressingPlacement): boolean {
  return (
    placement.packId === ELEMENTAL_SERENITY_PACK &&
    (placement.assetId === TREE_ASSET_ID || placement.assetId === BUSH_ASSET_ID)
  );
}

function toPlacement(
  placement: IslandDressingPlacement,
  scale: number,
  heightMultiplier: number,
): Placement {
  return {
    position: new THREE.Vector3(placement.x * scale, placement.y * scale, placement.z * scale),
    height: placement.height * scale * heightMultiplier,
    turn: placement.turn,
  };
}

export function IslandFoliage({
  plan,
  detail,
  scale,
  heightMultiplier,
}: {
  readonly plan: IslandDressingPlan;
  readonly detail: "course" | "world";
  readonly scale: number;
  readonly heightMultiplier: number;
}) {
  const scene = useThree((state) => state.scene);
  const lightDirection = useMemo(() => foliageLightDirection(scene), [scene]);
  const treePlacements = useMemo(
    () =>
      plan.placements
        .filter((placement) => placement.assetId === TREE_ASSET_ID)
        .map((placement) => toPlacement(placement, scale, heightMultiplier)),
    [heightMultiplier, plan, scale],
  );
  const bushPlacements = useMemo(
    () =>
      plan.placements
        .filter((placement) => placement.assetId === BUSH_ASSET_ID)
        .map((placement) => toPlacement(placement, scale, heightMultiplier)),
    [heightMultiplier, plan, scale],
  );
  if (detail === "world") {
    return treePlacements.length > 0 ? <WorldTreeSilhouette placements={treePlacements} /> : null;
  }
  return (
    <>
      {treePlacements.length > 0 ? (
        <CourseTreeFoliage placements={treePlacements} lightDirection={lightDirection} />
      ) : null}
      {bushPlacements.length > 0 ? (
        <CourseBushFoliage placements={bushPlacements} lightDirection={lightDirection} />
      ) : null}
    </>
  );
}
