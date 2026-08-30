import { hash } from "../island/random.js";
import { WORLD_STUDY_GRID_CONTRACT } from "../grid/course-grid.js";

/**
 * The first layer chooses a study, so one layout item is one study landmass.
 * There is no course-level packing here: that would bring the second layer's
 * visual grain back into the picker.
 */
export const PLANET_CLUSTER_LAYOUT_CONTRACT = {
  /** Empty air between the outer silhouettes of two study landmasses. */
  interClusterGap: 2.8,
  /** A nearest-neighbour sanity limit: five studies remain one catalogue. */
  maxNearestClusterGap: 24,
  /** Tight enough to fill the picker while retaining edge breathing room. */
  cameraPadding: 1.06,
} as const;

/**
 * Explicit bounds for the first layer's unit of meaning. Cell count is owned
 * by the shared grid contract; the radius/share checks are visual guardrails
 * for the real catalogue tests below.
 */
export const PLANET_STUDY_SIZE_CONTRACT = {
  minCells: WORLD_STUDY_GRID_CONTRACT.minCells,
  maxCells: WORLD_STUDY_GRID_CONTRACT.maxCells,
  minRadius: 4,
  maxLargestFieldShare: 0.72,
} as const;

/** A study's measured, already-aggregated world-grid envelope. */
export interface PlanetStudyLayoutInput {
  readonly studyId: string;
  readonly courseCount: number;
  readonly lessonCount: number;
  readonly cellCount: number;
  readonly halfX: number;
  readonly halfZ: number;
  readonly centerX?: number;
  readonly centerZ?: number;
}

export interface PlanetStudyPlacement {
  readonly studyId: string;
  readonly courseCount: number;
  readonly lessonCount: number;
  readonly cellCount: number;
  /** World-grid origin, passed directly to `WorldGridIsland.position`. */
  readonly x: number;
  readonly z: number;
  /** Center of the measured landmass envelope in the final planet field. */
  readonly centerX: number;
  readonly centerZ: number;
  readonly halfX: number;
  readonly halfZ: number;
  readonly radius: number;
  readonly clusterIndex: number;
}

/** Kept as a semantic alias for callers that describe the study as a cluster. */
export type PlanetClusterPlacement = PlanetStudyPlacement;

export interface PlanetFieldBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly halfX: number;
  readonly halfZ: number;
  readonly maxHalf: number;
}

export interface PlanetClusterLayout {
  readonly clusters: readonly PlanetClusterPlacement[];
  readonly bounds: PlanetFieldBounds;
}

interface CircleItem {
  readonly id: string;
  readonly radius: number;
}

interface CirclePlacement {
  readonly id: string;
  readonly radius: number;
  readonly x: number;
  readonly z: number;
}

function safeRadius(value: number): number {
  return Math.max(0.35, Number.isFinite(value) ? Math.abs(value) : 0.35);
}

/**
 * Deterministically pack study silhouettes from large to small.
 *
 * The candidate rings are a tiny constraint solver rather than a random
 * scatter. Every accepted candidate is checked against all earlier studies,
 * so the returned gap is a property of the measured landmass envelopes.
 * Hashes only choose among equal-looking angles; they never decide whether
 * overlap is allowed.
 */
function packCircles(
  items: readonly CircleItem[],
  gap: number,
  seed: string,
): readonly CirclePlacement[] {
  const ordered = [...items].sort(
    (left, right) => right.radius - left.radius || left.id.localeCompare(right.id),
  );
  const placed: CirclePlacement[] = [];
  for (const item of ordered) {
    if (placed.length === 0) {
      placed.push({ ...item, x: 0, z: 0 });
      continue;
    }

    let best: CirclePlacement | null = null;
    const phase = hash(`${seed}/${item.id}/phase`) * Math.PI * 2;
    for (let radial = 0; radial <= 160 && best === null; radial += 0.35) {
      const sampleCount = radial < 0.01 ? 1 : 72;
      for (let sample = 0; sample < sampleCount; sample += 1) {
        const angle =
          radial < 0.01 ? 0 : phase + (sample / sampleCount) * Math.PI * 2 + (sample % 2) * 0.012;
        const candidate = {
          ...item,
          x: Math.cos(angle) * radial,
          z: Math.sin(angle) * radial,
        };
        const valid = placed.every(
          (other) =>
            Math.hypot(candidate.x - other.x, candidate.z - other.z) -
              candidate.radius -
              other.radius >=
            gap - 1e-8,
        );
        if (valid) {
          best = candidate;
          break;
        }
      }
    }
    if (!best) {
      throw new RangeError(`Planet study layout exhausted while placing ${item.id}`);
    }
    placed.push(best);
  }
  return placed;
}

