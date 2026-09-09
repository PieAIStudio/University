/**
 * One world-camera projection for the learner surface and asset inspector.
 * The former +Z look-ahead belonged to a one-dimensional course road. R38's
 * real grouped islands exposed that stale assumption: the camera aimed at
 * empty sky while the catalogue accumulated above/right of the learner.
 */
import * as THREE from "three";
import { WORLD_DISTANCE_MIN, WORLD_POLAR } from "./controls.js";

const WORLD_NEIGHBOURS = 5;
const WORLD_FOCUS_OFFSET_MAX = 8;

/** Keep the current island legible, with a bounded hint of its ACTUAL neighbours.
 * Names, progress and invented course-road directions are not layout inputs.
 * A single/empty course catalogue aims at its learner instead of open sky.
 */
export function frameWorld(
  standingAt: THREE.Vector3 | null,
  placements: readonly { readonly position: THREE.Vector3 }[] = [],
): {
  readonly cameraFrom: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
} {
  const at = (standingAt ?? placements[0]?.position ?? new THREE.Vector3()).clone();
  const neighbours = [...placements]
    .sort(
      (a, b) =>
        a.position.distanceToSquared(at) - b.position.distanceToSquared(at) ||
        a.position.x - b.position.x ||
        a.position.z - b.position.z,
    )
    .slice(0, WORLD_NEIGHBOURS);
  const centre = at.clone().multiplyScalar(2);
  for (const entry of neighbours) centre.add(entry.position);
  centre.divideScalar(2 + neighbours.length);
  const offset = centre.sub(at).clampLength(0, WORLD_FOCUS_OFFSET_MAX);
  const look = at.clone().add(offset);
  const eye = new THREE.Vector3()
    .setFromSpherical(new THREE.Spherical(WORLD_DISTANCE_MIN, WORLD_POLAR, 0.16))
    .add(look);
  return { cameraFrom: [eye.x, eye.y, eye.z], lookAt: [look.x, look.y, look.z] };
}
