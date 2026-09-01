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
 * Elevation is also a value layer. These are albedo multipliers keyed to the
 * four authored terrace levels, not a post-process exposure shift: the lower
 * shoulder receives less light, while the upper terrace has enough value
 * headroom for the same sun to read as a lit plane in the fixed camera.
 *
 * Course and world use different ranges because they are two projections of
 * the same grid at different physical scales. The relation stays shared and
 * deterministic; only the camera's readable size changes the range. The course
 * range is deliberately neutral in the course projection: the shared top
 * swatch stays one green family, while the terrain slope and the real key/fill
 * lights carry the value cue. A wide ramp turns one meadow into unrelated
 * yellow and brown slabs.
 */
export const GRID_TERRAIN_VALUE_RAMP = {
  course: [1, 1, 1, 1],
  world: [0.8, 1.2, 3.2, 4.8],
} as const;

/**
 * Leaf colour is a real dressing layer, not a noise texture. The finite ramp
 * moves from dry yellow grass through moss to wet meadow, and its placement
 * selection is deterministic in the shared BatchedMesh adapter. Keeping the
 * endpoints inside the grass hue band gives a small course enough visible
 * plant identity without turning the top surface into a tiled colour field.
 */
export const GRID_PROP_FOLIAGE_COLOURS = [
  0xb99a40, 0xa4a13c, 0x8da643, 0x74a64a, 0x213c28, 0x315f36, 0x3d6a36, 0x5d9147, 0x3c713d,
] as const;

export function gridTerrainValueScale(
  projection: "course" | "world",
  height: 1 | 2 | 3 | 4,
): number {
  return GRID_TERRAIN_VALUE_RAMP[projection][height - 1] ?? 1;
}

function hueToRgb(p: number, q: number, t: number): number {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

/** Convert the reviewed top swatch into its dark, same-hue floating underside. */
export function gridUndersideColorForTop(top: number, dimmed = false): number {
  const red = ((top >> 16) & 255) / 255;
  const green = ((top >> 8) & 255) / 255;
  const blue = (top & 255) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const lightness = (maximum + minimum) * 0.5;
  const delta = maximum - minimum;
  let hue = 0;
  let saturation = 0;
  if (delta > 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (maximum === red) hue = ((green - blue) / delta) % 6;
    else if (maximum === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue /= 6;
    if (hue < 0) hue += 1;
  }
  const darkLightness = Math.max(0.12, Math.min(0.36, lightness * 0.38));
  const darkSaturation = Math.max(0.28, Math.min(0.76, saturation * 0.78));
  const q =
    darkLightness < 0.5
      ? darkLightness * (1 + darkSaturation)
      : darkLightness + darkSaturation - darkLightness * darkSaturation;
  const p = 2 * darkLightness - q;
  const own =
    delta === 0
      ? [darkLightness, darkLightness, darkLightness]
      : [hueToRgb(p, q, hue + 1 / 3), hueToRgb(p, q, hue), hueToRgb(p, q, hue - 1 / 3)];
  // The shared soil remains the material family; the own-hue component is the
  // identity cue visible in the reference's pink/blue/yellow island bottoms.
  const shared = [
    ((GRID_SHARED_SOIL.cliff >> 16) & 255) / 255,
    ((GRID_SHARED_SOIL.cliff >> 8) & 255) / 255,
    (GRID_SHARED_SOIL.cliff & 255) / 255,
  ];
  const dim = dimmed ? 0.62 : 1;
  const mixed = own.map((value, index) => (value * 0.78 + shared[index]! * 0.22) * dim);
  return (
    (Math.round(Math.min(1, mixed[0]!) * 255) << 16) |
    (Math.round(Math.min(1, mixed[1]!) * 255) << 8) |
    Math.round(Math.min(1, mixed[2]!) * 255)
  );
}

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

/**
 * Lesson stones sit on the shared ivory road, not on the meadow. The ramp
 * step is therefore chosen for brightness on `GRID_SHARED_SOIL.road`, not for
 * contrast against a particular ground. Live/idle use the light coral the
 * reference paints; done and locked stay on the same hue, one step deeper.
 */
export const GRID_LESSON_MARKER_COLOURS = {
  done: GRID_ACCENT_RAMP.coral,
  live: GRID_ACCENT_RAMP.coralLight,
  idle: GRID_ACCENT_RAMP.coralLight,
  locked: GRID_ACCENT_RAMP.coral,
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
  { id: "spring-rise", top: 0x68bd4c, accent: GRID_ACCENT_RAMP.coralDeep, ...GRID_SHARED_SOIL },
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
