import { describe, expect, it } from "vitest";

import { SKY_STOPS } from "./Maps";

function luma(hex: number) {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function rgb(hex: number) {
  return {
    r: (hex >> 16) & 255,
    g: (hex >> 8) & 255,
    b: hex & 255,
  };
}

describe("sky stops", () => {
  it("has three luminance steps, darker at the zenith", () => {
    const zenith = luma(SKY_STOPS.zenith);
    const mid = luma(SKY_STOPS.mid);
    const horizon = luma(SKY_STOPS.horizon);
    expect(mid - zenith).toBeGreaterThan(0.08);
    expect(horizon - mid).toBeGreaterThan(0.04);
  });

  it("is saturated blue at the top and warm at the rim", () => {
    const zenith = rgb(SKY_STOPS.zenith);
    const horizon = rgb(SKY_STOPS.horizon);
    expect(zenith.b).toBeGreaterThan(zenith.r + 40);
    expect(horizon.r).toBeGreaterThan(horizon.b);
    expect(horizon.r).toBeGreaterThan(horizon.g);
  });
});
