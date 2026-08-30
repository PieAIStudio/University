import { hash } from "../island/random.js";

/**
 * The planet is a higher camera over the same world field, not a second
 * spherical map. This contract owns only the 2D composition around that
 * shared field: courses pack inside one study cluster, then study clusters
 * pack into the catalogue.
 */
export const PLANET_CLUSTER_LAYOUT_CONTRACT = {
  /** Empty air between two course silhouettes in one study cluster. */
  intraClusterGap: 0.72,
  /** Empty air between the outer silhouettes of two study clusters. */
  interClusterGap: 2.4,
  /** A nearest-neighbour sanity limit: clusters must remain one field. */
  maxNearestClusterGap: 18,
  /** Shared world grids keep their native scale; no planet-only resize. */
  courseScale: 1,
  /** Extra breathing room for both the desktop and narrow mobile frame. */
  cameraPadding: 1.14,
} as const;

/** A map's measured local envelope, obtained from the shared world grid. */
export interface PlanetCourseLayoutInput {
  readonly studyId: string;
  readonly courseId: string;
  readonly halfX: number;
  readonly halfZ: number;
  readonly centerX?: number;
  readonly centerZ?: number;
}

export interface PlanetStudyLayoutInput {
  readonly studyId: string;
  readonly courses: readonly PlanetCourseLayoutInput[];
}

export interface PlanetCoursePlacement {
  readonly studyId: string;
  readonly courseId: string;
  /** World-grid origin, passed directly to `WorldGridIsland.position`. */
  readonly x: number;
  readonly z: number;
  /** Center of the measured map envelope in the final planet field. */
  readonly centerX: number;
  readonly centerZ: number;
  readonly halfX: number;
  readonly halfZ: number;
  readonly radius: number;
  readonly clusterIndex: number;
}

export interface PlanetClusterPlacement {
  readonly studyId: string;
  readonly centerX: number;
  readonly centerZ: number;
  readonly radius: number;
  readonly courseCount: number;
}

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
  readonly courses: readonly PlanetCoursePlacement[];
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

function circleGap(left: CirclePlacement, right: CirclePlacement): number {
  return Math.hypot(right.x - left.x, right.z - left.z) - left.radius - right.radius;
}

/**
 * Deterministically pack circles from large to small.
 *
 * The candidate rings are a tiny constraint solver rather than a random
 * scatter. Every accepted candidate is checked against all earlier circles,
 * so the returned gap is a property of the measured silhouettes. Hashes only
 * choose among equal-looking angles; they never decide whether overlap is
 * allowed.
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
    // The first valid point wins by radial distance. The bound is generous
    // enough for a future catalogue, but finite so malformed input cannot
    // hang the authoring preview.
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
        if (placed.every((other) => circleGap(candidate, other) >= gap - 1e-8)) {
          best = candidate;
          break;
        }
      }
    }
    if (!best) {
      throw new RangeError(`Planet circle layout exhausted while placing ${item.id}`);
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

function inputRadius(course: PlanetCourseLayoutInput): number {
  return Math.max(safeRadius(course.halfX), safeRadius(course.halfZ));
}

function fieldBounds(courses: readonly PlanetCoursePlacement[]): PlanetFieldBounds {
  if (courses.length === 0) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, halfX: 0, halfZ: 0, maxHalf: 0 };
  }
  const minX = Math.min(...courses.map((course) => course.centerX - course.halfX));
  const maxX = Math.max(...courses.map((course) => course.centerX + course.halfX));
  const minZ = Math.min(...courses.map((course) => course.centerZ - course.halfZ));
  const maxZ = Math.max(...courses.map((course) => course.centerZ + course.halfZ));
  const halfX = Math.max(Math.abs(minX), Math.abs(maxX));
  const halfZ = Math.max(Math.abs(minZ), Math.abs(maxZ));
  return { minX, maxX, minZ, maxZ, halfX, halfZ, maxHalf: Math.max(halfX, halfZ) };
}

/**
 * Place the measured course maps into stable study clusters.
 *
 * Study and course ids are the only ordering inputs. The caller may hand in a
 * filesystem order, a published-package order, or a selected study first;
 * none of those changes the visual origin. Selection is therefore a render
 * state (lift/brightness/focus), never a layout input.
 */
export function placePlanetClusters(
  studies: readonly PlanetStudyLayoutInput[],
): PlanetClusterLayout {
  const studyInputs = [...studies]
    .map((study) => ({
      studyId: study.studyId,
      courses: [...study.courses].sort((left, right) =>
        left.courseId.localeCompare(right.courseId),
      ),
    }))
    .sort((left, right) => left.studyId.localeCompare(right.studyId));

  const localByStudy = new Map<string, readonly CirclePlacement[]>();
  const courseByStudy = new Map<string, readonly PlanetCourseLayoutInput[]>();
  const clusterItems: CircleItem[] = [];

  for (const study of studyInputs) {
    const courses = study.courses;
    courseByStudy.set(study.studyId, courses);
    const packed = recenterCircles(
      packCircles(
        courses.map((course) => ({ id: course.courseId, radius: inputRadius(course) })),
        PLANET_CLUSTER_LAYOUT_CONTRACT.intraClusterGap,
        `planet/course/${study.studyId}`,
      ),
    );
    localByStudy.set(study.studyId, packed);
    const radius = packed.reduce(
      (largest, circle) => Math.max(largest, Math.hypot(circle.x, circle.z) + circle.radius),
      0,
    );
    clusterItems.push({ id: study.studyId, radius });
  }

  const packedClusters = recenterCircles(
    packCircles(clusterItems, PLANET_CLUSTER_LAYOUT_CONTRACT.interClusterGap, "planet/study"),
  );
  const clusterIndexByStudy = new Map(
    studyInputs.map((study, index) => [study.studyId, index] as const),
  );
  const clusterByStudy = new Map(packedClusters.map((cluster) => [cluster.id, cluster]));

  const clusters = studyInputs.map((study) => {
    const circle = clusterByStudy.get(study.studyId)!;
    return {
      studyId: study.studyId,
      centerX: circle.x,
      centerZ: circle.z,
      radius: circle.radius,
      courseCount: study.courses.length,
    };
  });

  const courses: PlanetCoursePlacement[] = [];
  for (const study of studyInputs) {
    const cluster = clusterByStudy.get(study.studyId)!;
    const local = new Map(localByStudy.get(study.studyId)!.map((circle) => [circle.id, circle]));
    for (const course of courseByStudy.get(study.studyId)!) {
      const circle = local.get(course.courseId)!;
      const mapCenterX = course.centerX ?? 0;
      const mapCenterZ = course.centerZ ?? 0;
      const centerX = cluster.x + circle.x;
      const centerZ = cluster.z + circle.z;
      courses.push({
        studyId: study.studyId,
        courseId: course.courseId,
        x: centerX - mapCenterX,
        z: centerZ - mapCenterZ,
        centerX,
        centerZ,
        halfX: safeRadius(course.halfX),
        halfZ: safeRadius(course.halfZ),
        radius: circle.radius,
        clusterIndex: clusterIndexByStudy.get(study.studyId)!,
      });
    }
  }

  return { clusters, courses, bounds: fieldBounds(courses) };
}

export const PLANET_CAMERA_POLAR = 0.8377580409572781; // 48° from +Y, higher than the world shot.

/**
 * Fit the whole field in both axes. A circular bound is conservative for the
 * oblique camera, which is preferable to cropping a real course silhouette on
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
