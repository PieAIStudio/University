import { describe, expect, it } from "vitest";
import { bakeMiniatureShadows } from "./miniature-shadow.js";
import { miniatureMetrics, type MiniatureProp } from "./miniature-layout.js";

function prop(asset: MiniatureProp["asset"], turn = 0): MiniatureProp {
  const metrics = miniatureMetrics(asset);
  return {
    asset,
    role: asset === "fir" ? "tree" : "landmark",
    x: 0,
    y: 0,
    z: 0,
    size: 0.6,
    turn,
    radius: metrics.radius * 0.6,
    supportRadius: metrics.supportRadius * 0.6,
    groundRange: [0, 0],
  };
}
const size = 96,
  padding = 6;
const flat = (height = 0) => new Float32Array(size * size).fill(height);

describe("static miniature caster silhouettes", () => {
  it("casts away from the actual sun and preserves soft, bounded coverage", () => {
    const shadow = bakeMiniatureShadows([prop("fir")], flat(), size, padding, [1, 1, 0]);
    expect(shadow).toEqual(bakeMiniatureShadows([prop("fir")], flat(), size, padding, [1, 1, 0]));
    let mass = 0,
      weightedX = 0,
      penumbra = 0;
    for (let z = 0; z < size; z++)
      for (let x = 0; x < size; x++) {
        const value = shadow[z * size + x]!;
        if (!(Number.isFinite(value) && value >= 0 && value <= 1))
          throw new Error("Invalid coverage");
        mass += value;
        weightedX += value * (((x - padding) / (size - 2 * padding - 1)) * 2 - 1);
        if (value > 0.01 && value < 0.99) penumbra++;
      }
    expect(mass).toBeGreaterThan(70);
    expect(weightedX / mass).toBeLessThan(-0.1);
    expect(penumbra).toBeGreaterThan(30);
  });

  it("uses the orientation of a real fence instead of the same radial blob", () => {
    const first = bakeMiniatureShadows([prop("fence")], flat(), size, padding, [0, 1, 0]);
    const turned = bakeMiniatureShadows(
      [prop("fence", Math.PI / 2)],
      flat(),
      size,
      padding,
      [0, 1, 0],
    );
    expect(first.some((value, index) => Math.abs(value - turned[index]!) > 0.1)).toBe(true);
    const coverage = (mask: Float32Array) => mask.reduce((sum, value) => sum + value, 0);
    expect(Math.abs(coverage(first) - coverage(turned))).toBeLessThan(1);
  });

  it("cannot shadow a receiver above every caster, or invent shadows with no props", () => {
    expect(
      bakeMiniatureShadows([prop("fir")], flat(1), size, padding, [1, 1, 0]).every((v) => v === 0),
    ).toBe(true);
    expect(bakeMiniatureShadows([], flat(), size, padding, [1, 1, 0]).every((v) => v === 0)).toBe(
      true,
    );
    expect(
      bakeMiniatureShadows([prop("fir")], flat(NaN), size, padding, [1, 1, 0]).every(
        (v) => v === 0,
      ),
    ).toBe(true);
  });

  it("rejects an invalid raster or horizon sun rather than baking NaNs", () => {
    expect(() => bakeMiniatureShadows([], flat(), size, padding, [0, 0, 1])).toThrow(RangeError);
    expect(() => bakeMiniatureShadows([], new Float32Array(1), size, padding, [0, 1, 0])).toThrow(
      RangeError,
    );
  });
});
