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

  it("keeps the series regions above the physical globe", () => {
    expect(PLANET_ATMOSPHERE.radius).toBeGreaterThan(0);
    expect(PLANET_ATMOSPHERE.regionAltitude).toBeGreaterThan(1);
  });
});
