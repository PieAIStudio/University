/** Foliage colour is another reading of the canonical meadow/rock/height
 * field, not new noise and not random colour per tree. Values are sRGB hex;
 * the shared Three.js colour pipeline converts them once at projection time.
 */
import { sampleIslandField, type IslandField, type IslandFieldSample } from "./island-field.js";
import type { IslandPoint } from "./island-blueprint.js";

export const FOLIAGE_PATCH_PALETTE = {
  moss: 0x6c9951,
  jade: 0x518e68,
  dryGold: 0xa69854,
} as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function mixHex(from: number, to: number, amount: number): number {
  const t = clamp01(amount);
  const channel = (shift: number) =>
    Math.round(((from >> shift) & 255) * (1 - t) + ((to >> shift) & 255) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export function foliageTintFromFieldSample(
  sample: Pick<IslandFieldSample, "grass" | "rock" | "height" | "ao">,
  heightScale: number,
): number {
  const meadow = clamp01(sample.grass);
  const exposure = clamp01(sample.rock);
  const elevation = clamp01(sample.height / Math.max(1, heightScale));
  const cool = clamp01(meadow * 0.88 + (1 - sample.ao) * 0.18 - exposure * 0.35);
  // Warmth belongs to the sparse, exposed high shoulder, not every fifth
  // tree. Cubic weighting keeps gold an accent inside the green family.
  const warmth = Math.pow(clamp01(exposure * 1.65 + elevation * 0.35 - meadow * 0.25), 3) * 0.68;
  return mixHex(
    mixHex(FOLIAGE_PATCH_PALETTE.moss, FOLIAGE_PATCH_PALETTE.jade, cool),
    FOLIAGE_PATCH_PALETTE.dryGold,
    warmth,
  );
}

export function foliageTintAt(field: IslandField, point: IslandPoint): number {
  return foliageTintFromFieldSample(
    sampleIslandField(field, point.x, point.z),
    field.extent * 0.14,
  );
}
