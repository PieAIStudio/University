import { describe, expect, it } from "vitest";
import {
  GRID_ACCENT_RAMP,
  GRID_PALETTE_PRESETS,
  GRID_SHARED_SOIL,
  gridPaletteFor,
  gridPaletteIndexFor,
} from "./grid-palette.js";

/** Relative luminance, so contrast can be asserted rather than eyeballed. */
function luminance(colour: number): number {
  const channel = (value: number): number => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((colour >> 16) & 255) +
    0.7152 * channel((colour >> 8) & 255) +
    0.0722 * channel(colour & 255)
  );
}

function contrast(a: number, b: number): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

describe("hand-picked grid palettes", () => {
  it("keeps a finite reviewed set of distinct meadow tops", () => {
    expect(GRID_PALETTE_PRESETS.length).toBeGreaterThanOrEqual(8);
    expect(GRID_PALETTE_PRESETS.length).toBeLessThanOrEqual(12);
    expect(new Set(GRID_PALETTE_PRESETS.map((preset) => preset.top)).size).toBe(
      GRID_PALETTE_PRESETS.length,
    );
    for (const preset of GRID_PALETTE_PRESETS) {
      expect(preset.shadow).toBe(GRID_SHARED_SOIL.shadow);
      expect(preset.cliff).toBe(GRID_SHARED_SOIL.cliff);
      expect(preset.road).toBe(GRID_SHARED_SOIL.road);
    }
  });

  it("spreads the grounds far enough apart to tell 53 courses apart", () => {
    // The world map shows a course as a few dozen pixels of ground and nothing
    // else, so near-identical tops are the same failure `archipelago-identity`
    // died of. Ten shades of one green would pass the distinctness check above
    // and still be unusable, so require real separation in luminance too.
    const tops = GRID_PALETTE_PRESETS.map((preset) => preset.top);
    const lights = tops.map(luminance).sort((a, b) => a - b);
    expect(lights.at(-1)! - lights[0]!).toBeGreaterThan(0.25);
    const channelSpread = (shift: number): number => {
      const values = tops.map((top) => (top >> shift) & 255);
      return Math.max(...values) - Math.min(...values);
    };
    // Not all one hue: red, green and blue must each vary across the table.
    expect(Math.min(channelSpread(16), channelSpread(8), channelSpread(0))).toBeGreaterThan(60);
  });

  it("keeps every lesson marker legible on its own ground", () => {
    // `accent` marks the tile a learner has to click, so its contrast is a
    // usability property. The hue stays fixed and only lightness moves, which
    // is why each accent must come from the one warm ramp.
    const ramp = new Set<number>(Object.values(GRID_ACCENT_RAMP));
    for (const preset of GRID_PALETTE_PRESETS) {
      expect(ramp.has(preset.accent)).toBe(true);
      expect(contrast(preset.accent, preset.top)).toBeGreaterThanOrEqual(1.6);
    }
  });

  it("hashes to one complete preset without synthesising a hue", () => {
    const args = ["turing-pact", "foundations-before-zero", "seed-a"] as const;
    const index = gridPaletteIndexFor(...args);
    const palette = gridPaletteFor(...args);
    const preset = GRID_PALETTE_PRESETS[index]!;
    expect(palette).toEqual({
      top: preset.top,
      shadow: preset.shadow,
      cliff: preset.cliff,
      road: preset.road,
      accent: preset.accent,
    });
    expect(gridPaletteFor(...args)).toEqual(palette);
  });
});
