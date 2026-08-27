/**
 * A small, deliberately sculpted cloud sea.
 *
 * The old cloud layer was one transparent flattened sphere per lobe.  At a
 * distance that turns every overlap grey and makes the clouds read as paint
 * smudges.  This version keeps the same cheap idea (no weather simulation and
 * no ray marching) but treats a cloud as one opaque little sculpture:
 * six shared rounded lobes above one warm under-belly.  The lobe transforms
 * are written once, then the whole field drifts as one group.
 *
 * There are exactly two instanced draw batches:
 *   - upper: six lobes per puff, with per-instance ivory/white colours;
 *   - lower: one warm contact belly per puff.
 *
 * Both batches share one low-poly sphere geometry.  The geometry is the only
 * resource whose segment count changes with the tier, so a phone gets a much
 * smaller silhouette without changing the visual language.
 */
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { CLOUD_LAYOUT_CONTRACT, cloudPuffs, type CloudPuff } from "./cloud-layout.js";
import { renderTier } from "./tier.js";

export type CuteCloudQuality = "desktop" | "mobile";

/** The art and batching contract for the cloud sea. */
export const CUTE_CLOUD_BATCH_NAMES = ["cute-cloud-upper", "cute-cloud-underbelly"] as const;

/**
 * The opaque world is drawn at the default order (zero). Draw the cloud sea
 * afterwards so its depth test can reject pixels behind an island or the sea
 * floor, while keeping the cloud's own depth out of the screen-space AO map.
 * The upper lobes come last so they keep their light silhouette over the warm
 * contact belly when the two batches overlap.
 */
const CUTE_CLOUD_RENDER_ORDER = {
  // Weather's sky, sea floor and islands use the default opaque order (zero).
  // Keep a little room above them for any future background decoration.
  underbelly: 3,
  upper: 4,
} as const;

export const CUTE_CLOUD_CONTRACT = {
  upperLobesPerPuff: 6,
  totalOpaqueLobesPerPuff: 7,
  drawBatches: CUTE_CLOUD_BATCH_NAMES.length,
  batchNames: CUTE_CLOUD_BATCH_NAMES,
  desktopPuffCount: CLOUD_LAYOUT_CONTRACT.desktopPuffCount,
  mobilePuffCount: CLOUD_LAYOUT_CONTRACT.mobilePuffCount,
  compositionClusterCount: CLOUD_LAYOUT_CONTRACT.compositionClusterCount,
  backgroundClusterCount: CLOUD_LAYOUT_CONTRACT.backgroundClusterCount,
  nearEdgeClusterCount: CLOUD_LAYOUT_CONTRACT.nearEdgeClusterCount,
  safeCorridorRatio: CLOUD_LAYOUT_CONTRACT.safeCorridorRatio,
  crownHeightPerScale: CLOUD_LAYOUT_CONTRACT.crownHeightPerScale,
  desktopSegments: { width: 14, height: 9 },
  mobileSegments: { width: 9, height: 6 },
  renderOrder: CUTE_CLOUD_RENDER_ORDER,
  opaque: true,
  wholeFieldDrift: true,
} as const;

const CLOUD_TONES = {
  pearl: 0xf8faf7,
  ivory: 0xf1f1eb,
  warm: 0xe8ddd0,
  underbelly: 0xd7c7b5,
} as const;

type Tone = keyof typeof CLOUD_TONES;

/** One lobe's transform and tone, kept free of Three.js for deterministic tests. */
export interface CuteCloudLobe {
  readonly position: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
  readonly rotationY: number;
  readonly color: number;
  readonly puffIndex: number;
}

/** The lower warm lobe that gives the cloud a soft, grounded underside. */
export interface CuteCloudUnderbelly {
  readonly position: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
  readonly rotationY: number;
  readonly color: number;
  readonly puffIndex: number;
}

export interface CuteCloudLayout {
  readonly quality: CuteCloudQuality;
  readonly puffs: readonly CloudPuff[];
  readonly lobes: readonly CuteCloudLobe[];
  readonly underbellies: readonly CuteCloudUnderbelly[];
}

interface LobeRecipe {
  readonly offset: readonly [number, number, number];
  readonly stretch: readonly [number, number, number];
  readonly tone: Tone;
}

