/**
 * Where the eye sits on the world map.
 *
 * Copied from the delivery shell's framing so both shells look at the same
 * archipelago from the same place. The camera lever is still polar-plus-
 * distance (see Controls); these numbers are the first pose, not a per-frame
 * override.
 */
import * as THREE from "three";

export function frameWorld(
  learnerAt: THREE.Vector3 | null,
  studyCentre: THREE.Vector3 | null,
): {
  readonly cameraFrom: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
} {
  if (!learnerAt) {
    return { cameraFrom: [0, 90, 110], lookAt: [0, 0, 0] };
  }
  const away = learnerAt
    .clone()
    .sub(studyCentre ?? new THREE.Vector3())
    .setY(0);
  if (away.lengthSq() < 0.01) away.set(0, 0, 1);
  away.normalize();
  const side = new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(15);
  const spot = learnerAt
    .clone()
    .addScaledVector(away, 45)
    .add(side)
    .setY(learnerAt.y + 34);
  return {
    cameraFrom: [spot.x, spot.y, spot.z],
    lookAt: [learnerAt.x, learnerAt.y, learnerAt.z],
  };
}
