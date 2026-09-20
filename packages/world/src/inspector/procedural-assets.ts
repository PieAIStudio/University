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
  COURSE_BUSH_CROWN_TRIANGLES,
  COURSE_CROWN_LOBES_PER_BUSH,
} from "../island/foliage-geometry.js";
import { courseTreeIsFir, courseLandscapePlan } from "../island/course-landscape-plan.js";
import { COURSE_SCENIC_TREE_TRIANGLES } from "../island/miniature-assets.js";
import { CAMPFIRE_FLAME_TRIANGLES, filterLitCampPlacements } from "../island/island-campfire.js";
import { createMedallionGeometry, medallionTriangleCount } from "../grid/lesson-medallion.js";
import { ISLAND_TECHNIQUE_LOCK } from "../island/island-technique-lock.js";
import { ISLAND_GRASS_LIMITS } from "../island/island-grass.js";
import { ISLAND_GRASS_BLADE_TRIANGLES } from "../island/island-grass-render.js";
import type { IslandBlueprint } from "../island/island-blueprint.js";
import type { IslandDressingPlan } from "../island/island-dressing.js";
import type { InspectorAsset, InspectorRuntimeMetrics, InspectorSourceRef } from "./types.js";
import { projectedMetric } from "./projected-metrics.js";

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
  let treeTriangles = 0;
  let bushPlacements = 0;
  let litCampPlacements = 0;
  let totalRouteNodes = 0;

  for (const plan of plans) {
    for (const p of plan.placements) {
      if (p.packId === "elemental-serenity" && p.assetId === "treeTrunks") {
        treePlacements += 1;
        treeTriangles +=
          COURSE_SCENIC_TREE_TRIANGLES[
            courseTreeIsFir(p.foliageShapeSeed ?? p.id, p.x, p.z) ? "fir" : "broadleaf"
          ];
      }
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

  // 2. Complete trees. Retired donor-trunk/crown rows must not double count.
  const treeCrownRow: InspectorAsset = {
    key: "procedural/course-trees",
    role: "完整树木",
    assetId: "procedural-course-trees",
    name: "shared complete fir and broadleaf trees",
    pack: "自有程序化",
    runtimePath: null,
    sourcePath: "packages/world/src/island/miniature-assets.ts",
    bytes: null,
    triangles: null,
    totalTriangles: treeTriangles,
    instances: treePlacements,
    placementCount: treePlacements,
    projectionKind: "procedural",
    bytesSource: null,
    trianglesSource: worldSource("island/miniature-assets.ts", "COURSE_SCENIC_TREE_TRIANGLES"),
    instancesSource: worldSource("island/course-trees.tsx", "CourseTreeField (one instance/tree)"),
    techniqueLock: "tree",
    technique: ISLAND_TECHNIQUE_LOCK.tree.technique,
    techniqueSource: worldSource("island/island-technique-lock.ts", "ISLAND_TECHNIQUE_LOCK.tree"),
    mutable: false,
    note: `共 ${treePlacements} 棵树，针叶${COURSE_SCENIC_TREE_TRIANGLES.fir}／阔叶${COURSE_SCENIC_TREE_TRIANGLES.broadleaf}三角，合计${treeTriangles}三角；树干已包含，不再另计原始GLB。`,
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
      : `共 ${bushPlacements} 丛灌木，每丛 3 个圆润团块（每团 ${COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE} 三角，绘制投影共 ${bushPlacements * 3} 实例 / ${bushPlacements * COURSE_BUSH_CROWN_TRIANGLES} 三角）；渲染器不获取 bushEmitter.glb。`,
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
  const medallionMetric = projectedMetric(runtime, "medallion");
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
    instances: isWorld ? 0 : runtime ? (medallionMetric?.instances ?? null) : totalRouteNodes,
    totalTriangles: isWorld ? 0 : runtime ? (medallionMetric?.triangles ?? null) : null,
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
  ] as const;
  const extras: InspectorAsset[] = dependentRows.map((row) => {
    const enabled = !isWorld;
    const measured = projectedMetric(runtime, row.id);
    const total = !enabled ? 0 : runtime ? (measured?.triangles ?? null) : null;
    return {
      key: `procedural/${row.key}`,
      role: "路标接地与刻纹",
      assetId: row.key,
      name: row.name,
      pack: "自有程序化",
      runtimePath: null,
      sourcePath: `packages/world/src/${row.file}`,
      bytes: null,
      triangles: row.triangles,
      totalTriangles: total,
      instances: !enabled ? 0 : (measured?.instances ?? null),
      placementCount: !enabled ? 0 : (measured?.instances ?? null),
      projectionKind: "procedural",
      bytesSource: null,
      trianglesSource: worldSource(row.file, row.entry),
      instancesSource: worldSource("inspector/projected-metrics.ts", "measureProjectedGeometry"),
      techniqueLock: "lessonNode",
      technique: "读取实际已提交的共享几何；不以刚性徽座三角数代替刻纹或贴地网格。",
      techniqueSource: worldSource(row.file, row.entry),
      mutable: false,
      note: !enabled
        ? "这一层不绘制。"
        : total === null
          ? "待当前场景网格就绪；未知不记作零。"
          : `当前投影共 ${total} 三角；不含阴影重复绘制或后处理。`,
    };
  });
  const landscapePlacements = isWorld
    ? 0
    : blueprints.reduce((sum, bp, i) => {
        const dressing = plans[i];
        if (!dressing) return sum;
        const plan = courseLandscapePlan(bp, dressing);
        return (
          sum +
          plan.outcrops.length +
          plan.flora.length +
          (plan.borders?.length ?? 0) +
          (plan.stones?.length ?? 0) +
          (plan.stalls?.length ?? 0) +
          (plan.canopy?.length ?? 0) +
          (plan.academies?.length ?? 0) +
          Number(plan.spring !== null)
        );
      }, 0);
  const landscapeMetric = projectedMetric(runtime, "courseLandscape");
  const landscapeRow: InspectorAsset = {
    key: "procedural/course-landscape",
    role: "岩台与林缘",
    assetId: "course-landscape",
    name: "rock shoulders, grounded boulders, garden edges, flora and coastal spring",
    pack: "自有程序化 + Kenney CC0 派生",
    runtimePath: null,
    sourcePath: "packages/world/src/island/course-landscape-geometry.ts",
    bytes: null,
    triangles: null,
    totalTriangles: landscapeMetric?.triangles ?? null,
    instances: landscapeMetric?.instances ?? null,
    placementCount: landscapePlacements,
    projectionKind: "procedural",
    bytesSource: null,
    trianglesSource: worldSource("inspector/projected-metrics.ts", "measureProjectedGeometry"),
    instancesSource: worldSource("island/course-landscape-plan.ts", "courseLandscapePlan"),
    techniqueLock: "landmark",
    technique:
      "同一占地计划；三块 Kenney 派生闭合石体组成196面岩台，林缘加入24面阔叶植物；岩台、花草和水景分别合批。",
    techniqueSource: worldSource("island/course-landscape-render.tsx", "CourseLandscape"),
    mutable: false,
    note: "三角形取当前绘制几何；环境薄石已由共用圆石替换，不重复计退役GLB。庭院有真实场所与开放入口，不是额外课程、道路或可点击关卡；未知不记零。",
  };
  const cliffMetric = projectedMetric(runtime, "cliffGarden");
  const cliffGardenRow: InspectorAsset = {
    ...landscapeRow,
    key: "procedural/cliff-garden",
    role: "岩缝植物",
    assetId: "cliff-garden",
    name: "plants supported by actual mineral bevel triangles",
    sourcePath: "packages/world/src/island/kenney-rock-shapes.json",
    placementCount: null,
    totalTriangles: cliffMetric?.triangles ?? null,
    instances: cliffMetric?.instances ?? null,
    instancesSource: worldSource("inspector/projected-metrics.ts", "measureProjectedGeometry"),
    technique:
      "读取实际岩肩面，以三角形内切圆放置完整根部；最多12簇、288面、一个合批，空间不够就不放。",
    techniqueSource: worldSource("island/cliff-garden.ts", "buildCliffGarden"),
    note: "资源来自已记录哈希的 Kenney Nature Kit CC0；数值为当前可见几何，不把整棵树或天空图案当作植物证据。",
  };
  return isWorld
    ? [grassRow, bushCrownRow, flameRow, medallionRow, ...extras]
    : [
        grassRow,
        treeCrownRow,
        bushCrownRow,
        flameRow,
        medallionRow,
        landscapeRow,
        cliffGardenRow,
        ...extras,
      ];
}
