import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
  COURSE_DISTANCE,
  COURSE_DISTANCE_MAX,
  COURSE_DISTANCE_MIN,
  COURSE_POLAR,
  WORLD_DISTANCE_MAX,
  WORLD_DISTANCE_MIN,
  WORLD_POLAR,
} from "./controls";
import { courseIslandScale } from "../Maps";
import { islandBlueprint, sampleIslandSurface } from "../island/island-blueprint.js";
import { radiusForLessons } from "../course/layout";

/*
  Dolly span, both levels. This started at 76× on the world map, which let the
  eye sit inside an island's mesh — and being inside the geometry is what reads
  as the sky spinning, which is what got reported. Three is the ceiling because
  past it the same drag gesture means wildly different things at the two ends.
*/
describe("two-finger map gestures", () => {
  it("keeps DOLLY_PAN and does not assign TWO to the one-finger PAN state", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "controls.tsx"),
      "utf8",
    );
    expect(source).toContain("THREE.TOUCH.DOLLY_PAN");
    expect(source).toContain("installTouchDollyDeadzone");
    expect(source).not.toMatch(/touches\.TWO\s*=\s*THREE\.TOUCH\.PAN/);
  });
});

describe("dolly range", () => {
  it("stays within a 3× span at both levels", () => {
    expect(WORLD_DISTANCE_MAX / WORLD_DISTANCE_MIN).toBeLessThanOrEqual(3);
    expect(COURSE_DISTANCE_MAX / COURSE_DISTANCE_MIN).toBeLessThanOrEqual(3);
  });
});

describe("course composition", () => {
  it("pins an elevated diorama landing that still clears picking bounds", () => {
    const polarDeg = THREE.MathUtils.radToDeg(COURSE_POLAR);
    expect(polarDeg).toBeGreaterThanOrEqual(50);
    expect(polarDeg).toBeLessThanOrEqual(55);
    expect(COURSE_DISTANCE).toBeGreaterThanOrEqual(34);
    expect(COURSE_DISTANCE).toBeLessThanOrEqual(38);
    expect(COURSE_DISTANCE).toBe(36);
    expect(COURSE_POLAR).toBeCloseTo(THREE.MathUtils.degToRad(52));
    // Close inspect still sits above the island peak; far is 3× so landform
    // can be read without a second overview camera. Hex-era 18/23/54 described
    // a near-horizon shot that hid the continuous route behind a foreground hill.
    expect(COURSE_DISTANCE_MIN).toBe(24);
    expect(COURSE_DISTANCE_MAX).toBe(72);
    expect(COURSE_DISTANCE_MAX / COURSE_DISTANCE_MIN).toBeLessThanOrEqual(3);
  });
});

/*
  The invariant that replaced "a sea is bigger than a road".

  That one asserted WORLD_DISTANCE_MIN >= COURSE_DISTANCE_MAX, and it was true
  while a course was a chain of small islands in the air. It is false now and
  should be: a course is one island tens of units across, and the things on the
  world map are course-sized islands a few units across. The bigger subject is
  the one you stand further back from, so the ordering flipped.

  What has to hold at both levels is the thing the old assertion was reaching
  for — the camera stays above the ground it is looking at, at every distance
  the controls allow.
*/
describe("the eye stays above the ground", () => {
  it("clears the largest island on the world map", () => {
    const clearance = WORLD_DISTANCE_MIN * Math.cos(WORLD_POLAR);
    expect(clearance).toBeGreaterThan(radiusForLessons(41));
  });

  it("clears the course island, including the longest course", () => {
    for (const lessons of [1, 12, 41]) {
      const scale = courseIslandScale(lessons);
      const blueprint = islandBlueprint({
        studyId: "course",
        courseId: "course",
        lessonCount: lessons,
      });
      const peak = sampleIslandSurface(blueprint, 0, 0).y * scale.y;
      expect(COURSE_DISTANCE_MIN * Math.cos(COURSE_POLAR)).toBeGreaterThan(peak);
    }
  });
});

/*
  Entering a course is still a closer shot than the world map, but it is no
  longer a shallower horizon tilt. Hex-era 66° was 12° below WORLD_POLAR and
  that is what hid the continuous road. The diorama polar sits near the world
  tilt; distance is what makes the course feel like arriving on one island.
*/
describe("course entry composition", () => {
  it("keeps the course closer than the world overview without restoring the hex horizon tilt", () => {
    expect(COURSE_DISTANCE).toBeLessThan(WORLD_DISTANCE_MIN);
    expect(COURSE_POLAR).toBeLessThan(THREE.MathUtils.degToRad(60));
    expect(COURSE_POLAR).toBeGreaterThan(THREE.MathUtils.degToRad(45));
  });
});