/*
 * The silhouette is intentionally asymmetrical.  A perfect four-lobe clover
 * looks like a logo; these six overlapping volumes read as a small cloud from
 * the aerial camera and retain a visible top/side/bottom hierarchy.
 */
const UPPER_LOBE_RECIPES: readonly LobeRecipe[] = [
  { offset: [0, 0.02, 0.04], stretch: [1.02, 0.4, 0.7], tone: "warm" },
  { offset: [-0.56, 0.08, 0.03], stretch: [0.64, 0.5, 0.58], tone: "ivory" },
  { offset: [0.56, 0.1, 0.02], stretch: [0.66, 0.54, 0.6], tone: "pearl" },
  { offset: [-0.23, 0.27, -0.12], stretch: [0.52, 0.54, 0.53], tone: "pearl" },
  { offset: [0.24, 0.29, -0.1], stretch: [0.5, 0.57, 0.52], tone: "pearl" },
  { offset: [0.02, 0.39, 0.08], stretch: [0.4, 0.45, 0.42], tone: "ivory" },
];

interface CloudSilhouetteVariant {
  readonly stretchX: readonly number[];
  readonly stretchY: readonly number[];
  readonly stretchZ: readonly number[];
  readonly offsetX: readonly number[];
  readonly offsetY: readonly number[];
  readonly offsetZ: readonly number[];
  readonly yaw: number;
}

/*
 * The recipe establishes the family resemblance; these small transforms keep
 * repeated instances from becoming a row of identical clovers. Vertical
 * factors stay at or below 1 so the established 1.12 crown contract remains
 * exact, while the shoulders and tails lean in different directions.
 */
const CLOUD_SILHOUETTE_VARIANTS: readonly CloudSilhouetteVariant[] = [
  {
    stretchX: [1.02, 0.94, 1.08, 0.96, 0.9, 0.82],
    stretchY: [0.94, 0.98, 0.9, 0.96, 0.86, 0.9],
    stretchZ: [1.04, 0.92, 1.06, 0.94, 0.9, 0.84],
    offsetX: [0, -0.03, 0.03, -0.01, 0.02, 0.04],
    offsetY: [0, 0, 0.01, 0, 0, 0],
    offsetZ: [0.02, 0.02, -0.01, -0.02, 0.02, 0.01],
    yaw: -0.045,
  },
  {
    stretchX: [0.92, 1.04, 0.96, 1.06, 0.84, 0.94],
    stretchY: [0.9, 0.92, 0.98, 0.88, 0.94, 0.82],
    stretchZ: [0.98, 1.05, 0.9, 1.02, 0.86, 0.9],
    offsetX: [0.03, -0.02, 0.01, -0.04, 0.03, -0.01],
    offsetY: [0, 0.01, 0, 0.01, 0, 0],
    offsetZ: [-0.01, 0.03, 0.02, 0.01, -0.02, 0.03],
    yaw: 0.06,
  },
  {
    stretchX: [1.06, 0.88, 1.02, 0.9, 1.04, 0.78],
    stretchY: [0.98, 0.9, 0.92, 0.94, 0.82, 0.96],
    stretchZ: [0.9, 1.02, 1.04, 0.88, 1.02, 0.82],
    offsetX: [-0.02, 0.04, -0.04, 0.02, -0.03, 0.01],
    offsetY: [0, 0, 0, 0.01, 0, 0],
    offsetZ: [0.03, -0.02, 0.03, 0.02, -0.01, 0.02],
    yaw: -0.02,
  },
  {
    stretchX: [0.96, 1.02, 0.9, 1.04, 0.92, 0.86],
    stretchY: [0.92, 0.96, 0.88, 0.9, 0.98, 0.86],
    stretchZ: [1.02, 0.9, 0.98, 1.04, 0.84, 0.92],
    offsetX: [0.01, 0.02, -0.02, 0.04, -0.01, -0.04],
    offsetY: [0, 0.01, 0, 0, 0.01, 0],
    offsetZ: [0.01, 0.03, -0.02, 0.02, 0.01, -0.01],
    yaw: 0.035,
  },
] as const;

function qualityFrom(quality?: CuteCloudQuality): CuteCloudQuality {
  return quality ?? renderTier();
}

