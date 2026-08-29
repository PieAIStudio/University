import type { View } from "@pieai/university-core";
import { frameCourse } from "@pieai/university-world/course-map.js";
import { frameWorld, roadAhead } from "@pieai/university-world/frame.js";
import type { LessonPlacement } from "@pieai/university-world/Maps.js";
import type { WorldMap } from "@pieai/university-world/WorldMapCanvas.js";
import { useMemo } from "react";

interface SceneCameraOptions {
  readonly learnerAt: Parameters<typeof frameWorld>[0];
  readonly lessons: readonly LessonPlacement[];
  readonly viewKind: View["kind"];
  readonly world: WorldMap | null;
}

/** Keep the world and course first shots in one named camera projection. */
export function useSceneCamera({ learnerAt, lessons, viewKind, world }: SceneCameraOptions) {
  /*
   * The default view stands beside the learner, not above the library.
   *
   * A world map is not meant to be read all at once. The first attempt put the
   * camera at a fixed point over the origin while the learner stood in a study
   * a hundred units away, and the result was a black frame with five specks in
   * it. Framing from where the learner is standing — back along the direction
   * they came, up, and off the axis so the road does not stack into a column of
   * discs — is what makes the map answer "where am I" in one glance.
   */
  const framed = useMemo(
    () => frameWorld(learnerAt, roadAhead(world?.placements ?? [], learnerAt)),
    [learnerAt, world],
  );

  /**
   * Inside a course the camera stands on the road instead of above it.
   *
   * The overview it replaces framed the whole folded course at once, which is
   * the right shot for a map and the wrong one for a path: every stone sat at
   * the same distance, so none of them was *next*. Standing behind the live
   * stone and looking up the road puts the answer to "what now" in the middle
   * of the frame, and lets the rest recede into the fog the scene already has.
   *
   * The camera tracks half the road's lateral swing rather than all of it. At
   * full swing it moves with the curve, the curve cancels, and the road looks
   * dead straight — the shot would be hiding the one thing it is framing.
   */
  // `frameCourse`, not a second copy: the authoring shell needs the same shot,
  // and a camera that exists in one app file is a camera the other cannot have.
  const roadCamera = useMemo(
    () => (viewKind === "course" || viewKind === "lesson" ? frameCourse(lessons) : null),
    [viewKind, lessons],
  );

  const cameraFrom: readonly [number, number, number] = roadCamera
    ? roadCamera.cameraFrom
    : framed.cameraFrom;
  const lookAt: readonly [number, number, number] = roadCamera ? roadCamera.lookAt : framed.lookAt;

  return { cameraFrom, lookAt };
}
