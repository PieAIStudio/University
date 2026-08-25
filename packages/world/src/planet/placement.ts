/**
 * Where a study sits on the planet, and how the globe turns to show it.
 *
 * A picker marker is a control, not a geographic claim. It therefore uses a
 * count-aware layout: the current series are evenly spaced in one front-facing
 * spherical cap, so a learner can see every entry without hunting around the
 * back of the globe. The ids are sorted before slots are assigned, which keeps
 * the result independent of filesystem order.
 *
 * `planetPoints` remains the generic full-sphere packing for geometry tests and
 * future map uses. `pointForStudy` remains a deterministic single-id helper;
 * the picker itself uses `placeStudies`, because only the collection knows how
 * wide its visible cap needs to be.
 */

import { hash } from "../island/random.js";

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

const VISIBLE_CAP_POLAR = 0.42;

function visiblePointAt(index: number, count: number, phase: number): SpherePoint {
  if (count <= 1) return toPoint(0, 0, 1, phase);

  /*
    Four real series fit comfortably on one latitude ring. Keeping the ring
    narrow matters more than maximising the sphere: when a learner selects one
    item, the other pins should remain in the same camera-facing hemisphere.
    More than six entries graduate to a golden-angle cap while staying below
    the horizon (`polar < π/2`).
  */
  if (count <= 6) {
    const theta = phase + (Math.PI * 2 * index) / count;
    return toPoint(
      Math.sin(VISIBLE_CAP_POLAR) * Math.cos(theta),
      Math.sin(VISIBLE_CAP_POLAR) * Math.sin(theta),
      Math.cos(VISIBLE_CAP_POLAR),
      theta,
    );
  }

  const golden = Math.PI * (3 - Math.sqrt(5));
  const polar = 0.34 + 0.76 * Math.sqrt((index + 0.5) / count);
  const theta = phase + golden * index;
  return toPoint(
    Math.sin(polar) * Math.cos(theta),
    Math.sin(polar) * Math.sin(theta),
    Math.cos(polar),
    theta,
  );
}

/**
 * One study, one deterministic point in the camera-facing cap. This helper is
 * intentionally independent of the collection; `placeStudies` is the API for
 * a real picker, because it can distribute a known number of studies without
 * overlap.
 *
 * Two hashes, not one: a single `[0,1)` used for both polar angle and azimuth
 * would put ids on a stripe. FNV on the two salted keys is the same trick
 * `seeded()` uses to get a stream out of one string.
 */
export function pointForStudy(studyId: string, seed = ""): SpherePoint {
  const key = seed ? `${seed}:${studyId}` : studyId;
  const polar = 0.28 + unitFrom(key, "polar") * 0.58;
  const theta = 2 * Math.PI * unitFrom(key, "azimuth");
  return toPoint(
    Math.sin(polar) * Math.cos(theta),
    Math.sin(polar) * Math.sin(theta),
    Math.cos(polar),
    theta,
  );
}

export function placeStudies(ids: readonly string[], seed = ""): ReadonlyMap<string, SpherePoint> {
  const placed = new Map<string, SpherePoint>();
  const ordered = [...new Set(ids)].sort((left, right) => left.localeCompare(right));
  const phase = seed ? 2 * Math.PI * unitFrom(seed, "phase") : 0;
  for (const [index, id] of ordered.entries()) {
    placed.set(id, visiblePointAt(index, ordered.length, phase));
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
