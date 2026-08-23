/**
 * The serialisable identity of one course island.
 *
 * A world-map island and the ground seen after entering it are not two models.
 * They are two projections of this one record. The small projection may omit
 * lesson stones, shrubs and minor buildings, but it keeps the outline, broad
 * terrain, colour family and semantic anchors. No Three.js object lives here,
 * so the same blueprint can later be cached at build time or sent to a worker.
 */
import { layoutCourseRoad } from "./layout.js";
import { hash, seeded } from "./random.js";

export const ISLAND_BLUEPRINT_VERSION = 1 as const;
const OUTLINE_SEGMENTS = 64;

export interface BlueprintPoint {
  readonly x: number;
  readonly z: number;
}

export interface BlueprintPathPoint extends BlueprintPoint {
  readonly index: number;
}

export interface BlueprintOutlinePoint extends BlueprintPoint {
  readonly angle: number;
  readonly scale: number;
}

export interface BlueprintSurfaceSlot extends BlueprintPoint {
  readonly y: number;
  readonly turn: number;
}

export interface IslandBlueprint {
  readonly version: typeof ISLAND_BLUEPRINT_VERSION;
  readonly studyId: string;
  readonly courseId: string;
  readonly lessons: number;
  readonly seed: string;
  readonly tint: number;
  readonly terrainPhase: number;
  readonly path: readonly BlueprintPathPoint[];
  readonly outline: readonly BlueprintOutlinePoint[];
  readonly surfaceSlots: readonly BlueprintSurfaceSlot[];
  readonly bounds: {
    readonly halfX: number;
    readonly halfZ: number;
    readonly maxHalf: number;
  };
  /** Landmarks survive semantic LOD; minor dressing does not. */
  readonly anchors: {
    readonly entrance: readonly [number, number];
    readonly landmark: readonly [number, number];
    readonly summit: readonly [number, number];
  };
}

export interface IslandSurfaceSample {
  readonly y: number;
  /** 0 at the centre, 1 at this angle's authored shoreline. */
  readonly radial: number;
  readonly inside: boolean;
}

const cache = new Map<string, IslandBlueprint>();

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function outlineScaleAt(blueprint: IslandBlueprint, angle: number): number {
  const full = Math.PI * 2;
  const wrapped = ((angle % full) + full) % full;
  const at = (wrapped / full) * blueprint.outline.length;
  const floor = Math.floor(at);
  const index = floor % blueprint.outline.length;
  const next = (index + 1) % blueprint.outline.length;
  return lerp(blueprint.outline[index]!.scale, blueprint.outline[next]!.scale, at - floor);
}

/** The continuous height rule used by terrain, lesson stones and props. */
export function sampleIslandSurface(
  blueprint: IslandBlueprint,
  x: number,
  z: number,
): IslandSurfaceSample {
  const normalX = x / blueprint.bounds.halfX;
  const normalZ = z / blueprint.bounds.halfZ;
  const angle = Math.atan2(normalZ, normalX);
  const edgeScale = outlineScaleAt(blueprint, angle);
  const radial = Math.hypot(normalX, normalZ) / edgeScale;
  const falloff = Math.max(0, 1 - Math.pow(clamp(radial, 0, 1), 1.72));
  const broadVariation =
    Math.sin(normalX * 4.1 + blueprint.terrainPhase) * 0.11 +
    Math.cos(normalZ * 5.2 - blueprint.terrainPhase * 0.73) * 0.08;
  return {
    y: falloff * (1.42 + broadVariation),
    radial,
    inside: radial <= 1,
  };
}

export function islandSurfaceY(blueprint: IslandBlueprint, x: number, z: number): number {
  return sampleIslandSurface(blueprint, x, z).y;
}

