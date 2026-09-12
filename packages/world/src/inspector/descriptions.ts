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
  type IslandBlueprint,
} from "../island/island-blueprint.js";
import {
  buildIslandGeometry,
  islandGeometryScale,
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
import { COURSE_TREE_TRUNK_TRIANGLE_CEILING } from "../island/foliage-geometry.js";
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
  resolveIslandRuntimeAsset,
  type IslandRuntimeAsset,
} from "../island/island-asset-registry.js";
import { assetKey } from "./triangle-count.js";
import { proceduralAssetRows } from "./procedural-assets.js";
import { courseLandscapePlan, courseReplacementIds } from "../island/course-landscape-plan.js";
import { previewReplacementReason } from "./preview-runtime.js";
import { projectedMetric, projectedTriangleTotal } from "./projected-metrics.js";
import { footprintSamplePoints, orientedFootprintFor } from "../island/island-composition.js";
import {
  planIslandDressing,
  type IslandDressingKind,
  type IslandDressingPlan,
  type IslandDressingPlacement,
} from "../island/island-dressing.js";
import {
  DEFAULT_ISLAND_SURFACE_STYLE,
  ISLAND_SURFACE_STYLE_PRESETS,
  resolveIslandSurfaceStyle,
} from "../island/island-surface-style.js";
import { skyStopsForStudy } from "../Maps.js";
import { WORLD_SUN, worldKeyToFillRatio, worldShadowFrustum } from "../sky/sun.js";
import { buildDomainPlan } from "../planet/domain-plan.js";
import { DOMAIN_RADIUS, REGION_ALTITUDE } from "../planet/atmospheric-regions.js";
import {
  createDomainGlobeGeometry,
  DOMAIN_CLOUD_TRIANGLES_MAX,
  DOMAIN_GLOBE_TRIANGLES_MAX,
} from "../planet/globe-geometry.js";
import type { PlanetStudy, PlanetStudyDomain } from "../planet/PlanetPage.js";

import type {
  InspectorAsset,
  InspectorAssetUse,
  InspectorModelInfo,
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

import {
  REMOTE_ISLAND_TERRAIN_TRIANGLES,
  REMOTE_PROPS_MAX_TRIANGLES_PER_ISLAND,
  REMOTE_ISLAND_BUDGET_PER_ISLAND,
  planRemotePropsCatalogue,
  type RemotePropPlacement,
} from "../island/remote-props.js";

export const REMOTE_ISLAND_TRIANGLES_PER_ISLAND = REMOTE_ISLAND_TERRAIN_TRIANGLES;
export const REMOTE_FOCUS_TRIANGLES = 96;

export interface WorldLayerIsland {
  /** Production catalogue identity from Maps.placeWorld; missing means incomplete input. */
  readonly id?: string;
  readonly blueprint: IslandBlueprint;
  /** World-space position from Maps.placeWorld; missing means incomplete input. */
  readonly position?: THREE.Vector3;
  readonly targetRadius?: number;
}

export interface DescribePlanetStudy extends Partial<PlanetStudy> {
  readonly id: string;
}

export interface DescribePlanetLayerOptions {
  readonly studyIds?: readonly string[];
  readonly courseCount?: number;
  readonly studies?: readonly (PlanetStudy | DescribePlanetStudy)[];
  readonly domainCatalog?: readonly PlanetStudyDomain[];
  readonly representativeLimit?: 3 | 5;
  readonly runtime?: InspectorRuntimeMetrics;
}

export interface DescribeWorldLayerOptions {
  readonly islands: readonly WorldLayerIsland[];
  readonly skyStudyId?: string | null;
  readonly runtime?: InspectorRuntimeMetrics;
  readonly triangleCounts?: TriangleCountMapLike;
  readonly models?: ReadonlyMap<string, InspectorModelInfo>;
}

export interface DescribeIslandLayerOptions {
  readonly blueprint: IslandBlueprint;
  readonly skyStudyId?: string | null;
  readonly runtime?: InspectorRuntimeMetrics;
  readonly triangleCounts?: TriangleCountMapLike;
  readonly models?: ReadonlyMap<string, InspectorModelInfo>;
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
  bush: "bush",
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
  return {
    id,
    label,
    value,
    source,
    mutable: options.mutable ?? false,
    ...options,
  };
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

let cachedDomainGlobeTriangles: number | null = null;

/** Keep the inspector's deterministic globe plan tied to the production generator. */
function domainGlobeTriangles(): number {
  if (cachedDomainGlobeTriangles === null) {
    const globe = createDomainGlobeGeometry("inspector-domain-globe");
    cachedDomainGlobeTriangles = geometryTriangles(globe);
    disposeGeometry(globe);
  }
  return cachedDomainGlobeTriangles;
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

function catalogAssets(
  triangleCounts: TriangleCountMapLike,
  models: ReadonlyMap<string, InspectorModelInfo>,
): InspectorCatalogAsset[] {
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
    model: models.get(assetKey(asset)),
  }));
}

