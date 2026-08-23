/**
 * The 3D scene. One implementation, for both shells when they choose it.
 *
 * How to read this file:
 *
 * - Exports below are the **scene contract**. A shell supplies course nodes,
 *   a `ProgressSource`, and click handlers. It does not import a renderer
 *   from `packages/ui`.
 * - Deep paths in `package.json` `exports` are the ones shells actually
 *   import. Anything not listed there is internal assembly.
 */

export {
  CourseScene,
  placeCourse,
  placeWorld,
  settlementSize,
  skyStopsForStudy,
  WorldScene,
} from "./Maps.js";
export type { LessonPlacement, Marker } from "./Maps.js";
export { Stage } from "./Stage.js";
export { courseSprites } from "./path-overlay.js";
export { courseShapeOf, depthsFromPrerequisites, isFocusDimmed, studySub } from "./course.js";
export type { Course, CourseNode } from "./course.js";
export {
  Controls,
  COURSE_POLAR,
  Flight,
  LabelProbe,
  MAP_CONTROLS_HINT,
  WORLD_DISTANCE_MAX,
  WORLD_DISTANCE_MIN,
  WORLD_POLAR,
} from "./controls.js";
export { frameWorld } from "./frame.js";
export { wheelIntent } from "./wheel-intent.js";
export { CompanionProbe, screenFromProjected } from "./companion-probe.js";
export type { CompanionAnchor } from "./companion-probe.js";
