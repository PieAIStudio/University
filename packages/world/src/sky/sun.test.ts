import { describe, expect, it } from "vitest";

import { WORLD_ENVIRONMENT } from "./environment.js";
import {
  WORLD_SUN,
  worldKeyToFillRatio,
  worldShadowFrustum,
  worldSunDirection,
  worldSunPosition,
  worldTotalFill,
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
    // Was 2–4 over hemisphere + ambient + environment. Two things were wrong
    // with that, and only one of them is that the band moved.
    //
    // 1. The denominator was not the scene's fill. The back rim is a fourth
    //    fill light, and it lived as a literal in `lighting.tsx` where this
    //    test could not see it — at 0.78 it was the largest single fill term
    //    in the rig while this assertion reported the scene as 2.08:1. It is
    //    in `WORLD_SUN` now, and `worldTotalFill` is the whole denominator.
    // 2. 2–4 is the overcast band, and it was left deliberately on 2026-09-02.
    //    The reference look is direct sun: a warm key against a cool, much
    //    smaller fill. On the complete accounting the scene moved from
    //    5.4/2.15 = 2.5:1 to 5.4/0.97 = 5.6:1.
    //
    // The ceiling is the part that still guards something. Fill is what keeps
    // colour in the shadows, and cutting it far enough turns low-poly faces
    // into one black shape — the failure `sun.ts` records. 7 is the measured
    // stop: at the chosen values `measureScene()` on course-design reads
    // scene-linear p05 0.047, comfortably unclipped, and the margin to 7 is
    // roughly the room that reading leaves.
    const ratio = WORLD_SUN.keyIntensity / worldTotalFill(WORLD_ENVIRONMENT.intensity);
    expect(ratio).toBeGreaterThanOrEqual(4);
    expect(ratio).toBeLessThanOrEqual(7);
  });

  it("counts the rim as fill and keeps it small next to the key", () => {
    // The rim's job is silhouette separation. When the other fills were halved
    // and the rim was not, it silently became the scene's ambient and painted
    // the ivory lesson plinths teal. Its share of total fill is the guard.
    const share = WORLD_SUN.rimIntensity / worldTotalFill(WORLD_ENVIRONMENT.intensity);
    expect(share).toBeLessThan(0.45);
    expect(WORLD_SUN.rimIntensity).toBeLessThan(WORLD_SUN.keyIntensity * 0.2);
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
