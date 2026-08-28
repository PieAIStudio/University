/**
 * Donor-shaped vegetation for course islands.
 *
 * Elemental-Serenity's treeTrunks.glb is a small scene containing six trunk
 * variants, not one reusable six-trunk tree. The two cheapest source meshes
 * are normalised into single-trunk variants, and each planned tree receives
 * exactly one of them. The leaves are different: every tree and bush in this
 * island shares one leaf InstancedMesh, so a card is never promoted to a
 * per-tree draw call.
 */
import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three-stdlib";

import { renderTier } from "../sky/tier.js";
import { resolveIslandRuntimeAsset, type IslandAssetPackId } from "./island-asset-registry.js";
import { type IslandDressingPlacement } from "./island-dressing.js";
import { hash, seeded } from "./random.js";

const DONOR_PACK: IslandAssetPackId = "elemental-serenity";
const TREE_TRUNK_ASSET = resolveIslandRuntimeAsset(DONOR_PACK, "treeTrunks");
const LEAF_ASSET = resolveIslandRuntimeAsset(DONOR_PACK, "leaf");
const BUSH_EMITTER_ASSET = resolveIslandRuntimeAsset(DONOR_PACK, "bushEmitter");

/**
 * Six tree cards and three bush cards make a readable cluster on desktop.
 * The mobile cap is deliberately lower: it is a separate budget, not a CSS
 * scale of the desktop budget. The cap is applied after deterministic sampling
 * so the same blueprint seed still produces the same image on every device.
 * Local Chrome measurement at the acceptance viewports: desktop design is
 * 120.00 FPS with 600 cards; the 390 by 844 mobile tier is 119.99 FPS with
 * 360 cards.
 */
export const ISLAND_CARD_VEGETATION_LEAF_COUNTS = {
  desktop: { tree: 20, bush: 10 },
  mobile: { tree: 12, bush: 6 },
} as const;

export const ISLAND_CARD_VEGETATION_LEAF_LIMITS = {
  desktop: 900,
  mobile: 480,
} as const;

const TRUNK_HEIGHT_SHARE = 0.82;
const TRUNK_VARIANT_LIMIT = 2;
const CARD_SHADER_MARKER = "/* university island donor cards */";

interface SourceMeshDescriptor {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
  readonly matrixWorld: THREE.Matrix4;
}

interface TrunkResource {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

interface VegetationResources {
  readonly trunkVariants: readonly TrunkResource[];
  readonly leafGeometry: THREE.BufferGeometry;
  readonly leafMaterial: THREE.MeshStandardMaterial;
  readonly cardCount: number;
}

interface CardInstance {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: number;
  readonly turn: number;
  readonly pitch: number;
  readonly roll: number;
  /** Height within the host tree/bush, used by the foliage colour ramp. */
  readonly height: number;
  /** A smooth, seed-derived patch value; neighbouring cards share its basis. */
  readonly noise: number;
}

interface TrunkInstance {
  readonly placement: IslandDressingPlacement;
  readonly height: number;
}

interface TrunkBucket {
  readonly variant: number;
  readonly instances: readonly TrunkInstance[];
}

function meshDescriptors(root: THREE.Object3D): readonly SourceMeshDescriptor[] {
  root.updateMatrixWorld(true);
  const descriptors: SourceMeshDescriptor[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!material) return;
    descriptors.push({
      geometry: mesh.geometry,
      material,
      matrixWorld: mesh.matrixWorld.clone(),
    });
  });
  return descriptors;
}

function firstMeshDescriptor(root: THREE.Object3D): SourceMeshDescriptor | null {
  return meshDescriptors(root)[0] ?? null;
}

function triangleCount(geometry: THREE.BufferGeometry): number {
  const index = geometry.getIndex();
  return (index ? index.count : geometry.getAttribute("position").count) / 3;
}

function emitterFootprint(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  // The supplied emitter is a cube. Keep this ratio-based so a revised donor
  // emitter changes the spread without changing the bush placement contract.
  return Math.max(0.5, size.x / Math.max(size.y, 0.001));
}

