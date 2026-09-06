/**
 * Procedural asset rows for the island inspector:
 *
 * Tracks procedural geometry (grass, solid crown lobes, bush lobes, campfire flame,
 * and lesson waypoint medallion) with truthful source paths, shared triangle budgets,
 * placement counts, and draw projection instance counts.
 *
 * Enforces:
 * - Immutable rows (cannot replace procedural assets via GLB catalog dropdown).
 * - World LOD (no course crowns, bushes, flames, or medallions in world view).
 * - Truthful metrics (draw projection vs placement count distinguished).
 */
import {
  COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE,
  COURSE_CROWN_LOBES_PER_BUSH,
  COURSE_CROWN_LOBES_PER_TREE,
  COURSE_TREE_CROWN_TRIANGLES_PER_LOBE,
} from "../island/foliage-geometry.js";
import { CAMPFIRE_FLAME_TRIANGLES, filterLitCampPlacements } from "../island/island-campfire.js";
import { createMedallionGeometry, medallionTriangleCount } from "../grid/lesson-medallion.js";
import { ISLAND_TECHNIQUE_LOCK } from "../island/island-technique-lock.js";
import { ISLAND_GRASS_LIMITS } from "../island/island-grass.js";
import { ISLAND_GRASS_BLADE_TRIANGLES } from "../island/island-grass-render.js";
import type { IslandBlueprint } from "../island/island-blueprint.js";
import type { IslandDressingPlan } from "../island/island-dressing.js";
import type { InspectorAsset, InspectorRuntimeMetrics, InspectorSourceRef } from "./types.js";

function worldSource(file: string, exportName: string): InspectorSourceRef {
  return { file: `packages/world/src/${file}`, export: exportName };
}

let cachedMedallionTriangles: number | null = null;

export function getMedallionTriangles(): number {
  if (cachedMedallionTriangles === null) {
    const geom = createMedallionGeometry();
    cachedMedallionTriangles = medallionTriangleCount(geom);
    geom.dispose();
  }
  return cachedMedallionTriangles;
}

export interface ProceduralAssetOptions {
  readonly detail: "course" | "world";
  readonly blueprints: readonly IslandBlueprint[];
  readonly plans: readonly IslandDressingPlan[];
  readonly runtime?: InspectorRuntimeMetrics;
}

