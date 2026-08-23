import { describe, expect, it } from "vitest";

import {
  COURSE_DISTANCE_MAX,
  WORLD_DISTANCE_MAX,
  WORLD_DISTANCE_MIN,
  WORLD_POLAR,
} from "./controls";
import { radiusForLessons } from "./layout";

describe("world-map dolly range", () => {
  it("stays within a 3× span, sea-in-frame to four-seas-in-frame", () => {
    expect(WORLD_DISTANCE_MAX / WORLD_DISTANCE_MIN).toBeLessThanOrEqual(3);
  });

  it("never sits closer than a course-path shot — a sea is bigger than a road", () => {
    expect(WORLD_DISTANCE_MIN).toBeGreaterThanOrEqual(COURSE_DISTANCE_MAX);
  });

  it("keeps the eye above the largest island when dolly is at min", () => {
    const groundClearance = WORLD_DISTANCE_MIN * Math.cos(WORLD_POLAR);
    expect(groundClearance).toBeGreaterThan(radiusForLessons(41));
  });
});