function safeExtent(extent: number) {
  return Number.isFinite(extent) ? Math.max(1, extent) : 40;
}

function safeLevel(level: number) {
  return Number.isFinite(level) ? level : -5.2;
}

/**
 * Make the complete instance data without allocating any Three.js objects.
 * This is the seam for future workers or baked manifests: layout generation
 * stays deterministic and the React component only uploads the result.
 */
export function cuteCloudLayout(
  extent: number,
  level: number,
  quality?: CuteCloudQuality,
): CuteCloudLayout {
  const resolvedQuality = qualityFrom(quality);
  const resolvedExtent = safeExtent(extent);
  const resolvedLevel = safeLevel(level);
  const puffs = cloudPuffs(resolvedExtent, resolvedQuality === "mobile", resolvedLevel);
  const lobes: CuteCloudLobe[] = [];
  const underbellies: CuteCloudUnderbelly[] = [];

  puffs.forEach((puff, puffIndex) => {
    // Keep each cloud recognisable but avoid a field of identical stamps. The
    // variation affects only the sculpture, never its semantic position.
    const variation = ((puffIndex * 17) % 29) / 29 - 0.5;
    const silhouette =
      CLOUD_SILHOUETTE_VARIANTS[
        (puff.clusterIndex * 3 + puffIndex + (puff.role === "near-edge" ? 1 : 0)) %
          CLOUD_SILHOUETTE_VARIANTS.length
      ]!;
    const yaw = variation * 0.22 + silhouette.yaw;
    UPPER_LOBE_RECIPES.forEach((recipe, lobeIndex) => {
      const [baseX, baseY, baseZ] = recipe.offset;
      const [baseSx, baseSy, baseSz] = recipe.stretch;
      const x = baseX + silhouette.offsetX[lobeIndex]!;
      const y = baseY + silhouette.offsetY[lobeIndex]!;
      const z = baseZ + silhouette.offsetZ[lobeIndex]!;
      const sx = baseSx * silhouette.stretchX[lobeIndex]!;
      const sy = baseSy * silhouette.stretchY[lobeIndex]!;
      const sz = baseSz * silhouette.stretchZ[lobeIndex]!;
      lobes.push({
        position: [
          puff.position[0] + (x + variation * 0.035) * puff.scale,
          puff.position[1] + y * puff.scale,
          puff.position[2] + z * puff.scale,
        ],
        scale: [sx * puff.scale, sy * puff.scale, sz * puff.scale],
        rotationY: yaw + variation * 0.06,
        color: CLOUD_TONES[recipe.tone],
        puffIndex,
      });
    });
    underbellies.push({
      position: [
        puff.position[0] + variation * 0.05 * puff.scale,
        // Tuck the warm belly into the shoulder mass. Leaving it a full lobe
        // below the crown makes an aerial cloud look like it is sitting on a
        // visible saucer.
        puff.position[1] - 0.03 * puff.scale,
        puff.position[2] + 0.04 * puff.scale,
      ],
      scale: [0.94 * puff.scale, 0.28 * puff.scale, 0.72 * puff.scale],
      rotationY: yaw,
      color: CLOUD_TONES.underbelly,
      puffIndex,
    });
  });

  return { quality: resolvedQuality, puffs, lobes, underbellies };
}

function setInstanceTransform(
  target: THREE.InstancedMesh,
  index: number,
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
  rotationY: number,
  color: number,
  scratch: THREE.Object3D,
) {
  scratch.position.set(position[0], position[1], position[2]);
  scratch.rotation.set(0, rotationY, 0);
  scratch.scale.set(scale[0], scale[1], scale[2]);
  scratch.updateMatrix();
  target.setMatrixAt(index, scratch.matrix);
  target.setColorAt(index, new THREE.Color(color));
}

export interface CuteCloudSeaProps {
  readonly extent: number;
  readonly level: number;
  /** Optional test/preview override; normal callers use the device tier. */
  readonly quality?: CuteCloudQuality;
  /** Keep false for a still capture or deterministic visual regression shot. */
  readonly drift?: boolean;
}

/**
 * Opaque, low-cost cloud sea for both the world and course projections.
 *
 * No pointer handler is exposed on purpose: clouds sit behind the islands and
 * must never steal a click.  `extent` and `level` remain the same two inputs as
 * the original CloudSea, so the parent can swap the component without a scene
 * or data-model change.
 */
