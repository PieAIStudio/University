import { describe, expect, it } from "vitest";
import { CATALOGUE_SUN, GARDEN_SUN, mapSunStyle, WORLD_SUN, worldSunDirection } from "./sun.js";
import { createSkyDomeUniforms } from "./skydome.js";
import { skyEnvironmentKey } from "./environment.js";

describe("R46 course garden light ownership", () => {
  it("uses one garden profile for direct sun and the visible/environment sky", () => {
    const stops = {
      zenith: 0x1c5aa8,
      mid: 0x3d86c9,
      horizon: 0x7fb8e0,
      sunProfile: "garden" as const,
    };
    expect(createSkyDomeUniforms(stops).uSunDirection.value.toArray()).toEqual(
      worldSunDirection("garden"),
    );
    expect(skyEnvironmentKey(stops)).toContain(":garden");
    expect(skyEnvironmentKey(stops)).not.toBe(
      skyEnvironmentKey({ ...stops, sunProfile: "course" }),
    );
    expect(mapSunStyle("garden")).toBe(GARDEN_SUN);
    expect(mapSunStyle("catalogue")).toBe(CATALOGUE_SUN);
    expect(mapSunStyle()).toBe(WORLD_SUN);
    expect(WORLD_SUN.azimuthDeg).toBe(210);
    expect(WORLD_SUN.keyIntensity).toBe(5.4);
    expect(CATALOGUE_SUN.keyIntensity).toBe(3.4);
    expect(GARDEN_SUN.elevationDeg).toBe(40);
    expect(Math.hypot(...worldSunDirection("garden"))).toBeCloseTo(1, 10);
  });
});
