import { describe, expect, it } from "vitest";

import {
  OPENING_WAVE_CEILING,
  openedTier,
  openingLength,
  openingTimeline,
} from "./chest-opening.js";
import type { ChestTier } from "./chests-and-monsters.js";

/** V7 station 4: about 2.5, 3.5, 4.5 and 6 seconds, wood to gold. */
const PROMISED: Readonly<Record<ChestTier, number>> = {
  wood: 2.5,
  rare: 3.5,
  epic: 4.5,
  legendary: 6,
};

describe("the chest opening", () => {
  it.each(Object.entries(PROMISED) as [ChestTier, number][])(
    "plays %s in about the length the journey promised",
    (tier, seconds) => {
      expect(Math.abs(openingLength(tier) - seconds)).toBeLessThanOrEqual(0.25);
    },
  );

  it("gets longer and richer with every tier", () => {
    const tiers: ChestTier[] = ["wood", "rare", "epic", "legendary"];
    const waves = tiers.map(
      (tier) => openingTimeline(tier).filter((event) => event.kind === "wave").length,
    );
    expect(waves).toEqual([1, 2, 3, 4]);
    for (let index = 1; index < tiers.length; index += 1)
      expect(openingLength(tiers[index]!)).toBeGreaterThan(openingLength(tiers[index - 1]!));
  });

  it("charges before it bursts, and never flies more than the ceiling in a wave", () => {
    const events = openingTimeline("legendary");
    expect(events[0]).toMatchObject({ at: 0, kind: "charge" });
    expect(events[1]!.kind).toBe("burst");
    expect(events[1]!.at).toBeGreaterThan(0);
    for (const event of events)
      if (event.kind === "wave") expect(event.pieces).toBeLessThanOrEqual(OPENING_WAVE_CEILING);
  });

  it("halves the loot on a slow device", () => {
    const pieces = (slow: boolean) =>
      openingTimeline("wood", { slow }).flatMap((event) =>
        event.kind === "wave" ? [event.pieces] : [],
      )[0]!;
    expect(pieces(true)).toBe(Math.round(pieces(false) / 2));
  });

  it("is simply open under reduced motion", () => {
    expect(openingTimeline("epic", { reduced: true }).map((event) => event.kind)).toEqual([
      "burst",
      "settled",
    ]);
  });

  it("goes up one tier, never down, when every exercise was right the first time", () => {
    expect(openedTier("wood", true)).toBe("rare");
    expect(openedTier("epic", true)).toBe("legendary");
    expect(openedTier("legendary", true)).toBe("legendary");
    expect(openedTier("rare", false)).toBe("rare");
  });
});
