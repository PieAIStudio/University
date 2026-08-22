import { describe, expect, it } from "vitest";
import {
  fillRecipe as kitFillRecipe,
  PALETTES as KIT_PALETTES,
  PARTS as KIT_PARTS,
  randomRecipe as kitRandomRecipe,
  rerollPart as kitRerollPart,
  SPECIES as KIT_SPECIES,
} from "@pieai/swimmer-avatar-kit";
import {
  fillRecipe as oursFillRecipe,
  PALETTES as OURS_PALETTES,
  PALETTE_SWATCHES,
  PARTS as OURS_PARTS,
  randomRecipe as oursRandomRecipe,
  rerollPart as oursRerollPart,
  SPECIES as OURS_SPECIES,
} from "@pieai/university-avatar";

import { COMPARE_PRESETS } from "./presets";

describe("recipe parity between packages/avatar and swimmer-avatar-kit@0.1.0", () => {
  it("lists the same species, parts, and palette ids", () => {
    expect(KIT_SPECIES.map((entry) => entry.id)).toEqual(OURS_SPECIES.map((entry) => entry.id));
    expect(KIT_SPECIES.map((entry) => entry.label)).toEqual(
      OURS_SPECIES.map((entry) => entry.label),
    );
    expect(KIT_PARTS.map((entry) => entry.id)).toEqual(OURS_PARTS.map((entry) => entry.id));
    expect(KIT_PARTS.map((entry) => entry.label)).toEqual(OURS_PARTS.map((entry) => entry.label));
    expect(KIT_PALETTES.map((entry) => entry.id)).toEqual(OURS_PALETTES.map((entry) => entry.id));
    expect(KIT_PALETTES.map((entry) => entry.label)).toEqual(
      OURS_PALETTES.map((entry) => entry.label),
    );
  });

  it("matches PALETTE_SWATCHES to the kit PALETTES table, including colours", () => {
    expect(
      KIT_PALETTES.map((entry) => ({
        id: entry.id,
        label: entry.label,
        colors: [...entry.colors],
      })),
    ).toEqual(
      PALETTE_SWATCHES.map((entry) => ({
        id: entry.id,
        label: entry.label,
        colors: [...entry.colors],
      })),
    );
  });

  it("reproduces the same recipe JSON from the same string seed", () => {
    const seeds = [
      "0",
      "42",
      "account:42",
      "ak1-bear",
      "ak1-bunny",
      "ak1-cat",
      "ak1-robot",
      "ak1-slime",
      "ak1-humanoid",
      "unicode-种子",
    ];
    for (const seed of seeds) {
      expect(kitRandomRecipe(seed)).toEqual(oursRandomRecipe(seed));
    }
  });

  it("pins the six evidence species to identical filled recipes", () => {
    for (const preset of COMPARE_PRESETS) {
      const ours = oursFillRecipe({
        ...oursRandomRecipe(preset.seed),
        species: preset.species,
        body: null,
        stance: null,
        parts: {},
      });
      const kit = kitFillRecipe({
        ...kitRandomRecipe(preset.seed),
        species: preset.species,
        body: null,
        stance: null,
        parts: {},
      });
      expect(kit).toEqual(ours);
    }
  });

  it("rerolls the same part to the same next recipe", () => {
    const ours = oursRandomRecipe("reroll-42");
    const kit = kitRandomRecipe("reroll-42");
    expect(kitRerollPart(kit, "eyes")).toEqual(oursRerollPart(ours, "eyes"));
  });

  it("treats a numeric string the same as the kit's number seed when the value fits in 32 bits", () => {
    expect(kitRandomRecipe(42)).toEqual(oursRandomRecipe("42"));
    expect(kitRandomRecipe("4294967297")).toEqual(oursRandomRecipe("4294967297"));
  });

  it("rejects an unknown part on the kit and no-ops here", () => {
    const ours = oursRandomRecipe("7");
    const snapshot = structuredClone(ours);
    expect(oursRerollPart(ours, "not-a-part")).toEqual(snapshot);
    expect(() => kitRerollPart(kitRandomRecipe("7"), "not-a-part")).toThrow(/Unknown avatar part/);
  });
});
