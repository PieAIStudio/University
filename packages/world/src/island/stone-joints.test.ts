import { describe, expect, it } from "vitest";
import { cliffPanelSpans, stoneJointAt } from "./stone-joints.js";

describe("shared natural stone segmentation", () => {
  it("covers every contour interval exactly once without equal-width column repetition", () => {
    const widths = new Set<number>();
    for (const seed of ["first", "grove", "bay", "stress"]) {
      for (const band of [1, 2, 3]) {
        for (const segments of [32, 96]) {
          const spans = cliffPanelSpans(seed, segments, band);
          expect(spans).toHaveLength(16);
          expect(spans).toEqual(cliffPanelSpans(seed, segments, band));
          const coverage = Array<number>(segments).fill(0);
          for (const span of spans) {
            expect(span.character).toBeGreaterThanOrEqual(0);
            expect(span.character).toBeLessThan(1);
            for (let i = 0; i < span.width; i++) coverage[(span.start + i) % segments]!++;
            widths.add((span.width * 32) / segments);
          }
          expect(coverage.every((n) => n === 1)).toBe(true);
        }
        const far = cliffPanelSpans(seed, 32, band);
        const near = cliffPanelSpans(seed, 96, band);
        expect(near.map((s) => ({ ...s, start: s.start / 3, width: s.width / 3 }))).toEqual(far);
      }
    }
    expect([...widths].sort()).toEqual([1, 2, 3]);
  });

  it("keeps structural joints continuous at the closed contour seam", () => {
    for (const band of [1, 2, 3, 4]) {
      const a = stoneJointAt("closed", 0, band);
      const b = stoneJointAt("closed", Math.PI * 2, band);
      expect(a).toEqual(b);
    }
  });

  it("rejects unsupported segment counts instead of leaving unowned intervals", () => {
    for (const count of [0, 16, 33, NaN, Infinity])
      expect(() => cliffPanelSpans("bad", count, 1)).toThrow(RangeError);
  });
});