function normaliseTrunkGeometry(source: SourceMeshDescriptor): THREE.BufferGeometry {
  const geometry = source.geometry.clone();
  geometry.userData = { ...source.geometry.userData };
  geometry.applyMatrix4(source.matrixWorld);
  geometry.computeBoundingBox();
  const box =
    geometry.boundingBox ?? new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const height = Math.max(size.y, 0.001);
  const normalise = new THREE.Matrix4()
    .makeScale(1 / height, 1 / height, 1 / height)
    .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z));
  geometry.applyMatrix4(normalise);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function normaliseLeafGeometry(source: SourceMeshDescriptor): THREE.BufferGeometry {
  const geometry = source.geometry.clone();
  geometry.userData = { ...source.geometry.userData };
  geometry.applyMatrix4(source.matrixWorld);
  geometry.computeBoundingBox();
  const box =
    geometry.boundingBox ??
    new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 0, 0.5));
  const size = box.getSize(new THREE.Vector3());
  const position = geometry.getAttribute("position");
  const height = Math.max(size.z, 0.001);
  const centreX = (box.min.x + box.max.x) * 0.5;
  const positions = new Float32Array(position.count * 3);
  const normals = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const offset = index * 3;
    // The source is a narrow upright card. A wider silhouette gives the same
    // two-triangle idea a canopy-like read from the course's elevated camera.
    positions[offset] = ((position.getX(index) - centreX) / height) * 1.25;
    // The donor card is authored in XZ. Convert it to a unit-height XY card;
    // the vertex shader then turns that card around Y toward the camera.
    positions[offset + 1] = (position.getZ(index) - box.min.z) / height;
    positions[offset + 2] = 0;
    normals[offset + 2] = 1;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function trunkMaterial(source: THREE.Material): THREE.Material {
  const material = source.clone();
  material.side = THREE.DoubleSide;
  if (material instanceof THREE.MeshStandardMaterial) {
    material.roughness = Math.max(0.78, material.roughness);
    material.metalness = 0;
    material.needsUpdate = true;
  }
  return material;
}

const CARD_VERTEX_DECLARATIONS = [
  CARD_SHADER_MARKER,
  "attribute float aCardHeight;",
  "attribute float aCardNoise;",
  "varying float vCardHeight;",
  "varying float vCardNoise;",
  "varying vec2 vCardUv;",
].join("\n");

const CARD_VERTEX_NORMAL = [
  CARD_SHADER_MARKER,
  "vCardHeight = aCardHeight;",
  "vCardNoise = aCardNoise;",
  "vCardUv = vec2( position.x + 0.5, position.y );",
].join("\n");

const CARD_FRAGMENT_DECLARATIONS = [
  CARD_SHADER_MARKER,
  "varying float vCardHeight;",
  "varying float vCardNoise;",
  "varying vec2 vCardUv;",
].join("\n");

const CARD_FRAGMENT_COLOUR = [
  CARD_SHADER_MARKER,
  "float cardAlpha = smoothstep( 0.52, 0.38, length( ( vCardUv - vec2( 0.5 ) ) * vec2( 1.0, 1.15 ) ) );",
  "if ( cardAlpha < 0.45 ) discard;",
  // Autumn-day tree ramp from elemental-serenity SeasonManager, without its
  // second renderer or alpha bitmap. Height is the donor's colour-ramp t.
  "vec3 cardShadow = vec3( 0.08, 0.05, 0.01 );",
  "vec3 cardMid = vec3( 0.33, 0.05, 0.004 );",
  "vec3 cardHigh = vec3( 0.85, 0.63, 0.0 );",
  "float cardRamp = clamp( vCardHeight * 0.72 + vCardNoise * 0.28, 0.0, 1.0 );",
  "vec3 cardColour = cardRamp < 0.5",
  "  ? mix( cardShadow, cardMid, cardRamp * 2.0 )",
  "  : mix( cardMid, cardHigh, ( cardRamp - 0.5 ) * 2.0 );",
  "cardColour *= vec3( 0.90, 0.60, 0.30 );",
  "diffuseColor.rgb = cardColour;",
].join("\n");

function createLeafMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0,
    emissive: 0x1f4818,
    emissiveIntensity: 0.09,
    side: THREE.DoubleSide,
    alphaTest: 0.5,
    transparent: false,
    depthWrite: true,
    toneMapped: false,
  });
  material.name = "IslandCardVegetationLeafMaterial";
  material.customProgramCacheKey = () => "island-card-vegetation-leaf-volume-3";
  material.onBeforeCompile = (shader) => {
    if (!shader.vertexShader.includes(CARD_SHADER_MARKER)) {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        "#include <common>\n" + CARD_VERTEX_DECLARATIONS,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n" + CARD_VERTEX_NORMAL,
      );
    }
    if (!shader.fragmentShader.includes(CARD_SHADER_MARKER)) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\n" + CARD_FRAGMENT_DECLARATIONS,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n" + CARD_FRAGMENT_COLOUR,
      );
    }
  };
  return material;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function foliagePatchNoise(seed: string, x: number, z: number): number {
  // A coarse world-space cell is the low-frequency part. A card-local hash is
  // blended in later, keeping cards from looking mechanically identical while
  // nearby cards still share a patch of light and shade.
  const cellX = Math.floor(x / 3.4);
  const cellZ = Math.floor(z / 3.4);
  return hash(seed + "/card-foliage/patch/" + cellX + "/" + cellZ);
}

function makeCardInstances(
  placements: readonly IslandDressingPlacement[],
  seed: string,
  scale: number,
  heightMultiplier: number,
  tier: "desktop" | "mobile",
  emitterRatio: number,
): readonly CardInstance[] {
  const requested: CardInstance[] = [];
  for (const placement of placements) {
    const kind: "tree" | "bush" = placement.kind === "tree" ? "tree" : "bush";
    const count = ISLAND_CARD_VEGETATION_LEAF_COUNTS[tier][kind];
    const random = seeded(seed + "/card-foliage/" + placement.id + "/" + kind);
    const baseX = placement.x * scale;
    const baseY = placement.y * scale;
    const baseZ = placement.z * scale;
    const totalHeight = Math.max(0.01, placement.height * scale * heightMultiplier);
    const foliageHeight = kind === "tree" ? totalHeight * 1.2 : totalHeight;
    const patch = foliagePatchNoise(seed, placement.x, placement.z);

    for (let cardIndex = 0; cardIndex < count; cardIndex += 1) {
      const angle = placement.turn + random() * Math.PI * 2;
      const radial = Math.sqrt(random());
      const vertical = random();
      const localNoise = random();
      const radius =
        kind === "tree"
          ? foliageHeight * (0.08 + radial * 0.22)
          : foliageHeight * emitterRatio * (0.12 + radial * 0.28);
      const cardY =
        baseY + foliageHeight * (kind === "tree" ? 0.48 + vertical * 0.5 : 0.08 + vertical * 0.34);
      const cardScale =
        foliageHeight * (kind === "tree" ? 0.16 + random() * 0.08 : 0.22 + random() * 0.1);
      const cardHeight = clamp01((cardY - baseY + cardScale * 0.5) / foliageHeight);
      const cardNoise = clamp01(patch * 0.72 + localNoise * 0.28);
      requested.push({
        x: baseX + Math.cos(angle) * radius,
        y: cardY,
        z: baseZ + Math.sin(angle) * radius,
        scale: cardScale,
        turn: random() * Math.PI * 2,
        pitch: 0.4 + random() * 0.9,
        roll: (random() - 0.5) * 0.7,
        height: cardHeight,
        noise: cardNoise,
      });
    }
  }

  const limit = ISLAND_CARD_VEGETATION_LEAF_LIMITS[tier];
  if (requested.length <= limit) return requested;
  // Even sampling preserves the route-wide silhouette better than truncating
  // the last trees in the plan. It is still a pure function of the seed/order.
  const sampled: CardInstance[] = [];
  const step = requested.length / limit;
  for (let index = 0; index < limit; index += 1) {
    sampled.push(requested[Math.floor((index + 0.5) * step)]!);
  }
  return sampled;
}

