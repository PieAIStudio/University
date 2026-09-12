/**
 * One continuous shallow bank per puff, with two complementary surface
 * batches. No intersecting spheres, separate belly slab or weather shader.
 * The same closed source is also used by course frames and globe clouds.
 */
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { hopPose } from "../avatar/hop.js";
import { seeded } from "../island/random.js";
import { CLOUD_CARRIER_FOOT_OFFSET, type CloudCarrierTarget } from "./cloud-carrier-contract.js";
import { CLOUD_RENDER_ORDER, CLOUD_TONES, createCloudMaterials } from "./cloud-material.js";
import {
  CLOUD_BANK_SUPPORT_HEIGHT,
  CLOUD_VOLUME_CONTRACT,
  createCloudVolumeParts,
} from "./cloud-volume.js";
import { renderTier } from "./tier.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";

export { CLOUD_CARRIER_FOOT_OFFSET } from "./cloud-carrier-contract.js";
export type { CloudCarrierTarget } from "./cloud-carrier-contract.js";

export type CloudPuffRole = "background" | "frame" | "near-edge";

export interface CloudPuff {
  readonly position: readonly [number, number, number];
  readonly scale: number;
  /** One of the six authored screen-space composition clusters. */
  readonly clusterIndex: number;
  /** A semantic art role used by tests and by the sculpture variation. */
  readonly role: CloudPuffRole;
}

/**
 * The cloud field is a composition, not a weather sampler. These constants
 * are shared by the layout tests and the renderer's crown/footprint contract.
 */
export const CLOUD_LAYOUT_CONTRACT = {
  // Preserve the existing framing and carrier slot; changing the surface
  // must not turn nine authored banks into another dense weather field.
  desktopPuffCount: 9,
  mobilePuffCount: 6,
  compositionClusterCount: 6,
  backgroundClusterCount: 2,
  nearEdgeClusterCount: 1,
  safeCorridorRatio: 0.58,
  horizontalFootprintPerScale: 1.2,
  crownHeightPerScale: 1.12,
  turfClearance: 0.08,
} as const;

interface CloudClusterRecipe {
  /** Angle around the camera-facing -Z arc; x = sin(angle), z = cos(angle). */
  readonly angle: number;
  /** Nominal distance as a multiple of the weather extent. */
  readonly radius: number;
  /** Stop very large maps from pushing the readable frame past the camera. */
  readonly maxRadius: number;
  /** Cluster diameter as a multiple of the weather extent. */
  readonly spread: number;
  readonly role: CloudPuffRole;
  readonly scale: readonly [number, number];
}

/*
 * Six hand-authored anchors make the field read in both camera frames. The
 * two far anchors are the large background masses, while the central rear
 * anchor is the intentional near-edge cloud in the camera frame. The slight
 * asymmetry keeps the result from looking like a six-point loading spinner
 * when the camera is pulled out.
 */
const CLUSTER_RECIPES: readonly CloudClusterRecipe[] = [
  {
    angle: -2.84,
    radius: 0.94,
    maxRadius: 116,
    spread: 0.045,
    role: "background",
    scale: [2.18, 2.72],
  },
  {
    angle: 2.84,
    radius: 0.91,
    maxRadius: 112,
    spread: 0.046,
    role: "background",
    scale: [2.08, 2.64],
  },
  {
    angle: -2.96,
    radius: 0.84,
    maxRadius: 98,
    spread: 0.042,
    role: "frame",
    scale: [1.48, 1.92],
  },
  {
    angle: 2.96,
    radius: 0.81,
    maxRadius: 94,
    spread: 0.044,
    role: "frame",
    scale: [1.42, 1.98],
  },
  {
    angle: -3.08,
    radius: 0.76,
    maxRadius: 90,
    spread: 0.04,
    role: "frame",
    scale: [1.36, 1.82],
  },
  {
    angle: 3.08,
    radius: 0.72,
    maxRadius: 86,
    spread: 0.038,
    role: "near-edge",
    scale: [1.72, 2.2],
  },
] as const;

/* Uneven counts preserve the same six clusters without making desktop a grid. */
const DESKTOP_CLUSTER_COUNTS = [2, 2, 2, 1, 1, 1] as const;
const MOBILE_CLUSTER_COUNTS = [1, 1, 1, 1, 1, 1] as const;

