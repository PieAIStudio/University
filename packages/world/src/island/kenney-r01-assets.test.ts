import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import elementalManifest from "./elemental-serenity-assets.json";
import manifest from "./kenney-r01-assets.json";
import { resolveIslandRuntimeAsset } from "./island-asset-registry.js";
import { islandBlueprint } from "./island-blueprint.js";
import { islandDressingFields } from "./island-dressing-render.js";
import { isIslandFoliagePlacement } from "./island-foliage-render.js";
import { planIslandDressing } from "./island-dressing.js";
import {
  islandRecipeRuntimeReferences,
  KENNEY_ISLAND_RECIPES,
  islandThemeSelectionForCourse,
} from "./kenney-recipes.js";

const publicRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../apps/university/public",
);

describe("R01 Kenney runtime whitelist", () => {
  it("contains exactly the recipe budget with portable provenance", () => {
    expect(manifest.selection.naturalBasePackId).toBe("nature-kit");
    expect(manifest.selection.accentPackIds).toEqual(["fantasy-town-kit"]);
    expect(manifest.selection.rawGlbBudget).toBe(10);
    expect(manifest.assets).toHaveLength(10);
    expect(new Set(manifest.assets.map((asset) => `${asset.pack}/${asset.assetId}`)).size).toBe(10);
    expect(manifest.dependencies).toHaveLength(1);
    expect(Object.keys(manifest.runtimeFallbacks)).toHaveLength(58);
    expect(JSON.stringify(manifest)).not.toContain("/Users/");
    expect(manifest.sourceRoot).toBe("local-donor:Kenney");
    for (const retiredNaturalFile of [
      "tree_default.glb",
      "tree_detailed.glb",
      "tree_pineDefaultB.glb",
      "plant_bushDetailed.glb",
    ]) {
      expect(
        existsSync(resolve(publicRoot, "kenney/r01/nature", retiredNaturalFile)),
        retiredNaturalFile,
      ).toBe(false);
    }
  });

  it("resolves every generated R01 placement through the shared asset adapter", () => {
    const blueprint = islandBlueprint({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonCount: 41,
      themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
    });
    const plan = planIslandDressing(blueprint, "course");
    const fields = islandDressingFields(plan, 1);
    expect(fields.reduce((count, field) => count + field.at.length, 0)).toBe(
      plan.placements.filter((placement) => !isIslandFoliagePlacement(placement)).length,
    );
    expect(fields.some((field) => field.src.startsWith("/models/elemental-serenity/"))).toBe(true);
    expect(
      fields.every(
        (field) =>
          field.src.startsWith("/kenney/r01/") ||
          field.src.startsWith("/models/elemental-serenity/"),
      ),
    ).toBe(true);
  });

  it("resolves every runtime asset reference in every recipe to a real file", () => {
    let fallbackReferenceCount = 0;
    for (const recipe of KENNEY_ISLAND_RECIPES) {
      const references = islandRecipeRuntimeReferences(recipe);
      for (const reference of references) {
        const resolution = resolveIslandRuntimeAsset(reference.packId, reference.assetId);
        const label = `${recipe.id}/${reference.packId}/${reference.assetId}`;
        expect(resolution, label).not.toBeNull();
        if (resolution?.usedFallback) fallbackReferenceCount += 1;
        expect(existsSync(resolve(publicRoot, resolution!.src.replace(/^\/+/, ""))), label).toBe(
          true,
        );
      }
    }
    // There are 61 missing recipe references, represented by 58 unique keys
    // because watercraft and space assets recur in more than one recipe.
    expect(fallbackReferenceCount).toBe(61);
  });

  it("keeps every recipe placement on the shared renderer field path", () => {
    for (const recipe of KENNEY_ISLAND_RECIPES) {
      const blueprint = islandBlueprint({
        studyId: "turing-pact",
        courseId: `runtime-${recipe.id}`,
        lessonCount: 41,
        themeSelection: {
          naturalBasePackId: recipe.base.packId,
          accentPackIds: recipe.accentPackIds,
          recipeId: recipe.id,
        },
      });
      const plan = planIslandDressing(blueprint, "course", recipe);
      const fields = islandDressingFields(plan, 1);
      expect(
        fields.reduce((count, field) => count + field.at.length, 0),
        recipe.id,
      ).toBe(plan.placements.filter((placement) => !isIslandFoliagePlacement(placement)).length);
    }
  });

  it("keeps Elemental-Serenity isolated from the confirmed Kenney manifest", () => {
    /*
     * Isolation is the point of this assertion, not the licence state. The
     * author cleared this media on 2026-08-28, so the provenance flipped to
     * granted — but it stays in its own manifest rather than being folded into
     * the CC0 Kenney one, because two different grants should never end up
     * behind one label.
     */
    expect(elementalManifest.assets).toHaveLength(8);
    expect(
      elementalManifest.assets.every((asset) => asset.provenance === "author-permission-granted"),
    ).toBe(true);
    expect(elementalManifest.licenseStatus).toBe("author-permission-granted");
    expect(elementalManifest.assets.every((asset) => asset.registeredOn === "2026-08-28")).toBe(
      true,
    );
    expect(elementalManifest.dependencies).toHaveLength(0);
    expect(elementalManifest.summary.externalTextureCount).toBe(0);
    expect(
      elementalManifest.assets.some((asset) => asset.assetId === "leave_alpha_map_256x256.png"),
    ).toBe(false);
    for (const asset of elementalManifest.assets) {
      expect(existsSync(resolve(publicRoot, asset.src.replace(/^\/+/, ""))), asset.assetId).toBe(
        true,
      );
    }
  });
});
