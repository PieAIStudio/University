import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  planAtmosphericRegions,
  atmosphericGeometryKey,
  isAtmosphericRegionFacingCamera,
  buildAtmosphericIslands,
  DOMAIN_RADIUS,
  REGION_HIT_RADIUS,
  REGION_ALTITUDE,
} from "./atmospheric-regions.js";
import type { PlanetStudy } from "./planet-copy.js";
function studies(count: number): PlanetStudy[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `study-${i}`,
    title: `Study ${i}`,
    courseCount: 8,
    lessonCount: 80,
    lessonsDone: 0,
    courseTitles: [],
    courses: Array.from({ length: 8 }, (_, c) => ({
      id: `course-${i}-${c}`,
      title: `Course ${c}`,
      lessonCount: 10,
      depth: c,
    })),
  }));
}
describe("atmospheric regions", () => {
  it.each([1, 4, 30])(
    "places %i distinct regions with non-overlapping physical hit targets",
    (count) => {
      const source = studies(count);
      const regions = planAtmosphericRegions(source);
      expect(regions).toHaveLength(count);
      expect(planAtmosphericRegions([...source].reverse())).toEqual(regions);
      for (let i = 0; i < regions.length; i++) {
        const region = regions[i]!;
        expect(region.position.length()).toBeCloseTo(DOMAIN_RADIUS * REGION_ALTITUDE, 5);
        expect(region.courseIds).toEqual(
          source
            .find((study) => study.id === region.studyId)!
            .courses.slice(0, 5)
            .map((course) => course.id),
        );
        for (let j = i + 1; j < regions.length; j++)
          expect(region.position.distanceTo(regions[j]!.position)).toBeGreaterThan(
            REGION_HIT_RADIUS * 2,
          );
      }
    },
  );
  it("keeps representative terrain outside the planet and within the 640 triangle per island budget", () => {
    const source = studies(4);
    const regions = planAtmosphericRegions(source);
    const geometry = buildAtmosphericIslands(source, regions);
    expect(geometry.index!.count / 3).toBeLessThanOrEqual(4 * 5 * 640);
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      const radius = Math.hypot(position.getX(i), position.getY(i), position.getZ(i));
      expect(Number.isFinite(radius)).toBe(true);
      expect(radius).toBeGreaterThan(DOMAIN_RADIUS * 1.07);
      expect(radius).toBeLessThan(DOMAIN_RADIUS * 1.2);
    }
    geometry.dispose();
  });
  it("does not fabricate islands for an empty catalogue", () => {
    expect(planAtmosphericRegions([])).toEqual([]);
    const geometry = buildAtmosphericIslands([], []);
    expect(geometry.getAttribute("position")).toBeUndefined();
    geometry.dispose();
  });
});

it("keeps shape identity across progress and label refreshes but invalidates course changes", () => {
  const initial = studies(4);
  const changed = initial.map((study) => ({ ...study, title: "renamed", lessonsDone: 10 }));
  expect(atmosphericGeometryKey(changed)).toBe(atmosphericGeometryKey(initial));
  const newLessons = initial.map((study) => ({
    ...study,
    courses: study.courses.map((c) => ({ ...c, lessonCount: c.lessonCount + 1 })),
  }));
  expect(atmosphericGeometryKey(newLessons)).not.toBe(atmosphericGeometryKey(initial));
});

it("rejects hidden region hit spheres including the rear limb under a rotated domain", () => {
  const region = planAtmosphericRegions(studies(1))[0]!;
  const rotation = new THREE.Quaternion().setFromUnitVectors(
    region.normal,
    new THREE.Vector3(0, 0, 1),
  );
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(4, 0, 0),
    rotation,
    new THREE.Vector3(0.3, 0.3, 0.3),
  );
  expect(isAtmosphericRegionFacingCamera(region, matrix, new THREE.Vector3(4, 0, 40))).toBe(true);
  expect(isAtmosphericRegionFacingCamera(region, matrix, new THREE.Vector3(4, 0, -40))).toBe(false);
  // At the silhouette the hit sphere protrudes, but its outward face is hidden.
  expect(isAtmosphericRegionFacingCamera(region, matrix, new THREE.Vector3(40, 0, 0))).toBe(false);
});
