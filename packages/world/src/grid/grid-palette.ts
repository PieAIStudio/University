import { hash } from "../island/random.js";

export interface GridPalette {
  readonly top: number;
  readonly shadow: number;
  readonly cliff: number;
  readonly road: number;
  readonly accent: number;
}

export const GRID_PALETTE_ROLES = ["top", "shadow", "cliff", "road", "accent"] as const;

/**
 * The lower half of the world has one material language. Course identity is
 * carried by the meadow top only; changing it on the cliff or underside turns
 * a place into a plastic token instead of another piece of the same world.
 */
export const GRID_SHARED_SOIL = {
  shadow: 0x412a24,
  cliff: 0x70452f,
  road: 0xf0e5c7,
} as const;

/**
 * The one warm ramp every lesson marker is drawn from.
 *
 * `accent` is not shared, because it is the only colour a learner has to find:
 * it marks the tile they are meant to click. A single coral held up while every
 * meadow was a shade of green, but against sand, frost or violet it drops to
 * 1.0-1.3 contrast and the marker disappears. So the hue stays fixed and only
 * the lightness moves, which keeps the control recognisable as one product
 * element across all 53 courses while staying legible on each ground.
 *
 * Solving for maximum contrast alone is wrong here and was tried: it collapses
 * most presets onto the same deep magenta, which reads as a different control
 * on every island.
 */
export const GRID_ACCENT_RAMP = {
  amberLight: 0xffdc8c,
  coralLight: 0xff9a62,
  coral: 0xf37958,
  coralDeep: 0xdc4a2c,
  brick: 0xc02818,
} as const;

export interface GridPalettePreset extends GridPalette {
  readonly id: string;
}

/**
 * Hand-picked grounds. This table is intentionally finite: a course hashes to
 * one complete, reviewed set instead of inventing a hue in HSL.
 *
 * The ten grounds span green, teal, olive, amber, sand, clay and rust rather
 * than ten shades of one green. An earlier table was all meadow greens, which
 * is the failure `work/archipelago-identity` already died of once: 53 islands
 * that no one can tell apart. Identity has to survive the world map, where a
 * course is a few dozen pixels of ground colour and nothing else.
 *
 * Two bounds hold the table in place, and both were learned by breaking them.
 *
 * Every top has to read as *ground*. Solving for colour separation alone put a pale blue-grey
 * and a lavender in this table, and the 41-lesson island rendered as a concrete
 * car park. So the range is the natural earth gamut — leaf, moss, olive, dry
 * grass, sand, clay, rust — and identity is spread across that, not across the
 * whole wheel.
 *
 * And every top has to stay saturated. Correcting the first mistake pulled four
 * of these below 0.24-0.31 HSL saturation, which rendered a 41-lesson island as
 * dry khaki: technically earth, visibly dust. Hue and lightness carry identity;
 * saturation carries whether the place looks alive.
 *
 * Every preset still shares the soil, cliff and road, so the islands read as 53
 * places in one world rather than 53 unrelated toys. Each accent is the ramp
 * step that clears 1.6:1 against its own ground.
 */
export const GRID_PALETTE_PRESETS: readonly GridPalettePreset[] = [
  { id: "morning-meadow", top: 0xc0b430, accent: GRID_ACCENT_RAMP.coralDeep, ...GRID_SHARED_SOIL },
  { id: "cool-highland", top: 0x6ec999, accent: GRID_ACCENT_RAMP.coralDeep, ...GRID_SHARED_SOIL },
  { id: "autumn-grove", top: 0xd89440, accent: GRID_ACCENT_RAMP.coralDeep, ...GRID_SHARED_SOIL },
  { id: "mint-shelf", top: 0x6ecfa8, accent: GRID_ACCENT_RAMP.coralDeep, ...GRID_SHARED_SOIL },
  { id: "dusk-field", top: 0x97ac40, accent: GRID_ACCENT_RAMP.amberLight, ...GRID_SHARED_SOIL },
  { id: "deep-forest", top: 0x3ca440, accent: GRID_ACCENT_RAMP.amberLight, ...GRID_SHARED_SOIL },
  { id: "sand-bar", top: 0xd8c87e, accent: GRID_ACCENT_RAMP.coral, ...GRID_SHARED_SOIL },
  { id: "clay-terrace", top: 0xcc7b5e, accent: GRID_ACCENT_RAMP.amberLight, ...GRID_SHARED_SOIL },
  { id: "tundra-flat", top: 0xa6c157, accent: GRID_ACCENT_RAMP.coralDeep, ...GRID_SHARED_SOIL },
  { id: "rust-down", top: 0xa86a3c, accent: GRID_ACCENT_RAMP.coral, ...GRID_SHARED_SOIL },
] as const;

export function gridPaletteIndexFor(studyId: string, courseId: string, seed: string): number {
  return Math.floor(
    hash(`${studyId}/${courseId}/${seed}/palette-slot`) * GRID_PALETTE_PRESETS.length,
  );
}

/** Pick one deliberate five-colour set; do not synthesize a colour from a hash. */
export function gridPaletteFor(studyId: string, courseId: string, seed: string): GridPalette {
  const preset = GRID_PALETTE_PRESETS[gridPaletteIndexFor(studyId, courseId, seed)]!;
  return {
    top: preset.top,
    shadow: preset.shadow,
    cliff: preset.cliff,
    road: preset.road,
    accent: preset.accent,
  };
}
