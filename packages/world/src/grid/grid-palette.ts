import { hash } from "../island/random.js";

export interface GridPalette {
  readonly top: number;
  readonly shadow: number;
  readonly cliff: number;
  readonly road: number;
  readonly accent: number;
}

export const GRID_PALETTE_ROLES = ["top", "shadow", "cliff", "road", "accent"] as const;

type Rgb = readonly [number, number, number];

function hueToRgb(p: number, q: number, t: number): number {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  if (saturation === 0) {
    const grey = Math.round(lightness * 255);
    return [grey, grey, grey];
  }
  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return [
    Math.round(hueToRgb(p, q, hue + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, hue) * 255),
    Math.round(hueToRgb(p, q, hue - 1 / 3) * 255),
  ];
}

function rgbToHex([red, green, blue]: Rgb): number {
  return (red << 16) | (green << 8) | blue;
}

/**
 * Five deliberate swatches. Lighting may shade these colours, but it never
 * chooses the identity of the island. The large lightness steps are what
 * keep a grid readable with shadowMap disabled.
 */
export function gridPaletteFor(studyId: string, courseId: string, seed: string): GridPalette {
  const hue = (hash(`${studyId}/${courseId}/${seed}/palette`) * 360) / 360;
  const top = rgbToHex(hslToRgb(hue, 0.7, 0.52));
  // Course identity belongs on the top. Shared soil-coloured sides and a
  // warm stone road keep a blue or purple course from becoming a plastic
  // token when several islands share one world.
  const shadow = 0x26343d;
  const cliff = 0x704b3c;
  const road = 0xd2a35e;
  const accent = rgbToHex(hslToRgb((hue + 0.52) % 1, 0.78, 0.58));
  return { top, shadow, cliff, road, accent };
}
