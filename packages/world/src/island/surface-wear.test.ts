import { describe, expect, it } from "vitest";
import { surfaceWearAt } from "./surface-wear.js";
import { surfaceSwatchData } from "./surface-material-detail.js";

describe("quiet tile-local wear", () => {
  it("has continuous value and slope through both repeating seams", () => {
    const e = 1e-5;
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      expect(surfaceWearAt(t, 0)).toBeCloseTo(surfaceWearAt(t, 1), 12);
      expect(surfaceWearAt(0, t)).toBeCloseTo(surfaceWearAt(1, t), 12);
      const dx0 = (surfaceWearAt(e, t) - surfaceWearAt(-e, t)) / (2 * e);
      const dx1 = (surfaceWearAt(1 + e, t) - surfaceWearAt(1 - e, t)) / (2 * e);
      expect(dx0).toBeCloseTo(dx1, 7);
      expect(surfaceWearAt(t + 3, t - 2)).toBeCloseTo(surfaceWearAt(t, t), 12);
    }
  });
  it("retains bounded low-contrast relief and rejects unbounded texture allocation", () => {
    const data = surfaceSwatchData();
    const relief = Array.from(data).filter((_, i) => i % 4 === 0);
    expect(Math.min(...relief)).toBeGreaterThan(45);
    expect(Math.max(...relief)).toBeLessThan(210);
    expect(Math.max(...relief) - Math.min(...relief)).toBeGreaterThan(50);
    expect(() => surfaceSwatchData(513)).toThrow(RangeError);
  });
});
