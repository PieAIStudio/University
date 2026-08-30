import * as THREE from "three";

import {
  ISLAND_BLUEPRINT_LAYOUT_REVISION,
  ISLAND_BLUEPRINT_MIN_CENTERLINE_SPACING,
  ISLAND_BLUEPRINT_MIN_NODE_SPACING,
  ISLAND_ROUTE_SHORE_BAND,
  BASE_PLATEAU_HEIGHT,
  MAX_HEIGHT_RATIO,
  PATCH_GAIN,
  RELIEF_AMPLITUDE_RATIO,
  TERRACE_STEP_RATIO,
  islandBlueprint,
  type IslandBlueprint,
} from "../island/island-blueprint.js";
import {
  buildIslandGeometry,
  ISLAND_GEOMETRY_PALETTE,
  type IslandGeometryDetail,
} from "../island/island-geometry.js";
import {
  ISLAND_DECORATION_TRIANGLE_CEILING,
  ISLAND_LANDMARK_TRIANGLE_CEILING,
  ISLAND_TREE_TRIANGLE_CEILING,
  ISLAND_TECHNIQUE_LOCK,
  type IslandTechniqueEntry,
} from "../island/island-technique-lock.js";
import {
  ISLAND_GRASS_BLADE_DENSITY_MULTIPLIER,
  ISLAND_GRASS_LIMITS,
  ISLAND_GRASS_LOD_PROFILES,
  ISLAND_GRASS_LOD_THRESHOLDS,
  ISLAND_GRASS_TOP_MAX_RADIAL,
} from "../island/island-grass.js";
import { ISLAND_GRASS_BLADE_TRIANGLES } from "../island/island-grass-render.js";
import {
  islandRuntimeAssets,
  resolveIslandRuntimeAssetFromRecipe,
  type IslandRuntimeAsset,
} from "../island/island-asset-registry.js";
import { assetKey } from "./triangle-count.js";
import {
  planIslandDressing,
  type IslandDressingKind,
  type IslandDressingPlan,
} from "../island/island-dressing.js";
import {
  DEFAULT_ISLAND_SURFACE_STYLE,
  ISLAND_SURFACE_STYLE_PRESETS,
  resolveIslandSurfaceStyle,
} from "../island/island-surface-style.js";
import { islandThemeSelectionForCourse } from "../island/kenney-recipes.js";
import { skyStopsForStudy, WORLD_SKY_CONTRACT } from "../Maps.js";
import { worldGridTargetForLessons } from "../grid/course-grid.js";
import { WORLD_SUN, worldKeyToFillRatio, worldShadowFrustum } from "../sky/sun.js";
import { PLANET_CAMERA_POLAR, PLANET_CLUSTER_LAYOUT_CONTRACT } from "../planet/placement.js";
import { PLANET_ATMOSPHERE } from "../planet/PlanetScene.js";

import type {
  InspectorAsset,
  InspectorCatalogAsset,
  InspectorColorStop,
  InspectorLayerDescription,
  InspectorParameter,
  InspectorRoleChoice,
  InspectorRuntimeMetrics,
  InspectorSourceRef,
  InspectorTechniqueLockId,
  TriangleCountMapLike,
} from "./types.js";

export interface WorldLayerIsland {
  readonly blueprint: IslandBlueprint;
  readonly targetRadius?: number;
}

export interface DescribePlanetLayerOptions {
  readonly studyIds: readonly string[];
  readonly courseCount?: number;
}

export interface DescribeWorldLayerOptions {
  readonly islands: readonly WorldLayerIsland[];
  readonly skyStudyId?: string | null;
  readonly runtime?: InspectorRuntimeMetrics;
  readonly triangleCounts?: TriangleCountMapLike;
}

export interface DescribeIslandLayerOptions {
  readonly blueprint: IslandBlueprint;
  readonly skyStudyId?: string | null;
  readonly runtime?: InspectorRuntimeMetrics;
  readonly triangleCounts?: TriangleCountMapLike;
}

const ROLE_LABELS: Readonly<Record<IslandDressingKind, string>> = {
  tree: "树",
  bush: "灌木",
  rock: "石头",
  landmark: "地标",
  prop: "道具",
};

const PACK_LABELS: Readonly<Record<string, string>> = {
  "nature-kit": "kenney nature-kit",
  "fantasy-town-kit": "kenney fantasy-town",
  "elemental-serenity": "elemental-serenity",
};

const LOCK_FOR_KIND: Readonly<Record<IslandDressingKind, InspectorTechniqueLockId>> = {
  tree: "tree",
  bush: "decoration",
  rock: "decoration",
  landmark: "landmark",
  prop: "decoration",
};

function worldSource(file: string, exportName: string): InspectorSourceRef {
  return { file: `packages/world/src/${file}`, export: exportName };
}

function projectSource(file: string, exportName: string): InspectorSourceRef {
  return { file, export: exportName };
}

