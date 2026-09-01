import { srgbToDisplayLinear } from "@pieai/swimmer-render-kit";
import { describe, expect, it } from "vitest";

import { WORLD_GRADE, WORLD_GRADE_PIVOT_SRGB8 } from "./grade.js";

describe("world grade", () => {
  it("expands around a measured ungraded midtone, not an inherited pivot", () => {
    expect(WORLD_GRADE.contrastPivot).toBeCloseTo(srgbToDisplayLinear(WORLD_GRADE_PIVOT_SRGB8), 6);
    expect(WORLD_GRADE.contrast).toBeGreaterThan(1.15);
    expect(WORLD_GRADE.vignette.edgeGain).toBeGreaterThan(0.9);
  });

  it("keeps the warm soil channels above the post-grade crush point", () => {
    expect(WORLD_GRADE_PIVOT_SRGB8).toBeLessThan(100);
    expect(WORLD_GRADE.warmHighlight.amount).toBeLessThan(0.2);
  });

  it("keeps tilt-shift and grain off so labels stay readable", () => {
    expect(WORLD_GRADE.tiltShift).toBe(false);
    expect(WORLD_GRADE.grain).toBe(0);
  });
});
