import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import manifest from "./grid-assets.json";
import {
  GRID_BIOMES,
  GRID_NATURE_ASSET_IDS,
  GRID_PROP_ROLE_SIZING,
  gridBiomeAssetIds,
  gridBiomeRoleFor,
  gridBiomeSequenceIsVaried,
  gridBiomesForUnits,
  gridNatureAspect,
  gridPropSize,
  gridPropSizeViolations,
  type GridPropRole,
} from "./grid-theme.js";

const publicRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../apps/university/public",
);

const unitIds = (count: number): readonly string[] =>
  Array.from({ length: count }, (_, index) => `unit-${index + 1}`);
const natureAssetIds = new Set(
  manifest.assets.filter((asset) => asset.pack === "nature-kit").map((asset) => asset.assetId),
);

describe("grid biome library", () => {
  it("ships the reviewed packs through one texture-free material contract", () => {
    // ADR-0008 locks `decoration` to Kenney CC0 at <= 1200 triangles each.
    // The three accent kits are admitted only after colormap baking, so the
    // expanded library still has no runtime texture and one BatchedMesh path.
    expect(manifest.selection.packIds).toEqual([
      "nature-kit",
      "castle-kit",
      "survival-kit",
      "pirate-kit",
    ]);
    expect(manifest.selection.materialMode).toBe("shared-batched-COLOR_0");
    expect(manifest.summary.modelCount).toBe(279);
    expect(manifest.summary.bakedModelCount).toBe(202);
    expect(GRID_NATURE_ASSET_IDS).toHaveLength(77);
    expect(GRID_NATURE_ASSET_IDS.every((assetId) => natureAssetIds.has(assetId))).toBe(true);
    expect(manifest.summary.externalTextureCount).toBe(0);
    expect(manifest.summary.bakedUvCount).toBe(0);
    expect(manifest.summary.sourceCrossColourTriangles).toBe(0);
    expect(manifest.summary.maxTriangles).toBeLessThanOrEqual(1200);
    expect(manifest.license.spdx).toBe("CC0-1.0");
    expect(JSON.stringify(manifest)).not.toContain("/Users/");
    for (const asset of manifest.assets) {
      expect(existsSync(resolve(publicRoot, asset.src.replace(/^\/+/, ""))), asset.assetId).toBe(
        true,
      );
      if (asset.bake) {
        expect(asset.bake.method, asset.assetId).toBe("colormap-rgb-nearest-to-COLOR_0");
        expect(asset.bake.sourceCrossColourTriangles, asset.assetId).toBe(0);
        expect(asset.losslessCheck.status, asset.assetId).toBe("passed");
        expect(asset.biomes.length, asset.assetId).toBeGreaterThan(0);
      }
    }
    expect(manifest.tripwire.status).toContain("passed");
    expect(manifest.tripwire.crossColourTriangles).toBeGreaterThan(0);
  });

  it("resolves every asset named by every biome", () => {
    // The biome table and the import whitelist are two files. This is the gate
    // that stops them drifting into a runtime 404 instead of a red test.
    const known = new Set(manifest.assets.map((asset) => asset.assetId));
    for (const biome of GRID_BIOMES) {
      for (const assetId of gridBiomeAssetIds(biome)) {
        expect(known.has(assetId), `${biome.id}/${assetId}`).toBe(true);
      }
      expect(biome.canopy.length, biome.id).toBeGreaterThanOrEqual(2);
      expect(biome.ground.length, biome.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps every prop inside both ends of its role's size bands", () => {
    /*
     * Both ends, always. An upper bound alone is satisfiable by squeezing a
     * tree into a black needle, which is a real failure this project has
     * already shipped once. The lower bound is what refuses that answer.
     *
     * This assertion is also what caught `crops_dirtRow` (20:1 aspect) and
     * `fence_gate` (2.9:1 as a landmark): both are ground decals wearing a
     * prop's clothes, and both were removed from the table rather than having
     * the band widened to admit them.
     */
    const violations: string[] = [];
    for (const biome of GRID_BIOMES) {
      for (const assetId of gridBiomeAssetIds(biome)) {
        const role = gridBiomeRoleFor(biome, assetId);
        expect(role, `${biome.id}/${assetId}`).not.toBeNull();
        for (const found of gridPropSizeViolations(assetId, role!)) {
          violations.push(
            `${biome.id}/${assetId} as ${found.role}: ${found.reason} (${found.value.toFixed(3)})`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("never lets a prop cover more ground than a hex", () => {
    // A hex is 2.0 world units across. A prop wider than that cannot sit on
    // one cell, which breaks the "one prop per cell" contract geometrically
    // even when the planner honours it logically.
    for (const [role, sizing] of Object.entries(GRID_PROP_ROLE_SIZING)) {
      // 2.4 and not 2.0: the landmark band is deliberately allowed to overhang
      // its own cell a little, because a chapter opener that stops exactly at
      // the hex edge reads as another tile rather than as a thing standing on
      // the island. Its neighbours are kept clear by the landmark clearance
      // rule in `grid-props.ts`, not by this number.
      expect(sizing.footprint[1], role).toBeLessThanOrEqual(2.4);
      expect(sizing.footprint[0], role).toBeGreaterThan(0);
      expect(sizing.height[0], role).toBeGreaterThan(0);
      expect(sizing.height[0], role).toBeLessThan(sizing.height[1]);
    }
    // Landmarks are the one band allowed to exceed a single cell, because a
    // chapter opener is meant to read across its clearing.
    expect(GRID_PROP_ROLE_SIZING.canopy.footprint[1]).toBeLessThan(2);
  });

  it("keeps a flat mesh flat instead of turning it into a slab", () => {
    // `rock_smallFlatA` is 7.6 times wider than it is tall. Sizing by height
    // alone would give it a footprint of nearly four hexes; the footprint
    // clamp gives up height instead and it stays a pebble.
    const aspect = gridNatureAspect("rock_smallFlatA");
    expect(aspect).toBeGreaterThan(5);
    const size = gridPropSize("ground", aspect, 0.5);
    expect(size.footprint).toBeLessThanOrEqual(GRID_PROP_ROLE_SIZING.ground.footprint[1]);
    expect(size.height).toBeGreaterThanOrEqual(GRID_PROP_ROLE_SIZING.ground.height[0]);
    expect(size.height).toBeLessThan(0.3);
  });

  it("gives every unit its own biome and never repeats an adjacent one", () => {
    for (const count of [1, 2, 3, 6, 8, 10, 12, 17]) {
      const units = unitIds(count);
      const assignment = gridBiomesForUnits(units, "foundations-before-zero");
      expect(assignment.size, `${count} units`).toBe(count);
      expect(gridBiomeSequenceIsVaried(units, assignment), `${count} units`).toBe(true);
      if (count <= GRID_BIOMES.length) {
        const distinct = new Set([...assignment.values()].map((biome) => biome.id));
        expect(distinct.size, `${count} units`).toBe(count);
      }
    }
  });

  it("opens a course somewhere calm", () => {
    for (const seed of ["a", "b", "c", "foundations-before-zero", "seed-17", "x9"]) {
      const units = unitIds(6);
      const assignment = gridBiomesForUnits(units, seed);
      expect(assignment.get("unit-1")!.opening, seed).toBe(true);
    }
  });

  it("is stable for one seed and different across seeds", () => {
    const units = unitIds(6);
    const first = gridBiomesForUnits(units, "seed-one");
    const again = gridBiomesForUnits(units, "seed-one");
    expect([...first.values()].map((biome) => biome.id)).toEqual(
      [...again.values()].map((biome) => biome.id),
    );
    const other = gridBiomesForUnits(units, "seed-two");
    const sameEverywhere = units.every((unitId) => first.get(unitId)!.id === other.get(unitId)!.id);
    expect(sameEverywhere).toBe(false);
  });

  it("keeps biome ground tints inside a restrained band", () => {
    // A biome is weather on the course's ground, not a second palette. Wide
    // tints would make every course converge on the same six colours and
    // destroy the course identity the world map depends on.
    //
    // Hue was capped at 0.045 — sixteen degrees of rotation — and every biome
    // sat at the cap, which is the shape of a band set too tight: the table
    // stops expressing preferences and just reports the limit. Sixteen degrees
    // is below the threshold at which a chapter change reads as a change, so
    // the island was one green and the whole unit-as-biome idea was carried by
    // the props alone. 0.095 is about thirty-four degrees, still a family
    // rather than a second palette, and the biomes now spread across it
    // instead of piling on the edge.
    for (const biome of GRID_BIOMES) {
      expect(Math.abs(biome.groundTint.hue), biome.id).toBeLessThanOrEqual(0.095);
      expect(biome.groundTint.saturation, biome.id).toBeGreaterThanOrEqual(0.55);
      expect(biome.groundTint.saturation, biome.id).toBeLessThanOrEqual(1.35);
      // Tighter than hue and saturation on purpose: elevation owns value, so a
      // biome may only borrow a little of it before the terraces stop reading.
      expect(biome.groundTint.value, biome.id).toBeGreaterThanOrEqual(0.87);
      expect(biome.groundTint.value, biome.id).toBeLessThanOrEqual(1.13);
    }
  });

  it("spreads its biomes across the band instead of piling them on the cap", () => {
    /*
     * The failure this catches is not a value out of range — the old table was
     * entirely in range. It is a table that has stopped choosing.
     *
     * Every biome sat within a whisker of the old 0.045 hue cap, because the
     * cap was tighter than the difference the art needed, so each entry was
     * really saying "as far as I am allowed" rather than "this is what a
     * quarry looks like". A range check passes happily on that, and the island
     * still renders as one colour. So: the hues must actually use the band,
     * and they must not bunch at its edge.
     */
    const hues = GRID_BIOMES.map((biome) => biome.groundTint.hue);
    const span = Math.max(...hues) - Math.min(...hues);
    expect(span).toBeGreaterThanOrEqual(0.12);
    const atTheCap = hues.filter((hue) => Math.abs(hue) > 0.085).length;
    expect(atTheCap).toBeLessThanOrEqual(3);
    // Adjacent units get different biomes; those two must differ enough to
    // read as a chapter change rather than as a lighting drift.
    const sorted = [...hues].sort((a, b) => a - b);
    const gaps = sorted.slice(1).map((hue, index) => hue - sorted[index]!);
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(0.01);
    const saturations = GRID_BIOMES.map((biome) => biome.groundTint.saturation);
    expect(Math.max(...saturations) - Math.min(...saturations)).toBeGreaterThanOrEqual(0.5);
  });

  it("has at least three calm biomes to open with", () => {
    expect(GRID_BIOMES.filter((biome) => biome.opening).length).toBeGreaterThanOrEqual(3);
  });

  it("prices a whole course's biome library", () => {
    // The budget claim in the ADR amendment is this number, not a guess.
    const units = unitIds(6);
    const assignment = gridBiomesForUnits(units, "foundations-before-zero");
    const assetIds = new Set([...assignment.values()].flatMap((biome) => gridBiomeAssetIds(biome)));
    const byId = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));
    const bytes = [...assetIds].reduce((total, id) => total + (byId.get(id)?.bytes ?? 0), 0);
    // Six units now draw from a larger catalogue, but this is still bounded by
    // the explicit biome assignment rather than by the full 286-model cache.
    expect(assetIds.size).toBeLessThanOrEqual(180);
    expect(bytes).toBeLessThan(4_100_000);
  });
});

describe("grid prop sizing", () => {
  it("is monotonic in its roll", () => {
    const aspect = gridNatureAspect("tree_oak_fall");
    const low = gridPropSize("canopy", aspect, 0);
    const high = gridPropSize("canopy", aspect, 1);
    expect(high.height).toBeGreaterThan(low.height);
  });

  it("preserves the mesh's own proportions", () => {
    // Fattening is uniform, so a slender pine stays slender relative to a
    // round one. If this ever stops holding, every prop has become a cube.
    const pine = gridNatureAspect("tree_pineTallA_detailed");
    const oak = gridNatureAspect("tree_oak_fall");
    expect(pine).toBeLessThan(oak);
    const pineSize = gridPropSize("canopy", pine, 0.5);
    const oakSize = gridPropSize("canopy", oak, 0.5);
    expect(pineSize.footprint).toBeLessThan(oakSize.footprint);
  });

  it("clamps rather than throwing on an absurd aspect", () => {
    const size = gridPropSize("ground", 40, 0.5);
    expect(size.footprint).toBeLessThanOrEqual(GRID_PROP_ROLE_SIZING.ground.footprint[1]);
    expect(Number.isFinite(size.height)).toBe(true);
  });

  it("rejects a decal that only a widened band would admit", () => {
    // Guarding the guard: this is the shape of the thing that was removed.
    const violations = gridPropSizeViolations("stone_smallFlatA", "canopy");
    expect(violations.length).toBeGreaterThan(0);
  });
});

const ROLES: readonly GridPropRole[] = ["canopy", "understory", "ground", "landmark"];

describe("grid role sizing bands", () => {
  it("keeps the four bands ordered and non-overlapping at their centres", () => {
    const centres = ROLES.map(
      (role) => (GRID_PROP_ROLE_SIZING[role].height[0] + GRID_PROP_ROLE_SIZING[role].height[1]) / 2,
    );
    // ground < understory < canopy < landmark: the scale hierarchy is the
    // thing that makes a frame readable, so it is asserted, not assumed.
    expect(centres[2]).toBeLessThan(centres[1]!);
    expect(centres[1]).toBeLessThan(centres[0]!);
    expect(centres[0]).toBeLessThan(centres[3]!);
  });
});
