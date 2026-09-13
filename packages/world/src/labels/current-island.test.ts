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

describe("current island in a narrow portrait view", () => {
  for (const sideChrome of [false, true]) {
    it(`can use the third nearby caption row${sideChrome ? " with a small side nudge" : ""}`, () => {
      const current = {
        id: "current",
        x: 187.5,
        y: 300,
        z: 0.5,
        width: 220,
        height: 48,
        anchor: "island" as const,
        weight: 4,
      };
      const blocked = [
        { left: 0, right: 375, top: 0, bottom: 455 },
        ...(sideChrome ? [{ left: 280, right: 375, top: 450, bottom: 550 }] : []),
      ];
      const viewport = { width: 375, height: 679 };
      const result = placeLabels([current], viewport, { reserved: blocked })[0]!;
      expect(result.visible).toBe(true);
      expect(Math.abs(result.x - current.x)).toBeLessThanOrEqual(32);
      expect(result.y).toBeLessThanOrEqual(current.y + current.height / 2 + 4 + 3 * 52);
      const box = labelBox(result, current.width, current.height, "island");
      expect(blocked.some((other) => boxesOverlap(box, other, 4))).toBe(false);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(viewport.width);
      expect(box.bottom).toBeLessThanOrEqual(viewport.height);
      expect(islandCaptionLeader(current, result, current.width, current.height)).not.toBeNull();
      expect(
        placeLabels([{ ...current, weight: 1 }], viewport, { reserved: blocked })[0]!.visible,
      ).toBe(false);
    });
  }
});
