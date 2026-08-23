/**
 * Where a study sits on the planet, and how the globe turns to show it.
 *
 * Placement is a function of `studyId`, never of the array index. The world
 * map already learned this the hard way: a layout keyed to content (or to
 * "the third item") rearranges every island when an author inserts a course.
 * The globe would do the same thing, except the learner would watch their
 * project jump to a new continent. `random.ts` is the same FNV the islands
 * seed from, so a study that is stable on the map is stable here.
 *
 * The even packing (`planetPoints`) is a Fibonacci sphere. Hashing an id
 * straight onto that packing would still be index-like — slot 7 moves when
 * the packing is rebuilt for N+1. So the two APIs stay separate: Fibonacci
 * is how we prove N=4 and N=40 can share a sphere; `pointForStudy` is how a
 * real project finds its island, alone.
 */

import { hash } from "../random.js";

export interface SpherePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Azimuth around Y, radians. */
  readonly theta: number;
  /** Polar angle from +Y, radians. */
  readonly phi: number;
}

export interface YawPitch {
  readonly yaw: number;
  readonly pitch: number;
}

function toPoint(x: number, y: number, z: number, theta: number): SpherePoint {
  const length = Math.hypot(x, y, z) || 1;
  const nx = x / length;
  const ny = y / length;
  const nz = z / length;
  return {
    x: nx,
    y: ny,
    z: nz,
    theta,
    phi: Math.acos(Math.min(1, Math.max(-1, ny))),
  };
}

/**
 * FNV on its own is not an avalanche. `study-00` / `study-01` share a long
 * prefix, so their hashes walk a stripe, and forty numbered projects would
 * sit in one belt — overlapping even though the ids are distinct. A murmur
 * finalizer on the FNV bits jumps the whole range from a one-character
 * tail flip. We still start from `hash()` so the stream stays the same
 * FNV the islands already trust.
 */
function unitFrom(id: string, salt: string): number {
  const unit = hash(`${salt}:${id}`);
  let bits = (unit * 0x100000000) >>> 0;
  bits ^= bits >>> 16;
  bits = Math.imul(bits, 0x85ebca6b);
  bits ^= bits >>> 13;
  bits = Math.imul(bits, 0xc2b2ae35);
  bits ^= bits >>> 16;
  return (bits >>> 0) / 0x100000000;
}

/**
 * Even packing of `count` points on the unit sphere.
 *
 * Offset samples (`i + 0.5`) so nothing lands on a pole. A point on the pole
 * is a marker sitting on top of another marker in screen space once the
 * globe tilts even slightly, which is the overlap the N=4 / N=40 tests exist
 * to refuse. `seed` only yaws the constellation — spacing is a property of
 * count, not of phase.
 */
export function planetPoints(count: number, seed = 0): readonly SpherePoint[] {
  if (count <= 0) return [];
  if (count === 1) {
    return [toPoint(0, 1, 0, seed)];
  }
  // Golden angle. `π(3 − √5)` is 2π/φ², the increment that never lines two
  // samples up on the same meridian.
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - ((index + 0.5) / count) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * index + seed;
    return toPoint(Math.cos(theta) * radius, y, Math.sin(theta) * radius, theta);
  });
}

/**
 * One study, one point. Independent of every other study, so inserting a
 * neighbour cannot shove this one around the ocean.
 *
 * Two hashes, not one: a single `[0,1)` used for both latitude and longitude
 * lays every id on a spiral stripe, and the four seas we actually have would
 * have landed in a belt. FNV on `id` and `id#lon` is the same trick
 * `seeded()` uses to get a stream out of one string.
 */
export function pointForStudy(studyId: string, seed = ""): SpherePoint {
  const key = seed ? `${seed}:${studyId}` : studyId;
  const u = unitFrom(key, "lat");
  const v = unitFrom(key, "lon");
  const y = 1 - 2 * u;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = 2 * Math.PI * v;
  return toPoint(Math.cos(theta) * radius, y, Math.sin(theta) * radius, theta);
}

export function placeStudies(ids: readonly string[], seed = ""): ReadonlyMap<string, SpherePoint> {
  const placed = new Map<string, SpherePoint>();
  for (const id of ids) {
    placed.set(id, pointForStudy(id, seed));
  }
  return placed;
}

/**
 * Apply `rotationFor` the way a default three.js `Object3D` does: order
 * XYZ, so pitch (X) then yaw (Y), never roll. Kept here so the test and
 * the scene cannot drift onto different Euler orders — YXZ was the first
 * draft and it left a residual X on a point that should have faced +Z.
 */
export function applyYawPitch(
  point: Pick<SpherePoint, "x" | "y" | "z">,
  yaw: number,
  pitch: number,
): { readonly x: number; readonly y: number; readonly z: number } {
  const cosX = Math.cos(pitch);
  const sinX = Math.sin(pitch);
  const y1 = cosX * point.y - sinX * point.z;
  const z1 = sinX * point.y + cosX * point.z;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  return {
    x: cosY * point.x + sinY * z1,
    y: y1,
    z: -sinY * point.x + cosY * z1,
  };
}

/**
 * Globe rotation that puts `point` on +Z.
 *
 * PlanetStage sits the camera near +Z looking at the origin, so +Z is "in
 * the learner's face". Pitch around X until the point is in the XZ plane,
 * then yaw around Y until it sits on +Z. No roll: a rolled globe dumps
 * the north pole into the side of the frame and the sea no longer reads
 * as a planet.
 */
export function rotationFor(point: Pick<SpherePoint, "x" | "y" | "z">): YawPitch {
  const pitch = Math.atan2(point.y, point.z);
  const cosX = Math.cos(pitch);
  const sinX = Math.sin(pitch);
  const z1 = sinX * point.y + cosX * point.z;
  const yaw = -Math.atan2(point.x, z1);
  return { yaw, pitch };
}

/**
 * Frame-rate independent approach. This is `THREE.MathUtils.damp` written
 * out so the stepper can live next to the packing and stay three-free:
 * `lerp(a, b, 1 - exp(-lambda * dt))`. A fixed-factor lerp is faster on a
 * 120 Hz screen than on a 60 Hz one; the globe would then take a different
 * number of turns to arrive, which is a lie about where the island is.
 */
export function dampValue(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function stepRotation(
  current: YawPitch,
  target: YawPitch,
  dt: number,
  reducedMotion: boolean,
  lambda = 5.5,
): YawPitch {
  if (reducedMotion || dt <= 0) return { yaw: target.yaw, pitch: target.pitch };
  // Shortest-arc yaw. Without this, selecting a study just the other side of
  // ±π sends the globe the long way around and the island the learner picked
  // disappears behind the horizon for a full spin.
  const yawTarget =
    current.yaw +
    Math.atan2(Math.sin(target.yaw - current.yaw), Math.cos(target.yaw - current.yaw));
  return {
    yaw: dampValue(current.yaw, yawTarget, lambda, dt),
    pitch: dampValue(current.pitch, target.pitch, lambda, dt),
  };
}
