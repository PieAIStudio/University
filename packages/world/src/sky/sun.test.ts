import { describe, expect, it } from "vitest";

import { WORLD_ENVIRONMENT } from "./environment.js";
import {
  WORLD_SUN,
  worldKeyToFillRatio,
  worldShadowFrustum,
  worldShadowNormalBias,
  worldSunDirection,
  worldSunPosition,
  worldTotalFill,
} from "./sun.js";

describe("world sun", () => {
  it("keeps elevation inside the intentional 38–42° window", () => {
    expect(WORLD_SUN.elevationDeg).toBeGreaterThanOrEqual(38);
    expect(WORLD_SUN.elevationDeg).toBeLessThanOrEqual(42);
  });

  it("keeps key:fill at or above the look-contract floor", () => {
    expect(worldKeyToFillRatio()).toBeGreaterThanOrEqual(3);
  });

  it("maintains intentional fill values and stylized key-to-fill ratio", () => {
    expect(WORLD_SUN.hemisphereIntensity).toBe(0.9);
    expect(WORLD_SUN.ambientIntensity).toBe(0.22);
    expect(WORLD_SUN.rimIntensity).toBe(0.34);

    const totalFill = worldTotalFill(WORLD_ENVIRONMENT.intensity);
    expect(totalFill).toBeCloseTo(1.62, 2);

    // With restored open fill terms (hemisphere 0.90, ambient 0.22, rim 0.34, env 0.16),
    // total key-to-fill ratio sits at ~3.33:1 (5.4 / 1.62), keeping shaded slope irradiance
    // around ~1.28–1.30 to avoid crushing shadow channels below the post-grade contrast floor.
    const ratio = WORLD_SUN.keyIntensity / totalFill;
    expect(ratio).toBeGreaterThanOrEqual(3.0);
    expect(ratio).toBeLessThanOrEqual(4.0);
  });

  it("computes finite, bounded shadow normal bias that scales with half and inversely with map size", () => {
    // Finite and bounded in [0.04, 0.40] across standard and extreme bounds
    const desktopBias = worldShadowNormalBias({ half: 35 }, 2048);
    const mobileBias = worldShadowNormalBias({ half: 35 }, 1024);

    expect(Number.isFinite(desktopBias)).toBe(true);
    expect(Number.isFinite(mobileBias)).toBe(true);
    expect(desktopBias).toBeGreaterThanOrEqual(0.04);
    expect(desktopBias).toBeLessThanOrEqual(0.4);
    expect(mobileBias).toBeGreaterThanOrEqual(0.04);
    expect(mobileBias).toBeLessThanOrEqual(0.4);

    // Clamping limits
    const tinyBias = worldShadowNormalBias({ half: 1 }, 4096);
    expect(tinyBias).toBe(0.04);
    const hugeBias = worldShadowNormalBias({ half: 200 }, 512);
    expect(hugeBias).toBe(0.4);

    // Fallback on non-finite or invalid inputs
    const fallbackBias = worldShadowNormalBias({ half: NaN }, 0);
    expect(Number.isFinite(fallbackBias)).toBe(true);
    expect(fallbackBias).toBeGreaterThanOrEqual(0.04);
    expect(fallbackBias).toBeLessThanOrEqual(0.4);

    // Scales linearly with half (when within unclamped range)
    const biasHalf15 = worldShadowNormalBias({ half: 15 }, 2048);
    const biasHalf30 = worldShadowNormalBias({ half: 30 }, 2048);
    expect(biasHalf30).toBeGreaterThan(biasHalf15);
    expect(biasHalf30).toBeCloseTo(biasHalf15 * 2, 2);

    // Scales inversely with map size (mobile 1024 gets 2x desktop 2048 bias)
    expect(mobileBias).toBeGreaterThan(desktopBias);
    expect(mobileBias).toBeCloseTo(desktopBias * 2, 2);
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
