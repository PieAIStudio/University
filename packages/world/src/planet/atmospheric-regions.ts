/** One deterministic global projection of real course identities. */
import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import { islandGeometryBlueprint, projectIslandBlueprint } from "../island/island-blueprint.js";
import { getOrCreateRemoteBaseGeometry } from "../island/remote-island-field.js";
import { islandThemeSelectionForCourse } from "../island/kenney-recipes.js";
import { islandLookSeedForCourse } from "../island/island-surface-style.js";
import type { PlanetStudy } from "./planet-copy.js";

export const DOMAIN_RADIUS = 10;
export const REGION_ALTITUDE = 1.12;
export const REGION_HIT_RADIUS = 0.95;
export const ATMOSPHERIC_ISLAND_RADIUS = 0.19;
export type PlanetRepresentativeLimit = 3 | 5;
/** Keep whole, canonical islands; narrow viewports need fewer representatives, not denser meshes. */
export function planetRepresentativeLimit(
  viewportWidth: number,
  deviceTier: "desktop" | "mobile" = "desktop",
): PlanetRepresentativeLimit {
  return deviceTier === "mobile" || viewportWidth < 768 ? 3 : 5;
}
export interface AtmosphericRegion {
  readonly studyId: string;
  readonly normal: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly position: THREE.Vector3;
  readonly courseIds: readonly string[];
}

/** Only geometry inputs belong here; progress/title edits must not rebuild islands. */
export function atmosphericGeometryKey(
  studies: readonly PlanetStudy[],
  limit: PlanetRepresentativeLimit = 5,
): string {
  return JSON.stringify(
    [...studies]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((study) => [
        study.id,
        // Courses arrive in the canonical teaching order from spineOf (world-model).
        study.courses.slice(0, limit).map((course) => [course.id, course.lessonCount]),
      ]),
  );
}

/** A larger invisible hit sphere must not expose a region behind the limb. */
export function isAtmosphericRegionFacingCamera(
  region: AtmosphericRegion,
  bodyMatrix: THREE.Matrix4,
  cameraPosition: THREE.Vector3,
): boolean {
  const normal = region.normal.clone().transformDirection(bodyMatrix);
  const point = region.position.clone().applyMatrix4(bodyMatrix);
  return normal.dot(cameraPosition.clone().sub(point)) > 0;
}

export function planAtmosphericRegions(
  studies: readonly PlanetStudy[],
  limit: PlanetRepresentativeLimit = 5,
): readonly AtmosphericRegion[] {
  const ordered = [...studies].sort((a, b) => a.id.localeCompare(b.id));
  return ordered.map((study, i) => {
    const y = 1 - (2 * (i + 0.5)) / ordered.length;
    const phi = i * Math.PI * (3 - Math.sqrt(5));
    const r = Math.sqrt(1 - y * y);
    const normal = new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r);
    return {
      studyId: study.id,
      normal,
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal),
      position: normal.clone().multiplyScalar(DOMAIN_RADIUS * REGION_ALTITUDE),
      courseIds: study.courses.slice(0, limit).map((course) => course.id),
    };
  });
}

/** Build all representative islands in one draw; selection only rotates the domain. */
export function buildAtmosphericIslands(
  studies: readonly PlanetStudy[],
  regions: readonly AtmosphericRegion[],
) {
  const parts: THREE.BufferGeometry[] = [];
  for (const region of regions) {
    const study = studies.find((entry) => entry.id === region.studyId)!;
    for (let i = 0; i < region.courseIds.length; i++) {
      const course = study.courses.find((entry) => entry.id === region.courseIds[i])!;
      const blueprint = projectIslandBlueprint(
        islandGeometryBlueprint({
          studyId: study.id,
          courseId: course.id,
          lessonCount: Math.max(1, course.lessonCount),
          seed: islandLookSeedForCourse(course.id) ?? course.id,
          themeSelection: islandThemeSelectionForCourse(study.id, course.id),
        }),
      );
      const base = getOrCreateRemoteBaseGeometry(blueprint, ATMOSPHERIC_ISLAND_RADIUS);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(base.positions.slice(), 3));
      geometry.setAttribute("normal", new THREE.BufferAttribute(base.normals.slice(), 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(base.colors.slice(), 3));
      geometry.setIndex(new THREE.BufferAttribute(base.indices.slice(), 1));
      const angle = i * 2.4;
      const spread = i === 0 ? 0 : 0.38 + i * 0.025;
      const offset = new THREE.Vector3(Math.cos(angle) * spread, 0, Math.sin(angle) * spread)
        .applyQuaternion(region.quaternion)
        .add(region.position);
      geometry.applyMatrix4(
        new THREE.Matrix4().compose(offset, region.quaternion, new THREE.Vector3(1, 1, 1)),
      );
      parts.push(geometry);
    }
  }
  if (parts.length === 0) return new THREE.BufferGeometry();
  const merged = mergeBufferGeometries(parts);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error("Cannot merge atmospheric course projections");
  merged.computeBoundingSphere();
  return merged;
}
