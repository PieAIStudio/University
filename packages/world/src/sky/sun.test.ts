import { describe, expect, it } from "vitest";

import { WORLD_ENVIRONMENT } from "./environment.js";
import {
  WORLD_SUN,
  worldKeyToFillRatio,
  worldShadowFrustum,
  worldSunDirection,
  worldSunPosition,
} from "./sun.js";

describe("world sun", () => {
  it("keeps elevation inside the measured 16–28° window", () => {
    expect(WORLD_SUN.elevationDeg).toBeGreaterThanOrEqual(16);
    expect(WORLD_SUN.elevationDeg).toBeLessThanOrEqual(28);
  });

  it("keeps key:fill at or above the look-contract floor", () => {
    expect(worldKeyToFillRatio()).toBeGreaterThanOrEqual(3);
  });

  it("keeps total key-to-fill inside the measured stylized range", () => {
    const fill =
      WORLD_SUN.hemisphereIntensity + WORLD_SUN.ambientIntensity + WORLD_ENVIRONMENT.intensity;
    const ratio = WORLD_SUN.keyIntensity / fill;
    expect(ratio).toBeGreaterThanOrEqual(2);
    expect(ratio).toBeLessThanOrEqual(4);
  });

  it("uses a chromatic warm lower bounce instead of neutral gray", () => {
    const red = (WORLD_SUN.hemisphereGround >> 16) & 255;
    const green = (WORLD_SUN.hemisphereGround >> 8) & 255;
    const blue = WORLD_SUN.hemisphereGround & 255;
    expect(red).toBeGreaterThan(green);
    expect(green).toBeGreaterThan(blue);
  });

  it("places the light on a unit direction whose elevation matches the contract", () => {
    const [x, y, z] = worldSunDirection();
    const length = Math.hypot(x, y, z);
    expect(length).toBeCloseTo(1, 5);
    const elevation = (Math.atan2(y, Math.hypot(x, z)) * 180) / Math.PI;
    expect(elevation).toBeCloseTo(WORLD_SUN.elevationDeg, 5);
  });

  it("scales position by distance without changing direction", () => {
    const [x, y, z] = worldSunDirection();
    expect(worldSunPosition(40)).toEqual([x * 40, y * 40, z * 40]);
  });

  it("fits the shadow frustum to the island, not a fraction of the weather sphere", () => {
    const course = worldShadowFrustum(35);
    expect(course.half).toBeGreaterThan(35);
    expect(course.half).toBeLessThan(35 * 1.3);
    expect(course.far).toBeGreaterThan(course.lightDistance);
    expect(course.near).toBeLessThan(course.lightDistance);
    expect(course.mapSize).toBe(2048);
  });
});
