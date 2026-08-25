import { describe, expect, it } from "vitest";

import {
  COURSE_DISTANCE_MAX,
  COURSE_DISTANCE_MIN,
  COURSE_POLAR,
  WORLD_DISTANCE_MAX,
  WORLD_DISTANCE_MIN,
  WORLD_POLAR,
} from "./controls";
import { courseIslandScale } from "../Maps";
import { islandBlueprint, islandSurfaceY } from "../island/island-blueprint.js";
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
      const blueprint = islandBlueprint("course", "course", lessons);
      const peak = islandSurfaceY(blueprint, 0, 0) * scale.y;
      expect(COURSE_DISTANCE_MIN * Math.cos(COURSE_POLAR)).toBeGreaterThan(peak);
    }
  });
});

/*
  Entering a course has to read as flying closer to the same world, not as
  cutting to a different one. Two degrees of tilt apart is close enough that
  the transition is a move; the 20° gap the two levels used to have read as a
  cut, and was tuned for a road going away from the eye that no longer exists.
*/
describe("the two levels look like one world", () => {
  it("keeps the tilts within a few degrees of each other", () => {
    const degrees = Math.abs(COURSE_POLAR - WORLD_POLAR) * (180 / Math.PI);
    expect(degrees).toBeLessThan(6);
  });
});
