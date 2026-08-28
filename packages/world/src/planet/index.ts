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
export {
  PlanetScene,
  PlanetStage,
  PLANET_ICOSAHEDRON_DETAIL,
  PLANET_LIGHTS,
  PLANET_PALETTE,
  PLANET_SPACE_PALETTE,
  PLANET_FLOATING_CLUSTER_PROFILE_COUNT,
  buildFloatingIslandGeometry,
  buildPlanetGeometry,
} from "./PlanetScene.js";
export type { PlanetSceneProps } from "./PlanetScene.js";
export { PlanetPage, PlanetRail } from "./PlanetPage.js";
export type { PlanetPageProps, PlanetStudy } from "./PlanetPage.js";
export { studyCounts, studyCourseList } from "./planet-copy.js";
