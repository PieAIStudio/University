/** Deterministic camera and scene-data seams for the DEV-only island judge. */
import { planIslandDressing, type IslandDressingPlan } from "./island-dressing.js";
import type { IslandBlueprint, IslandPoint } from "./island-blueprint.js";
import {
  ISLAND_LOOK_SHOT_IDS,
  type IslandLookDebugOptions,
  type IslandLookShotId,
} from "./island-surface-style.js";

export {
  islandLookDebugFromSearch,
  resolveIslandLookDebug,
  ISLAND_LOOK_SHOT_IDS,
  type IslandLookDebugOptions,
  type IslandLookShotId,
} from "./island-surface-style.js";
export { ISLAND_LOOK_CONTRACT } from "./look-contract.js";

export interface IslandLookCameraPose {
  readonly cameraFrom: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
  /** Three's spherical polar angle, measured down from the +Y axis. */
  readonly polar: number;
  /** Fixed clockwise yaw from the +Z direction, in radians. */
  readonly azimuth: number;
  readonly fov: number;
  readonly distance: number;
}

export interface IslandLookBounds {
  readonly halfX: number;
  readonly halfZ: number;
  /** The serialised outline lets the design shot fit the actual silhouette. */
  readonly outline?: readonly IslandPoint[];
}

export interface IslandLookViewport {
  readonly width: number;
  readonly height: number;
}

const COURSE_DESIGN_COVERAGE = 0.84;
const COURSE_NEAR_DISTANCE = 34;
const COURSE_FAR_DISTANCE = 76;
const WORLD_DESIGN_DISTANCE = 112;
const COURSE_ELEVATION_DEGREES = 36;
const COURSE_DESIGN_AZIMUTH_DEGREES = 65;
const LOOK_POLAR = ((90 - COURSE_ELEVATION_DEGREES) * Math.PI) / 180;
const LOOK_ELEVATION = (COURSE_ELEVATION_DEGREES * Math.PI) / 180;

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function cameraOffset(distance: number, azimuth = 0): readonly [number, number, number] {
  // Three's spherical polar angle is measured from +Y. A 54° polar angle is
  // therefore a fixed 36° depression from the horizontal, not an eyeballed
  // camera height copied from the learner view.
  const horizontal = distance * Math.cos(LOOK_ELEVATION);
  return [
    horizontal * Math.sin(azimuth),
    distance * Math.sin(LOOK_ELEVATION),
    horizontal * Math.cos(azimuth),
  ];
}

function designOutline(bounds: IslandLookBounds): readonly IslandPoint[] {
  if (bounds.outline && bounds.outline.length >= 3) return bounds.outline;
  // Tests and small callers may only have extents. An ellipse is a stable
  // fallback that keeps the camera helper deterministic without pretending a
  // rectangle is the island's silhouette.
  return Array.from({ length: 64 }, (_, index) => {
    const angle = (index / 64) * Math.PI * 2;
    return {
      x: Math.cos(angle) * bounds.halfX,
      z: Math.sin(angle) * bounds.halfZ,
    };
  });
}

function projectedDesignExtent(
  bounds: IslandLookBounds,
  viewport: IslandLookViewport,
  fov: number,
  distance: number,
  azimuth: number,
): { readonly horizontal: number; readonly vertical: number } {
  const aspect = finitePositive(viewport.width / viewport.height, 1);
  const verticalFov = (fov * Math.PI) / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const horizontalTangent = Math.tan(horizontalFov / 2);
  const verticalTangent = Math.tan(verticalFov / 2);
  const viewX = Math.sin(azimuth);
  const viewZ = Math.cos(azimuth);
  const rightX = Math.cos(azimuth);
  const rightZ = -Math.sin(azimuth);
  let horizontal = 0;
  let vertical = 0;
  for (const point of designOutline(bounds)) {
    const along = point.x * viewX + point.z * viewZ;
    const depth = distance - along * Math.cos(LOOK_ELEVATION);
    if (depth <= 0) {
      return { horizontal: Number.POSITIVE_INFINITY, vertical: Number.POSITIVE_INFINITY };
    }
    const screenX = (point.x * rightX + point.z * rightZ) / (depth * horizontalTangent);
    const screenY = (-along * Math.sin(LOOK_ELEVATION)) / (depth * verticalTangent);
    horizontal = Math.max(horizontal, Math.abs(screenX));
    vertical = Math.max(vertical, Math.abs(screenY));
  }
  return { horizontal, vertical };
}

function courseDesignDistance(
  bounds: IslandLookBounds,
  viewport: IslandLookViewport,
  fov: number,
  azimuth: number,
): number {
  let low = COURSE_NEAR_DISTANCE;
  let high = low;
  while (true) {
    const extent = projectedDesignExtent(bounds, viewport, fov, high, azimuth);
    if (Math.max(extent.horizontal, extent.vertical) <= COURSE_DESIGN_COVERAGE) break;
    high *= 2;
  }
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const middle = (low + high) / 2;
    const extent = projectedDesignExtent(bounds, viewport, fov, middle, azimuth);
    if (Math.max(extent.horizontal, extent.vertical) <= COURSE_DESIGN_COVERAGE) high = middle;
    else low = middle;
  }
  return high;
}

/**
 * Return the numeric pose used by a look-contract capture.
 *
 * The design distance is derived only from the serialised outline/bounds and
 * viewport aspect. Near/far and world-design retain fixed distances so those
 * envelope shots can reveal a camera regression instead of hiding it behind
 * refitting.
 */
export function islandLookCameraForShot(
  shot: IslandLookShotId,
  bounds: IslandLookBounds,
  viewport: IslandLookViewport,
): IslandLookCameraPose {
  const fov = viewport.width > 0 && viewport.width < 768 ? 42 : 34;
  const azimuth = shot === "course-design" ? (COURSE_DESIGN_AZIMUTH_DEGREES * Math.PI) / 180 : 0;
  const distance =
    shot === "course-design"
      ? courseDesignDistance(bounds, viewport, fov, azimuth)
      : shot === "course-near"
        ? COURSE_NEAR_DISTANCE
        : shot === "course-far"
          ? COURSE_FAR_DISTANCE
          : WORLD_DESIGN_DISTANCE;
  const offset = cameraOffset(distance, azimuth);
  return {
    cameraFrom: offset,
    lookAt: [0, 0, 0],
    polar: LOOK_POLAR,
    azimuth,
    fov,
    distance,
  };
}

/** A type guard kept beside the one source of valid shot ids. */
export function isIslandLookShotId(value: unknown): value is IslandLookShotId {
  return typeof value === "string" && (ISLAND_LOOK_SHOT_IDS as readonly string[]).includes(value);
}

export function shotIdOf(options: IslandLookDebugOptions): IslandLookShotId | null {
  return options.shot;
}

export interface IslandLookSceneSource {
  readonly detail: "course" | "world";
  readonly blueprints: readonly IslandBlueprint[];
  readonly dressingPlans: readonly IslandDressingPlan[];
  readonly nodePositions: readonly IslandPoint[];
}

/** Build judge data from the same blueprint and dressing planner as the scene. */
export function islandLookSceneSource(
  detail: "course" | "world",
  blueprints: readonly IslandBlueprint[],
  nodePositions: readonly IslandPoint[] = [],
): IslandLookSceneSource {
  return {
    detail,
    blueprints,
    dressingPlans: blueprints.map((blueprint) => planIslandDressing(blueprint, detail)),
    nodePositions,
  };
}
