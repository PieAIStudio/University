/**
 * Where the eye sits on the world map.
 *
 * Copied from the delivery shell's framing so both shells look at the same
 * archipelago from the same place. The camera lever is still polar-plus-
 * distance (see Controls); these numbers are the first pose, not a per-frame
 * override.
 */
import * as THREE from "three";

import { WORLD_DISTANCE_MIN, WORLD_POLAR } from "./controls.js";
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

/**
 * How much road is still in front of the learner, along −Z.
 *
 * Zero in a series with one course, which is the case that broke the shot: the
 * camera aimed a fixed two and a half course-steps down a road that had no
 * second course, so it framed open sea with the only island clinging to the
 * bottom edge. 通用课 shipped with exactly one course and looked broken on the
 * day it landed.
 */
export function roadAhead(
  placements: readonly { readonly position: THREE.Vector3 }[],
  standingAt: THREE.Vector3 | null,
): number {
  if (placements.length === 0) return 0;
  const from = standingAt?.z ?? 0;
  const furthest = Math.min(...placements.map((entry) => entry.position.z));
  return Math.max(0, from - furthest);
}

/**
 * @param standingAt Where the learner is on this project's road, or the head of
 *   the road in a project they have not started. `null` only while the course
 *   list is still resolving.
 *
 * The old signature took a study centre and an `overview` flag as well, because
 * the map used to hold every project at once and 「看全部四片海」 pulled the
 * camera back to the origin to show all of them. One project per scene retires
 * both: there is no ring to centre on any more, and the way to see the other
 * projects is the planet, which is a page and not a camera distance.
 */
export function frameWorld(
  standingAt: THREE.Vector3 | null,
  /**
   * Distance still to travel. The shot leads the learner by up to two and a
   * half course-steps, but never past the end of what there is to look at.
   */
  ahead = Number.POSITIVE_INFINITY,
): {
  readonly cameraFrom: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
} {
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
  const at = (standingAt ?? new THREE.Vector3(0, 0, 0)).clone();
  const look = new THREE.Vector3(at.x, at.y, at.z - Math.min(WORLD_LOOK_AHEAD, ahead));
  // A few degrees off the axis so the islands stagger instead of stacking into
  // one column of discs.
  const azimuth = 0.16;
  return {
    cameraFrom: pose(look, WORLD_DISTANCE_MIN, WORLD_POLAR, azimuth),
    lookAt: [look.x, look.y, look.z],
  };
}
