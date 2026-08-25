import { describe, expect, it } from "vitest";

import { cloudPuffs } from "./cloud-layout.js";

describe("cloud sea", () => {
  it("is deterministic and has a smaller mobile population", () => {
    expect(cloudPuffs(40, false, -5.2)).toEqual(cloudPuffs(40, false, -5.2));
    expect(cloudPuffs(40, true, -5.2)).toHaveLength(18);
    expect(cloudPuffs(40, false, -5.2)).toHaveLength(64);
  });

  it("stays below the visible shoreline in both map levels", () => {
    for (const [extent, mobile, level] of [
      [40, false, -5.2],
      [40, true, -5.2],
      [80, false, -10.2],
    ] as const) {
      for (const puff of cloudPuffs(extent, mobile, level)) {
        const highestPoint = puff.position[1] + puff.scale * 0.28;
        expect(highestPoint).toBeLessThan(0);
      }
    }
  });
});
