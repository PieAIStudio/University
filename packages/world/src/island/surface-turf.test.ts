import { describe, expect, it } from "vitest";
import { surfaceTurfAt } from "./surface-turf.js";

describe("short-turf material tile", () => {
  it("wraps exactly in both directions, including negative coordinates", () => {
    for (let i = 0; i < 100; i++) {
      const t = i / 100;
      expect(surfaceTurfAt(0, t)).toBeCloseTo(surfaceTurfAt(1, t), 10);
      expect(surfaceTurfAt(t, 0)).toBeCloseTo(surfaceTurfAt(t, 1), 10);
      expect(surfaceTurfAt(-0.21, t)).toBeCloseTo(surfaceTurfAt(0.79, t), 10);
    }
  });
  it("is a finite, nonuniform material swatch independent of course and camera", () => {
    let low = 0,
      high = 0;
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const h = surfaceTurfAt((x + 0.5) / 64, (y + 0.5) / 64);
        expect(Number.isFinite(h)).toBe(true);
        expect(h).toBeGreaterThanOrEqual(0.12);
        expect(h).toBeLessThanOrEqual(0.88);
        if (h < 0.13) low++;
        if (h > 0.25) high++;
      }
    expect(low).toBeGreaterThan(2000);
    expect(high).toBeGreaterThan(200);
  });
});
