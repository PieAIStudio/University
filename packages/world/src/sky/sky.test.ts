import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { COURSE_SKY_STOPS, SKY_STOPS, skyStopsForStudy, WORLD_SKY_CONTRACT } from "../Maps";
import { WORLD_SUN } from "./sun.js";

function luma(hex: number) {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function rgb(hex: number) {
  return {
    r: (hex >> 16) & 255,
    g: (hex >> 8) & 255,
    b: hex & 255,
  };
}

describe("sky stops", () => {
  it("has three luminance steps, darker at the zenith", () => {
    const zenith = luma(SKY_STOPS.zenith);
    const mid = luma(SKY_STOPS.mid);
    const horizon = luma(SKY_STOPS.horizon);
    expect(mid - zenith).toBeGreaterThan(0.08);
    expect(horizon - mid).toBeGreaterThan(0.04);
  });

  it("is saturated blue at the top and warm at the rim", () => {
    const zenith = rgb(SKY_STOPS.zenith);
    const horizon = rgb(SKY_STOPS.horizon);
    expect(zenith.b).toBeGreaterThan(zenith.r + 40);
    expect(horizon.r).toBeGreaterThan(horizon.b);
    expect(horizon.r).toBeGreaterThan(horizon.g);
  });

  it("keeps the default dome for the four-seas overview and shifts a named study", () => {
    const unset = skyStopsForStudy(null);
    expect(unset.zenith).toBe(SKY_STOPS.zenith);
    const turing = skyStopsForStudy("turing-pact");
    const buzz = skyStopsForStudy("buzz");
    expect(turing.zenith).not.toBe(SKY_STOPS.zenith);
    expect(turing.zenith).not.toBe(buzz.zenith);
    expect(luma(turing.mid) - luma(turing.zenith)).toBeGreaterThan(0.05);
  });

  it("uses blue lower air and no continuous sea for the world projection", () => {
    expect(WORLD_SKY_CONTRACT.visibleSea).toBe(false);
    expect(WORLD_SKY_CONTRACT.horizon).toBeGreaterThan(0x9fbfcc);
    expect(WORLD_SKY_CONTRACT.nadir).not.toBe(0x3a7f92);
    expect(WORLD_SKY_CONTRACT.fogFarRatio).toBeGreaterThan(WORLD_SKY_CONTRACT.fogNearRatio);
    const source = readFileSync(new URL("../Maps.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/includeSea=\{WORLD_SKY_CONTRACT\.visibleSea\}/);
  });

  it("keeps the course lower arc airy instead of deep violet", () => {
    expect(COURSE_SKY_STOPS.nadir).toBe(0xc0b8e5);
  });

  it("draws a sun disc on the one skydome, keyed to the shared world sun", () => {
    const source = readFileSync(new URL("./skydome.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/uSunDirection/);
    expect(source).toMatch(/uSunGlowColor/);
    expect(source).not.toMatch(/uIsNight|uMoonPosition|uStarDensity/);
    expect(WORLD_SUN.keyIntensity).toBeGreaterThan(
      WORLD_SUN.hemisphereIntensity + WORLD_SUN.ambientIntensity,
    );
  });
});
