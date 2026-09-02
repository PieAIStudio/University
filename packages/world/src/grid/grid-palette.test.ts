import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GRID_ACCENT_RAMP,
  GRID_LESSON_MARKER_COLOURS,
  GRID_PALETTE_PRESETS,
  GRID_PROP_FOLIAGE_COLOURS,
  GRID_SHARED_SOIL,
  GRID_TERRAIN_VALUE_RAMP,
  gridPaletteFor,
  gridPaletteIndexFor,
  gridUndersideColorForTop,
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
      expect(preset.rim).toBe(GRID_SHARED_SOIL.rim);
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

  it("keeps every ground readable against the cliff it sits on", () => {
    // Identity lives in the top colour while the cliff, shadow and road are
    // shared, so a top that sits at the cliff's own luminance loses the edge
    // that makes an island read as ground on top of rock. `rust-down` sat at
    // 1.86 here and a three-lesson island rendered as one brown lump; every
    // other preset already cleared 2.5, so this is a floor the table was
    // meeting by accident everywhere except one row.
    //
    // It pulls against the saturation floor and the separation range above:
    // the cheapest way to pass this alone is to lighten every top toward
    // white, which those two tests reject.
    for (const preset of GRID_PALETTE_PRESETS) {
      expect(contrast(preset.top, GRID_SHARED_SOIL.cliff)).toBeGreaterThan(2.2);
    }
  });

  it("keeps every ground saturated enough to look alive", () => {
    // The earth gamut is a hue constraint, not a licence to desaturate. A first
    // pass at it left four tops between 0.24 and 0.31 and the island rendered
    // as dry khaki. Hue and lightness carry identity; saturation carries
    // whether the ground reads as a place rather than dust.
    for (const preset of GRID_PALETTE_PRESETS) {
      const r = ((preset.top >> 16) & 255) / 255;
      const g = ((preset.top >> 8) & 255) / 255;
      const b = (preset.top & 255) / 255;
      const high = Math.max(r, g, b);
      const low = Math.min(r, g, b);
      const lightness = (high + low) / 2;
      const saturation = high === low ? 0 : (high - low) / (1 - Math.abs(2 * lightness - 1));
      expect(saturation).toBeGreaterThanOrEqual(0.42);
    }
  });

  it("keeps course terrace emphasis narrow instead of splitting the meadow", () => {
    const ramp = GRID_TERRAIN_VALUE_RAMP.course;
    // Four broad terrace values add relief in the close shot without making
    // adjacent same-height cells into a checkerboard.
    expect(Math.max(...ramp) - Math.min(...ramp)).toBeLessThanOrEqual(0.18);
    expect(ramp[0]).toBeLessThan(ramp.at(-1)!);
  });

  it("keeps grid foliage inside the green family", () => {
    const hueOf = (colour: number): number => {
      const red = ((colour >> 16) & 255) / 255;
      const green = ((colour >> 8) & 255) / 255;
      const blue = (colour & 255) / 255;
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const delta = maximum - minimum;
      if (delta === 0) return 0;
      let hue =
        maximum === red
          ? ((green - blue) / delta) % 6
          : maximum === green
            ? (blue - red) / delta + 2
            : (red - green) / delta + 4;
      hue *= 60;
      return hue < 0 ? hue + 360 : hue;
    };
    expect(Math.max(...GRID_PROP_FOLIAGE_COLOURS.map(hueOf))).toBeLessThan(150);
  });

  it("derives a dark underside from the island top without adding a material", () => {
    const warm = gridUndersideColorForTop(0xd89440);
    const green = gridUndersideColorForTop(0x3ca440);
    expect(warm).not.toBe(green);
    expect(gridUndersideColorForTop(0xd89440, true)).not.toBe(warm);
    expect(contrast(warm, GRID_SHARED_SOIL.road)).toBeGreaterThan(3);
  });

  it("paints every lesson stone from the one warm ramp", () => {
    const ramp = new Set<number>(Object.values(GRID_ACCENT_RAMP));
    for (const colour of Object.values(GRID_LESSON_MARKER_COLOURS)) {
      expect(ramp.has(colour)).toBe(true);
    }
    expect(GRID_LESSON_MARKER_COLOURS.live).toBe(GRID_ACCENT_RAMP.coralLight);
    expect(GRID_LESSON_MARKER_COLOURS.idle).toBe(GRID_ACCENT_RAMP.coralLight);
    const maps = readFileSync(new URL("../Maps.tsx", import.meta.url), "utf8");
    expect(maps).toMatch(/GRID_LESSON_MARKER_COLOURS/);
    expect(maps).not.toMatch(/MARKER_COLOUR\s*=/);
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
      rim: preset.rim,
      road: preset.road,
      accent: preset.accent,
    });
    expect(gridPaletteFor(...args)).toEqual(palette);
  });
});
