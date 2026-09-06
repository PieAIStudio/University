import { describe, expect, it } from "vitest";

import { islandBlueprint } from "../island/island-blueprint.js";
import {
  COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE,
  COURSE_TREE_CROWN_TRIANGLES_PER_LOBE,
} from "../island/foliage-geometry.js";
import { CAMPFIRE_FLAME_TRIANGLES } from "../island/island-campfire.js";
import { ISLAND_GRASS_LIMITS } from "../island/island-grass.js";
import { ISLAND_GRASS_BLADE_TRIANGLES } from "../island/island-grass-render.js";
import { islandThemeSelectionForCourse } from "../island/kenney-recipes.js";
import { describeIslandLayer, describeWorldLayer } from "./descriptions.js";
import { getMedallionTriangles } from "./procedural-assets.js";

function parameterValue(description: ReturnType<typeof describeIslandLayer>, id: string) {
  return [
    ...description.terrain.parameters,
    ...description.dressing.parameters,
    ...description.lighting.parameters,
  ].find((parameter) => parameter.id === id);
}

function createTestBlueprint(lessonCount = 6) {
  return islandBlueprint({
    studyId: "inspector-test",
    courseId: "course",
    lessonCount,
    themeSelection: islandThemeSelectionForCourse("inspector-test", "course"),
  });
}

describe("map inspector descriptions", () => {
  it("reads the course grass density from the real grass module", () => {
    const blueprint = createTestBlueprint(3);
    const description = describeIslandLayer({ blueprint });
    const density = parameterValue(description, "grass-desktop-limit");

    expect(density?.value).toBe(ISLAND_GRASS_LIMITS.course.desktop);
    expect(density?.source.file).toBe("packages/world/src/island/island-grass.ts");
    expect(density?.source.export).toBe("ISLAND_GRASS_LIMITS.course.desktop");
  });

  it("shows the world projection's zero grass budget from the same constant", () => {
    const blueprint = createTestBlueprint(3);
    const description = describeWorldLayer({
      islands: [{ blueprint, targetRadius: 4 }],
    });
    const density = description.dressing.parameters.find(
      (parameter) => parameter.id === "grass-desktop-limit",
    );

    expect(density?.value).toBe(ISLAND_GRASS_LIMITS.world.desktop);
    expect(density?.source.export).toBe("ISLAND_GRASS_LIMITS.world.desktop");
  });
});

describe("H01: bushEmitter rendered exclusion and catalog retention", () => {
  it("excludes bushEmitter from rendered dressing assets while retaining it in catalog", () => {
    const blueprint = createTestBlueprint(6);
    const description = describeIslandLayer({ blueprint });

    // Rendered assets must never contain bushEmitter.glb
    const renderedBushEmitter = description.dressing.assets.find(
      (asset) => asset.assetId === "bushEmitter",
    );
    expect(renderedBushEmitter).toBeUndefined();

    // Catalog must retain bushEmitter because it is registered in elemental-serenity
    const catalogBushEmitter = description.dressing.catalog.find(
      (asset) => asset.assetId === "bushEmitter",
    );
    expect(catalogBushEmitter).toBeDefined();
    expect(catalogBushEmitter?.packId).toBe("elemental-serenity");
  });
});

