import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { islandBlueprint } from "../island/island-blueprint.js";
import {
  COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE,
  COURSE_TREE_CROWN_TRIANGLES_PER_LOBE,
} from "../island/foliage-geometry.js";
import { CAMPFIRE_FLAME_TRIANGLES } from "../island/island-campfire.js";
import { ISLAND_GRASS_LIMITS } from "../island/island-grass.js";
import { ISLAND_GRASS_BLADE_TRIANGLES } from "../island/island-grass-render.js";
import { islandThemeSelectionForCourse } from "../island/kenney-recipes.js";
import * as dressingModule from "../island/island-dressing.js";
import { describeIslandLayer, describePlanetLayer, describeWorldLayer } from "./descriptions.js";
import { getMedallionTriangles } from "./procedural-assets.js";
import { REMOTE_ISLAND_TERRAIN_TRIANGLES } from "../island/remote-props.js";

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
    // A grass-only runtime sample does not certify the medallion batch.
    expect(medallion?.instances).toBeNull();
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
    expect(
      worldDescription.dressing.assets.find((a) => a.key === "procedural/tree-crown"),
    ).toBeUndefined();
  });
});

describe("H03: Tree trunks truthful triangle handling and island budget", () => {
  it("marks treeTrunks triangles as null to prevent 2,028x multiplication and yields truthful budget", () => {
    const blueprint = createTestBlueprint(6);
    const triangleCounts = new Map([["elemental-serenity/treeTrunks", 2028]]);
    const description = describeIslandLayer({ blueprint, triangleCounts });

    const treeTrunks = description.dressing.assets.find((asset) => asset.assetId === "treeTrunks");
    expect(treeTrunks, "the fixture must actually contain the donor trunk row").toBeDefined();
    // The source file contains all variants; it is never a single-tree cost.
    expect(treeTrunks!.triangles).toBeNull();
    expect(treeTrunks!.note).toContain("2,032");
    expect(treeTrunks!.note).toContain("384");

    expect(description.budget.actualTriangles).toBeNull();
    expect(description.budget.basis).toContain("未知值不记作零");
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

describe("H08: Distant view descriptions for continuous archipelago and planet layers", () => {
  it("never calls planIslandDressing in world or planet distant view descriptions", () => {
    const spy = vi.spyOn(dressingModule, "planIslandDressing");
    try {
      const bp1 = createTestBlueprint(6);
      const bp2 = createTestBlueprint(12);
      const worldDesc = describeWorldLayer({
        islands: [
          {
            id: "inspector-test/course",
            blueprint: bp1,
            targetRadius: 4,
            position: new THREE.Vector3(0, 0, 0),
          },
          {
            id: "inspector-test/course-2",
            blueprint: bp2,
            targetRadius: 5,
            position: new THREE.Vector3(18, 0, -7),
          },
        ],
      });
      const planetDesc = describePlanetLayer({
        studies: [
          { id: "s1", title: "Study 1", courseCount: 2, lessonCount: 10 },
          { id: "s2", title: "Study 2", courseCount: 3, lessonCount: 15 },
        ],
      });
      expect(spy).not.toHaveBeenCalled();

      // No course dressing GLBs
      const nonProcedural = worldDesc.dressing.assets.filter(
        (a) => !a.key.startsWith("procedural/"),
      );
      expect(nonProcedural).toHaveLength(0);

      // Course-only procedural assets (grass, course crowns, bushes, flames, medallions) all have 0 instances
      const courseOnlyAssets = worldDesc.dressing.assets.filter(
        (a) => a.key !== "procedural/world-landmark" && a.key !== "procedural/world-tree-crown",
      );
      for (const asset of courseOnlyAssets) {
        expect(asset.instances).toBe(0);
        expect(asset.placementCount).toBe(0);
      }

      // Remote props assets have non-zero instances matching the 2 test islands
      const landmarkAsset = worldDesc.dressing.assets.find(
        (a) => a.key === "procedural/world-landmark",
      );
      const treeAsset = worldDesc.dressing.assets.find(
        (a) => a.key === "procedural/world-tree-crown",
      );
      expect(landmarkAsset?.instances).toBe(2);
      expect(treeAsset?.instances).toBeGreaterThanOrEqual(4);
      expect(treeAsset?.instances).toBeLessThanOrEqual(8);
      expect(
        worldDesc.dressing.assets.filter((asset) => asset.key === "procedural/world-tree-crown"),
      ).toHaveLength(1);
      expect(treeAsset?.sourcePath).toBe("packages/world/src/island/remote-props.ts");
      expect(treeAsset?.trianglesSource?.file).toBe("packages/world/src/island/remote-props.ts");
      expect(
        new Set(landmarkAsset?.uses?.map((use) => `${use.position[0]}:${use.position[2]}`)).size,
      ).toBe(2);
      expect(treeAsset?.uses?.some((use) => use.position[0] !== 0 || use.position[2] !== 0)).toBe(
        true,
      );

      expect(
        planetDesc.dressing.assets.some((asset) => asset.key === "procedural/world-tree-crown"),
      ).toBe(false);
      expect(
        planetDesc.dressing.assets.some((asset) => asset.key === "procedural/world-landmark"),
      ).toBe(false);
      expect(
        planetDesc.terrain.parameters.find((parameter) => parameter.id === "domain-count")?.value,
      ).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("does not generate a ghost island when islands list is empty", () => {
    const description = describeWorldLayer({ islands: [] });
    const count = description.terrain.parameters.find((p) => p.id === "island-count");
    expect(count?.value).toBe(0);
    expect(description.terrain.geometryTriangles).toBe(0);
    expect(description.dressing.assets).toHaveLength(0);
    expect(description.budget.triangleBudget).toBe(0);
  });

  it("reflects actual visible runtime mesh triangles in world and planet layers", () => {
    const bp = createTestBlueprint(6);
    const worldDesc = describeWorldLayer({
      islands: [{ blueprint: bp, targetRadius: 4 }],
      runtime: {
        projected: {
          terrain: {
            instances: 1,
            triangles: REMOTE_ISLAND_TERRAIN_TRIANGLES,
            meshes: 1,
          },
        },
      },
    });
    expect(worldDesc.terrain.geometryTriangles).toBe(REMOTE_ISLAND_TERRAIN_TRIANGLES);
    expect(worldDesc.budget.actualTriangles).toBeNull();
    expect(worldDesc.budget.breakdown[0]?.triangles).toBe(REMOTE_ISLAND_TERRAIN_TRIANGLES);
    expect(worldDesc.budget.breakdown[1]?.triangles).toBeNull();
    expect(
      worldDesc.dressing.assets.find((asset) => asset.assetId === "world-landmark")?.totalTriangles,
    ).toBeNull();

    const planetDesc = describePlanetLayer({
      studies: [{ id: "s1", title: "Study 1", courseCount: 2, lessonCount: 10 }],
      runtime: {
        projected: {
          domainGlobe: { instances: 1, triangles: 3968, meshes: 1 },
          atmosphericIslands: { instances: 1, triangles: 1280, meshes: 1 },
          planetFocus: { instances: 1, triangles: 96, meshes: 1 },
        },
      },
    });
    expect(planetDesc.terrain.geometryTriangles).toBe(3968 + 1280);
    expect(planetDesc.budget.actualTriangles).toBeNull();
    expect(
      planetDesc.dressing.assets.find((asset) => asset.assetId === "domainClouds")?.totalTriangles,
    ).toBeNull();
  });

  it("describes domain globes with course representative islands and treats unknown actual triangles as null", () => {
    const planetDesc = describePlanetLayer({
      studies: [{ id: "s1", title: "Study 1", courseCount: 2, lessonCount: 10 }],
    });
    expect(planetDesc.terrain.generator).toContain("createDomainGlobeGeometry");
    expect(planetDesc.terrain.generator).toContain("buildAtmosphericIslands");
    expect(planetDesc.terrain.generator).not.toContain("WorldHexField");
    expect(planetDesc.terrain.generator).not.toContain("hex prism");
    expect(planetDesc.terrain.parameters.some((p) => p.id === "study-cell-floor")).toBe(false);
    expect(planetDesc.terrain.parameters.some((p) => p.id === "study-cell-ceiling")).toBe(false);

    // Unknown value is null, not 0
    expect(planetDesc.budget.actualTriangles).toBeNull();
  });

  it("uses actual cloud and atmosphere projections without substituting their ceilings", () => {
    const description = describePlanetLayer({
      studies: [{ id: "s1", courseCount: 2, domain: { id: "programming", title: "编程" } }],
      runtime: {
        projected: {
          domainGlobe: { instances: 1, triangles: 3968, meshes: 1 },
          domainClouds: { instances: 1, triangles: 4080, meshes: 1 },
          domainAtmosphere: { instances: 1, triangles: 3968, meshes: 1 },
          domainRegionTargets: { instances: 1, triangles: 80, meshes: 1 },
        },
        knownAbsent: ["atmosphericIslands", "planetFocus"],
      },
    });
    expect(description.budget.actualTriangles).toBe(3968 * 2 + 4080 + 80);
    const cloud = description.dressing.assets.find((asset) => asset.assetId === "domainClouds");
    expect(cloud?.totalTriangles).toBe(4080);
    expect(
      description.dressing.assets.find((asset) => asset.assetId === "planetFocus")?.totalTriangles,
    ).toBe(0);
    expect(
      description.terrain.parameters.find((parameter) => parameter.id === "representative-count")
        ?.value,
    ).toBe(2);
    expect(description.dressing.note).toContain("编程");
  });

  it("does not invent remote props when production placement data is incomplete", () => {
    const first = createTestBlueprint(6);
    const assertUnknown = (description: ReturnType<typeof describeWorldLayer>) => {
      const tree = description.dressing.assets.find(
        (asset) => asset.key === "procedural/world-tree-crown",
      );
      expect(tree?.instances).toBeNull();
      expect(tree?.placementCount).toBeNull();
      expect(tree?.totalTriangles).toBeNull();
      expect(tree?.uses).toEqual([]);
      expect(description.dressing.note).toContain("不使用原点");
    };

    assertUnknown(
      describeWorldLayer({
        islands: [{ id: "inspector-test/course", blueprint: first, targetRadius: 4 }],
      }),
    );
    assertUnknown(
      describeWorldLayer({
        islands: [
          {
            blueprint: first,
            position: new THREE.Vector3(18, 0, -7),
            targetRadius: 4,
          },
        ],
      }),
    );
  });

  it("preserves supplied Maps positions in remote prop occupancy", () => {
    const first = createTestBlueprint(6);
    const second = islandBlueprint({
      studyId: "inspector-test",
      courseId: "course-2",
      lessonCount: 12,
      themeSelection: islandThemeSelectionForCourse("inspector-test", "course-2"),
    });
    const description = describeWorldLayer({
      islands: [
        {
          id: "inspector-test/course",
          blueprint: first,
          targetRadius: 4,
          position: new THREE.Vector3(0, 0, 0),
        },
        {
          id: "inspector-test/course-2",
          blueprint: second,
          targetRadius: 5,
          position: new THREE.Vector3(18, 2, -7),
        },
      ],
    });
    const landmark = description.dressing.assets.find(
      (asset) => asset.key === "procedural/world-landmark",
    );
    expect(landmark?.instances).toBe(2);
    expect(landmark?.uses?.map((use) => use.group)).toEqual([
      "inspector-test/course",
      "inspector-test/course-2",
    ]);
    expect(landmark?.uses?.some((use) => use.position[0] > 10 && use.position[2] < 0)).toBe(true);
  });

  it("keeps missing representative course metadata unknown while honoring empty declared domains", () => {
    const description = describePlanetLayer({
      studies: [{ id: "s1", title: "Study 1" }],
      domainCatalog: [{ id: "empty", title: "Empty domain" }],
    });
    expect(
      description.terrain.parameters.find((parameter) => parameter.id === "domain-count")?.value,
    ).toBe(2);
    expect(
      description.terrain.parameters.find((parameter) => parameter.id === "representative-count")
        ?.value,
    ).toBe("未知");
    const representatives = description.dressing.assets.find(
      (asset) => asset.assetId === "atmosphericIslands",
    );
    expect(representatives?.instances).toBeNull();
    expect(representatives?.totalTriangles).toBeNull();
    expect(description.dressing.note).toContain("Empty domain");
    expect(description.budget.actualTriangles).toBeNull();
  });

  it("treats an actually empty planet as zero, without using zero for a partial sample", () => {
    const empty = describePlanetLayer({ studies: [] });
    expect(empty.budget.actualTriangles).toBe(0);
    expect(empty.terrain.geometryTriangles).toBe(0);

    const partial = describePlanetLayer({
      studies: [{ id: "s1", title: "Study 1", courseCount: 0 }],
      runtime: {
        projected: {
          domainGlobe: { instances: 1, triangles: 3968, meshes: 1 },
          domainClouds: { instances: 1, triangles: 4000, meshes: 1 },
          domainAtmosphere: { instances: 1, triangles: 3968, meshes: 1 },
          domainRegionTargets: { instances: 1, triangles: 80, meshes: 1 },
        },
      },
    });
    expect(
      partial.dressing.assets.find((asset) => asset.assetId === "planetFocus")?.instances,
    ).toBe(null);
    expect(partial.budget.actualTriangles).toBeNull();
  });
});
