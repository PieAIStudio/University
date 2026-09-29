import { describe, expect, it } from "vitest";
import { CLOSE_UP_DISTANCE, introductoryCameraReach } from "./CloseUpCamera.js";

describe("first-meeting perspective fit", () => {
  it("keeps the full pair inside the 320px phone's horizontal field, not merely its midpoint", () => {
    for (const aspect of [320 / 740, 390 / 844, 1440 / 900]) {
      for (const separation of [0, 1, 3, 6]) {
        const reach = introductoryCameraReach(separation, 38, aspect);
        const widthAtNearestSubject =
          (reach - separation / 2) * Math.tan((38 * Math.PI) / 360) * Math.min(1, aspect) * 0.8;
        expect(widthAtNearestSubject).toBeGreaterThanOrEqual(separation / 2 + 1.6 - 1e-8);
        expect(reach).toBeGreaterThanOrEqual(CLOSE_UP_DISTANCE);
      }
    }
  });
  it("steps back on a narrow viewport without changing the subject separation or field of view", () => {
    expect(introductoryCameraReach(3, 38, 320 / 740)).toBeGreaterThan(
      introductoryCameraReach(3, 38, 1440 / 900),
    );
    expect(introductoryCameraReach(1, 50, 2)).toBe(CLOSE_UP_DISTANCE);
  });
});