/* Deliberate silhouette rhythm inside a cluster: high, low, shoulder, high… */
const MEMBER_OFFSETS = [
  -0.46, 0.22, 0.42, -0.12, 0.58, -0.3, 0.08, 0.5, -0.54, 0.32, -0.02, 0.64,
] as const;
const MEMBER_RADIAL_OFFSETS = [
  0.18, -0.26, 0.06, 0.31, -0.12, -0.34, 0.2, -0.04, 0.27, -0.19, 0.1, -0.28,
] as const;
const MEMBER_SCALE_STEPS = [
  0.68, 0.43, 0.91, 0.3, 0.77, 0.54, 0.84, 0.36, 0.62, 0.48, 0.96, 0.58,
] as const;

function safeExtent(extent: number): number {
  return Number.isFinite(extent) ? Math.max(1, extent) : 40;
}

function safeLevel(level: number): number {
  return Number.isFinite(level) ? level : -5.2;
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clusterCounts(mobile: boolean): readonly number[] {
  return mobile ? MOBILE_CLUSTER_COUNTS : DESKTOP_CLUSTER_COUNTS;
}

/** Radius reserved for the route/island centre in the cloud plane. */
export function cloudSafeCorridorRadius(extent: number): number {
  return safeExtent(extent) * CLOUD_LAYOUT_CONTRACT.safeCorridorRatio;
}

/**
 * A conservative horizontal radius for the complete sculpted cloud. This is
 * intentionally larger than any single recipe lobe so the corridor check is
 * about the silhouette, not only about a puff's origin.
 */
export function cloudHorizontalFootprint(scale: number): number {
  return Math.max(0, scale) * CLOUD_LAYOUT_CONTRACT.horizontalFootprintPerScale;
}

function minimumClusterRadius(extent: number, scale: number): number {
  // The extra margin also absorbs the group's tiny whole-field drift in the
  // renderer, so an animated frame cannot nibble into the route corridor.
  const driftMargin = Math.max(extent * 0.035, 0.7);
  return cloudSafeCorridorRadius(extent) + cloudHorizontalFootprint(scale) + driftMargin;
}

function outerCloudRadius(extent: number, largestScale: number): number {
  const minimumOuter = minimumClusterRadius(extent, largestScale) + extent * 0.28;
  return Math.max(extent * 2.2, minimumOuter);
}

function pushedOutsideCorridor(
  x: number,
  z: number,
  minimumRadius: number,
): readonly [number, number] {
  const distance = Math.hypot(x, z);
  if (distance >= minimumRadius || distance === 0) return [x, z];
  const factor = minimumRadius / distance;
  return [x * factor, z * factor];
}

function cloudHeight(
  level: number,
  scale: number,
  role: CloudPuffRole,
  random: () => number,
): number {
  const roleDrop = role === "background" ? 0.2 : role === "near-edge" ? 0.78 : 0.46;
  const depthDrop = roleDrop + random() * 0.62;
  const desired = level - depthDrop;
  // `level` is normally already below the island. The clamp keeps the public
  // helper honest for previews that pass a positive level as well.
  const crownLimit =
    -CLOUD_LAYOUT_CONTRACT.turfClearance - scale * CLOUD_LAYOUT_CONTRACT.crownHeightPerScale;
  return Math.min(desired, crownLimit);
}

/**
 * Deterministic cloud sea, kept below the visible turf and shoreline.
 *
 * Every puff belongs to one authored composition cluster. The seed only
 * perturbs member spacing, scale and depth inside that recipe; it never turns
 * the framing into an evenly random disc.
 */
export function cloudPuffs(extent: number, mobile: boolean, level: number): CloudPuff[] {
  const resolvedExtent = safeExtent(extent);
  const resolvedLevel = safeLevel(level);
  const random = seeded(`cloud-sea/${mobile ? "mobile" : "desktop"}`);
  const counts = clusterCounts(mobile);
  const largestScale = Math.max(...CLUSTER_RECIPES.map((recipe) => recipe.scale[1]));
  const outerRadius = outerCloudRadius(resolvedExtent, largestScale);
  const puffs: CloudPuff[] = [];

  CLUSTER_RECIPES.forEach((recipe, clusterIndex) => {
    const count = counts[clusterIndex] ?? 0;
    const clusterScale = recipe.scale[1];
    const minimumRadius = minimumClusterRadius(resolvedExtent, clusterScale);
    const spread = resolvedExtent * recipe.spread;
    const nominalRadius = resolvedExtent * recipe.radius;
    // Keep the outermost lobe inside the field's framing radius, even for a
    // very small test extent where the fixed sculpture scale dominates.
    const radius = Math.max(
      minimumRadius,
      Math.min(
        recipe.maxRadius,
        nominalRadius,
        outerRadius - spread - cloudHorizontalFootprint(clusterScale),
      ),
    );
    const axisX = Math.sin(recipe.angle);
    const axisZ = Math.cos(recipe.angle);
    const tangentX = Math.cos(recipe.angle);
    const tangentZ = -Math.sin(recipe.angle);

    for (let memberIndex = 0; memberIndex < count; memberIndex += 1) {
      const patternIndex = memberIndex % MEMBER_OFFSETS.length;
      const memberJitter = (random() - 0.5) * 0.1;
      const radialJitter = (random() - 0.5) * 0.08;
      const scaleJitter = (random() - 0.5) * 0.1;
      const scaleStep = clamp(MEMBER_SCALE_STEPS[patternIndex]! + scaleJitter, 0, 1);
      const scale = lerp(recipe.scale[0], recipe.scale[1], scaleStep);
      const tangentOffset = (MEMBER_OFFSETS[patternIndex]! + memberJitter) * spread;
      const radialOffset = (MEMBER_RADIAL_OFFSETS[patternIndex]! + radialJitter) * spread * 0.62;
      const rawX = axisX * (radius + radialOffset) + tangentX * tangentOffset;
      const rawZ = axisZ * (radius + radialOffset) + tangentZ * tangentOffset;
      const [x, z] = pushedOutsideCorridor(rawX, rawZ, minimumClusterRadius(resolvedExtent, scale));

      puffs.push({
        position: [x, cloudHeight(resolvedLevel, scale, recipe.role, random), z],
        scale,
        clusterIndex,
        role: recipe.role,
      });
    }
  });

  return puffs;
}

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
const CUTE_CLOUD_RENDER_ORDER = CLOUD_RENDER_ORDER;

export const CUTE_CLOUD_CONTRACT = {
  upperLobesPerPuff: 1,
  totalOpaqueLobesPerPuff: 1,
  drawBatches: CUTE_CLOUD_BATCH_NAMES.length,
  batchNames: CUTE_CLOUD_BATCH_NAMES,
  desktopPuffCount: CLOUD_LAYOUT_CONTRACT.desktopPuffCount,
  mobilePuffCount: CLOUD_LAYOUT_CONTRACT.mobilePuffCount,
  compositionClusterCount: CLOUD_LAYOUT_CONTRACT.compositionClusterCount,
  backgroundClusterCount: CLOUD_LAYOUT_CONTRACT.backgroundClusterCount,
  nearEdgeClusterCount: CLOUD_LAYOUT_CONTRACT.nearEdgeClusterCount,
  safeCorridorRatio: CLOUD_LAYOUT_CONTRACT.safeCorridorRatio,
  crownHeightPerScale: CLOUD_LAYOUT_CONTRACT.crownHeightPerScale,
  desktopSegments: { width: 32, height: 9 },
  mobileSegments: { width: 20, height: 6 },
  renderOrder: CUTE_CLOUD_RENDER_ORDER,
  opaque: true,
  wholeFieldDrift: true,
} as const;

const CLOUD_ROLE_TONES: Readonly<
  Record<CloudPuffRole, { readonly lift: number; readonly tone: number }>
> = {
  "near-edge": { lift: 1.06, tone: CLOUD_TONES.pearl },
  frame: { lift: 1, tone: CLOUD_TONES.pearl },
  background: { lift: 0.72, tone: CLOUD_TONES.ivory },
};

function scaleHex(color: number, amount: number): number {
  const clamped = Math.min(1.35, Math.max(0.35, amount));
  const red = Math.min(255, Math.round(((color >> 16) & 255) * clamped));
  const green = Math.min(255, Math.round(((color >> 8) & 255) * clamped));
  const blue = Math.min(255, Math.round((color & 255) * clamped));
  return (red << 16) | (green << 8) | blue;
}

/** One bank transform. The legacy list names remain the two batch inputs. */
export interface CuteCloudLobe {
  readonly position: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
  readonly rotationY: number;
  readonly color: number;
  readonly puffIndex: number;
}

export type CuteCloudUnderbelly = CuteCloudLobe;

export interface CuteCloudLayout {
  readonly quality: CuteCloudQuality;
  readonly puffs: readonly CloudPuff[];
  readonly lobes: readonly CuteCloudLobe[];
  readonly underbellies: readonly CuteCloudUnderbelly[];
}

export interface ArchipelagoCloudFrame {
  readonly radius: number;
  /** Lowest actual root in this projection; scenery clouds remain below it. */
  readonly floor: number;
}

const ARCHIPELAGO_BANK_ANCHORS = [
  [-13.1, -8.4, 0.67],
  [7.05, -2.44, 0.7],
  [-7.63, -1.74, 0.55],
  [4.78, -15.13, 0.62],
  [0.66, -16.71, 0.62],
  [-6.09, 3.44, 0.57],
  [7.05, 1.52, 0.63],
  [9.04, -9.22, 0.48],
] as const;
// Broader cotton shoulders, not upright grey pebbles. The carrier is excluded
// from this transform and keeps its exact foot-support datum.
const ARCHIPELAGO_CLOUD_HEIGHT_SCALE = 1.22;

/** Vary a whole bank, not its constituent balls. XZ stays in the unchanged
 * 1.2-per-scale envelope, including all four shoulders and every yaw.
 */
const CLOUD_SILHOUETTE_VARIANTS = [
  { stretchX: 1.05, stretchY: 0.92, stretchZ: 1, yaw: -0.08 },
  { stretchX: 0.98, stretchY: 1, stretchZ: 1.08, yaw: 0.1 },
  { stretchX: 1.08, stretchY: 0.9, stretchZ: 0.94, yaw: -0.04 },
  { stretchX: 1, stretchY: 0.96, stretchZ: 1.04, yaw: 0.06 },
] as const;

function qualityFrom(quality?: CuteCloudQuality): CuteCloudQuality {
  return quality ?? renderTier();
}

/**
 * The last authored puff is the carrier slot. It is not a ninth/tenth cloud:
 * the existing instance is moved, so the cloud sea keeps its two batches and
 * its desktop/mobile instance counts. The returned point is where the bunny's
 * feet begin; the cloud centre is `CLOUD_CARRIER_FOOT_OFFSET` below it.
 */
export function cloudCarrierHome(
  extent: number,
  level: number,
  quality?: CuteCloudQuality,
): CloudCarrierTarget {
  const layout = cuteCloudLayout(extent, level, qualityFrom(quality));
  const carrier = layout.puffs.at(-1);
  if (!carrier) return [0, safeLevel(level) + CLOUD_CARRIER_FOOT_OFFSET, 0];
  return [
    carrier.position[0],
    carrier.position[1] + CLOUD_CARRIER_FOOT_OFFSET,
    carrier.position[2],
  ];
}

/** Keep the existing conservative unit envelope around the carrier transform.
 * The shallow body is contained by it; the turf safety margin is not reduced.
 * The target is the avatar's feet, not sea level or an island's origin.
 */
export function cloudCarrierClearance(
  extent: number,
  level: number,
  quality?: CuteCloudQuality,
): number {
  const layout = cuteCloudLayout(extent, level, qualityFrom(quality));
  const index = layout.puffs.length - 1;
  const carrier = layout.puffs[index];
  if (!carrier) return CLOUD_CARRIER_FOOT_OFFSET;
  const bottom = Math.min(
    ...[...layout.lobes, ...layout.underbellies]
      .filter((lobe) => lobe.puffIndex === index)
      .map((lobe) => lobe.position[1] - lobe.scale[1]),
  );
  return (
    carrier.position[1] + CLOUD_CARRIER_FOOT_OFFSET - bottom + CLOUD_LAYOUT_CONTRACT.turfClearance
  );
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
  frame?: ArchipelagoCloudFrame,
): CuteCloudLayout {
  const resolvedQuality = qualityFrom(quality);
  const resolvedExtent = safeExtent(extent);
  const resolvedLevel = safeLevel(level);
  const basePuffs = cloudPuffs(resolvedExtent, resolvedQuality === "mobile", resolvedLevel);
  const puffs = frame
    ? basePuffs.map((puff, index): CloudPuff => {
        if (index === basePuffs.length - 1) return puff;
        const anchor = ARCHIPELAGO_BANK_ANCHORS[index % ARCHIPELAGO_BANK_ANCHORS.length]!;
        const unit = clamp(frame.radius, 3, 5);
        const scale = unit * anchor[2];
        return {
          ...puff,
          scale,
          position: [
            anchor[0] * unit,
            frame.floor -
              3 -
              scale * CLOUD_VOLUME_CONTRACT.crownHeightMax * ARCHIPELAGO_CLOUD_HEIGHT_SCALE,
            anchor[1] * unit,
          ],
        };
      })
    : basePuffs;
  const lobes: CuteCloudLobe[] = [];
  const underbellies: CuteCloudUnderbelly[] = [];

  puffs.forEach((puff, puffIndex) => {
    const variation = ((puffIndex * 17) % 29) / 29 - 0.5;
    const silhouette =
      CLOUD_SILHOUETTE_VARIANTS[
        (puff.clusterIndex * 3 + puffIndex + (puff.role === "near-edge" ? 1 : 0)) %
          CLOUD_SILHOUETTE_VARIANTS.length
      ]!;
    const scale: readonly [number, number, number] = [
      silhouette.stretchX * puff.scale,
      silhouette.stretchY *
        puff.scale *
        (frame && puffIndex !== puffs.length - 1 ? ARCHIPELAGO_CLOUD_HEIGHT_SCALE : 1),
      silhouette.stretchZ * puff.scale,
    ];
    const carrier = puffIndex === puffs.length - 1;
    // The last bank still owns the same foot target and horizontal origin.
    // Align the source's centre crown to that target as the body becomes thin;
    // otherwise replacing the balls would leave the bunny hovering above it.
    const supportLift = carrier
      ? CLOUD_CARRIER_FOOT_OFFSET - CLOUD_BANK_SUPPORT_HEIGHT * scale[1]
      : 0;
    const tone = CLOUD_ROLE_TONES[puff.role];
    const bank: CuteCloudLobe = {
      position: [puff.position[0], puff.position[1] + supportLift, puff.position[2]],
      scale,
      rotationY: variation * 0.22 + silhouette.yaw,
      color: scaleHex(tone.tone, frame && !carrier ? Math.max(0.94, tone.lift) : tone.lift),
      puffIndex,
    };
    lobes.push(bank);
    // Same transform and colour, disjoint triangles. There is no second
    // displaced belly that could expose a saucer or a material seam.
    underbellies.push(bank);
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

/** Rewrite a carrier matrix without touching its already-uploaded instance colour. */
function setCarrierInstanceTransform(
  target: THREE.InstancedMesh,
  index: number,
  base: CuteCloudLobe | CuteCloudUnderbelly,
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  scratch: THREE.Object3D,
) {
  scratch.position.set(
    base.position[0] + offsetX,
    base.position[1] + offsetY,
    base.position[2] + offsetZ,
  );
  scratch.rotation.set(0, base.rotationY, 0);
  scratch.scale.set(base.scale[0], base.scale[1], base.scale[2]);
  scratch.updateMatrix();
  target.setMatrixAt(index, scratch.matrix);
}

/** Move the two existing surface instances and keep their culling bounds live.
 * The carrier may leave the authored background arc; a birth-position sphere
 * can otherwise cull the whole bank even while the avatar is on screen.
 * No geometry, material, colour or additional instance is created here.
 */
export function updateCloudCarrierInstances(
  upper: THREE.InstancedMesh | null,
  lower: THREE.InstancedMesh | null,
  layout: CuteCloudLayout,
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  scratch: THREE.Object3D,
): void {
  const index = layout.puffs.length - 1;
  const crown = layout.lobes[index];
  const belly = layout.underbellies[index];
  if (upper && crown) {
    setCarrierInstanceTransform(upper, index, crown, offsetX, offsetY, offsetZ, scratch);
    upper.instanceMatrix.needsUpdate = true;
    upper.computeBoundingSphere();
  }
  if (lower && belly) {
    setCarrierInstanceTransform(lower, index, belly, offsetX, offsetY, offsetZ, scratch);
    lower.instanceMatrix.needsUpdate = true;
    lower.computeBoundingSphere();
  }
}

export interface CuteCloudSeaProps {
  readonly extent: number;
  readonly level: number;
  /** Optional test/preview override; normal callers use the device tier. */
  readonly quality?: CuteCloudQuality;
  /** Keep false for a still capture or deterministic visual regression shot. */
  readonly drift?: boolean;
  /**
   * Bunny-foot target for the existing carrier puff. `undefined` keeps this
   * component as the ordinary cloud sea; `null` returns the carrier to its
   * authored home position.
   */
  readonly carrierTarget?: CloudCarrierTarget | null;
  /** Development evidence key; it is omitted from production callers. */
  readonly carrierSurface?: "world" | "planet";
  readonly frame?: ArchipelagoCloudFrame;
}

/**
 * Opaque, low-cost cloud sea for both the world and course projections.
 *
 * No pointer handler is exposed on purpose: clouds sit behind the islands and
 * must never steal a click.  `extent` and `level` remain the same two inputs as
 * the original CloudSea, so the parent can swap the component without a scene
 * or data-model change.
 */
export function CuteCloudSea({
  extent,
  level,
  quality,
  drift = true,
  carrierTarget,
  carrierSurface,
  frame,
}: CuteCloudSeaProps) {
  const resolvedQuality = qualityFrom(quality);
  const layout = useMemo(
    () => cuteCloudLayout(extent, level, resolvedQuality, frame),
    [extent, level, resolvedQuality, frame?.radius, frame?.floor],
  );
  const group = useRef<THREE.Group>(null);
  const reducedMotion = usePrefersReducedMotion();
  const upper = useRef<THREE.InstancedMesh>(null);
  const lower = useRef<THREE.InstancedMesh>(null);
  const carrierPuffIndex = layout.puffs.length - 1;
  const carrierOrigin = useMemo(() => {
    const puff = layout.puffs[carrierPuffIndex];
    return new THREE.Vector3(...(puff?.position ?? [0, safeLevel(level), 0]));
  }, [carrierPuffIndex, layout.puffs, level]);
  const carrierFrom = useRef(new THREE.Vector3());
  const carrierGoal = useRef(new THREE.Vector3());
  const carrierPosition = useRef(new THREE.Vector3());
  const carrierTargetScratch = useMemo(() => new THREE.Vector3(), []);
  const carrierScratch = useMemo(() => new THREE.Object3D(), []);
  const carrierStartedAt = useRef<number | null>(null);
  const carrierArcLift = useRef(0);
  const carrierSequence = useRef(0);

  const { crown: upperGeometry, underbelly: lowerGeometry } = useMemo(() => {
    const segments =
      layout.quality === "mobile"
        ? CUTE_CLOUD_CONTRACT.mobileSegments
        : CUTE_CLOUD_CONTRACT.desktopSegments;
    return createCloudVolumeParts(segments.width, segments.height);
  }, [layout.quality]);
  // Both cloud fields take the same pair; `cloud-material.ts` says why a
  // second answer to "how is a cloud lit" is no longer a caller's to give.
  const { crown: upperMaterial, underbelly: lowerMaterial } = useMemo(
    () => createCloudMaterials(),
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
    carrierFrom.current.copy(carrierOrigin);
    carrierGoal.current.copy(carrierOrigin);
    carrierPosition.current.copy(carrierOrigin);
    carrierStartedAt.current = null;
    carrierArcLift.current = 0;
    carrierSequence.current += 1;
  }, [layout]);

  useLayoutEffect(
    () => () => {
      upperGeometry.dispose();
      lowerGeometry.dispose();
    },
    [lowerGeometry, upperGeometry],
  );

  useLayoutEffect(
    () => () => {
      upperMaterial.dispose();
      lowerMaterial.dispose();
    },
    [lowerMaterial, upperMaterial],
  );

  useLayoutEffect(() => {
    if (carrierTarget === undefined || carrierPuffIndex < 0) return;
    const target = carrierTarget;
    if (target) {
      carrierTargetScratch.set(target[0], target[1] - CLOUD_CARRIER_FOOT_OFFSET, target[2]);
    } else {
      carrierTargetScratch.copy(carrierOrigin);
    }

    if (!carrierGoal.current.equals(carrierTargetScratch)) {
      // This is the same in-flight retargeting used by LearnerMarker: start
      // from the carrier's current position, never from its old destination.
      carrierFrom.current.copy(carrierPosition.current);
      carrierGoal.current.copy(carrierTargetScratch);
      // Share the avatar's selection-commit clock. A delayed first render
      // must not add another whole frame before the 420ms journey begins.
      carrierStartedAt.current = performance.now();
      carrierSequence.current += 1;
    }
  }, [
    carrierTarget?.[0],
    carrierTarget?.[1],
    carrierTarget?.[2],
    carrierTarget === undefined,
    layout,
  ]);

  useFrame(({ clock }) => {
    if (!drift || !group.current) return;
    const time = clock.elapsedTime;
    // The field moves as one composition. Tiny horizontal movement gives the
    // eye life without turning the banks into independent weather systems.
    const driftX = reducedMotion ? 0 : Math.sin(time * 0.018) * safeExtent(extent) * 0.004;
    const driftZ = reducedMotion ? 0 : Math.cos(time * 0.014) * safeExtent(extent) * 0.003;
    group.current.position.x = driftX;
    group.current.position.z = driftZ;
    if (carrierTarget === undefined || carrierPuffIndex < 0) return;

    let lift = 0;
    if (carrierStartedAt.current === null) {
      carrierPosition.current.copy(carrierGoal.current);
    } else {
      const pose = hopPose({
        from: carrierFrom.current,
        to: carrierGoal.current,
        elapsedMs: Math.max(0, performance.now() - carrierStartedAt.current),
        reducedMotion,
      });
      carrierPosition.current.set(pose.position.x, pose.position.y, pose.position.z);
      lift = pose.lift;
      carrierArcLift.current = lift;
      if (pose.done) {
        carrierStartedAt.current = null;
        carrierArcLift.current = 0;
      }
    }

    // The carrier remains fixed while the rest of the cloud composition drifts
    // by cancelling only the parent group's tiny offset. The two existing
    // surface instances are rewritten in place; no geometry, material, batch or pass
    // is created for the bunny's cloud.
    const offsetX = carrierPosition.current.x - carrierOrigin.x - driftX;
    const offsetY = carrierPosition.current.y - carrierOrigin.y + lift;
    const offsetZ = carrierPosition.current.z - carrierOrigin.z - driftZ;
    updateCloudCarrierInstances(
      upper.current,
      lower.current,
      layout,
      offsetX,
      offsetY,
      offsetZ,
      carrierScratch,
    );

    if (import.meta.env.DEV && carrierSurface) {
      const bag = globalThis as unknown as {
        __cloudCarrierMotion?: Record<string, unknown>;
      };
      bag.__cloudCarrierMotion ??= {};
      bag.__cloudCarrierMotion[carrierSurface] = {
        sequence: carrierSequence.current,
        inFlight: carrierStartedAt.current !== null,
        startedAtPerformanceMs: carrierStartedAt.current,
        position: carrierPosition.current.toArray(),
        target: carrierGoal.current.toArray(),
        arcLift: carrierArcLift.current,
      };
    }
  });

  return (
    <group ref={group} name="cute-cloud-sea" userData={{ opaque: true, batches: 2 }}>
      <instancedMesh
        ref={lower}
        name={CUTE_CLOUD_BATCH_NAMES[1]}
        args={[lowerGeometry, lowerMaterial, layout.underbellies.length]}
        frustumCulled
        renderOrder={CUTE_CLOUD_RENDER_ORDER.underbelly}
      />
      <instancedMesh
        ref={upper}
        name={CUTE_CLOUD_BATCH_NAMES[0]}
        args={[upperGeometry, upperMaterial, layout.lobes.length]}
        frustumCulled
        renderOrder={CUTE_CLOUD_RENDER_ORDER.upper}
      />
    </group>
  );
}
