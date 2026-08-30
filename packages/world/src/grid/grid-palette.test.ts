import { describe, expect, it } from "vitest";
import {
  GRID_PALETTE_PRESETS,
  GRID_SHARED_SOIL,
  gridPaletteFor,
  gridPaletteIndexFor,
} from "./grid-palette.js";

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
      expect(preset.accent).toBe(GRID_SHARED_SOIL.accent);
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
