import { describe, expect, it } from "vitest";
import {
  CATALOGUE_SUN,
  WORLD_SUN,
  mapSunStyle,
  worldSunDirection,
  worldSunPosition,
} from "./sun.js";
import { createSkyDomeUniforms, type SkyDomeStops } from "./skydome.js";
import { skyEnvironmentKey } from "./environment.js";

describe("one consistent catalogue daylight profile", () => {
  it("keeps course defaults and every fill term unchanged", () => {
    expect(mapSunStyle()).toBe(WORLD_SUN);
    expect(worldSunDirection()).toBe(worldSunDirection("course"));
    expect(mapSunStyle("catalogue")).toBe(CATALOGUE_SUN);
    expect(CATALOGUE_SUN).toEqual({
      ...WORLD_SUN,
      elevationDeg: 50,
      azimuthDeg: 315,
      keyIntensity: 3.4,
    });
    expect(WORLD_SUN.azimuthDeg).toBe(210);
    expect(WORLD_SUN.keyIntensity).toBe(5.4);
  });

  it("lights the real camera-facing root without a camera input or another light", () => {
    const direction = worldSunDirection("catalogue");
    expect(Math.hypot(...direction)).toBeCloseTo(1, 12);
    expect(direction[0]).toBeLessThan(-0.3);
    expect(direction[1]).toBeGreaterThan(0.7);
    expect(direction[2]).toBeGreaterThan(0.3);
    expect(worldSunPosition(40, "catalogue")).toEqual(direction.map((v) => v * 40));
    expect(worldSunPosition(NaN, "catalogue")).toEqual(worldSunPosition(40, "catalogue"));
  });

  it("keeps the visible sky and its PMREM uniforms on the direct-light profile", () => {
    const stops: SkyDomeStops = {
      zenith: 0x152d76,
      mid: 0x9ccfec,
      horizon: 0xf3f0ff,
      nadir: 0x4d3e86,
      sunProfile: "catalogue",
    };
    const uniforms = createSkyDomeUniforms(stops);
    expect(uniforms.uSunDirection.value.toArray()).toEqual(worldSunDirection("catalogue"));
    expect(skyEnvironmentKey(stops)).not.toBe(
      skyEnvironmentKey({ ...stops, sunProfile: "course" }),
    );
    expect(skyEnvironmentKey(stops)).not.toBe(skyEnvironmentKey({ ...stops, nadir: 0x123456 }));
    expect(skyEnvironmentKey({ ...stops })).toBe(skyEnvironmentKey(stops));
  });
});