function hex(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

function assetName(assetId: string): string {
  return assetId.replace(/[-_]/gu, " ");
}

function packLabel(pack: string): string {
  return PACK_LABELS[pack] ?? pack;
}

function parameter(
  id: string,
  label: string,
  value: number | string,
  source: InspectorSourceRef,
  options: Partial<Pick<InspectorParameter, "unit" | "mutable" | "previewKey" | "note">> = {},
): InspectorParameter {
  return { id, label, value, source, mutable: options.mutable ?? false, ...options };
}

function colorStop(
  id: string,
  label: string,
  value: number,
  source: InspectorSourceRef,
): InspectorColorStop {
  return { id, label, hex: hex(value), source };
}

function geometryTriangles(geometry: THREE.BufferGeometry): number {
  const index = geometry.index;
  const position = geometry.getAttribute("position");
  return Math.round((index ? index.count : (position?.count ?? 0)) / 3);
}

function disposeGeometry(geometry: THREE.BufferGeometry): void {
  geometry.dispose();
}

function sourceForAssetManifest(asset: IslandRuntimeAsset): InspectorSourceRef {
  return worldSource(
    `island/${asset.pack === "elemental-serenity" ? "elemental-serenity-assets.json" : "kenney-r01-assets.json"}`,
    "assets[].bytes",
  );
}

function trianglesSourceForAsset(asset: IslandRuntimeAsset): InspectorSourceRef {
  return projectSource(
    `apps/university/public${asset.src}`,
    "GLB JSON meshes[].primitives[].indices / POSITION",
  );
}

function dressingInstancesSource(): InspectorSourceRef {
  return worldSource("island/island-dressing.ts", "planIslandDressing().placements");
}

function techniqueFor(lockId: InspectorTechniqueLockId): IslandTechniqueEntry {
  return ISLAND_TECHNIQUE_LOCK[lockId]!;
}

function catalogAssets(triangleCounts: TriangleCountMapLike): InspectorCatalogAsset[] {
  return islandRuntimeAssets().map((asset) => ({
    key: assetKey(asset),
    assetId: asset.assetId,
    name: assetName(asset.assetId),
    pack: packLabel(asset.pack),
    packId: asset.pack,
    runtimePath: asset.src,
    sourcePath: asset.source ?? null,
    bytes: asset.bytes ?? null,
    triangles: triangleCounts.get(assetKey(asset)) ?? null,
  }));
}

interface PlacementAssetGroup {
  readonly resolution: IslandRuntimeAsset;
  readonly roles: Set<IslandDressingKind>;
  instances: number;
  requestedKeys: Set<string>;
  fallbackReason?: string;
}

interface DressingRows {
  readonly assets: readonly InspectorAsset[];
  readonly roles: readonly InspectorRoleChoice[];
  readonly plans: readonly IslandDressingPlan[];
}

function dressingRows(
  inputs: readonly WorldLayerIsland[],
  triangleCounts: TriangleCountMapLike,
): DressingRows {
  const groups = new Map<string, PlacementAssetGroup>();
  const roleKeys = new Map<IslandDressingKind, Set<string>>();
  const plans: IslandDressingPlan[] = [];

  for (const input of inputs) {
    const detail = input.targetRadius === undefined ? "course" : "world";
    const plan = planIslandDressing(input.blueprint, detail);
    plans.push(plan);
    for (const placement of plan.placements) {
      const requestedKey = `${placement.packId}/${placement.assetId}`;
      const roleSet = roleKeys.get(placement.kind) ?? new Set<string>();
      roleSet.add(requestedKey);
      roleKeys.set(placement.kind, roleSet);

      const resolution = resolveIslandRuntimeAssetFromRecipe(placement.packId, placement.assetId);
      if (!resolution) continue;
      const key = assetKey(resolution);
      const group = groups.get(key) ?? {
        resolution,
        roles: new Set<IslandDressingKind>(),
        instances: 0,
        requestedKeys: new Set<string>(),
      };
      group.roles.add(placement.kind);
      group.instances += 1;
      group.requestedKeys.add(requestedKey);
      if (resolution.usedFallback) group.fallbackReason = resolution.fallbackReason;
      groups.set(key, group);
    }
  }

  const assets = [...groups.values()]
    .sort((left, right) => assetKey(left.resolution).localeCompare(assetKey(right.resolution)))
    .map((group) => {
      const asset = group.resolution;
      const lockId = [...group.roles]
        .map((kind) => LOCK_FOR_KIND[kind])
        .sort((left, right) => (left === "landmark" ? -1 : right === "landmark" ? 1 : 0))[0]!;
      const lock = techniqueFor(lockId);
      const roles = [...group.roles].sort();
      return {
        key: assetKey(asset),
        role: roles.map((kind) => ROLE_LABELS[kind]).join(" / "),
        assetId: asset.assetId,
        name: assetName(asset.assetId),
        pack: packLabel(asset.pack),
        packId: asset.pack,
        runtimePath: asset.src,
        sourcePath: asset.source ?? asset.src,
        bytes: asset.bytes ?? null,
        triangles: triangleCounts.get(assetKey(asset)) ?? null,
        instances: group.instances,
        bytesSource: sourceForAssetManifest(asset),
        trianglesSource: trianglesSourceForAsset(asset),
        instancesSource: dressingInstancesSource(),
        techniqueLock: lockId,
        technique: lock.technique,
        techniqueSource: worldSource(
          "island/island-technique-lock.ts",
          `ISLAND_TECHNIQUE_LOCK.${lockId}`,
        ),
        mutable: true,
        note: group.fallbackReason
          ? `运行时使用登记的 fallback：${group.fallbackReason}`
          : "下拉替换只作用于当前预览，不写回配方。",
      } satisfies InspectorAsset;
    });

  const roles = (Object.keys(ROLE_LABELS) as IslandDressingKind[]).map(
    (kind) =>
      ({
        id: kind,
        label: ROLE_LABELS[kind],
        currentKeys: [...(roleKeys.get(kind) ?? new Set<string>())],
        source: dressingInstancesSource(),
        mutable: true,
        note: "替换只作用于这个配置台的预览；正式变更仍需修改配方。",
      }) satisfies InspectorRoleChoice,
  );

  return { assets, roles, plans };
}

function grassAsset(
  detail: "course" | "world",
  runtime: InspectorRuntimeMetrics | undefined,
): InspectorAsset {
  const lock = techniqueFor("grass");
  const limit = ISLAND_GRASS_LIMITS[detail].desktop;
  return {
    key: "procedural/grass-blade",
    role: "草",
    assetId: "generated-three-vertex-blade",
    name: "generated three-vertex blade",
    pack: "自有程序化",
    runtimePath: null,
    sourcePath: "packages/world/src/island/island-grass-render.tsx",
    bytes: null,
    triangles: ISLAND_GRASS_BLADE_TRIANGLES,
    instances: detail === "world" ? 0 : (runtime?.grassInstances ?? null),
    bytesSource: null,
    trianglesSource: worldSource("island/island-grass-render.tsx", "ISLAND_GRASS_BLADE_TRIANGLES"),
    instancesSource: worldSource("island/island-grass.ts", `ISLAND_GRASS_LIMITS.${detail}.desktop`),
    techniqueLock: "grass",
    technique: lock.technique,
    techniqueSource: worldSource("island/island-technique-lock.ts", "ISLAND_TECHNIQUE_LOCK.grass"),
    mutable: true,
    note:
      detail === "world"
        ? "世界投影按 ADR-0009 不画草；地形色承担远景信息。"
        : `当前相机画面加载后显示实际实例数；上限来自 ${limit.toLocaleString()}。`,
  };
}

function islandTerrain(
  blueprint: IslandBlueprint,
  detail: IslandGeometryDetail,
  targetRadius?: number,
): InspectorLayerDescription["terrain"] {
  const shape = buildIslandGeometry(blueprint, detail, targetRadius);
  const maxPatchAmplitude = Math.max(
    ...blueprint.terrainPatches.map((patch) => patch.amplitude),
    0,
  );
  const terrain = {
    generator: "buildIslandGeometry → buildTerrain",
    parameters: [
      parameter(
        "route-archetype",
        "路线形状",
        blueprint.route.archetype,
        worldSource("island/island-blueprint.ts", "islandBlueprint().route.archetype"),
      ),
      parameter(
        "road-width",
        "路线宽度",
        blueprint.route.roadWidth,
        worldSource("island/island-blueprint.ts", "islandBlueprint().route.roadWidth"),
        { unit: "units" },
      ),
      parameter(
        "shoulder-width",
        "路线肩带",
        blueprint.route.shoulderWidth,
        worldSource("island/island-blueprint.ts", "islandBlueprint().route.shoulderWidth"),
        { unit: "units" },
      ),
      parameter(
        "node-radius",
        "节点半径",
        blueprint.route.nodeRadius,
        worldSource("island/island-blueprint.ts", "islandBlueprint().route.nodeRadius"),
        { unit: "units" },
      ),
      parameter(
        "centerline-samples",
        "中心线采样",
        blueprint.route.centerlineSamples,
        worldSource("island/island-blueprint.ts", "islandBlueprint().route.centerlineSamples"),
        { unit: "samples" },
      ),
      parameter(
        "terrain-patches",
        "地形起伏块",
        blueprint.terrainPatches.length,
        worldSource("island/island-blueprint.ts", "islandBlueprint().terrainPatches"),
        { unit: "patches" },
      ),
      parameter(
        "max-patch-amplitude",
        "最大起伏幅度",
        maxPatchAmplitude,
        worldSource("island/island-blueprint.ts", "islandBlueprint().terrainPatches[].amplitude"),
        { unit: "units" },
      ),
      parameter(
        "base-plateau-height",
        "基础高原高度",
        BASE_PLATEAU_HEIGHT,
        worldSource("island/island-blueprint.ts", "BASE_PLATEAU_HEIGHT"),
        { unit: "units" },
      ),
      parameter(
        "patch-gain",
        "起伏块增益",
        PATCH_GAIN,
        worldSource("island/island-blueprint.ts", "PATCH_GAIN"),
        { unit: "×" },
      ),
      parameter(
        "max-height-ratio",
        "最高高度比例",
        MAX_HEIGHT_RATIO,
        worldSource("island/island-blueprint.ts", "MAX_HEIGHT_RATIO"),
        { unit: "ratio" },
      ),
      parameter(
        "terrace-step-ratio",
        "梯田台阶比例",
        TERRACE_STEP_RATIO,
        worldSource("island/island-blueprint.ts", "TERRACE_STEP_RATIO"),
        { unit: "ratio" },
      ),
      parameter(
        "relief-amplitude-ratio",
        "细节起伏比例",
        RELIEF_AMPLITUDE_RATIO,
        worldSource("island/island-blueprint.ts", "RELIEF_AMPLITUDE_RATIO"),
        { unit: "ratio" },
      ),
      parameter(
        "shore-band",
        "岸线保留带",
        ISLAND_ROUTE_SHORE_BAND,
        worldSource("island/island-blueprint.ts", "ISLAND_ROUTE_SHORE_BAND"),
        { unit: "units" },
      ),
      parameter(
        "min-node-spacing",
        "节点最小间距",
        ISLAND_BLUEPRINT_MIN_NODE_SPACING,
        worldSource("island/island-blueprint.ts", "ISLAND_BLUEPRINT_MIN_NODE_SPACING"),
        { unit: "units" },
      ),
      parameter(
        "layout-revision",
        "布局版本",
        ISLAND_BLUEPRINT_LAYOUT_REVISION,
        worldSource("island/island-blueprint.ts", "ISLAND_BLUEPRINT_LAYOUT_REVISION"),
      ),
      parameter(
        "detail-spacing",
        "中心线最小采样间距",
        ISLAND_BLUEPRINT_MIN_CENTERLINE_SPACING,
        worldSource("island/island-blueprint.ts", "ISLAND_BLUEPRINT_MIN_CENTERLINE_SPACING"),
        { unit: "units" },
      ),
    ],
    colors: [
      colorStop(
        "grass",
        "草地",
        ISLAND_GEOMETRY_PALETTE.grass,
        worldSource("island/island-geometry.ts", "ISLAND_GEOMETRY_PALETTE.grass"),
      ),
      colorStop(
        "meadow-low",
        "低地草色",
        ISLAND_GEOMETRY_PALETTE.meadowLow,
        worldSource("island/island-geometry.ts", "ISLAND_GEOMETRY_PALETTE.meadowLow"),
      ),
      colorStop(
        "meadow-deep",
        "深谷草色",
        ISLAND_GEOMETRY_PALETTE.meadowDeep,
        worldSource("island/island-geometry.ts", "ISLAND_GEOMETRY_PALETTE.meadowDeep"),
      ),
      colorStop(
        "sand",
        "沙岸",
        ISLAND_GEOMETRY_PALETTE.sand,
        worldSource("island/island-geometry.ts", "ISLAND_GEOMETRY_PALETTE.sand"),
      ),
      colorStop(
        "rock",
        "岩石",
        ISLAND_GEOMETRY_PALETTE.rock,
        worldSource("island/island-geometry.ts", "ISLAND_GEOMETRY_PALETTE.rock"),
      ),
      colorStop(
        "cliff",
        "峭壁",
        ISLAND_GEOMETRY_PALETTE.cliff,
        worldSource("island/island-geometry.ts", "ISLAND_GEOMETRY_PALETTE.cliff"),
      ),
    ],
    geometryTriangles: geometryTriangles(shape.terrain),
    geometrySource: worldSource("island/island-geometry.ts", "buildIslandGeometry().terrain"),
  } satisfies InspectorLayerDescription["terrain"];
  disposeGeometry(shape.terrain);
  return terrain;
}

function islandLighting(
  skyStudyId: string | null | undefined,
  groundRadius: number,
): InspectorLayerDescription["lighting"] {
  const sky = skyStopsForStudy(skyStudyId ?? null);
  const shadow = worldShadowFrustum(groundRadius);
  return {
    parameters: [
      parameter(
        "sun-elevation",
        "太阳高度角",
        WORLD_SUN.elevationDeg,
        worldSource("sky/sun.ts", "WORLD_SUN.elevationDeg"),
        { unit: "deg" },
      ),
      parameter(
        "sun-azimuth",
        "太阳方位角",
        WORLD_SUN.azimuthDeg,
        worldSource("sky/sun.ts", "WORLD_SUN.azimuthDeg"),
        { unit: "deg" },
      ),
      parameter(
        "key-intensity",
        "太阳光强",
        WORLD_SUN.keyIntensity,
        worldSource("sky/sun.ts", "WORLD_SUN.keyIntensity"),
        { mutable: true, previewKey: "keyLightIntensity", note: "只改当前预览的第一盏方向光。" },
      ),
      parameter(
        "ambient-intensity",
        "环境光强",
        WORLD_SUN.ambientIntensity,
        worldSource("sky/sun.ts", "WORLD_SUN.ambientIntensity"),
        { mutable: true, previewKey: "ambientLightIntensity", note: "只改当前预览的环境光。" },
      ),
      parameter(
        "hemisphere-intensity",
        "半球光强",
        WORLD_SUN.hemisphereIntensity,
        worldSource("sky/sun.ts", "WORLD_SUN.hemisphereIntensity"),
      ),
      parameter(
        "key-fill-ratio",
        "主光 / 填充比",
        worldKeyToFillRatio(),
        worldSource("sky/sun.ts", "worldKeyToFillRatio()"),
        { unit: "ratio" },
      ),
      parameter(
        "shadow-map-size",
        "阴影贴图尺寸",
        shadow.mapSize,
        worldSource("sky/sun.ts", "worldShadowFrustum().mapSize"),
        { unit: "px" },
      ),
    ],
    colors: [
      colorStop("sky-zenith", "天顶", sky.zenith, worldSource("Maps.tsx", "skyStopsForStudy()")),
      colorStop("sky-mid", "天空中段", sky.mid, worldSource("Maps.tsx", "skyStopsForStudy()")),
      colorStop(
        "sky-horizon",
        "地平线",
        sky.horizon,
        worldSource("Maps.tsx", "skyStopsForStudy()"),
      ),
      colorStop(
        "sun",
        "太阳色",
        WORLD_SUN.keyColor,
        worldSource("sky/sun.ts", "WORLD_SUN.keyColor"),
      ),
    ],
  };
}

function dressingParameters(
  detail: "course" | "world",
  styleBrightness: number,
): readonly InspectorParameter[] {
  const limits = ISLAND_GRASS_LIMITS[detail];
  return [
    parameter(
      "grass-desktop-limit",
      "草实例上限（桌面）",
      limits.desktop,
      worldSource("island/island-grass.ts", `ISLAND_GRASS_LIMITS.${detail}.desktop`),
      {
        unit: "instances",
        mutable: detail === "course",
        previewKey: detail === "course" ? "grassDensityLimit" : undefined,
        note:
          detail === "course" ? "实时预览覆盖，不写回 ISLAND_GRASS_LIMITS。" : "世界投影锁定为 0。",
      },
    ),
    parameter(
      "grass-mobile-limit",
      "草实例上限（移动）",
      limits.mobile,
      worldSource("island/island-grass.ts", `ISLAND_GRASS_LIMITS.${detail}.mobile`),
      { unit: "instances" },
    ),
    parameter(
      "blade-triangles",
      "单片草三角形",
      ISLAND_GRASS_BLADE_TRIANGLES,
      worldSource("island/island-grass-render.tsx", "ISLAND_GRASS_BLADE_TRIANGLES"),
      { unit: "tris/instance", note: "技术锁只读；改动需先修订 ADR-0008。" },
    ),
    parameter(
      "grass-density-multiplier",
      "草叶密度换算",
      ISLAND_GRASS_BLADE_DENSITY_MULTIPLIER,
      worldSource("island/island-grass.ts", "ISLAND_GRASS_BLADE_DENSITY_MULTIPLIER"),
      { unit: "×" },
    ),
    parameter(
      "grass-top-radial",
      "草覆盖最大径向值",
      ISLAND_GRASS_TOP_MAX_RADIAL,
      worldSource("island/island-grass.ts", "ISLAND_GRASS_TOP_MAX_RADIAL"),
      { unit: "ratio" },
    ),
    parameter(
      "near-height",
      "近景草高倍率",
      ISLAND_GRASS_LOD_PROFILES.near.heightMultiplier,
      worldSource("island/island-grass.ts", "ISLAND_GRASS_LOD_PROFILES.near.heightMultiplier"),
      {
        unit: "×",
        mutable: detail === "course",
        previewKey: detail === "course" ? "grassHeightMultiplier" : undefined,
        note: detail === "course" ? "只影响当前画面。" : "世界投影不画草。",
      },
    ),
    parameter(
      "mid-density",
      "中景草密度倍率",
      ISLAND_GRASS_LOD_PROFILES.mid.densityMultiplier,
      worldSource("island/island-grass.ts", "ISLAND_GRASS_LOD_PROFILES.mid.densityMultiplier"),
      { unit: "×" },
    ),
    parameter(
      "mid-height",
      "中景草高倍率",
      ISLAND_GRASS_LOD_PROFILES.mid.heightMultiplier,
      worldSource("island/island-grass.ts", "ISLAND_GRASS_LOD_PROFILES.mid.heightMultiplier"),
      { unit: "×" },
    ),
    parameter(
      "near-to-mid",
      "近景→中景阈值",
      ISLAND_GRASS_LOD_THRESHOLDS.nearToMid,
      worldSource("island/island-grass.ts", "ISLAND_GRASS_LOD_THRESHOLDS.nearToMid"),
      { unit: "units" },
    ),
    parameter(
      "mid-to-far",
      "中景→远景阈值",
      ISLAND_GRASS_LOD_THRESHOLDS.midToFar,
      worldSource("island/island-grass.ts", "ISLAND_GRASS_LOD_THRESHOLDS.midToFar"),
      { unit: "units" },
    ),
    parameter(
      "surface-brightness",
      "地表亮度覆盖",
      styleBrightness,
      worldSource("island/island-surface-style.ts", "ISLAND_SURFACE_STYLE_PRESETS[].brightness"),
      {
        mutable: detail === "course",
        previewKey: detail === "course" ? "terrainBrightness" : undefined,
        note: detail === "course" ? "运行时覆盖只作用于预览。" : "世界投影保持远景色阶。",
      },
    ),
  ];
}

function dressingDescription(
  inputs: readonly WorldLayerIsland[],
  detail: "course" | "world",
  runtime: InspectorRuntimeMetrics | undefined,
  triangleCounts: TriangleCountMapLike,
  note: string,
): InspectorLayerDescription["dressing"] {
  const rows = dressingRows(inputs, triangleCounts);
  const styleId = resolveIslandSurfaceStyle();
  const style =
    ISLAND_SURFACE_STYLE_PRESETS[styleId] ??
    ISLAND_SURFACE_STYLE_PRESETS[DEFAULT_ISLAND_SURFACE_STYLE];
  const grass = grassAsset(detail, runtime);
  return {
    assets: [grass, ...rows.assets],
    catalog: catalogAssets(triangleCounts),
    roles: rows.roles,
    parameters: dressingParameters(detail, style.brightness),
    note,
  };
}

function resourceTriangles(assets: readonly InspectorAsset[]): number | null {
  let total = 0;
  for (const asset of assets) {
    if (asset.instances === null || asset.triangles === null) return null;
    total += asset.instances * asset.triangles;
  }
  return total;
}

function resourceBudget(assets: readonly InspectorAsset[]): number {
  return assets.reduce((total, asset) => {
    if (asset.instances === null) return total;
    const ceiling =
      asset.techniqueLock === "landmark"
        ? ISLAND_LANDMARK_TRIANGLE_CEILING
        : asset.techniqueLock === "tree"
          ? ISLAND_TREE_TRIANGLE_CEILING
          : ISLAND_DECORATION_TRIANGLE_CEILING;
    return total + asset.instances * ceiling;
  }, 0);
}

function islandBudget(
  terrainTriangles: number,
  assets: readonly InspectorAsset[],
  basis: string,
): InspectorLayerDescription["budget"] {
  const grass = assets.find((asset) => asset.techniqueLock === "grass");
  const decoration = assets.filter((asset) => asset.techniqueLock !== "grass");
  const actualResources = resourceTriangles(assets);
  const actualTriangles = actualResources === null ? null : terrainTriangles + actualResources;
  const grassBudget =
    grass?.instances === null || grass?.instances === undefined || grass?.triangles === null
      ? null
      : ISLAND_GRASS_LIMITS.course.desktop * grass.triangles;
  const totalBudget = terrainTriangles + (grassBudget ?? 0) + resourceBudget(decoration);
  return {
    triangleBudget: totalBudget,
    actualTriangles,
    budgetSource: projectSource(
      "docs/adr/ADR-0009-the-procedural-map-is-one-pipeline.md",
      "第三阶段：按屏幕像素分配预算",
    ),
    basis,
    breakdown: [
      { label: "地形网格", triangles: terrainTriangles },
      { label: "草：桌面上限 × 单片草", triangles: grassBudget },
      { label: "装饰 / 地标：技术锁上限", triangles: resourceBudget(decoration) },
    ],
  };
}

function worldBudget(
  terrainTriangles: number,
  assets: readonly InspectorAsset[],
): InspectorLayerDescription["budget"] {
  const actualResources = resourceTriangles(assets);
  return {
    triangleBudget: terrainTriangles + resourceBudget(assets),
    actualTriangles: actualResources === null ? null : terrainTriangles + actualResources,
    budgetSource: projectSource(
      "docs/adr/ADR-0009-the-procedural-map-is-one-pipeline.md",
      "第三阶段：按屏幕像素分配预算",
    ),
    basis: "群岛视角把岛压缩到约 40px；因此不画草，只保留轮廓、明暗断点和亮点。",
    breakdown: [
      { label: "世界投影地形", triangles: terrainTriangles },
      { label: "世界投影装饰 / 地标锁上限", triangles: resourceBudget(assets) },
    ],
  };
}

function planetGeometry(
  studyIds: readonly string[],
  courseCount = 0,
): {
  readonly terrainTriangles: number;
  readonly focusTriangles: number;
} {
  // Inspector callers only have the study list. The count is therefore an
  // explicitly labelled estimate; browser evidence records the real GL
  // counter. One world cell uses the same shared 18-triangle prism as Maps.
  const estimatedCourses = Math.max(courseCount, studyIds.length);
  return {
    terrainTriangles: estimatedCourses * worldGridTargetForLessons(12) * 18,
    focusTriangles: 64,
  };
}

function planetTerrain(
  studyCount: number,
  courseCount: number,
  terrainTriangles: number,
): InspectorLayerDescription["terrain"] {
  return {
    generator: "buildWorldCourseGrid → WorldHexField (shared instanced hex prism)",
    parameters: [
      parameter(
        "study-count",
        "当前项目数",
        studyCount,
        worldSource("planet/PlanetScene.tsx", "PlanetSceneProps.studies"),
        { unit: "studies" },
      ),
      parameter(
        "course-count",
        "真实课程数",
        courseCount,
        worldSource("planet/PlanetScene.tsx", "buildPlanetProjection()"),
        { unit: "courses" },
      ),
      parameter(
        "course-scale",
        "共享课程网格比例",
        PLANET_CLUSTER_LAYOUT_CONTRACT.courseScale,
        worldSource("planet/placement.ts", "PLANET_CLUSTER_LAYOUT_CONTRACT.courseScale"),
      ),
      parameter(
        "intra-cluster-gap",
        "簇内最小间距",
        PLANET_CLUSTER_LAYOUT_CONTRACT.intraClusterGap,
        worldSource("planet/placement.ts", "PLANET_CLUSTER_LAYOUT_CONTRACT.intraClusterGap"),
        { unit: "world units" },
      ),
      parameter(
        "inter-cluster-gap",
        "簇间最小间距",
        PLANET_CLUSTER_LAYOUT_CONTRACT.interClusterGap,
        worldSource("planet/placement.ts", "PLANET_CLUSTER_LAYOUT_CONTRACT.interClusterGap"),
        { unit: "world units" },
      ),
      parameter(
        "selected-lift",
        "选中簇抬升",
        PLANET_ATMOSPHERE.selectedLift,
        worldSource("planet/PlanetScene.tsx", "PLANET_ATMOSPHERE.selectedLift"),
        { unit: "world units" },
      ),
      parameter(
        "camera-polar",
        "高位相机角",
        PLANET_CAMERA_POLAR,
        worldSource("planet/placement.ts", "PLANET_CAMERA_POLAR"),
        { unit: "radians" },
      ),
      parameter(
        "terrain-triangles",
        "共享地形估算三角形",
        terrainTriangles,
        worldSource("grid/WorldHexField.tsx", "HEX_GEOMETRY_TRIANGLES"),
        { unit: "tris", note: "按每课 12 节代表性 world footprint 估算；真实值以浏览器计数为准。" },
      ),
    ],
    colors: [
      colorStop(
        "sky-zenith",
        "天空顶",
        skyStopsForStudy(null).zenith,
        worldSource("Maps.tsx", "SKY_STOPS.zenith"),
      ),
      colorStop(
        "sky-mid",
        "天空中部",
        skyStopsForStudy(null).mid,
        worldSource("Maps.tsx", "SKY_STOPS.mid"),
      ),
      colorStop(
        "sky-horizon",
        "天空地平线",
        WORLD_SKY_CONTRACT.horizon,
        worldSource("Maps.tsx", "WORLD_SKY_CONTRACT.horizon"),
      ),
      colorStop(
        "soil-cliff",
        "共享崖土",
        0x64594f,
        worldSource("grid/grid-palette.ts", "GRID_SHARED_SOIL.cliff"),
      ),
    ],
    geometryTriangles: terrainTriangles,
    geometrySource: worldSource("grid/WorldHexField.tsx", "WorldHexTerrain"),
  };
}

function planetLighting(): InspectorLayerDescription["lighting"] {
  return {
    parameters: [
      parameter(
        "key-intensity",
        "共享太阳光强",
        WORLD_SUN.keyIntensity,
        worldSource("sky/sun.ts", "WORLD_SUN.keyIntensity"),
      ),
      parameter(
        "ambient-intensity",
        "共享环境光强",
        WORLD_SUN.ambientIntensity,
        worldSource("sky/sun.ts", "WORLD_SUN.ambientIntensity"),
      ),
      parameter(
        "hemisphere-intensity",
        "共享半球光强",
        WORLD_SUN.hemisphereIntensity,
        worldSource("sky/sun.ts", "WORLD_SUN.hemisphereIntensity"),
      ),
      parameter(
        "atmosphere-fog-far",
        "星球大气远端",
        PLANET_ATMOSPHERE.fogFarRatio,
        worldSource("planet/PlanetScene.tsx", "PLANET_ATMOSPHERE.fogFarRatio"),
        { unit: "× weather extent" },
      ),
    ],
    colors: [
      colorStop(
        "key",
        "太阳光色",
        WORLD_SUN.keyColor,
        worldSource("sky/sun.ts", "WORLD_SUN.keyColor"),
      ),
      colorStop(
        "hemisphere-ground",
        "半球下方反弹",
        WORLD_SUN.hemisphereGround,
        worldSource("sky/sun.ts", "WORLD_SUN.hemisphereGround"),
      ),
      colorStop(
        "fog",
        "大气雾色",
        WORLD_SKY_CONTRACT.fogColor,
        worldSource("Maps.tsx", "WORLD_SKY_CONTRACT.fogColor"),
      ),
    ],
  };
}

function planetBudget(
  terrainTriangles: number,
  focusTriangles: number,
): InspectorLayerDescription["budget"] {
  const estimatedTriangles = terrainTriangles + focusTriangles;
  return {
    triangleBudget: estimatedTriangles,
    actualTriangles: null,
    budgetSource: projectSource(
      "docs/adr/ADR-0009-the-procedural-map-is-one-pipeline.md",
      "第三阶段：按屏幕像素分配预算",
    ),
    basis:
      "星球页复用远景 instanced hex field；静态摘要是估算，真实调用与三角形以同口径浏览器证据为准。",
    breakdown: [
      { label: "共享 world 地形（估算）", triangles: terrainTriangles },
      { label: "选中簇焦点环", triangles: focusTriangles },
    ],
  };
}

function emptyDressing(note: string): InspectorLayerDescription["dressing"] {
  return {
    assets: [],
    catalog: [],
    roles: [],
    parameters: [],
    note,
  };
}

export function describePlanetLayer({
  studyIds,
  courseCount = 0,
}: DescribePlanetLayerOptions): InspectorLayerDescription {
  const geometry = planetGeometry(studyIds, courseCount);
  return {
    id: "planet",
    title: "行星",
    projection: "研究项目选择器的行星投影",
    liveSource: worldSource("planet/PlanetScene.tsx", "PlanetStage → PlanetScene"),
    terrain: planetTerrain(studyIds.length, courseCount, geometry.terrainTriangles),
    dressing: emptyDressing(
      "项目组复用 WorldPropField 的远景装饰；星球页只改变簇组合、相机与选中态，不另造一套资产。",
    ),
    lighting: planetLighting(),
    budget: planetBudget(geometry.terrainTriangles, geometry.focusTriangles),
  };
}

function previewBlueprint(): IslandBlueprint {
  return islandBlueprint({
    studyId: "map-studio-preview",
    courseId: "map-studio-preview",
    lessonCount: 1,
    themeSelection: islandThemeSelectionForCourse("map-studio-preview", "map-studio-preview"),
  });
}

export function describeWorldLayer({
  islands,
  skyStudyId = null,
  runtime,
  triangleCounts = new Map(),
}: DescribeWorldLayerOptions): InspectorLayerDescription {
  const activeIslands =
    islands.length > 0
      ? islands
      : [{ blueprint: previewBlueprint(), targetRadius: 1 } satisfies WorldLayerIsland];
  const first = activeIslands[0]!;
  const terrainDescriptions = activeIslands.map((island) =>
    islandTerrain(island.blueprint, "world", island.targetRadius),
  );
  const terrainTriangles = terrainDescriptions.reduce(
    (total, description) => total + description.geometryTriangles,
    0,
  );
  const representativeTerrain = terrainDescriptions[0]!;
  const terrain = {
    ...representativeTerrain,
    parameters: [
      parameter(
        "island-count",
        "当前画面岛屿数",
        islands.length,
        worldSource("Maps.tsx", "WorldScene.placements"),
        {
          unit: "islands",
          note: islands.length === 0 ? "课程书架加载完成后会替换预览样本。" : undefined,
        },
      ),
      ...representativeTerrain.parameters,
    ],
    geometryTriangles: terrainTriangles,
  } satisfies InspectorLayerDescription["terrain"];
  const dressing = dressingDescription(
    activeIslands,
    "world",
    runtime,
    triangleCounts,
    "群岛是世界投影：草的真实上限来自 ISLAND_GRASS_LIMITS.world.desktop = 0；保留岛的轮廓、地标和少量装饰。",
  );
  return {
    id: "world",
    title: "群岛",
    projection: "世界地图的远景投影",
    liveSource: worldSource("Maps.tsx", "WorldScene"),
    terrain,
    dressing,
    lighting: islandLighting(skyStudyId, first.blueprint.bounds.maxHalf),
    budget: worldBudget(terrainTriangles, dressing.assets),
  };
}

export function describeIslandLayer({
  blueprint,
  skyStudyId = null,
  runtime,
  triangleCounts = new Map(),
}: DescribeIslandLayerOptions): InspectorLayerDescription {
  const terrain = islandTerrain(blueprint, "course");
  const dressing = dressingDescription(
    [{ blueprint }],
    "course",
    runtime,
    triangleCounts,
    "课程岛是近景投影：草、树、灌木、石头和地标全部来自同一个 blueprint + dressing plan；替换只留在当前预览。",
  );
  return {
    id: "island",
    title: "课程岛",
    projection: "一门课程的近景可读投影",
    liveSource: worldSource("Maps.tsx", "CourseScene"),
    terrain,
    dressing,
    lighting: islandLighting(skyStudyId, blueprint.bounds.maxHalf),
    budget: islandBudget(
      terrain.geometryTriangles,
      dressing.assets,
      "课程岛按屏幕像素分配预算；相机越近才值得把三角形花在草与装饰上。",
    ),
  };
}

export { islandRuntimeAssets } from "../island/island-asset-registry.js";