interface PlacementAssetGroup {
  readonly resolution: IslandRuntimeAsset;
  readonly roles: Set<IslandDressingKind>;
  instances: number;
  requestedKeys: Set<string>;
  fallbackReason?: string;
  readonly uses: InspectorAssetUse[];
}

function placementUse(
  input: WorldLayerIsland,
  placement: IslandDressingPlacement,
): InspectorAssetUse {
  const scale =
    input.targetRadius === undefined
      ? 1
      : islandGeometryScale(input.blueprint, "world", input.targetRadius);
  return {
    studyId: input.blueprint.studyId,
    courseId: input.blueprint.courseId,
    id: placement.id,
    assetKey: `${placement.packId}/${placement.assetId}`,
    position: [placement.x * scale, placement.y * scale, placement.z * scale],
    height:
      placement.height *
      scale *
      (input.targetRadius === undefined ? 1 : 3.2) *
      (resolveIslandRuntimeAsset(placement.packId, placement.assetId)?.heightScale ?? 1),
    turn: placement.turn,
    group:
      placement.assemblyId ??
      placement.outpostId ??
      placement.clusterId ??
      placement.companionOf ??
      "natural",
    state: placement.state ?? "static",
  };
}

interface DressingRows {
  readonly assets: readonly InspectorAsset[];
  readonly roles: readonly InspectorRoleChoice[];
  readonly plans: readonly IslandDressingPlan[];
}

function dressingRows(
  inputs: readonly WorldLayerIsland[],
  triangleCounts: TriangleCountMapLike,
  runtime?: InspectorRuntimeMetrics,
  models: ReadonlyMap<string, InspectorModelInfo> = new Map(),
): DressingRows {
  const groups = new Map<string, PlacementAssetGroup>();
  const roleKeys = new Map<IslandDressingKind, Set<string>>();
  const plans: IslandDressingPlan[] = [];

  for (const input of inputs) {
    const detail = input.targetRadius === undefined ? "course" : "world";
    const plan = planIslandDressing(input.blueprint, detail);
    plans.push(plan);
    const replacements =
      detail === "course" ? courseReplacementIds(courseLandscapePlan(input.blueprint, plan)) : null;
    for (const placement of plan.placements) {
      // Course and world foliage renderers use procedural solid crown lobes;
      // bushEmitter.glb is never fetched or drawn. Do not treat as rendered geometry.
      if (placement.assetId === "bushEmitter" || placement.assetId === "treeTrunks") {
        continue;
      }
      if (replacements?.has(placement.id)) continue;

      const requestedKey = `${placement.packId}/${placement.assetId}`;
      const roleSet = roleKeys.get(placement.kind) ?? new Set<string>();
      roleSet.add(requestedKey);
      roleKeys.set(placement.kind, roleSet);

      const resolution = resolveIslandRuntimeAsset(placement.packId, placement.assetId);
      if (!resolution) continue;
      const key = assetKey(resolution);
      const group = groups.get(key) ?? {
        resolution,
        roles: new Set<IslandDressingKind>(),
        instances: 0,
        requestedKeys: new Set<string>(),
        uses: [],
      };
      group.roles.add(placement.kind);
      group.instances += 1;
      group.uses.push(placementUse(input, placement));
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
      const isTreeTrunks = asset.assetId === "treeTrunks";
      return {
        key: assetKey(asset),
        requestedKeys: [...group.requestedKeys],
        role: roles.map((kind) => ROLE_LABELS[kind]).join(" / "),
        assetId: asset.assetId,
        name: assetName(asset.assetId),
        pack: packLabel(asset.pack),
        packId: asset.pack,
        runtimePath: asset.src,
        sourcePath: asset.source ?? asset.src,
        model: models.get(assetKey(asset)),
        uses: group.uses,
        bytes: asset.bytes ?? null,
        triangles: isTreeTrunks ? null : (triangleCounts.get(assetKey(asset)) ?? null),
        ...(isTreeTrunks
          ? {
              totalTriangles: runtime
                ? (projectedMetric(runtime, "treeTrunk")?.triangles ?? null)
                : null,
            }
          : {}),
        instances: group.instances,
        placementCount: group.instances,
        projectionKind: "glb",
        bytesSource: sourceForAssetManifest(asset),
        trianglesSource: isTreeTrunks
          ? worldSource(
              "island/island-foliage-render.tsx",
              "normalizedTrunkVariants (dynamic single-variant selection, max 384 tris)",
            )
          : trianglesSourceForAsset(asset),
        instancesSource: dressingInstancesSource(),
        techniqueLock: lockId,
        technique: lock.technique,
        techniqueSource: worldSource(
          "island/island-technique-lock.ts",
          `ISLAND_TECHNIQUE_LOCK.${lockId}`,
        ),
        mutable: roles.every((role) => role === "rock"),
        note: isTreeTrunks
          ? "近景每棵选取 6 种树干之一（288–384 三角）；世界远景使用独立的 remote-props 剪影，不加载该树干。原始文件合计 2,032 三角不是单树成本；总量读取当前场景投影。骨架高度为完整树高的 0.68，冠团另计。"
          : group.fallbackReason
            ? `运行时使用登记的 fallback：${group.fallbackReason}`
            : "下拉替换只作用于当前预览，不写回配方。",
      } satisfies InspectorAsset;
    });

  const roles = (Object.keys(ROLE_LABELS) as IslandDressingKind[]).map((kind) => {
    const isBush = kind === "bush";
    const isTree = kind === "tree";
    const currentKeys = isBush ? [] : [...(roleKeys.get(kind) ?? new Set<string>())];
    const compatibleKeys = islandRuntimeAssets()
      .filter(
        (asset) =>
          previewReplacementReason({ role: kind, fromKeys: currentKeys, target: asset }, models) ===
          null,
      )
      .map(assetKey);
    return {
      id: kind,
      label: ROLE_LABELS[kind],
      currentKeys,
      compatibleKeys,
      source: dressingInstancesSource(),
      mutable: kind === "rock" && compatibleKeys.length > 0,
      note: isBush
        ? "灌木使用自有程序化实体团块（20 三角 icosahedron），渲染器不拉取外部 GLB；此处不可替换。"
        : isTree
          ? "树位使用共用的完整程序化针叶／阔叶造型；任意 GLB 替换不安全，此处只读。"
          : kind !== "rock"
            ? "组合/效果资产不能逐件替换；需要从 composition 整组重新验证接地、尺度和锚点。"
            : "只提供材质相容、原点接地且归一化占地不扩大的已登记石头；仅影响预览。",
    } satisfies InspectorRoleChoice;
  });

  return { assets, roles, plans };
}

