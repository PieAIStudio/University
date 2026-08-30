import { describe, expect, it } from "vitest";

import { WORLD_SUN } from "../sky/sun.js";
import { PLANET_ATMOSPHERE } from "./PlanetScene.js";

describe("planet shared-world atmosphere contract", () => {
  it("uses the one shared world key and keeps it above the direct light fill", () => {
    const fill = WORLD_SUN.hemisphereIntensity + WORLD_SUN.ambientIntensity;
    const ratio = WORLD_SUN.keyIntensity / fill;

    expect(ratio).toBeGreaterThan(1);
    expect(WORLD_SUN.keyColor).toBe(0xffefd2);
  });

  it("makes distance the separator with a stronger falloff than the catalogue", () => {
    expect(PLANET_ATMOSPHERE.fogFarRatio).toBeLessThan(3.5);
    expect(PLANET_ATMOSPHERE.fogNearRatio).toBeLessThan(0.55);
    expect(PLANET_ATMOSPHERE.selectedLift).toBeGreaterThan(0);
  });
});
