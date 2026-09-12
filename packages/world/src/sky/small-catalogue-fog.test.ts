import { expect, it } from "vitest";
import { worldFogRange, WORLD_SKY_CONTRACT } from "../Maps.js";
import { WORLD_HOME_DISTANCE } from "../camera/controls.js";

it("keeps a small catalogue readable at the actual arrival distance while retaining large-field haze", () => {
  for (const extent of [0, 4, 8, 16, 32]) {
    const [, far] = worldFogRange(extent);
    const hazeAtArrival = 1 - Math.exp(-Math.pow((0.82 / far) * WORLD_HOME_DISTANCE, 2));
    expect(hazeAtArrival).toBeLessThan(0.08);
    expect(far).toBeGreaterThanOrEqual(WORLD_HOME_DISTANCE * 3);
  }
  for (const extent of [80, 160, 300])
    expect(worldFogRange(extent)[1]).toBe(extent * WORLD_SKY_CONTRACT.fogFarRatio);
  expect(worldFogRange(Number.NaN)).toEqual([0, WORLD_SKY_CONTRACT.minimumFogFar]);
});
