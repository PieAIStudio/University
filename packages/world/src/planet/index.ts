/**
 * The study-picker planet. One implementation, both shells, when the parent
 * wires a route. Nothing in this folder reads a library or a progress store.
 */
export {
  PLANET_CAMERA_POLAR,
  PLANET_CLUSTER_LAYOUT_CONTRACT,
  PLANET_STUDY_SIZE_CONTRACT,
  placePlanetClusters,
  planetCameraDistance,
} from "./placement.js";
export type {
  PlanetClusterLayout,
  PlanetClusterPlacement,
  PlanetFieldBounds,
  PlanetStudyLayoutInput,
  PlanetStudyPlacement,
} from "./placement.js";
export { PlanetScene, PlanetStage, PLANET_ATMOSPHERE } from "./PlanetScene.js";
export type { PlanetSceneProps } from "./PlanetScene.js";
export { PlanetPage, PlanetRail } from "./PlanetPage.js";
export type { PlanetPageProps, PlanetCourse, PlanetStudy } from "./PlanetPage.js";
export { studyCounts, studyCourseList } from "./planet-copy.js";
