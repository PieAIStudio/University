import { srgbToDisplayLinear } from "@pieai/swimmer-render-kit";
import { describe, expect, it } from "vitest";

import { WORLD_GRADE, WORLD_GRADE_PIVOT_SRGB8 } from "./grade.js";

describe("world grade", () => {
  it("expands around a measured ungraded midtone, not an inherited pivot", () => {
    expect(WORLD_GRADE.contrastPivot).toBeCloseTo(srgbToDisplayLinear(WORLD_GRADE_PIVOT_SRGB8), 6);
    expect(WORLD_GRADE.contrast).toBeCloseTo(1.06, 2);
    expect(WORLD_GRADE.contrast).toBeGreaterThanOrEqual(1.04);
    expect(WORLD_GRADE.contrast).toBeLessThanOrEqual(1.08);
    expect(WORLD_GRADE.vignette.edgeGain).toBeGreaterThan(0.9);
  });

  it("keeps the warm soil channels above the post-grade crush point", () => {
    expect(WORLD_GRADE_PIVOT_SRGB8).toBeLessThan(100);
    expect(WORLD_GRADE.warmHighlight.amount).toBeLessThan(0.2);

    // The contrast affine operator `(col - pivot) * contrast + pivot` has a theoretical
    // clip floor at `pivot * (1 - 1 / contrast)`. Below this floor, channels go negative
    // and clamp to zero in the framebuffer, stripping hue from shaded terrain.
    // At contrast 1.17, the floor was ~0.00942 (sRGB ~24.5/255), causing shaded foliage/soil
    // red & blue channels to clip to zero. At contrast 1.06, the floor drops to ~0.00367,
    // safely below dark shadow channels (sRGB 16 = ~0.00516 display-linear), so shaded
    // surfaces keep chromatic hue rather than crushing to monochrome.
    const clipFloor = WORLD_GRADE.contrastPivot * (1 - 1 / WORLD_GRADE.contrast);
    expect(clipFloor).toBeGreaterThan(0);
    expect(clipFloor).toBeLessThan(srgbToDisplayLinear(16));

    const shadowSampleLinear = srgbToDisplayLinear(16);
    const gradedSample =
      (shadowSampleLinear - WORLD_GRADE.contrastPivot) * WORLD_GRADE.contrast +
      WORLD_GRADE.contrastPivot;
    expect(gradedSample).toBeGreaterThan(0);
  });

  it("keeps tilt-shift and grain off so labels stay readable", () => {
    expect(WORLD_GRADE.tiltShift).toBe(false);
    expect(WORLD_GRADE.grain).toBe(0);
  });
});
