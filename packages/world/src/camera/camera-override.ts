import type * as THREE from "three";

/**
 * A pose that takes the map camera over for a moment — the close-up beside the
 * learner's avatar when a lesson's chest opens (V7 station 4).
 *
 * It rides on the scene, which every component inside the canvas already
 * shares, so the scene that stages a moment and the controls that own the
 * camera need no other channel between them. While it is set the controls
 * stop steering and put the camera exactly here; when it is cleared they
 * resume from wherever the override left the eye.
 */
export interface CameraOverride {
  readonly from: THREE.Vector3;
  readonly look: THREE.Vector3;
}

const KEY = "cameraOverride";

export function setCameraOverride(scene: THREE.Object3D, pose: CameraOverride | null): void {
  if (pose) scene.userData[KEY] = pose;
  else delete scene.userData[KEY];
}

export function cameraOverrideOf(scene: THREE.Object3D): CameraOverride | null {
  return (scene.userData[KEY] as CameraOverride | undefined) ?? null;
}
