/**
 * The study-picker planet. One implementation, both shells, when the parent
 * wires a route. Nothing in this folder reads a library or a progress store.
 */
export {
  applyYawPitch,
  dampValue,
  placeStudies,
  planetPoints,
  pointForStudy,
  rotationFor,
  stepRotation,
} from "./placement.js";
export type { SpherePoint, YawPitch } from "./placement.js";
export { PlanetScene, PlanetStage } from "./PlanetScene.js";
export type { PlanetSceneProps } from "./PlanetScene.js";
export { PlanetPage, PlanetRail } from "./PlanetPage.js";
export type { PlanetPageProps, PlanetStudy } from "./PlanetPage.js";
export { studyCounts, studyCourseList } from "./planet-copy.js";
