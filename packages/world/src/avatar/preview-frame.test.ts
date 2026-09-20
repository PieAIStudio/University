import { describe, expect, it } from "vitest";
import { previewFrame } from "./preview-frame.js";
describe("full avatar material-preview framing", () => {
  it("contains small, wide and tall recipes in portrait and landscape", () => {
    for (const [w, h, minY] of [
      [1.1, 1.43, 0],
      [0.6, 0.4, -0.2],
      [3, 1, 0],
      [1, 4, -1],
    ]) {
      for (const aspect of [0.5, 1, 1.5, 2]) {
        const bounds = { w: w!, h: h!, minY: minY!, maxY: minY! + h!, cy: minY! + h! / 2 };
        const frame = previewFrame(bounds, 30, aspect);
        expect(frame.centreY).toBeCloseTo(bounds.cy);
        const available =
          frame.distance *
          Math.sin(Math.min(Math.PI / 12, Math.atan(Math.tan(Math.PI / 12) * aspect)));
        expect(available).toBeGreaterThan(Math.max(w!, h!) / 2);
        expect(frame.distance).toBeGreaterThan(frame.minDistance);
      }
    }
  });
  it("rejects invalid inputs rather than hiding the avatar at infinity", () => {
    const bounds = { w: 1, h: 1, minY: 0, maxY: 1, cy: 0.5 };
    expect(() => previewFrame(bounds, 30, 0)).toThrow(RangeError);
    expect(() => previewFrame({ ...bounds, h: NaN }, 30, 1)).toThrow(RangeError);
  });
});
