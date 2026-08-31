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
export { buildCourseGrid } from "./grid/course-grid.js";
export { hexToWorld } from "./grid/hex.js";
export { Stage } from "./Stage.js";
export { WorldMapCanvas, type WorldMap } from "./WorldMapCanvas.js";
export {
  describeIslandLayer,
  describePlanetLayer,
  describeWorldLayer,
  PreviewOverrideBridge,
} from "./inspector/index.js";
export type {
  InspectorLayerDescription,
  InspectorParameter,
  InspectorRuntimeMetrics,
} from "./inspector/index.js";
export { courseSprites } from "./labels/path-overlay.js";
export {
  courseNodesOf,
  courseShapeOf,
  depthsFromPrerequisites,
  isFocusDimmed,
  studySub,
} from "./course/course.js";
export type { Course, CourseNode } from "./course/course.js";
export { islandBlueprint } from "./island/island-blueprint.js";
export { islandThemeSelectionForCourse } from "./island/kenney-recipes.js";
export {
  Controls,
  COURSE_POLAR,
  Flight,
  LabelProbe,
  MAP_CONTROLS_HINT,
  MapControlsHint,
  mapControlsHint,
  WORLD_DISTANCE_MAX,
  WORLD_DISTANCE_MIN,
  WORLD_POLAR,
} from "./camera/controls.js";
export type { MapPointer } from "./camera/controls.js";
export { frameWorld } from "./camera/frame.js";
export { wheelIntent } from "./camera/wheel-intent.js";
export { CompanionProbe, screenFromProjected } from "./companion/companion-probe.js";
export type { CompanionAnchor } from "./companion/companion-probe.js";
export {
  islandLookCameraForShot,
  islandLookDebugFromSearch,
  islandLookSceneSource,
  resolveIslandLookDebug,
  ISLAND_LOOK_CONTRACT,
  ISLAND_LOOK_SHOT_IDS,
} from "./island/island-look.js";
export type {
  IslandLookCameraPose,
  IslandLookDebugOptions,
  IslandLookSceneSource,
  IslandLookShotId,
} from "./island/island-look.js";
export type {
  DomLabelContrastSample,
  IslandLookBrowserReport,
  IslandLookCodeMetrics,
  IslandLookLayerDistribution,
  IslandLookPixelMetrics,
} from "./island/look-metrics.js";