function makeTrunkBuckets(
  placements: readonly IslandDressingPlacement[],
  seed: string,
  scale: number,
  heightMultiplier: number,
  variantCount: number,
): readonly TrunkBucket[] {
  if (variantCount === 0) return [];
  const buckets = Array.from({ length: variantCount }, (_, variant) => ({
    variant,
    instances: [] as TrunkInstance[],
  }));
  for (const placement of placements) {
    const variant = Math.min(
      variantCount - 1,
      Math.floor(hash(seed + "/trunk-variant/" + placement.id) * variantCount),
    );
    buckets[variant]!.instances.push({
      placement,
      height: placement.height * scale * heightMultiplier * TRUNK_HEIGHT_SHARE,
    });
  }
  return buckets.filter((bucket) => bucket.instances.length > 0);
}

function setCardAttributes(geometry: THREE.BufferGeometry, cards: readonly CardInstance[]): void {
  const count = Math.max(cards.length, 1);
  const heights = new Float32Array(count);
  const noises = new Float32Array(count);
  for (const [index, card] of cards.entries()) {
    heights[index] = card.height;
    noises[index] = card.noise;
  }
  geometry.setAttribute("aCardHeight", new THREE.InstancedBufferAttribute(heights, 1));
  geometry.setAttribute("aCardNoise", new THREE.InstancedBufferAttribute(noises, 1));
}

function disposeVegetationResources(resources: VegetationResources): void {
  resources.leafGeometry.dispose();
  resources.leafMaterial.dispose();
  for (const trunk of resources.trunkVariants) {
    trunk.geometry.dispose();
    trunk.material.dispose();
  }
}

