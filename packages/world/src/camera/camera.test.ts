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
describe("dolly range", () => {
  it("stays within a 3× span at both levels", () => {
    expect(WORLD_DISTANCE_MAX / WORLD_DISTANCE_MIN).toBeLessThanOrEqual(3);
    expect(COURSE_DISTANCE_MAX / COURSE_DISTANCE_MIN).toBeLessThanOrEqual(3);
  });
});

describe("course composition", () => {
  it("pins the selected low and near landing pose", () => {
    expect(COURSE_POLAR).toBeCloseTo(THREE.MathUtils.degToRad(66));
    expect(COURSE_DISTANCE).toBe(23);
    expect(COURSE_DISTANCE_MIN).toBe(18);
    // The far end still lets a learner pull back and inspect more levels after
    // entering the close view, without restoring the old island-wide shot.
    expect(COURSE_DISTANCE_MAX).toBe(54);
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
  The course is intentionally a different composition from the world map:
  entering it is the product's promised move onto an island. The lower course
  tilt was selected from a fixed-seed contact sheet because it reveals a sky
  band and keeps the next lesson markers in front of the learner.
*/
describe("course entry composition", () => {
  it("keeps the course materially lower than the world overview", () => {
    const degrees = Math.abs(COURSE_POLAR - WORLD_POLAR) * (180 / Math.PI);
    expect(degrees).toBeGreaterThanOrEqual(10);
    expect(degrees).toBeLessThanOrEqual(16);
  });
});
