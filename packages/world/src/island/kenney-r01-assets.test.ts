import { describe, expect, it } from "vitest";

import manifest from "./kenney-r01-assets.json";
import { islandBlueprintV2 } from "./island-blueprint-v2.js";
import { islandDressingFieldsV2 } from "./island-dressing-v2-render.js";
import { planIslandDressingV2 } from "./island-dressing-v2.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";

describe("R01 Kenney runtime whitelist", () => {
  it("contains exactly the recipe budget with portable provenance", () => {
    expect(manifest.selection.naturalBasePackId).toBe("nature-kit");
    expect(manifest.selection.accentPackIds).toEqual(["fantasy-town-kit"]);
    expect(manifest.selection.rawGlbBudget).toBe(14);
    expect(manifest.assets).toHaveLength(14);
    expect(new Set(manifest.assets.map((asset) => `${asset.pack}/${asset.assetId}`)).size).toBe(14);
    expect(manifest.dependencies).toHaveLength(1);
    expect(JSON.stringify(manifest)).not.toContain("/Users/");
    expect(manifest.sourceRoot).toBe("local-donor:Kenney");
  });

  it("resolves every generated R01 placement through the shared asset adapter", () => {
    const blueprint = islandBlueprintV2({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonCount: 41,
      themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
    });
    const plan = planIslandDressingV2(blueprint, "course");
    const fields = islandDressingFieldsV2(plan, 1);
    expect(fields.reduce((count, field) => count + field.at.length, 0)).toBe(
      plan.placements.length,
    );
    expect(fields.every((field) => field.src.startsWith("/kenney/r01/"))).toBe(true);
  });
});
