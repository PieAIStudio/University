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

  it("keeps the shared default dome without a study and shifts a named study", () => {
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

  it("keeps the course sky cold, with the rim lighter than the air below it", () => {
    // Was: `nadir === 0xc0b8e5`, pinning the warm-lavender lower arc of the
    // illustrated sunset. That sky was replaced on 2026-09-02 because it read
    // brighter than the ground and in the same hue family, so the island had
    // no silhouette; pinning one hex of it would only pin the failure.
    //
    // What is actually load-bearing is the relation, so that is what is
    // asserted. The course camera is pitched down and renders the dome's lower
    // branch (see `skydome.tsx`), where `horizon` is the top of the visible sky
    // and `nadir` the bottom. Both must stay blue — no warm rim — and the rim
    // must stay lighter than the air beneath the island, which is the gradient
    // the frame is built on.
    const rim = rgb(COURSE_SKY_STOPS.horizon);
    const below = rgb(COURSE_SKY_STOPS.nadir ?? COURSE_SKY_STOPS.horizon);
    expect(rim.b).toBeGreaterThan(rim.r + 40);
    expect(below.b).toBeGreaterThan(below.r + 40);
    expect(luma(COURSE_SKY_STOPS.horizon)).toBeGreaterThan(
      luma(COURSE_SKY_STOPS.nadir ?? COURSE_SKY_STOPS.horizon),
    );
    // And the mid stop sits between them, so the same four stops are still a
    // correct top-to-bottom sky in the upper branch the planet page draws.
    expect(luma(COURSE_SKY_STOPS.horizon)).toBeGreaterThan(luma(COURSE_SKY_STOPS.mid));
    expect(luma(COURSE_SKY_STOPS.mid)).toBeGreaterThan(luma(COURSE_SKY_STOPS.zenith));
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