function recenterCircles(circles: readonly CirclePlacement[]): readonly CirclePlacement[] {
  if (circles.length === 0) return [];
  const minX = Math.min(...circles.map((circle) => circle.x - circle.radius));
  const maxX = Math.max(...circles.map((circle) => circle.x + circle.radius));
  const minZ = Math.min(...circles.map((circle) => circle.z - circle.radius));
  const maxZ = Math.max(...circles.map((circle) => circle.z + circle.radius));
  const shiftX = (minX + maxX) * 0.5;
  const shiftZ = (minZ + maxZ) * 0.5;
  return circles.map((circle) => ({ ...circle, x: circle.x - shiftX, z: circle.z - shiftZ }));
}

function inputRadius(study: PlanetStudyLayoutInput): number {
  return Math.max(safeRadius(study.halfX), safeRadius(study.halfZ));
}

function fieldBounds(studies: readonly PlanetStudyPlacement[]): PlanetFieldBounds {
  if (studies.length === 0) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, halfX: 0, halfZ: 0, maxHalf: 0 };
  }
  const minX = Math.min(...studies.map((study) => study.centerX - study.halfX));
  const maxX = Math.max(...studies.map((study) => study.centerX + study.halfX));
  const minZ = Math.min(...studies.map((study) => study.centerZ - study.halfZ));
  const maxZ = Math.max(...studies.map((study) => study.centerZ + study.halfZ));
  const halfX = Math.max(Math.abs(minX), Math.abs(maxX));
  const halfZ = Math.max(Math.abs(minZ), Math.abs(maxZ));
  return { minX, maxX, minZ, maxZ, halfX, halfZ, maxHalf: Math.max(halfX, halfZ) };
}

/**
 * Place five (or a future small catalogue of) study landmasses in one stable
 * field. Input order, course order and selection are intentionally absent
 * from the solver, so clicking a study can only change rendering state.
 */
export function placePlanetClusters(
  studies: readonly PlanetStudyLayoutInput[],
): PlanetClusterLayout {
  const ordered = [...studies]
    .map((study) => ({ ...study }))
    .sort((left, right) => left.studyId.localeCompare(right.studyId));
  const packed = recenterCircles(
    packCircles(
      ordered.map((study) => ({ id: study.studyId, radius: inputRadius(study) })),
      PLANET_CLUSTER_LAYOUT_CONTRACT.interClusterGap,
      "planet/study",
    ),
  );
  const byStudy = new Map(packed.map((circle) => [circle.id, circle]));

  const clusters = ordered.map((study, clusterIndex) => {
    const circle = byStudy.get(study.studyId)!;
    const mapCenterX = study.centerX ?? 0;
    const mapCenterZ = study.centerZ ?? 0;
    return {
      studyId: study.studyId,
      courseCount: study.courseCount,
      lessonCount: study.lessonCount,
      cellCount: study.cellCount,
      x: circle.x - mapCenterX,
      z: circle.z - mapCenterZ,
      centerX: circle.x,
      centerZ: circle.z,
      halfX: safeRadius(study.halfX),
      halfZ: safeRadius(study.halfZ),
      radius: circle.radius,
      clusterIndex,
    };
  });

  return { clusters, bounds: fieldBounds(clusters) };
}

export const PLANET_CAMERA_POLAR = 0.8377580409572781; // 48° from +Y, higher than the world shot.

/**
 * Fit the whole field in both axes. A circular bound is conservative for the
 * oblique camera, which is preferable to cropping a real study silhouette on
 * a narrow phone viewport.
 */
export function planetCameraDistance(
  bounds: Pick<PlanetFieldBounds, "halfX" | "halfZ">,
  aspect: number,
  fovDegrees: number,
): number {
  const safeAspect = Math.max(0.05, Number.isFinite(aspect) ? aspect : 1);
  const halfVertical = (Math.max(1, fovDegrees) * Math.PI) / 360;
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * safeAspect);
  const halfFov = Math.max(0.01, Math.min(halfVertical, halfHorizontal));
  const radius = Math.max(1, Math.hypot(Math.abs(bounds.halfX), Math.abs(bounds.halfZ)));
  return (radius * PLANET_CLUSTER_LAYOUT_CONTRACT.cameraPadding) / Math.tan(halfFov);
}
