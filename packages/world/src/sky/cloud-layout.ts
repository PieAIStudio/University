import { seeded } from "../island/random.js";

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
