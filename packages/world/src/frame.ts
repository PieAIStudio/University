/**
 * Where the eye sits on the world map.
 *
 * Copied from the delivery shell's framing so both shells look at the same
 * archipelago from the same place. The camera lever is still polar-plus-
 * distance (see Controls); these numbers are the first pose, not a per-frame
 * override.
 */
import * as THREE from "three";

import { WORLD_DISTANCE_MAX, WORLD_DISTANCE_MIN, WORLD_POLAR } from "./controls.js";

function pose(
  look: THREE.Vector3,
  distance: number,
  polar: number,
  azimuth: number,
): readonly [number, number, number] {
  const offset = new THREE.Vector3().setFromSpherical(
    new THREE.Spherical(distance, polar, azimuth),
  );
  return [look.x + offset.x, look.y + offset.y, look.z + offset.z];
}

export function frameWorld(
  learnerAt: THREE.Vector3 | null,
  studyCentre: THREE.Vector3 | null,
  options?: { readonly overview?: boolean },
): {
  readonly cameraFrom: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
} {
  if (options?.overview || (!learnerAt && !studyCentre)) {
    const look = new THREE.Vector3(0, 0, 0);
    return {
      cameraFrom: pose(look, WORLD_DISTANCE_MAX, WORLD_POLAR, Math.PI / 4),
      lookAt: [0, 0, 0],
    };
  }
  const look = (learnerAt ?? studyCentre)!.clone();
  const away = look
    .clone()
    .sub(studyCentre ?? new THREE.Vector3())
    .setY(0);
  if (away.lengthSq() < 0.01) away.set(0, 0, 1);
  away.normalize();
  // A small azimuth bias so a road along the view does not stack into a
  // column of discs — the same "off the axis" habit the cartesian framing
  // used to get by adding a 15-unit side vector.
  const azimuth = Math.atan2(away.x, away.z) + 0.32;
  return {
    cameraFrom: pose(look, WORLD_DISTANCE_MIN, WORLD_POLAR, azimuth),
    lookAt: [look.x, look.y, look.z],
  };
}