function offsetLandmark(path: readonly BlueprintPathPoint[]): readonly [number, number] {
  // A gate is orientation, not a trophy at the midpoint. Keeping it in the
  // first unit lets the learner recognise the tiny world-map silhouette again
  // as soon as the camera arrives on the island.
  const anchor = Math.round((path.length - 1) * 0.12);
  const point = path[anchor]!;
  const before = path[Math.max(0, anchor - 1)]!;
  const after = path[Math.min(path.length - 1, anchor + 1)]!;
  const dx = after.x - before.x;
  const dz = after.z - before.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return [point.x + 4.4, point.z];
  // The course road passes the monument instead of running through its mesh.
  return [point.x - (dz / length) * 4.4, point.z + (dx / length) * 4.4];
}

/** Build or recover the stable identity of one course island. */
export function islandBlueprint(
  studyId: string,
  courseId: string,
  lessons: number,
): IslandBlueprint {
  const safeLessons = Math.max(1, Math.floor(lessons));
  const key = `${ISLAND_BLUEPRINT_VERSION}/${studyId}/${courseId}/${safeLessons}`;
  const found = cache.get(key);
  if (found) return found;

  const seed = `${studyId}/${courseId}`;
  const path = layoutCourseRoad(safeLessons).map((point, index) => ({
    index,
    x: point.x,
    z: point.z,
  }));
  const margin = 7.4 + Math.min(2.8, Math.sqrt(safeLessons) * 0.38);
  const halfX = Math.max(7.8, ...path.map((point) => Math.abs(point.x) + margin));
  const halfZ = Math.max(7.8, ...path.map((point) => Math.abs(point.z) + margin));
  const shorePhase = hash(`${seed}/shore`) * Math.PI * 2;
  const terrainPhase = hash(`${seed}/terrain`) * Math.PI * 2;
  const outline = Array.from({ length: OUTLINE_SEGMENTS }, (_, index) => {
    const angle = (index / OUTLINE_SEGMENTS) * Math.PI * 2;
    // Low-frequency harmonics produce bays and shoulders without the noisy
    // saw edge caused by independent random jitter at every vertex.
    const scale =
      1 + Math.sin(angle * 3 + shorePhase) * 0.09 + Math.sin(angle * 5 - shorePhase * 0.61) * 0.045;
    return {
      angle,
      scale,
      x: Math.cos(angle) * halfX * scale,
      z: Math.sin(angle) * halfZ * scale,
    };
  });

  const anchors = {
    entrance: [path[0]!.x, path[0]!.z] as const,
    landmark: offsetLandmark(path),
    summit: [path[path.length - 1]!.x, path[path.length - 1]!.z] as const,
  };
  const base: IslandBlueprint = {
    version: ISLAND_BLUEPRINT_VERSION,
    studyId,
    courseId,
    lessons: safeLessons,
    seed,
    tint: (hash(studyId) - 0.5) * 0.14,
    terrainPhase,
    path,
    outline,
    surfaceSlots: [],
    bounds: { halfX, halfZ, maxHalf: Math.max(halfX, halfZ) },
    anchors,
  };

  const random = seeded(`${seed}/surface-slots`);
  const slotCount = Math.max(18, safeLessons * 3);
  const surfaceSlots: BlueprintSurfaceSlot[] = [];
  // These are semantic clearings, not decoration coordinates. Reserving them
  // in the blueprint means the same tree cannot cover the gate in the course
  // view and then disappear from its world-map projection.
  const protectedClearings: readonly (readonly [readonly [number, number], number])[] = [
    [anchors.entrance, 3.2],
    [anchors.landmark, 5.8],
    [anchors.summit, 3.2],
  ];
  let attempts = 0;
  while (surfaceSlots.length < slotCount && attempts < slotCount * 24) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const edgeScale = outlineScaleAt(base, angle);
    const radial = Math.sqrt(random()) * 0.78 * edgeScale;
    const x = Math.cos(angle) * halfX * radial;
    const z = Math.sin(angle) * halfZ * radial;
    const protectedSlot = protectedClearings.some(
      ([[clearX, clearZ], radius]) => Math.hypot(x - clearX, z - clearZ) < radius,
    );
    const turn = random() * Math.PI * 2;
    if (protectedSlot) continue;
    surfaceSlots.push({ x, y: islandSurfaceY(base, x, z), z, turn });
  }
  const made = { ...base, surfaceSlots };
  cache.set(key, made);
  return made;
}
