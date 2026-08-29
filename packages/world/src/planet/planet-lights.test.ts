import { describe, expect, it } from "vitest";

import { PLANET_LIGHTS } from "./PlanetScene.js";

describe("planet lighting contract", () => {
  it("keeps the key light between two and four times the total fill", () => {
    const fill =
      PLANET_LIGHTS.hemisphereIntensity +
      PLANET_LIGHTS.ambientIntensity +
      PLANET_LIGHTS.frontalFillIntensity +
      PLANET_LIGHTS.nightRimIntensity;
    const ratio = PLANET_LIGHTS.keyIntensity / fill;

    expect(ratio).toBeGreaterThanOrEqual(2);
    expect(ratio).toBeLessThanOrEqual(4);
  });

  it("keeps the lower hemisphere bounce chromatic and blue-led", () => {
    const red = (PLANET_LIGHTS.hemisphereGround >> 16) & 255;
    const green = (PLANET_LIGHTS.hemisphereGround >> 8) & 255;
    const blue = PLANET_LIGHTS.hemisphereGround & 255;

    expect(blue).toBeGreaterThan(green);
    expect(green).toBeGreaterThan(red);
  });
});
