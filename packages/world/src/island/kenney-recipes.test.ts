import { describe, expect, it } from "vitest";

import {
  KENNEY_CATALOG_SCHEMA_VERSION,
  KENNEY_COVERAGE_LEDGER,
  KENNEY_ISLAND_RECIPES,
  KENNEY_PACKS,
  islandThemeSelectionForCourse,
  validateIslandRecipe,
} from "./kenney-recipes.js";

describe("Kenney island recipe catalog", () => {
  it("keeps the complete unique pack inventory separate from runtime recipes", () => {
    expect(KENNEY_CATALOG_SCHEMA_VERSION).toBe(1);
    expect(KENNEY_PACKS).toHaveLength(20);
    expect(new Set(KENNEY_PACKS.map((pack) => pack.id)).size).toBe(KENNEY_PACKS.length);
    expect(KENNEY_PACKS.find((pack) => pack.id === "nature-kit")?.materialMode).toBe("unlit-color");
    expect(KENNEY_PACKS.find((pack) => pack.id === "space-kit")?.textureDependency).toBe("none");
    expect(KENNEY_PACKS.every((pack) => /^[a-f0-9]{64}$/.test(pack.licenseSha256))).toBe(true);
  });

  it("validates every curated recipe and keeps the first slice intentionally small", () => {
    expect(KENNEY_ISLAND_RECIPES).toHaveLength(12);
    for (const recipe of KENNEY_ISLAND_RECIPES) {
      expect(validateIslandRecipe(recipe)).toEqual({ ok: true, errors: [] });
      expect(recipe.accentPackIds.length).toBeGreaterThanOrEqual(1);
      expect(recipe.accentPackIds.length).toBeLessThanOrEqual(2);
      expect(recipe.base.packId).toBe("nature-kit");
    }
    const first = KENNEY_ISLAND_RECIPES[0]!;
    expect(first.id).toBe("R01-forest-academy");
    expect(first.accentPackIds).toEqual(["fantasy-town-kit"]);
    expect(
      new Set([...first.base.assetIds, ...first.accentRoles.flatMap((role) => role.assetIds)]).size,
    ).toBe(14);
  });

  it("assigns every physical accent pack to a coherent island recipe", () => {
    expect(KENNEY_COVERAGE_LEDGER).toHaveLength(KENNEY_PACKS.length);
    expect(KENNEY_COVERAGE_LEDGER.every((entry) => entry.recipeIds.length > 0)).toBe(true);
    expect(KENNEY_COVERAGE_LEDGER.every((entry) => entry.selectedCount > 0)).toBe(true);
    expect(KENNEY_COVERAGE_LEDGER.every((entry) => entry.coverageRatio > 0)).toBe(true);
    expect(KENNEY_COVERAGE_LEDGER.find((entry) => entry.packId === "nature-kit")?.status).toBe(
      "validated",
    );
    expect(
      KENNEY_COVERAGE_LEDGER.find((entry) => entry.packId === "fantasy-town-kit")?.status,
    ).toBe("validated");
  });

  it("rejects a hidden third physical pack", () => {
    const original = KENNEY_ISLAND_RECIPES[0]!;
    const invalid = {
      ...original,
      accentPackIds: ["fantasy-town-kit", "space-kit", "modular-space-kit"],
    } as typeof original;
    const result = validateIslandRecipe(invalid);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("one or two physical packs");
  });

  it("keeps explicit art direction in data and fallback assignment stable", () => {
    expect(islandThemeSelectionForCourse("turing-pact", "foundations-before-zero")).toEqual({
      naturalBasePackId: "nature-kit",
      accentPackIds: ["fantasy-town-kit"],
      recipeId: "R01-forest-academy",
    });
    const first = islandThemeSelectionForCourse("future-study", "future-course");
    const second = islandThemeSelectionForCourse("future-study", "future-course");
    expect(first).toEqual(second);
    expect(first.accentPackIds.length).toBeGreaterThanOrEqual(1);
    expect(first.accentPackIds.length).toBeLessThanOrEqual(2);
  });
});
