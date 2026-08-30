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
  accent: 0xf37958,
} as const;

export interface GridPalettePreset extends GridPalette {
  readonly id: string;
}

/**
 * Hand-picked meadow families. This table is intentionally finite: a course
 * hashes to one complete, reviewed set instead of inventing a hue in HSL.
 * Every preset shares the warm soil, ivory road and coral interaction colour.
 */
export const GRID_PALETTE_PRESETS: readonly GridPalettePreset[] = [
  { id: "lime-meadow", top: 0xb6c43a, ...GRID_SHARED_SOIL },
  { id: "spring-meadow", top: 0x9bbd47, ...GRID_SHARED_SOIL },
  { id: "fern-meadow", top: 0x7cad50, ...GRID_SHARED_SOIL },
  { id: "clover-meadow", top: 0x5b9e64, ...GRID_SHARED_SOIL },
  { id: "sage-meadow", top: 0x6eaa85, ...GRID_SHARED_SOIL },
  { id: "mint-meadow", top: 0x82b769, ...GRID_SHARED_SOIL },
  { id: "olive-meadow", top: 0xa8b648, ...GRID_SHARED_SOIL },
  { id: "golden-meadow", top: 0xc6b24b, ...GRID_SHARED_SOIL },
  { id: "moss-meadow", top: 0xa8c34a, ...GRID_SHARED_SOIL },
  { id: "deep-meadow", top: 0x91a94a, ...GRID_SHARED_SOIL },
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