describe("H02: Procedural assets and world layer LOD", () => {
  it("projects all five procedural asset rows into course dressing with truthful counts", () => {
    const blueprint = createTestBlueprint(6);
    const description = describeIslandLayer({
      blueprint,
      runtime: {
        grassInstances: 14200,
      },
    });

    const assets = description.dressing.assets;

    // 1. Grass blade
    const grass = assets.find((a) => a.key === "procedural/grass-blade");
    expect(grass).toBeDefined();
    expect(grass?.role).toBe("草");
    expect(grass?.triangles).toBe(ISLAND_GRASS_BLADE_TRIANGLES);
    expect(grass?.instances).toBe(14200);
    expect(grass?.projectionKind).toBe("procedural");
    expect(grass?.mutable).toBe(false);

    // 2. Tree crown lobes
    const treeCrown = assets.find((a) => a.key === "procedural/tree-crown");
    expect(treeCrown).toBeDefined();
    expect(treeCrown?.role).toBe("树冠");
    expect(treeCrown?.triangles).toBe(COURSE_TREE_CROWN_TRIANGLES_PER_LOBE);
    expect(treeCrown?.projectionKind).toBe("procedural");
    expect(treeCrown?.mutable).toBe(false);
    expect(treeCrown?.instances).toBe((treeCrown?.placementCount ?? 0) * 3);

    // 3. Bush crown lobes
    const bushCrown = assets.find((a) => a.key === "procedural/bush-crown");
    expect(bushCrown).toBeDefined();
    expect(bushCrown?.role).toBe("灌木");
    expect(bushCrown?.triangles).toBe(COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE);
    expect(bushCrown?.projectionKind).toBe("procedural");
    expect(bushCrown?.mutable).toBe(false);
    expect(bushCrown?.instances).toBe((bushCrown?.placementCount ?? 0) * 3);

    // 4. Campfire flame
    const flame = assets.find((a) => a.key === "procedural/campfire-flame");
    expect(flame).toBeDefined();
    expect(flame?.role).toBe("营火火焰");
    expect(flame?.triangles).toBe(CAMPFIRE_FLAME_TRIANGLES);
    expect(flame?.projectionKind).toBe("procedural");
    expect(flame?.mutable).toBe(false);

    // 5. Lesson waypoint medallion
    const medallion = assets.find((a) => a.key === "procedural/lesson-medallion");
    expect(medallion).toBeDefined();
    expect(medallion?.role).toBe("路标徽座");
    expect(medallion?.triangles).toBe(getMedallionTriangles());
    expect(medallion?.instances).toBe(blueprint.nodes.length);
    expect(medallion?.projectionKind).toBe("procedural");
    expect(medallion?.mutable).toBe(false);
  });

  it("enforces world LOD for all procedural assets in world layer", () => {
    const blueprint = createTestBlueprint(6);
    const worldDescription = describeWorldLayer({
      islands: [{ blueprint, targetRadius: 4 }],
    });

    const proceduralKeys = [
      "procedural/grass-blade",
      "procedural/tree-crown",
      "procedural/bush-crown",
      "procedural/campfire-flame",
      "procedural/lesson-medallion",
    ];

    for (const key of proceduralKeys) {
      const row = worldDescription.dressing.assets.find((a) => a.key === key);
      expect(row).toBeDefined();
      expect(row?.instances).toBe(0);
      expect(row?.placementCount).toBe(0);
    }
  });
});

describe("H03: Tree trunks truthful triangle handling and island budget", () => {
  it("marks treeTrunks triangles as null to prevent 2,028x multiplication and yields truthful budget", () => {
    const blueprint = createTestBlueprint(6);
    const triangleCounts = new Map([["elemental-serenity/treeTrunks", 2028]]);
    const description = describeIslandLayer({ blueprint, triangleCounts });

    const treeTrunks = description.dressing.assets.find((asset) => asset.assetId === "treeTrunks");
    if (treeTrunks) {
      // Must not use 2,028
      expect(treeTrunks.triangles).toBeNull();
      expect(treeTrunks.note).toContain("2,032");
      expect(treeTrunks.note).toContain("384");

      // Budget actualTriangles must be null rather than 2028 * instances
      expect(description.budget.actualTriangles).toBeNull();
      expect(description.budget.basis).toContain("未知值不记作零");
    }
  });
});

describe("H04: Bush technique lock and role immutability", () => {
  it("sets technique lock for bush to 'bush' and marks bush role as non-mutable", () => {
    const blueprint = createTestBlueprint(6);
    const description = describeIslandLayer({ blueprint });

    // Role picker check
    const bushRole = description.dressing.roles.find((role) => role.id === "bush");
    expect(bushRole).toBeDefined();
    expect(bushRole?.mutable).toBe(false);
    expect(bushRole?.currentKeys).toEqual([]);
    expect(bushRole?.note).toContain("自有程序化实体团块");

    // Procedural asset technique lock check
    const bushAsset = description.dressing.assets.find(
      (asset) => asset.key === "procedural/bush-crown",
    );
    expect(bushAsset).toBeDefined();
    expect(bushAsset?.techniqueLock).toBe("bush");
  });
});
