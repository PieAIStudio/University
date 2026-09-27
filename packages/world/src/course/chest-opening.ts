import type { ChestTier } from "./chests-and-monsters.js";

/**
 * How big each chest's celebration is (V7 station 4, decision J2 as the Owner
 * clarified it: every opening plays in full, and its length follows the chest).
 * Rarer chests burst in more waves, for longer, with more kinds of things.
 * Tuned from the review chest (`docs/reference/player-journey/v7/lab/rewards3d.js`,
 * `OPENING_FX`) so the whole opening — charge, waves, settle — lands on the
 * lengths the journey promised: about 2.5, 3.5, 4.5 and 6 seconds.
 */
export interface OpeningFx {
  /** Bursts of loot. */
  readonly waves: number;
  /** Pieces in the first wave; later waves are a little larger. */
  readonly count: number;
  /** Seconds between waves. */
  readonly gap: number;
  /** Camera shake per wave, in world units; 0 for the everyday chest. */
  readonly shake: number;
  /** Ground shockwaves, one per wave up to this many. */
  readonly shocks: number;
  /** Fireworks across the whole opening. */
  readonly fireworks: number;
  /** Coins falling from the sky (gold only). */
  readonly rain: number;
  /** Seconds the chest shakes and leaks light before it bursts. */
  readonly charge: number;
  /** Seconds from the last wave until the loot has settled. */
  readonly settle: number;
}

export const OPENING_FX: Readonly<Record<ChestTier, OpeningFx>> = {
  wood: {
    waves: 1,
    count: 60,
    gap: 0,
    shake: 0,
    shocks: 1,
    fireworks: 0,
    rain: 0,
    charge: 0.6,
    settle: 1.9,
  },
  rare: {
    waves: 2,
    count: 80,
    gap: 0.45,
    shake: 0.015,
    shocks: 2,
    fireworks: 0,
    rain: 0,
    charge: 0.8,
    settle: 2.25,
  },
  epic: {
    waves: 3,
    count: 100,
    gap: 0.42,
    shake: 0.03,
    shocks: 3,
    fireworks: 3,
    rain: 0,
    charge: 1,
    settle: 2.66,
  },
  legendary: {
    waves: 4,
    count: 120,
    gap: 0.4,
    shake: 0.05,
    shocks: 4,
    fireworks: 7,
    rain: 60,
    charge: 1.2,
    settle: 3.6,
  },
};

/** At most this many pieces fly in any one wave (V7: 「喷出来的东西最多 80 个」 on a phone). */
export const OPENING_WAVE_CEILING = 80;

export type OpeningEvent =
  | { readonly at: number; readonly kind: "charge" }
  | { readonly at: number; readonly kind: "burst" }
  | { readonly at: number; readonly kind: "wave"; readonly wave: number; readonly pieces: number }
  | { readonly at: number; readonly kind: "settled" };

/**
 * Every moment of one opening, in seconds from the tap. `slow` halves the loot
 * for a device that cannot carry it; `reduced` (reduced motion) is a chest
 * that is simply open, with nothing flying.
 */
export function openingTimeline(
  tier: ChestTier,
  { slow = false, reduced = false }: { readonly slow?: boolean; readonly reduced?: boolean } = {},
): readonly OpeningEvent[] {
  if (reduced)
    return [
      { at: 0, kind: "burst" },
      { at: 0, kind: "settled" },
    ];
  const fx = OPENING_FX[tier];
  const events: OpeningEvent[] = [
    { at: 0, kind: "charge" },
    { at: fx.charge, kind: "burst" },
  ];
  for (let wave = 1; wave <= fx.waves; wave += 1) {
    const size = Math.round(fx.count * (wave === 1 ? 1 : 0.7 + wave * 0.15));
    const pieces = Math.min(OPENING_WAVE_CEILING, slow ? Math.round(size / 2) : size);
    events.push({ at: fx.charge + (wave - 1) * fx.gap, kind: "wave", wave, pieces });
  }
  events.push({ at: fx.charge + (fx.waves - 1) * fx.gap + fx.settle, kind: "settled" });
  return events;
}

/** Seconds from the tap until the opening has settled. */
export function openingLength(tier: ChestTier): number {
  return openingTimeline(tier).at(-1)!.at;
}

/**
 * The chest a learner opens: one tier up when every exercise in the lesson was
 * answered right the first time (V7: 「只会往上升，不会往下降」). Computed when
 * the chest opens, never stored.
 */
export function openedTier(tier: ChestTier, allFirstTry: boolean): ChestTier {
  if (!allFirstTry) return tier;
  const order: readonly ChestTier[] = ["wood", "rare", "epic", "legendary"];
  return order[Math.min(order.length - 1, order.indexOf(tier) + 1)]!;
}