export function CuteCloudSea({ extent, level, quality, drift = true }: CuteCloudSeaProps) {
  const resolvedQuality = qualityFrom(quality);
  const layout = useMemo(
    () => cuteCloudLayout(extent, level, resolvedQuality),
    [extent, level, resolvedQuality],
  );
  const group = useRef<THREE.Group>(null);
  const upper = useRef<THREE.InstancedMesh>(null);
  const lower = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => {
    const segments =
      layout.quality === "mobile"
        ? CUTE_CLOUD_CONTRACT.mobileSegments
        : CUTE_CLOUD_CONTRACT.desktopSegments;
    return new THREE.SphereGeometry(1, segments.width, segments.height);
  }, [layout.quality]);
  const upperMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        // Instance colours are already the art-directed absolute tones.
        // The instance colour path is enabled by InstancedMesh itself; asking
        // for vertex colours as well would make SphereGeometry look for a
        // missing `color` attribute and collapse the cloud to black.
        color: 0xffffff,
        roughness: 1,
        metalness: 0,
        emissive: 0x2a3034,
        emissiveIntensity: 0.16,
        transparent: false,
        fog: false,
        // Decorative cloud lobes overlap by design. Feeding those internal
        // intersections to the screen-space AO pass turns a white sculpture
        // into a solid black cut-out, so clouds paint colour but do not become
        // occluders. The batches render after the opaque scene, so depthTest
        // still rejects cloud pixels behind islands and the sea floor.
        depthTest: true,
        depthWrite: false,
      }),
    [],
  );
  const lowerMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 1,
        metalness: 0,
        emissive: 0x302a27,
        emissiveIntensity: 0.12,
        transparent: false,
        fog: false,
        depthTest: true,
        depthWrite: false,
      }),
    [],
  );

  useLayoutEffect(() => {
    const upperMesh = upper.current;
    const lowerMesh = lower.current;
    if (!upperMesh || !lowerMesh) return;
    const scratch = new THREE.Object3D();
    for (const [index, lobe] of layout.lobes.entries()) {
      setInstanceTransform(
        upperMesh,
        index,
        lobe.position,
        lobe.scale,
        lobe.rotationY,
        lobe.color,
        scratch,
      );
    }
    for (const [index, belly] of layout.underbellies.entries()) {
      setInstanceTransform(
        lowerMesh,
        index,
        belly.position,
        belly.scale,
        belly.rotationY,
        belly.color,
        scratch,
      );
    }
    upperMesh.instanceMatrix.needsUpdate = true;
    lowerMesh.instanceMatrix.needsUpdate = true;
    upperMesh.instanceColor!.needsUpdate = true;
    lowerMesh.instanceColor!.needsUpdate = true;
    upperMesh.computeBoundingSphere();
    lowerMesh.computeBoundingSphere();
  }, [layout]);

  useLayoutEffect(
    () => () => {
      geometry.dispose();
      upperMaterial.dispose();
      lowerMaterial.dispose();
    },
    [geometry, lowerMaterial, upperMaterial],
  );

  useFrame(({ clock }) => {
    if (!drift || !group.current) return;
    const time = clock.elapsedTime;
    // The field moves as one composition.  Tiny horizontal movement gives the
    // eye life without turning six lobes into six independent animations.
    group.current.position.x = Math.sin(time * 0.018) * safeExtent(extent) * 0.004;
    group.current.position.z = Math.cos(time * 0.014) * safeExtent(extent) * 0.003;
  });

  return (
    <group ref={group} name="cute-cloud-sea" userData={{ opaque: true, batches: 2 }}>
      <instancedMesh
        ref={lower}
        name={CUTE_CLOUD_BATCH_NAMES[1]}
        args={[geometry, lowerMaterial, layout.underbellies.length]}
        frustumCulled
        renderOrder={CUTE_CLOUD_RENDER_ORDER.underbelly}
      />
      <instancedMesh
        ref={upper}
        name={CUTE_CLOUD_BATCH_NAMES[0]}
        args={[geometry, upperMaterial, layout.lobes.length]}
        frustumCulled
        renderOrder={CUTE_CLOUD_RENDER_ORDER.upper}
      />
    </group>
  );
}
