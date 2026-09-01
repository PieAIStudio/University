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

import { hopPose } from "../avatar/hop.js";
import { seeded } from "../island/random.js";
import { CLOUD_CARRIER_FOOT_OFFSET, type CloudCarrierTarget } from "./cloud-carrier-contract.js";
import { createCloudVolumeGeometry } from "./cloud-volume.js";
import { renderTier } from "./tier.js";

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
  // A puff is already a complete seven-lobe cloud sculpture. Eighteen puffs
  // made the authored clusters read as two giant banks of foam rather than as
  // the small, toy-like clouds the reference establishes.
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
  pearl: 0xfff7ee,
  ivory: 0xe9eef6,
  warm: 0xdccbb8,
  underbelly: 0x8a7464,
} as const;

const CLOUD_ROLE_TONES: Readonly<
  Record<CloudPuffRole, { readonly lift: number; readonly belly: number }>
> = {
  // Near clouds catch the low sun; distant banks stay cooler and darker so
  // the field has a near/far, light/dark reading instead of one foam value.
  "near-edge": { lift: 1.06, belly: 0x6f5c50 },
  frame: { lift: 1, belly: 0x8a7464 },
  background: { lift: 0.72, belly: 0x4d5968 },
};

function scaleHex(color: number, amount: number): number {
  const clamped = Math.min(1.35, Math.max(0.35, amount));
  const red = Math.min(255, Math.round(((color >> 16) & 255) * clamped));
  const green = Math.min(255, Math.round(((color >> 8) & 255) * clamped));
  const blue = Math.min(255, Math.round((color & 255) * clamped));
  return (red << 16) | (green << 8) | blue;
}

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
        color: scaleHex(CLOUD_TONES[recipe.tone], CLOUD_ROLE_TONES[puff.role].lift),
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
      color: CLOUD_ROLE_TONES[puff.role].belly,
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
}: CuteCloudSeaProps) {
  const resolvedQuality = qualityFrom(quality);
  const layout = useMemo(
    () => cuteCloudLayout(extent, level, resolvedQuality),
    [extent, level, resolvedQuality],
  );
  const group = useRef<THREE.Group>(null);
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

  const geometry = useMemo(() => {
    const segments =
      layout.quality === "mobile"
        ? CUTE_CLOUD_CONTRACT.mobileSegments
        : CUTE_CLOUD_CONTRACT.desktopSegments;
    return createCloudVolumeGeometry(segments.width, segments.height);
  }, [layout.quality]);
  const upperMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        // Instance colours carry near/far role identity. The shared geometry
        // adds a subtle value ramp so the closed body also reads in profile.
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.82,
        metalness: 0,
        emissive: 0x3a4048,
        emissiveIntensity: 0.1,
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
        vertexColors: true,
        roughness: 0.94,
        metalness: 0,
        emissive: 0x241c18,
        emissiveIntensity: 0.04,
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
    carrierFrom.current.copy(carrierOrigin);
    carrierGoal.current.copy(carrierOrigin);
    carrierPosition.current.copy(carrierOrigin);
    carrierStartedAt.current = null;
    carrierArcLift.current = 0;
    carrierSequence.current += 1;
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
    const driftX = Math.sin(time * 0.018) * safeExtent(extent) * 0.004;
    const driftZ = Math.cos(time * 0.014) * safeExtent(extent) * 0.003;
    group.current.position.x = driftX;
    group.current.position.z = driftZ;

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
      carrierStartedAt.current = time;
      carrierSequence.current += 1;
    }

    let lift = 0;
    if (carrierStartedAt.current === null) {
      carrierPosition.current.copy(carrierGoal.current);
    } else {
      const pose = hopPose({
        from: carrierFrom.current,
        to: carrierGoal.current,
        elapsedMs: (time - carrierStartedAt.current) * 1000,
        reducedMotion:
          typeof window !== "undefined" &&
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches,
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
    // by cancelling only the parent group's tiny offset. The seven existing
    // instances are rewritten in place; no geometry, material, batch or pass
    // is created for the bunny's cloud.
    const offsetX = carrierPosition.current.x - carrierOrigin.x - driftX;
    const offsetY = carrierPosition.current.y - carrierOrigin.y + lift;
    const offsetZ = carrierPosition.current.z - carrierOrigin.z - driftZ;
    const firstLobe = carrierPuffIndex * CUTE_CLOUD_CONTRACT.upperLobesPerPuff;
    for (let lobeIndex = 0; lobeIndex < CUTE_CLOUD_CONTRACT.upperLobesPerPuff; lobeIndex += 1) {
      const lobe = layout.lobes[firstLobe + lobeIndex];
      if (!lobe || !upper.current) continue;
      setCarrierInstanceTransform(
        upper.current,
        firstLobe + lobeIndex,
        lobe,
        offsetX,
        offsetY,
        offsetZ,
        carrierScratch,
      );
    }
    const belly = layout.underbellies[carrierPuffIndex];
    if (belly && lower.current) {
      setCarrierInstanceTransform(
        lower.current,
        carrierPuffIndex,
        belly,
        offsetX,
        offsetY,
        offsetZ,
        carrierScratch,
      );
    }
    if (upper.current) upper.current.instanceMatrix.needsUpdate = true;
    if (lower.current) lower.current.instanceMatrix.needsUpdate = true;

    if (import.meta.env.DEV && carrierSurface) {
      const bag = globalThis as unknown as {
        __cloudCarrierMotion?: Record<string, unknown>;
      };
      bag.__cloudCarrierMotion ??= {};
      bag.__cloudCarrierMotion[carrierSurface] = {
        sequence: carrierSequence.current,
        inFlight: carrierStartedAt.current !== null,
        startedAtClock: carrierStartedAt.current,
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