const terrainDescriptionCache = new WeakMap<
  IslandBlueprint,
  Map<string, InspectorLayerDescription["terrain"]>
>();

function islandTerrain(
  blueprint: IslandBlueprint,
  detail: IslandGeometryDetail,
  targetRadius?: number,
): InspectorLayerDescription["terrain"] {
  const cacheKey = `${detail}/${targetRadius ?? "full"}`;
  const cached = terrainDescriptionCache.get(blueprint)?.get(cacheKey);
  if (cached) return cached;
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
  const cache = terrainDescriptionCache.get(blueprint) ?? new Map();
  cache.set(cacheKey, terrain);
  terrainDescriptionCache.set(blueprint, cache);
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
        {
          mutable: true,
          previewKey: "keyLightIntensity",
          note: "只改当前预览的第一盏方向光。",
        },
      ),
      parameter(
        "ambient-intensity",
        "环境光强",
        WORLD_SUN.ambientIntensity,
        worldSource("sky/sun.ts", "WORLD_SUN.ambientIntensity"),
        {
          mutable: true,
          previewKey: "ambientLightIntensity",
          note: "只改当前预览的环境光。",
        },
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
  models: ReadonlyMap<string, InspectorModelInfo> = new Map(),
): InspectorLayerDescription["dressing"] {
  const rows = dressingRows(inputs, triangleCounts, runtime, models);
  const styleId = resolveIslandSurfaceStyle();
  const style =
    ISLAND_SURFACE_STYLE_PRESETS[styleId] ??
    ISLAND_SURFACE_STYLE_PRESETS[DEFAULT_ISLAND_SURFACE_STYLE];
  const procedural = proceduralAssetRows({
    detail,
    blueprints: inputs.map((i) => i.blueprint),
    plans: rows.plans,
    runtime,
  });
  return {
    assets: [...procedural, ...rows.assets],
    catalog: catalogAssets(triangleCounts, models),
    roles: rows.roles,
    parameters: dressingParameters(detail, style.brightness),
    note,
    compositions: rows.plans.flatMap((plan, index) =>
      (plan.decisions ?? []).map((decision) => {
        const input = inputs[index]!;
        const members = plan.placements.filter((placement) =>
          decision.members.includes(placement.id),
        );
        const points = members.flatMap((placement) =>
          footprintSamplePoints(
            orientedFootprintFor(
              placement.assetId,
              placement.height,
              placement.x,
              placement.z,
              placement.turn,
            ),
          ),
        );
        return {
          studyId: input.blueprint.studyId,
          courseId: input.blueprint.courseId,
          id: decision.assemblyId,
          kind: decision.kind,
          status: decision.status,
          attempts: decision.attempts,
          rejections: decision.rejections,
          fallback: decision.fallback,
          members: members.map((placement) => placementUse(input, placement)),
          footprint: points.length
            ? ([
                Math.max(...points.map((point) => point.x)) -
                  Math.min(...points.map((point) => point.x)),
                Math.max(...points.map((point) => point.z)) -
                  Math.min(...points.map((point) => point.z)),
              ] as const)
            : null,
          span: decision.span,
          slope: decision.slope,
        };
      }),
    ),
  };
}

