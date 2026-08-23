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
import { STUDY_PATH } from "./layout.js";

/**
 * How far down the road the world shot aims, past the learner's own island.
 *
 * Two and a half courses. Less and the learner sits in the middle of the frame
 * with as much sea behind them as road ahead; more and their own island slides
 * off the bottom edge, which is the one thing on the map they are entitled to
 * always be able to find.
 */
const WORLD_LOOK_AHEAD = STUDY_PATH.step * 2.5;

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
  /*
    The study is a road running along −Z, and the shot has to be down it.

    This used to point the camera along `learner − studyCentre`, which was the
    right idea for a radial tree: the learner was somewhere out on a disc and
    that vector said which way "outward" was. On a road it says almost nothing
    — near the middle of a study it is a rounding error, and the ±0.32 bias
    then decided the whole composition. The result was a road running corner to
    corner with 60% of the frame on empty sea.

    So: look down the road, and pull the target forward along it. The learner
    lands in the lower third with the courses they have not opened yet filling
    the rest, which is the same composition the course view uses and the same
    answer to the same question.
  */
  const at = (learnerAt ?? studyCentre)!.clone();
  const look = new THREE.Vector3(at.x, at.y, at.z - WORLD_LOOK_AHEAD);
  // A few degrees off the axis so the islands stagger instead of stacking into
  // one column of discs.
  const azimuth = 0.16;
  return {
    cameraFrom: pose(look, WORLD_DISTANCE_MIN, WORLD_POLAR, azimuth),
    lookAt: [look.x, look.y, look.z],
  };
}
