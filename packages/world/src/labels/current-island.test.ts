import { describe, expect, it } from "vitest";
import { placeLabels, labelBox, boxesOverlap, islandCaptionLeader } from "./labels.js";

describe("current island in a shallow landscape view", () => {
  it("finds nearby clear sky without covering scenery or chrome or changing priority", () => {
    const current = {
      id: "current",
      x: 438,
      y: 141,
      z: 0.5,
      width: 220,
      height: 24,
      anchor: "island" as const,
      weight: 4,
    };
    const blocked = [
      { left: 0, right: 92, top: 0, bottom: 230 },
      { left: 104, right: 304, top: 0, bottom: 61 },
      { left: 550, right: 872, top: 0, bottom: 230 },
      { left: 350, right: 470, top: 65, bottom: 214 },
    ];
    const result = placeLabels([current], { width: 872, height: 230 }, { reserved: blocked })[0]!;
    expect(result.visible).toBe(true);
    expect(Math.abs(result.x - current.x)).toBeLessThanOrEqual(current.width);
    const box = labelBox(result, current.width, current.height, "island");
    expect(blocked.some((other) => boxesOverlap(box, other, 4))).toBe(false);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(872);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(230);
    expect(islandCaptionLeader(current, result, current.width, current.height)).not.toBeNull();
    const later = placeLabels(
      [{ ...current, weight: 1 }],
      { width: 872, height: 230 },
      { reserved: blocked },
    )[0]!;
    expect(later.visible).toBe(false);
  });
});