function LoadedCardVegetation({
  placements,
  seed,
  scale,
  heightMultiplier,
  treeSrc,
  leafSrc,
  emitterSrc,
}: {
  readonly placements: readonly IslandDressingPlacement[];
  readonly seed: string;
  readonly scale: number;
  readonly heightMultiplier: number;
  readonly treeSrc: string;
  readonly leafSrc: string;
  readonly emitterSrc: string;
}) {
  const tier = renderTier();
  const dracoLoader = useMemo(() => new DRACOLoader().setDecoderPath("/draco/"), []);
  const treeGltf = useGLTF(treeSrc, false, true, (loader) => {
    loader.setDRACOLoader(dracoLoader);
  });
  const leafGltf = useGLTF(leafSrc, false, true, (loader) => {
    loader.setDRACOLoader(dracoLoader);
  });
  const emitterGltf = useGLTF(emitterSrc, false, true, (loader) => {
    loader.setDRACOLoader(dracoLoader);
  });

  const trunkSources = useMemo(
    () =>
      [...meshDescriptors(treeGltf.scene)]
        .sort((first, second) => triangleCount(first.geometry) - triangleCount(second.geometry))
        .slice(0, TRUNK_VARIANT_LIMIT),
    [treeGltf.scene],
  );
  const leafSource = useMemo(() => firstMeshDescriptor(leafGltf.scene), [leafGltf.scene]);
  const emitterRatio = useMemo(() => emitterFootprint(emitterGltf.scene), [emitterGltf.scene]);
  const cards = useMemo(
    () => makeCardInstances(placements, seed, scale, heightMultiplier, tier, emitterRatio),
    [emitterRatio, heightMultiplier, placements, scale, seed, tier],
  );
  const trunkBuckets = useMemo(
    () =>
      makeTrunkBuckets(
        placements.filter((placement) => placement.kind === "tree"),
        seed,
        scale,
        heightMultiplier,
        trunkSources.length,
      ),
    [heightMultiplier, placements, scale, seed, trunkSources.length],
  );

  const [owned, setOwned] = useState<VegetationResources | null>(null);
  const ownedRef = useRef<VegetationResources | null>(null);
  const leafMesh = useRef<THREE.InstancedMesh>(null);
  const trunkMeshes = useRef<Array<THREE.InstancedMesh | null>>([]);

  useLayoutEffect(() => {
    if (!leafSource || trunkSources.length === 0) return;
    const resources: VegetationResources = {
      trunkVariants: trunkSources.map((source) => ({
        geometry: normaliseTrunkGeometry(source),
        material: trunkMaterial(source.material),
      })),
      leafGeometry: normaliseLeafGeometry(leafSource),
      leafMaterial: createLeafMaterial(),
      cardCount: cards.length,
    };
    setCardAttributes(resources.leafGeometry, cards);
    ownedRef.current = resources;
    setOwned(resources);
    return () => {
      if (ownedRef.current === resources) ownedRef.current = null;
      disposeVegetationResources(resources);
    };
  }, [cards, leafSource, trunkSources]);

  useLayoutEffect(() => {
    if (!owned || owned.cardCount !== cards.length) return;
    const dummy = new THREE.Object3D();
    for (const [bucketIndex, bucket] of trunkBuckets.entries()) {
      const target = trunkMeshes.current[bucketIndex];
      if (!target) continue;
      target.count = bucket.instances.length;
      for (const [instanceIndex, instance] of bucket.instances.entries()) {
        dummy.position.set(
          instance.placement.x * scale,
          instance.placement.y * scale,
          instance.placement.z * scale,
        );
        dummy.rotation.set(0, instance.placement.turn, 0);
        dummy.scale.setScalar(instance.height);
        dummy.updateMatrix();
        target.setMatrixAt(instanceIndex, dummy.matrix);
      }
      target.instanceMatrix.needsUpdate = true;
      target.computeBoundingSphere();
    }

    const leafTarget = leafMesh.current;
    if (!leafTarget) return;
    leafTarget.count = cards.length;
    for (const [index, card] of cards.entries()) {
      dummy.position.set(card.x, card.y, card.z);
      dummy.rotation.set(card.pitch, card.turn, card.roll);
      dummy.scale.setScalar(card.scale);
      dummy.updateMatrix();
      leafTarget.setMatrixAt(index, dummy.matrix);
    }
    leafTarget.instanceMatrix.needsUpdate = true;
    leafTarget.computeBoundingSphere();
  }, [cards, owned, scale, trunkBuckets]);

  if (!owned) return null;
  return (
    <>
      {trunkBuckets.map((bucket, index) => {
        const trunk = owned.trunkVariants[bucket.variant]!;
        return (
          <instancedMesh
            key={"donor-trunk-" + bucket.variant + "-" + bucket.instances.length}
            ref={(node) => {
              trunkMeshes.current[index] = node;
            }}
            args={[trunk.geometry, trunk.material, Math.max(bucket.instances.length, 1)]}
            castShadow
            receiveShadow
            frustumCulled
          />
        );
      })}
      <instancedMesh
        key={"donor-leaf-cards-" + cards.length}
        ref={leafMesh}
        args={[owned.leafGeometry, owned.leafMaterial, Math.max(cards.length, 1)]}
        userData={{
          islandLookPlacementCount: placements.length,
          islandCardLeafInstanceCount: cards.length,
        }}
        castShadow={false}
        receiveShadow
        frustumCulled
      />
    </>
  );
}

/** Render planned tree/bush placements through the donor card adapter. */
export function IslandCardVegetation({
  placements,
  seed,
  scale,
  heightMultiplier = 1,
}: {
  readonly placements: readonly IslandDressingPlacement[];
  readonly seed: string;
  readonly scale: number;
  readonly heightMultiplier?: number;
}) {
  if (placements.length === 0 || !TREE_TRUNK_ASSET || !LEAF_ASSET || !BUSH_EMITTER_ASSET) {
    return null;
  }
  return (
    <LoadedCardVegetation
      placements={placements}
      seed={seed}
      scale={scale}
      heightMultiplier={heightMultiplier}
      treeSrc={TREE_TRUNK_ASSET.src}
      leafSrc={LEAF_ASSET.src}
      emitterSrc={BUSH_EMITTER_ASSET.src}
    />
  );
}
