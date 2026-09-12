import { describe, expect, it } from "vitest";
import { islandCaptionLeader } from "./labels.js";

describe("island caption ownership", () => {
  it("leaves ordinary root captions alone", () => {
    expect(islandCaptionLeader({ x: 200, y: 300 }, { x: 200, y: 315 }, 180, 22)).toBeNull();
    expect(islandCaptionLeader({ x: NaN, y: 300 }, { x: 200, y: 315 }, 180, 22)).toBeNull();
  });
  it("starts outside the measured label and ends next to its original anchor", () => {
    for (const anchor of [
      { x: 200, y: 200 },
      { x: 80, y: 220 },
      { x: 320, y: 230 },
    ]) {
      const placed = { x: 200, y: 270 };
      const line = islandCaptionLeader(anchor, placed, 180, 22)!;
      expect(line).not.toBeNull();
      expect(Math.abs(line.x) > 90 || Math.abs(line.y) > 11).toBe(true);
      const end = {
        x: placed.x + line.x + Math.cos(line.angle) * line.length,
        y: placed.y + line.y + Math.sin(line.angle) * line.length,
      };
      expect(Math.hypot(end.x - anchor.x, end.y - anchor.y)).toBeCloseTo(2, 7);
    }
  });
});