function resourceTriangles(assets: readonly InspectorAsset[]): number | null {
  let total = 0;
  for (const asset of assets) {
    if (asset.totalTriangles !== undefined) {
      if (asset.totalTriangles === null) return null;
      total += asset.totalTriangles;
      continue;
    }
    if (asset.instances === 0) continue;
    if (asset.instances === null || asset.triangles === null) return null;
    total += asset.instances * asset.triangles;
  }
  return total;
}

function resourceBudget(assets: readonly InspectorAsset[]): number {
  return assets.reduce((total, asset) => {
    if (asset.instances === null) return total;
    if (asset.projectionKind === "procedural") {
      return total + (asset.totalTriangles ?? asset.instances * (asset.triangles ?? 0));
    }
    const ceiling =
      asset.assetId === "treeTrunks"
        ? COURSE_TREE_TRUNK_TRIANGLE_CEILING
        : asset.techniqueLock === "landmark"
          ? ISLAND_LANDMARK_TRIANGLE_CEILING
          : asset.assetId === "treeTrunks"
            ? 384
            : asset.techniqueLock === "tree"
              ? ISLAND_TREE_TRIANGLE_CEILING
              : ISLAND_DECORATION_TRIANGLE_CEILING;
    return total + (asset.placementCount ?? asset.instances) * ceiling;
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
    basis:
      actualTriangles === null
        ? `${basis}（等待当前投影：动态树干、刻纹、贴地底沿和浅嵌盘逐项测量；未知值不记作零）`
        : basis,
    breakdown: [
      { label: "地形网格", triangles: terrainTriangles },
      { label: "草：桌面上限 × 单片草", triangles: grassBudget },
      {
        label: "装饰 / 地标：技术锁上限",
        triangles: resourceBudget(decoration),
      },
    ],
  };
}

const WORLD_TERRAIN_COLORS: readonly InspectorColorStop[] = [
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
];

function worldTerrainParameters(
  blueprint: IslandBlueprint | null,
  islandCount: number,
): readonly InspectorParameter[] {
  const countParam = parameter(
    "island-count",
    "当前画面岛屿数",
    islandCount,
    worldSource("Maps.tsx", "WorldScene.placements"),
    {
      unit: "islands",
      note: islandCount === 0 ? "课程书架加载完成后会替换预览样本。" : undefined,
    },
  );

  if (!blueprint || islandCount === 0) {
    return [countParam];
  }

  const maxPatchAmplitude = Math.max(
    ...blueprint.terrainPatches.map((patch) => patch.amplitude),
    0,
  );

  return [
    countParam,
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
  ];
}

interface PlannedWorldIsland {
  readonly id: string;
  readonly blueprint: IslandBlueprint;
  readonly position: THREE.Vector3;
  readonly scale: 1;
  readonly radius: number;
}

/**
 * Remote props must be planned from the same catalogue placement identity and
 * position that Maps renders. An incomplete adapter is deliberately not
 * reconstructed with a study road or an origin: its planned counts remain
 * unknown until production placement data arrives.
 */
function worldPlacementInputs(
  islands: readonly WorldLayerIsland[],
): readonly PlannedWorldIsland[] | null {
  const ids = new Set<string>();
  const planned: PlannedWorldIsland[] = [];
  for (const island of islands) {
    const id = island.id?.trim();
    const position = island.position;
    const radius = island.targetRadius ?? island.blueprint.bounds.maxHalf;
    if (
      !id ||
      ids.has(id) ||
      !position ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(position.z) ||
      !Number.isFinite(radius) ||
      radius <= 0
    ) {
      return null;
    }
    ids.add(id);
    planned.push({
      id,
      blueprint: island.blueprint,
      position: position.clone(),
      scale: 1,
      radius,
    });
  }
  return planned;
}

function remotePropUse(
  prop: RemotePropPlacement,
  host: WorldLayerIsland | undefined,
  assetKey: string,
  index: number,
): InspectorAssetUse {
  return {
    studyId: host?.blueprint.studyId ?? prop.islandId,
    courseId: host?.blueprint.courseId ?? prop.islandId,
    id: `${prop.islandId}/${prop.kind}-${index}`,
    assetKey,
    position: [prop.position.x, prop.position.y, prop.position.z],
    height: prop.scale,
    turn: prop.rotationY,
    group: prop.islandId,
    state: prop.dimmed ? "dimmed" : "static",
  };
}

function worldBudget(
  islandCount: number,
  runtime?: InspectorRuntimeMetrics,
): InspectorLayerDescription["budget"] {
  const estimatedTerrainTriangles = islandCount * REMOTE_ISLAND_TERRAIN_TRIANGLES;
  const estimatedPropsTriangles = islandCount * REMOTE_PROPS_MAX_TRIANGLES_PER_ISLAND;
  const estimatedTotal = islandCount * REMOTE_ISLAND_BUDGET_PER_ISLAND;
  const projectedTerrain = projectedMetric(runtime, "terrain");
  const projectedProps = projectedMetric(runtime, "remoteProps");
  const actualTriangles =
    islandCount === 0
      ? 0
      : runtime && projectedTerrain && projectedProps
        ? projectedTerrain.triangles + projectedProps.triangles
        : null;

  return {
    triangleBudget: islandCount > 0 ? estimatedTotal : 0,
    actualTriangles,
    budgetSource: projectSource(
      "docs/adr/ADR-0009-the-procedural-map-is-one-pipeline.md",
      "第三阶段：按屏幕像素分配预算",
    ),
    basis:
      "飞岛群使用同源连续地形与合批微缩景观：树木、主题景物、水景和接触阴影分批，地形及景观最多六次基础绘制。只有地形和 remote-props 的实测都完整或明确为空时才给出总量；不含头像、天空和后处理。",
    breakdown: [
      {
        label: "世界投影连续地形",
        triangles: runtime
          ? (projectedTerrain?.triangles ?? null)
          : islandCount > 0
            ? estimatedTerrainTriangles
            : 0,
      },
      {
        label: "微缩景观、树木、水景与接触阴影",
        triangles: runtime
          ? (projectedProps?.triangles ?? null)
          : islandCount > 0
            ? estimatedPropsTriangles
            : 0,
      },
    ],
  };
}

function worldDressingDescription(
  islands: readonly WorldLayerIsland[],
  runtime?: InspectorRuntimeMetrics,
): InspectorLayerDescription["dressing"] {
  const styleId = resolveIslandSurfaceStyle();
  const style =
    ISLAND_SURFACE_STYLE_PRESETS[styleId] ??
    ISLAND_SURFACE_STYLE_PRESETS[DEFAULT_ISLAND_SURFACE_STYLE];

  if (islands.length === 0) {
    return {
      assets: [],
      catalog: [],
      roles: [],
      parameters: dressingParameters("world", style.brightness),
      note: "群岛是世界远景投影：复用连续浮岛共享网格（RemoteIslandField），不生成课程近景道具，零草叶（ISLAND_GRASS_LIMITS.world.desktop = 0），零关卡节点。",
      compositions: [],
    };
  }

  const plannedIslands = worldPlacementInputs(islands);
  const propsPlan = plannedIslands ? planRemotePropsCatalogue(plannedIslands) : null;
  const hostById = new Map(
    plannedIslands?.map((planned, index) => [planned.id, islands[index]!] as const),
  );
  const sceneryProps = propsPlan ? [...propsPlan.landmarks, ...propsPlan.accents] : [];
  const landmarkUses = propsPlan
    ? sceneryProps.map((prop, index) =>
        remotePropUse(prop, hostById.get(prop.islandId), "procedural/world-landmark", index),
      )
    : [];
  const treeUses = propsPlan
    ? propsPlan.trees.map((prop, index) =>
        remotePropUse(prop, hostById.get(prop.islandId), "procedural/world-tree-crown", index),
      )
    : [];
  const placementNote = plannedIslands
    ? ""
    : "生产 Maps catalogue placement 的 id/position 不完整；不使用原点或 study-layout fallback，未知不记作 0。";

  const measuredLandmark = projectedMetric(runtime, "remoteLandmark");
  const measuredTree = projectedMetric(runtime, "remoteTree");

  const remoteLandmarkAsset: InspectorAsset = {
    key: "procedural/world-landmark",
    role: "远景地标",
    assetId: "world-landmark",
    name: "微缩主题景物与伴生花草",
    pack: "自有程序化",
    runtimePath: null,
    sourcePath: "packages/world/src/island/remote-props.ts",
    bytes: null,
    triangles: null,
    totalTriangles: runtime
      ? (measuredLandmark?.triangles ?? null)
      : propsPlan
        ? sceneryProps.reduce((sum, prop) => sum + prop.triangles, 0)
        : null,
    instances: runtime
      ? (measuredLandmark?.instances ?? null)
      : propsPlan
        ? sceneryProps.length
        : null,
    placementCount: propsPlan ? sceneryProps.length : null,
    projectionKind: "procedural",
    bytesSource: null,
    trianglesSource: worldSource("island/remote-props.ts", "REMOTE_PAVILION_TRIANGLES"),
    instancesSource: worldSource("island/remote-props.ts", "planRemotePropsCatalogue"),
    techniqueLock: "landmark",
    technique:
      "每岛一处配方主题看点与花草石组；读取实际地形三角形拟合完整占地，按材质合并而非逐物体绘制。",
    techniqueSource: worldSource("island/miniature-assets.ts", "createMiniatureAsset"),
    mutable: false,
    uses: landmarkUses,
    note: propsPlan
      ? `主题看点 ${propsPlan.landmarks.length} 处，伴生花草石组 ${propsPlan.accents.length} 组。未测时的三角数仅含规划实体；运行时另计合入的水岸，水面和接触阴影计入景观总预算。`
      : placementNote,
  };

  const remoteTreeAsset: InspectorAsset = {
    key: "procedural/world-tree-crown",
    role: "远景树冠",
    assetId: "world-tree-crown",
    name: "微缩林团（针叶、阔叶、樱花与秋树）",
    pack: "自有程序化",
    runtimePath: null,
    sourcePath: "packages/world/src/island/remote-props.ts",
    bytes: null,
    triangles: null,
    totalTriangles: runtime
      ? (measuredTree?.triangles ?? null)
      : propsPlan
        ? propsPlan.trees.reduce((sum, prop) => sum + prop.triangles, 0)
        : null,
    instances: runtime ? (measuredTree?.instances ?? null) : (propsPlan?.trees.length ?? null),
    placementCount: propsPlan?.trees.length ?? null,
    projectionKind: "procedural",
    bytesSource: null,
    trianglesSource: worldSource("island/remote-props.ts", "REMOTE_TREE_TRIANGLES"),
    instancesSource: worldSource("island/remote-props.ts", "planRemotePropsCatalogue"),
    techniqueLock: "tree",
    technique:
      "每岛至多五棵有树干和完整树冠的配方树木，合并为一个树木批次，不加载岛内课程模型；完整支撑面通过远景地形三角形检查。",
    techniqueSource: worldSource("island/miniature-assets.ts", "createMiniatureAsset"),
    mutable: false,
    uses: treeUses,
    note: propsPlan
      ? `当前规划 ${propsPlan.trees.length} 棵树；不同树型的三角数直接求和，不用一个原型的面数乘整个目录。`
      : placementNote,
  };

  const procedural = proceduralAssetRows({
    detail: "world",
    blueprints: islands.map((i) => i.blueprint),
    plans: [],
    runtime,
  });

  return {
    assets: [remoteLandmarkAsset, remoteTreeAsset, ...procedural],
    catalog: [],
    roles: [],
    parameters: dressingParameters("world", style.brightness),
    note: `飞岛群复用连续地形（RemoteIslandField）与单一微缩景观计划（RemotePropsField）；仅有少量合批草簇，不运行岛内草地生成器或近景关卡节点。${placementNote ? ` ${placementNote}` : ""}`,
    compositions: [],
  };
}

export function describePlanetLayer({
  studyIds,
  courseCount,
  studies,
  domainCatalog,
  representativeLimit: requestedLimit = 5,
  runtime,
}: DescribePlanetLayerOptions): InspectorLayerDescription {
  const studyInputs = studies ?? (studyIds ?? []).map<DescribePlanetStudy>((id) => ({ id }));
  const studyList: PlanetStudy[] = studyInputs.map((study) => ({
    ...study,
    title: study.title ?? study.id,
    courseCount: study.courseCount ?? 0,
    lessonCount: study.lessonCount ?? 0,
    lessonsDone: study.lessonsDone ?? 0,
    courses: study.courses ?? [],
    courseTitles: study.courseTitles ?? [],
  }));
  const representativeLimit = runtime?.planetRepresentativeLimit ?? requestedLimit;
  const representativeCounts = studyInputs.map((study) =>
    study.courses !== undefined
      ? Math.min(representativeLimit, study.courses.length)
      : study.courseCount !== undefined
        ? Math.min(representativeLimit, Math.max(0, study.courseCount))
        : null,
  );
  const representativeCount = representativeCounts.some((count) => count === null)
    ? null
    : representativeCounts.reduce<number>((sum, count) => sum + (count ?? 0), 0);
  const domains = buildDomainPlan(studyList, domainCatalog);
  const totalCourses = studies
    ? studyList.reduce((sum, study) => sum + study.courseCount, 0)
    : (courseCount ?? 0);
  const globeTriangles = domainGlobeTriangles();
  const definitions = [
    {
      id: "domainGlobe",
      label: "领域球体",
      planned: domains.length * globeTriangles,
      count: domains.length,
      generator: "createDomainGlobeGeometry",
      file: "planet/globe-geometry.ts",
    },
    {
      id: "domainClouds",
      label: "球面云块",
      planned: null,
      count: domains.length,
      generator: "createDomainCloudGeometry",
      file: "planet/globe-geometry.ts",
    },
    {
      id: "domainAtmosphere",
      label: "大气轮廓",
      planned: domains.length * globeTriangles,
      count: domains.length,
      generator: "DomainPlanet",
      file: "planet/PlanetScene.tsx",
    },
    {
      id: "atmosphericIslands",
      label: "真实课程代表岛",
      planned:
        representativeCount === null ? null : representativeCount * REMOTE_ISLAND_TERRAIN_TRIANGLES,
      count: representativeCount,
      generator: "buildAtmosphericIslands",
      file: "planet/atmospheric-regions.ts",
    },
    {
      id: "domainRegionTargets",
      label: "系列区域命中体",
      planned: studyList.length * 80,
      count: studyList.length,
      generator: "DomainPlanet",
      file: "planet/PlanetScene.tsx",
    },
    {
      id: "planetFocus",
      label: "选中系列区域环",
      planned: null,
      count: null,
      generator: "DomainPlanet",
      file: "planet/PlanetScene.tsx",
    },
  ] as const;
  const assets: InspectorAsset[] = definitions.map((definition) => {
    const value = projectedMetric(runtime, definition.id);
    const source = worldSource(definition.file, definition.generator);
    const geometrySource =
      definition.id === "domainGlobe" || definition.id === "domainAtmosphere"
        ? worldSource("planet/globe-geometry.ts", "createDomainGlobeGeometry")
        : source;
    return {
      key: `procedural/${definition.id}`,
      role: definition.label,
      assetId: definition.id,
      name: definition.label,
      pack: "自有程序化",
      runtimePath: null,
      sourcePath: `packages/world/src/${definition.file}`,
      bytes: null,
      triangles: null,
      totalTriangles: runtime ? (value?.triangles ?? null) : definition.planned,
      instances: runtime ? (value?.instances ?? null) : definition.count,
      placementCount: definition.count ?? value?.instances ?? null,
      projectionKind: "procedural",
      bytesSource: null,
      trianglesSource: geometrySource,
      instancesSource: source,
      techniqueLock: "domainPlanet",
      technique: definition.generator,
      techniqueSource: source,
      mutable: false,
      note:
        definition.id === "atmosphericIslands"
          ? representativeCount === null
            ? "代表课程列表与数量未完整提供；实际代表岛及三角数保持未知，不以 0 代替。"
            : "每系列最多呈现前 5 门真实课程的地形代表；完整课程数在 DOM 列表，合并网格数不是课程数。"
          : definition.id === "domainRegionTargets"
            ? "透明命中体仍有提交成本；不代表可见实体。"
            : "无运行时采样时仅展示已知规划量；云带与选中环不伪造实际值。",
    };
  });
  const representativeBudgetCount = representativeCount ?? studyList.length * 5;
  const plannedTerrainTriangles =
    domains.length * globeTriangles + representativeBudgetCount * REMOTE_ISLAND_TERRAIN_TRIANGLES;
  const measuredTerrainTriangles = projectedTriangleTotal(runtime, [
    "domainGlobe",
    "atmosphericIslands",
  ]);
  const terrainTriangles = measuredTerrainTriangles ?? plannedTerrainTriangles;
  const actualTriangles =
    domains.length === 0
      ? 0
      : projectedTriangleTotal(
          runtime,
          definitions.map((definition) => definition.id),
        );
  return {
    id: "planet",
    title: "行星",
    projection: "学习领域球体 → 大气层系列区域 → 课程代表岛",
    liveSource: worldSource("planet/PlanetScene.tsx", "PlanetScene"),
    terrain: {
      generator: "buildDomainPlan → createDomainGlobeGeometry + buildAtmosphericIslands",
      parameters: [
        parameter(
          "domain-count",
          "真实领域数",
          domains.length,
          worldSource("planet/domain-plan.ts", "buildDomainPlan"),
        ),
        parameter(
          "study-count",
          "系列区域数",
          studyList.length,
          worldSource("planet/atmospheric-regions.ts", "planAtmosphericRegions"),
        ),
        parameter(
          "course-count",
          "真实课程数",
          totalCourses,
          worldSource("planet/planet-copy.ts", "PlanetStudy.courseCount"),
        ),
        parameter(
          "representative-count",
          "课程代表岛数",
          representativeCount ?? "未知",
          worldSource("planet/atmospheric-regions.ts", "planAtmosphericRegions"),
        ),
        parameter(
          "domain-radius",
          "球体半径",
          DOMAIN_RADIUS,
          worldSource("planet/atmospheric-regions.ts", "DOMAIN_RADIUS"),
        ),
        parameter(
          "region-altitude",
          "区域轨道半径",
          DOMAIN_RADIUS * REGION_ALTITUDE,
          worldSource("planet/atmospheric-regions.ts", "REGION_ALTITUDE"),
        ),
      ],
      colors: [],
      geometryTriangles: terrainTriangles,
      geometrySource: worldSource("planet/PlanetScene.tsx", "DomainPlanet"),
    },
    dressing: {
      assets,
      catalog: [],
      roles: [],
      parameters: [],
      compositions: [],
      note:
        domains
          .map(
            (domain) =>
              `${domain.title}：${domain.studies.map((study) => study.title).join("、") || "暂无系列"}`,
          )
          .join("；") || "暂无已发布领域。",
    },
    lighting: {
      parameters: [
        parameter(
          "key-intensity",
          "共享太阳光强",
          WORLD_SUN.keyIntensity,
          worldSource("sky/sun.ts", "WORLD_SUN.keyIntensity"),
        ),
      ],
      colors: [
        colorStop(
          "key",
          "共享太阳光色",
          WORLD_SUN.keyColor,
          worldSource("sky/sun.ts", "WORLD_SUN.keyColor"),
        ),
      ],
    },
    budget: {
      triangleBudget:
        domains.length *
          (DOMAIN_GLOBE_TRIANGLES_MAX + DOMAIN_CLOUD_TRIANGLES_MAX + DOMAIN_GLOBE_TRIANGLES_MAX) +
        representativeBudgetCount * REMOTE_ISLAND_TERRAIN_TRIANGLES +
        studyList.length * 80 +
        (studyList.length ? REMOTE_FOCUS_TRIANGLES : 0),
      actualTriangles,
      budgetSource: projectSource(
        "docs/adr/ADR-0008-one-locked-technique-per-island-element.md",
        "领域星球",
      ),
      basis:
        "领域球体、云带、大气壳、代表岛和交互几何；运行时采样为场景图提交几何，不含天空、阴影和后处理。缺失投影不补零，只有完整场景明确声明 optional 投影不存在时才计 0。代表课程元数据缺失时，预算使用每系列最多 5 门的保守上限，实测总量仍为未知。表面纹理每领域 1024×512 RGBA，基础 2 MiB，含 mipmap 约 2.67 MiB。",
      breakdown: assets.map((asset) => ({
        label: asset.name,
        triangles: asset.totalTriangles ?? null,
      })),
    },
  };
}

export function describeWorldLayer({
  islands,
  skyStudyId = null,
  runtime,
}: DescribeWorldLayerOptions): InspectorLayerDescription {
  const islandCount = islands.length;
  const estimatedTerrainTriangles = islandCount * REMOTE_ISLAND_TRIANGLES_PER_ISLAND;
  const projectedTerrain = projectedMetric(runtime, "terrain");
  const terrainTriangles =
    projectedTerrain?.triangles ?? (islandCount > 0 ? estimatedTerrainTriangles : 0);

  const terrain: InspectorLayerDescription["terrain"] = {
    generator: "buildRemoteIslandBatch → RemoteIslandField (shared continuous mesh)",
    parameters: worldTerrainParameters(islandCount > 0 ? islands[0]!.blueprint : null, islandCount),
    colors: WORLD_TERRAIN_COLORS,
    geometryTriangles: terrainTriangles,
    geometrySource: worldSource("island/remote-island-field.ts", "buildRemoteIslandBatch"),
  };

  const dressing = worldDressingDescription(islands, runtime);
  const maxHalf = islandCount > 0 ? islands[0]!.blueprint.bounds.maxHalf : 0;

  return {
    id: "world",
    title: "群岛",
    projection: "世界地图的远景投影",
    liveSource: worldSource("Maps.tsx", "WorldScene"),
    terrain,
    dressing,
    lighting: islandLighting(skyStudyId, maxHalf),
    budget: worldBudget(islandCount, runtime),
  };
}

export function describeIslandLayer({
  blueprint,
  skyStudyId = null,
  runtime,
  triangleCounts = new Map(),
  models = new Map(),
}: DescribeIslandLayerOptions): InspectorLayerDescription {
  const terrain = islandTerrain(blueprint, "course");
  const dressing = dressingDescription(
    [{ blueprint }],
    "course",
    runtime,
    triangleCounts,
    "课程岛是近景投影：草、树、灌木、石头和地标全部来自同一个 blueprint + dressing plan；替换只留在当前预览。",
    models,
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
