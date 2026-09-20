import * as THREE from "three";

/** A single camera-facing datum: backing, objects and DOM must share its plane.
 * Fixed world-z planes are not parallel to angled faces and can bury lower tiles. */
export function boardPoint(
  camera: THREE.Camera,
  width: number,
  height: number,
  x: number,
  y: number,
  raised = 0,
): [number, number, number] {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const direction = new THREE.Vector3((2 * x) / width - 1, 1 - (2 * y) / height, 0.5)
    .unproject(camera)
    .sub(camera.position)
    .normalize();
  const p = camera.position
    .clone()
    .addScaledVector(direction, (20 - raised) / direction.dot(forward));
  return [p.x, p.y, p.z];
}