export function proceduralAssetRows({
  detail,
  blueprints,
  plans,
  runtime,
}: ProceduralAssetOptions): readonly InspectorAsset[] {
  let treePlacements = 0;
  let bushPlacements = 0;
  let litCampPlacements = 0;
  let totalRouteNodes = 0;

  for (const plan of plans) {
    for (const p of plan.placements) {
      if (p.packId === "elemental-serenity" && p.assetId === "treeTrunks") treePlacements += 1;
      if (p.packId === "elemental-serenity" && p.assetId === "bushEmitter") bushPlacements += 1;
    }
    litCampPlacements += filterLitCampPlacements(plan.placements).length;
  }

  for (const bp of blueprints) {
    totalRouteNodes += bp.nodes?.length ?? bp.geometryNodes?.length ?? 0;
  }

  const isWorld = detail === "world";

  // 1. Grass blade
  const grassLimit = ISLAND_GRASS_LIMITS[detail].desktop;
  const grassRow: InspectorAsset = {
    key: "procedural/grass-blade",
    role: "草",
    assetId: "generated-three-vertex-blade",
    name: "generated three-vertex blade",
    pack: "自有程序化",
    runtimePath: null,
    sourcePath: "packages/world/src/island/island-grass-render.tsx",
    bytes: null,
    triangles: ISLAND_GRASS_BLADE_TRIANGLES,
    instances: isWorld ? 0 : (runtime?.grassInstances ?? null),
    placementCount: isWorld ? 0 : null,
    projectionKind: "procedural",
    bytesSource: null,
    trianglesSource: worldSource("island/island-grass-render.tsx", "ISLAND_GRASS_BLADE_TRIANGLES"),
    instancesSource: worldSource("island/island-grass.ts", `ISLAND_GRASS_LIMITS.${detail}.desktop`),
    techniqueLock: "grass",
    technique: ISLAND_TECHNIQUE_LOCK.grass.technique,
    techniqueSource: worldSource("island/island-technique-lock.ts", "ISLAND_TECHNIQUE_LOCK.grass"),
    mutable: false,
    note: isWorld
      ? "世界投影按 ADR-0009 不画草；地形色承担远景信息。"
      : `当前相机画面加载后显示实际实例数；上限来自 ${grassLimit.toLocaleString()}。`,
  };

  // 2. Tree crown lobes
  const treeCrownRow: InspectorAsset = {
    key: "procedural/tree-crown",
    role: "树冠",
    assetId: "procedural-tree-crown",
    name: "tree crown lobes (icosahedron d1)",
    pack: "自有程序化",
    runtimePath: null,
    sourcePath: "packages/world/src/island/foliage-geometry.ts",
    bytes: null,
    triangles: COURSE_TREE_CROWN_TRIANGLES_PER_LOBE,
    instances: isWorld ? 0 : treePlacements * COURSE_CROWN_LOBES_PER_TREE,
    placementCount: isWorld ? 0 : treePlacements,
    projectionKind: "procedural",
    bytesSource: null,
    trianglesSource: worldSource(
      "island/foliage-geometry.ts",
      "COURSE_TREE_CROWN_TRIANGLES_PER_LOBE",
    ),
    instancesSource: worldSource("island/foliage-geometry.ts", "treeCrownLobes() (3 lobes/tree)"),
    techniqueLock: "tree",
    technique: ISLAND_TECHNIQUE_LOCK.tree.technique,
    techniqueSource: worldSource("island/island-technique-lock.ts", "ISLAND_TECHNIQUE_LOCK.tree"),
    mutable: false,
    note: isWorld
      ? "世界投影保留单树干剪影与低多边形圆锥，不加载课程冠团。"
      : `共 ${treePlacements} 棵树，每棵 3 个冠团（每团 80 三角，绘制投影共 ${treePlacements * 3} 实例 / ${treePlacements * 240} 三角）。`,
  };

  // 3. Bush crown lobes
  const bushCrownRow: InspectorAsset = {
    key: "procedural/bush-crown",
    role: "灌木",
    assetId: "procedural-bush-crown",
    name: "bush crown lobes (icosahedron d0)",
    pack: "自有程序化",
    runtimePath: null,
    sourcePath: "packages/world/src/island/foliage-geometry.ts",
    bytes: null,
    triangles: COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE,
    instances: isWorld ? 0 : bushPlacements * COURSE_CROWN_LOBES_PER_BUSH,
    placementCount: isWorld ? 0 : bushPlacements,
    projectionKind: "procedural",
    bytesSource: null,
    trianglesSource: worldSource(
      "island/foliage-geometry.ts",
      "COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE",
    ),
    instancesSource: worldSource("island/foliage-geometry.ts", "bushCrownLobes() (3 lobes/bush)"),
    techniqueLock: "bush",
    technique: ISLAND_TECHNIQUE_LOCK.bush.technique,
    techniqueSource: worldSource("island/island-technique-lock.ts", "ISLAND_TECHNIQUE_LOCK.bush"),
    mutable: false,
    note: isWorld
      ? "世界投影不绘制灌木 (world = 0)。"
      : `共 ${bushPlacements} 丛灌木，每丛 3 个扁平团块（每团 20 三角，绘制投影共 ${bushPlacements * 3} 实例 / ${bushPlacements * 60} 三角）；渲染器不获取 bushEmitter.glb。`,
  };

  // 4. Campfire flame
  const flameRow: InspectorAsset = {
    key: "procedural/campfire-flame",
    role: "营火火焰",
    assetId: "procedural-campfire-flame",
    name: "campfire flame & ember",
    pack: "自有程序化",
    runtimePath: null,
    sourcePath: "packages/world/src/island/island-campfire.ts",
    bytes: null,
    triangles: CAMPFIRE_FLAME_TRIANGLES,
    instances: isWorld ? 0 : litCampPlacements,
    placementCount: isWorld ? 0 : litCampPlacements,
    projectionKind: "procedural",
    bytesSource: null,
    trianglesSource: worldSource("island/island-campfire.ts", "CAMPFIRE_FLAME_TRIANGLES"),
    instancesSource: worldSource("island/island-campfire.ts", "filterLitCampPlacements()"),
    techniqueLock: "landmark",
    technique:
      '共享 22 三角低多边形发光网格；仅对 state === "lit" 的 camp 营火绘制，无点光源、无阴影、支持减动效。',
    techniqueSource: worldSource("island/island-campfire.ts", "createCampfireFlameGeometry()"),
    mutable: false,
    note: isWorld
      ? "世界投影不渲染近景营火火焰。"
      : litCampPlacements > 0
        ? `共 ${litCampPlacements} 处点燃营地，绘制 22 三角低多边形火焰网格。`
        : "当前岛屿营火处于 idle 状态或未放置营火。",
  };

  // 5. Lesson waypoint medallion
  const medallionRow: InspectorAsset = {
    key: "procedural/lesson-medallion",
    role: "路标徽座",
    assetId: "procedural-lesson-medallion",
    name: "lesson waypoint medallion body",
    pack: "自有程序化",
    runtimePath: null,
    sourcePath: "packages/world/src/grid/lesson-medallion.ts",
    bytes: null,
    triangles: getMedallionTriangles(),
    instances: isWorld ? 0 : (runtime?.projected?.medallion?.instances ?? totalRouteNodes),
    totalTriangles: isWorld
      ? 0
      : runtime?.projected
        ? (runtime.projected.medallion?.triangles ?? 0)
        : null,
    placementCount: isWorld ? 0 : totalRouteNodes,
    projectionKind: "procedural",
    bytesSource: null,
    trianglesSource: worldSource("grid/lesson-medallion.ts", "createMedallionGeometry()"),
    instancesSource: worldSource("island/island-blueprint.ts", "blueprint.nodes.length"),
    techniqueLock: "lessonNode",
    technique:
      ISLAND_TECHNIQUE_LOCK.lessonNode?.technique ??
      "圆润浅色学习徽座与已有单元刻纹，贴地姿态随法线对齐。",
    techniqueSource: worldSource(
      "island/island-technique-lock.ts",
      "ISLAND_TECHNIQUE_LOCK.lessonNode",
    ),
    mutable: false,
    note: isWorld
      ? "世界投影不渲染小节路标徽座。"
      : `168 三角只计刚性徽座体；${totalRouteNodes} 个课时的刻纹、贴地底沿和异常地形浅嵌盘分别列账。生成前实例数为课时上界，载入后读取实际网格。`,
  };

  const dependentRows = [
    {
      id: "sigil",
      key: "lesson-sigil",
      name: "单元刻纹（实际 48 / 50 三角批次）",
      file: "island/unit-sigil.ts",
      entry: "unitRingGeometry",
      triangles: null,
    },
    {
      id: "footing",
      key: "lesson-footing",
      name: "贴地石质底沿（合并网格）",
      file: "grid/lesson-medallion.ts",
      entry: "buildMedallionFooting",
      triangles: null,
    },
    {
      id: "inlay",
      key: "lesson-inlay",
      name: "异常地形浅嵌徽章（含刻纹）",
      file: "grid/medallion-grounding.ts",
      entry: "buildMedallionInlays",
      triangles: null,
    },
    {
      id: "worldTreeCrown",
      key: "world-tree-crown",
      name: "世界树冠剪影（六边锥）",
      file: "island/island-foliage-render.tsx",
      entry: "TreeSilhouette",
      triangles: 12,
    },
  ] as const;
  const extras: InspectorAsset[] = dependentRows.map((row) => {
    const enabled = row.id === "worldTreeCrown" ? isWorld : !isWorld;
    const measured = runtime?.projected?.[row.id];
    const total = !enabled
      ? 0
      : runtime?.projected
        ? (measured?.triangles ?? 0)
        : row.id === "worldTreeCrown"
          ? treePlacements * 12
          : null;
    return {
      key: `procedural/${row.key}`,
      role: row.id === "worldTreeCrown" ? "远景树冠" : "路标接地与刻纹",
      assetId: row.key,
      name: row.name,
      pack: "自有程序化",
      runtimePath: null,
      sourcePath: `packages/world/src/${row.file}`,
      bytes: null,
      triangles: row.triangles,
      totalTriangles: total,
      instances: !enabled
        ? 0
        : (measured?.instances ?? (row.id === "worldTreeCrown" ? treePlacements : null)),
      projectionKind: "procedural",
      bytesSource: null,
      trianglesSource: worldSource(row.file, row.entry),
      instancesSource: worldSource("inspector/projected-metrics.ts", "measureProjectedGeometry"),
      techniqueLock: row.id === "worldTreeCrown" ? "tree" : "lessonNode",
      technique:
        row.id === "worldTreeCrown"
          ? "每棵 12 三角的远景剪影，不加载课程冠团。"
          : "读取实际已提交的共享几何；不以刚性徽座三角数代替刻纹或贴地网格。",
      techniqueSource: worldSource(row.file, row.entry),
      mutable: false,
      note: !enabled
        ? "这一层不绘制。"
        : total === null
          ? "待当前场景网格就绪；未知不记作零。"
          : `当前投影共 ${total} 三角；不含阴影重复绘制或后处理。`,
    };
  });
  return [grassRow, treeCrownRow, bushCrownRow, flameRow, medallionRow, ...extras];
}
