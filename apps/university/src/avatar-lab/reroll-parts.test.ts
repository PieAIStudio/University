import { PARTS, randomRecipe, rerollPart } from "@pieai/swimmer-avatar-kit";
import { describe, expect, it } from "vitest";

import { REROLLABLE_PARTS } from "./rerollable-parts";

describe("avatar-lab part rerolls", () => {
  it("only offers part ids the kit accepts", () => {
    const known = new Set(PARTS.map((part) => part.id));
    const recipe = randomRecipe("ak1-humanoid");
    expect(REROLLABLE_PARTS.length).toBeGreaterThan(0);
    for (const part of REROLLABLE_PARTS) {
      expect(known.has(part.id)).toBe(true);
      expect(() => rerollPart(recipe, part.id)).not.toThrow();
    }
  });
});
