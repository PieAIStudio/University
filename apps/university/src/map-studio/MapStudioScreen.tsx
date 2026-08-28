import { useControls, useCreateStore } from "leva";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { progressSourceOf, type ProgressPort } from "@pieai/university-core";
import {
  GameBadge,
  GameButton,
  GameField,
  GameInput,
  GamePanel,
  GameTabs,
} from "@pieai/swimmer-ui-kit";
import {
  CourseScene,
  frameWorld,
  islandBlueprint,
  islandThemeSelectionForCourse,
  placeWorld,
  placeCourse,
  COURSE_POLAR,
  type CourseNode,
  type LessonPlacement,
  type WorldMap,
  WorldMapCanvas,
} from "@pieai/university-world";
import { courseMarkers, frameCourse, worldCourse } from "@pieai/university-world/course-map.js";
import { PlanetStage, type PlanetStudy } from "@pieai/university-world/planet.js";
import {
  applyPreviewAssetOverrides,
  clearPreviewAssetOverrides,
  describeIslandLayer,
  describePlanetLayer,
  describeWorldLayer,
  loadIslandAssetTriangleCounts,
  PreviewOverrideBridge,
  type InspectorAsset,
  type InspectorColorStop,
  type InspectorLayerDescription,
  type InspectorParameter,
  type InspectorRoleChoice,
  type InspectorRuntimeMetrics,
  type PreviewRole,
} from "@pieai/university-world/inspector.js";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";

import "./map-studio.css";

type StudioLayer = "planet" | "world" | "island";

interface MapStudioScreenProps {
  readonly studies: readonly {
    readonly id: string;
    readonly title: string;
    readonly courses: readonly CourseView[];
  }[];
  readonly nodes: readonly CourseNode[] | null;
  readonly world: WorldMap | null;
  readonly courseProgress: (node: CourseNode) => number;
  readonly progressPort: ProgressPort;
  readonly focusedStudyId: string | null;
  readonly planetStudies: readonly PlanetStudy[];
  readonly onSelectStudy: (studyId: string) => void;
}

const TABS = [
  { id: "planet", label: "行星", panelId: "map-studio-panel" },
  { id: "world", label: "群岛", panelId: "map-studio-panel" },
  { id: "island", label: "课程岛", panelId: "map-studio-panel" },
] as const;

function parameterByPreviewKey(
  description: InspectorLayerDescription,
  previewKey: string,
): InspectorParameter | undefined {
  return [
    ...description.terrain.parameters,
    ...description.dressing.parameters,
    ...description.lighting.parameters,
  ].find((parameter) => parameter.previewKey === previewKey);
}

function formatNumber(value: number | null): string {
  return value === null ? "加载中" : value.toLocaleString("zh-CN");
}

function formatBytes(value: number | null): string {
  if (value === null) return "程序化 / 未使用 GLB";
  return `${value.toLocaleString("zh-CN")} B`;
}

function sourceText(source: { readonly file: string; readonly export: string }): string {
  return `${source.file} · ${source.export}`;
}

function layerTitle(layer: StudioLayer): string {
  return layer === "planet" ? "行星" : layer === "world" ? "群岛" : "课程岛";
}

function valueText(value: number | string, unit?: string): string {
  return `${typeof value === "number" ? value.toLocaleString("zh-CN") : value}${unit ? ` ${unit}` : ""}`;
}

function mutableParameterIds(
  description: InspectorLayerDescription,
): readonly InspectorParameter[] {
  return [...description.lighting.parameters, ...description.dressing.parameters].filter(
    (parameter) => parameter.mutable && parameter.previewKey,
  );
}

function roleCurrentLabel(role: InspectorRoleChoice, assets: readonly InspectorAsset[]): string {
  const current = assets.find((asset) => role.currentKeys.includes(asset.key));
  if (!current) return "沿用配方";
  return `${current.pack} / ${current.assetId}`;
}

function catalogLabel(asset: { readonly pack: string; readonly assetId: string }): string {
  return `${asset.pack} / ${asset.assetId}`;
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function numberParameterValue(
  description: InspectorLayerDescription,
  previewKey: string,
  fallback: number,
): number {
  const parameter = parameterByPreviewKey(description, previewKey);
  return typeof parameter?.value === "number" ? parameter.value : fallback;
}

function changeValue(
  parameter: InspectorParameter,
  values: {
    readonly keyLightIntensity: number;
    readonly ambientLightIntensity: number;
    readonly grassDensityLimit: number;
    readonly grassHeightMultiplier: number;
    readonly terrainBrightness: number;
  },
): number {
  switch (parameter.previewKey) {
    case "keyLightIntensity":
      return values.keyLightIntensity;
    case "ambientLightIntensity":
      return values.ambientLightIntensity;
    case "grassDensityLimit":
      return values.grassDensityLimit;
    case "grassHeightMultiplier":
      return values.grassHeightMultiplier;
    case "terrainBrightness":
      return values.terrainBrightness;
    default:
      return typeof parameter.value === "number" ? parameter.value : 0;
  }
}

function sourceLine(source: InspectorParameter["source"]): ReactNode {
  return (
    <span className="map-studio__source">
      <span>出处</span>
      <code>{source.file}</code>
      <span>·</span>
      <code>{source.export}</code>
    </span>
  );
}

function ParameterRow({
  parameter,
  values,
  onChange,
}: {
  readonly parameter: InspectorParameter;
  readonly values: {
    readonly keyLightIntensity: number;
    readonly ambientLightIntensity: number;
    readonly grassDensityLimit: number;
    readonly grassHeightMultiplier: number;
    readonly terrainBrightness: number;
  };
  readonly onChange: (parameter: InspectorParameter, value: number) => void;
}) {
  const editable = parameter.mutable && Boolean(parameter.previewKey);
  const current = changeValue(parameter, values);
  const step = parameter.unit === "instances" ? 1000 : 0.05;
  return (
    <div className={`map-studio__parameter${editable ? " is-editable" : ""}`}>
      <div className="map-studio__parameter-head">
        <span>{parameter.label}</span>
        {editable ? <GameBadge tone="success">实时预览</GameBadge> : <GameBadge>只读</GameBadge>}
      </div>
      <div className="map-studio__parameter-value">
        {editable ? (
          <GameInput
            aria-label={parameter.label}
            max={parameter.unit === "instances" ? undefined : 20}
            min={0}
            onChange={(event) => onChange(parameter, Number(event.currentTarget.value))}
            step={step}
            type="number"
            value={current}
          />
        ) : (
          <strong>{valueText(parameter.value, parameter.unit)}</strong>
        )}
        {editable ? <span>{parameter.unit ?? ""}</span> : null}
      </div>
      {parameter.note ? <p className="map-studio__parameter-note">{parameter.note}</p> : null}
      {sourceLine(parameter.source)}
    </div>
  );
}

function ColorStrip({ colors }: { readonly colors: readonly InspectorColorStop[] }) {
  return (
    <div className="map-studio__colors" aria-label="颜色分带">
      {colors.map((color) => (
        <div className="map-studio__color" key={color.id}>
          <span className="map-studio__swatch" style={{ backgroundColor: color.hex }} />
          <div>
            <strong>{color.label}</strong>
            <code>{color.hex}</code>
          </div>
          <span className="map-studio__source map-studio__source--compact">
            <code>{color.source.file}</code>
            <span>·</span>
            <code>{color.source.export}</code>
          </span>
        </div>
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  source,
}: {
  readonly label: string;
  readonly value: string;
  readonly source: InspectorAsset["bytesSource"];
}) {
  return (
    <div className="map-studio__metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {source ? (
        <span className="map-studio__source map-studio__source--compact">
          <code>{source.file}</code>
          <span>·</span>
          <code>{source.export}</code>
        </span>
      ) : null}
    </div>
  );
}

function AssetCard({ asset }: { readonly asset: InspectorAsset }) {
  return (
    <article className="map-studio__asset" data-asset-key={asset.key}>
      <div className="map-studio__asset-title">
        <div>
          <h4>{asset.name}</h4>
          <p>{asset.role}</p>
        </div>
        <GameBadge tone={asset.techniqueLock === "landmark" ? "warning" : "neutral"}>
          {asset.pack}
        </GameBadge>
      </div>
      <dl className="map-studio__asset-paths">
        <div>
          <dt>运行时文件</dt>
          <dd>
            <code>{asset.runtimePath ?? "无：程序化生成"}</code>
          </dd>
        </div>
        <div>
          <dt>资源来源</dt>
          <dd>
            <code>{asset.sourcePath ?? "packages/world/src/island/island-grass-render.tsx"}</code>
          </dd>
        </div>
      </dl>
      <div className="map-studio__metrics">
        <Metric label="文件字节" value={formatBytes(asset.bytes)} source={asset.bytesSource} />
        <Metric
          label="单模型三角形"
          value={formatNumber(asset.triangles)}
          source={asset.trianglesSource}
        />
        <Metric
          label="当前实例"
          value={formatNumber(asset.instances)}
          source={asset.instancesSource}
        />
      </div>
      <div className="map-studio__lock">
        <div>
          <GameBadge>🔒 技术锁 · {asset.techniqueLock}</GameBadge>
          <p>{asset.technique}</p>
          <p className="map-studio__lock-note">要改这条技术锁，必须先修订 ADR-0008。</p>
        </div>
        <span className="map-studio__readonly">只读</span>
      </div>
      <span className="map-studio__source">
        <span>技术出处</span>
        <code>{asset.techniqueSource.file}</code>
        <span>·</span>
        <code>{asset.techniqueSource.export}</code>
      </span>
      {asset.note ? <p className="map-studio__asset-note">{asset.note}</p> : null}
    </article>
  );
}

function BudgetPanel({ budget }: { readonly budget: InspectorLayerDescription["budget"] }) {
  return (
    <GamePanel className="map-studio__recipe" title="预算 · 按屏幕像素分配">
      <div className="map-studio__budget-hero">
        <div>
          <span>预算基线</span>
          <strong>{formatNumber(budget.triangleBudget)} tris</strong>
        </div>
        <div>
          <span>当前实际用量</span>
          <strong>
            {budget.actualTriangles === null
              ? "加载中"
              : `${formatNumber(budget.actualTriangles)} tris`}
          </strong>
        </div>
      </div>
      <p className="map-studio__budget-basis">{budget.basis}</p>
      <div className="map-studio__budget-breakdown">
        {budget.breakdown.map((entry) => (
          <div key={entry.label}>
            <span>{entry.label}</span>
            <strong>{formatNumber(entry.triangles)}</strong>
          </div>
        ))}
      </div>
      {sourceLine(budget.budgetSource)}
    </GamePanel>
  );
}

function RecipePanel({
  description,
  controlValues,
  assetChoices,
  onAssetChoice,
  onParameterChange,
}: {
  readonly description: InspectorLayerDescription;
  readonly controlValues: {
    readonly keyLightIntensity: number;
    readonly ambientLightIntensity: number;
    readonly grassDensityLimit: number;
    readonly grassHeightMultiplier: number;
    readonly terrainBrightness: number;
  };
  readonly assetChoices: Readonly<Record<string, string>>;
  readonly onAssetChoice: (roleId: string, targetKey: string) => void;
  readonly onParameterChange: (parameter: InspectorParameter, value: number) => void;
}) {
  const parameters = mutableParameterIds(description);
  return (
    <>
      <GamePanel className="map-studio__recipe" title="地形配方">
        <p className="map-studio__generator">{description.terrain.generator}</p>
        <div className="map-studio__parameter-list">
          {description.terrain.parameters.map((parameter) => (
            <ParameterRow
              key={parameter.id}
              parameter={parameter}
              values={controlValues}
              onChange={onParameterChange}
            />
          ))}
        </div>
        <div className="map-studio__subheading">
          <span>颜色分带</span>
          <GameBadge>来自真实 palette</GameBadge>
        </div>
        <ColorStrip colors={description.terrain.colors} />
        <span className="map-studio__source">
          <span>网格三角形</span>
          <strong>{formatNumber(description.terrain.geometryTriangles)}</strong>
          <code>{description.terrain.geometrySource.file}</code>
          <span>·</span>
          <code>{description.terrain.geometrySource.export}</code>
        </span>
      </GamePanel>

      <GamePanel className="map-studio__recipe" title="植被 / 装饰配方">
        {parameters.length > 0 ? (
          <div className="map-studio__parameter-list">
            {description.dressing.parameters.map((parameter) => (
              <ParameterRow
                key={parameter.id}
                parameter={parameter}
                values={controlValues}
                onChange={onParameterChange}
              />
            ))}
          </div>
        ) : null}
        <div className="map-studio__role-list">
          {description.dressing.roles.map((role) => (
            <RolePicker
              key={role.id}
              role={role}
              description={description}
              value={assetChoices[role.id] ?? ""}
              onChange={onAssetChoice}
            />
          ))}
        </div>
        <div className="map-studio__asset-list">
          {description.dressing.assets.length > 0 ? (
            description.dressing.assets.map((asset) => <AssetCard asset={asset} key={asset.key} />)
          ) : (
            <p className="map-studio__empty">这一层没有外部植被 / 装饰模型。</p>
          )}
        </div>
        <p className="map-studio__recipe-note">{description.dressing.note}</p>
      </GamePanel>

      <GamePanel className="map-studio__recipe" title="光照与颜色">
        <div className="map-studio__parameter-list">
          {description.lighting.parameters.map((parameter) => (
            <ParameterRow
              key={parameter.id}
              parameter={parameter}
              values={controlValues}
              onChange={onParameterChange}
            />
          ))}
        </div>
        <ColorStrip colors={description.lighting.colors} />
      </GamePanel>

      <BudgetPanel budget={description.budget} />
    </>
  );
}

function RolePicker({
  role,
  description,
  value,
  onChange,
}: {
  readonly role: InspectorRoleChoice;
  readonly description: InspectorLayerDescription;
  readonly value: string;
  readonly onChange: (roleId: string, targetKey: string) => void;
}) {
  const hasInstances = role.currentKeys.length > 0;
  return (
    <GameField
      label={`${role.label}模型`}
      hint={`${sourceText(role.source)}；${hasInstances ? roleCurrentLabel(role, description.dressing.assets) : "这一层当前没有实例"}`}
    >
      <select
        aria-label={`${role.label}模型`}
        className="map-studio__select"
        disabled={!hasInstances}
        onChange={(event) => onChange(role.id, event.currentTarget.value)}
        value={value}
      >
        <option value="">沿用配方原资源</option>
        {description.dressing.catalog.map((asset) => (
          <option key={asset.key} value={asset.key}>
            {catalogLabel(asset)}
          </option>
        ))}
      </select>
    </GameField>
  );
}

export function MapStudioScreen({
  studies,
  nodes,
  world,
  courseProgress,
  progressPort,
  focusedStudyId,
  planetStudies,
  onSelectStudy,
}: MapStudioScreenProps) {
  const [activeLayer, setActiveLayer] = useState<StudioLayer>("planet");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<InspectorRuntimeMetrics>({});
  const [triangleCounts, setTriangleCounts] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const [assetChoices, setAssetChoices] = useState<Record<string, string>>({});
  const [assetRevision, setAssetRevision] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const selectedStudyId = focusedStudyId ?? studies[0]?.id ?? planetStudies[0]?.id ?? null;
  const selectedStudy = studies.find((study) => study.id === selectedStudyId) ?? studies[0];

  useEffect(() => {
    if (!focusedStudyId && selectedStudyId) onSelectStudy(selectedStudyId);
  }, [focusedStudyId, onSelectStudy, selectedStudyId]);

  useEffect(() => {
    const nextCourseId = selectedStudy?.courses[0]?.id ?? null;
    if (!selectedStudy?.courses.some((course) => course.id === selectedCourseId)) {
      setSelectedCourseId(nextCourseId);
    }
  }, [selectedCourseId, selectedStudy]);

  useEffect(() => {
    let alive = true;
    void loadIslandAssetTriangleCounts().then((counts) => {
      if (alive) setTriangleCounts(counts);
    });
    return () => {
      alive = false;
    };
  }, []);

  const source = useMemo(() => progressSourceOf(progressPort), [progressPort]);
  const previewWorld = useMemo(
    () => (nodes && selectedStudyId ? placeWorld(nodes, courseProgress, selectedStudyId) : world),
    [courseProgress, nodes, selectedStudyId, world],
  );
  const selectedCourse =
    selectedStudy?.courses.find((course) => course.id === selectedCourseId) ??
    selectedStudy?.courses[0] ??
    null;
  const courseLessons = useMemo<readonly LessonPlacement[]>(() => {
    if (!selectedStudy || !selectedCourse) return [];
    return placeCourse(selectedStudy.id, worldCourse(selectedCourse), source);
  }, [selectedCourse, selectedStudy, source]);
  const courseBlueprint = useMemo(
    () =>
      courseLessons[0]?.blueprint ??
      islandBlueprint({
        studyId: selectedStudy?.id ?? "map-studio-preview",
        courseId: selectedCourse?.id ?? "map-studio-preview",
        lessonCount: 1,
        themeSelection: islandThemeSelectionForCourse(
          selectedStudy?.id ?? "map-studio-preview",
          selectedCourse?.id ?? "map-studio-preview",
        ),
      }),
    [courseLessons, selectedCourse?.id, selectedStudy?.id],
  );

  const description = useMemo(() => {
    if (activeLayer === "planet") {
      return describePlanetLayer({ studyIds: planetStudies.map((study) => study.id) });
    }
    if (activeLayer === "world") {
      return describeWorldLayer({
        islands:
          previewWorld?.placements.map((entry) => ({
            blueprint: entry.blueprint,
            targetRadius: entry.radius,
          })) ?? [],
        runtime,
        skyStudyId: selectedStudyId,
        triangleCounts,
      });
    }
    return describeIslandLayer({
      blueprint: courseBlueprint,
      runtime,
      skyStudyId: selectedStudyId,
      triangleCounts,
    });
  }, [
    activeLayer,
    courseBlueprint,
    planetStudies,
    previewWorld,
    runtime,
    selectedStudyId,
    triangleCounts,
  ]);

  const controlDefaults = useMemo(
    () => ({
      keyLightIntensity: numberParameterValue(description, "keyLightIntensity", 1),
      ambientLightIntensity: numberParameterValue(description, "ambientLightIntensity", 1),
      grassDensityLimit: numberParameterValue(description, "grassDensityLimit", 0),
      grassHeightMultiplier: numberParameterValue(description, "grassHeightMultiplier", 1),
      terrainBrightness: numberParameterValue(description, "terrainBrightness", 0),
    }),
    [description],
  );
  // Leva supplies the canonical control state and change notifications. The
  // studio renders those values through SwimmerUIKit so the authoring panel
  // keeps the product's visual language instead of mounting Leva's global HUD.
  const controlStore = useCreateStore();
  const [controlValues, setControlValues] = useControls(
    `map-studio-preview-${activeLayer}`,
    () => ({
      keyLightIntensity: {
        value: controlDefaults.keyLightIntensity,
        min: 0,
        max: Math.max(12, controlDefaults.keyLightIntensity * 2),
        step: 0.1,
      },
      ambientLightIntensity: {
        value: controlDefaults.ambientLightIntensity,
        min: 0,
        max: Math.max(6, controlDefaults.ambientLightIntensity * 2),
        step: 0.05,
      },
      grassDensityLimit: {
        value: controlDefaults.grassDensityLimit,
        min: 0,
        max: Math.max(1, controlDefaults.grassDensityLimit * 2),
        step: controlDefaults.grassDensityLimit > 0 ? 1000 : 1,
      },
      grassHeightMultiplier: {
        value: controlDefaults.grassHeightMultiplier,
        min: 0,
        max: 3,
        step: 0.05,
      },
      terrainBrightness: {
        value: controlDefaults.terrainBrightness,
        min: -1,
        max: 1,
        step: 0.01,
      },
    }),
    { store: controlStore },
    [activeLayer, controlDefaults],
  );

  const tuning = useMemo(
    () => ({
      keyLightIntensity: Number(controlValues.keyLightIntensity),
      ambientLightIntensity: Number(controlValues.ambientLightIntensity),
      grassDensityMultiplier:
        controlDefaults.grassDensityLimit > 0
          ? Number(controlValues.grassDensityLimit) / controlDefaults.grassDensityLimit
          : 0,
      grassHeightMultiplier: Number(controlValues.grassHeightMultiplier),
      terrainBrightness: Number(controlValues.terrainBrightness),
    }),
    [controlDefaults.grassDensityLimit, controlValues],
  );

  const onParameterChange = (parameter: InspectorParameter, value: number) => {
    switch (parameter.previewKey) {
      case "keyLightIntensity":
        setControlValues({ keyLightIntensity: value });
        break;
      case "ambientLightIntensity":
        setControlValues({ ambientLightIntensity: value });
        break;
      case "grassDensityLimit":
        setControlValues({ grassDensityLimit: value });
        break;
      case "grassHeightMultiplier":
        setControlValues({ grassHeightMultiplier: value });
        break;
      case "terrainBrightness":
        setControlValues({ terrainBrightness: value });
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const overrides = description.dressing.roles.flatMap((role) => {
      const targetKey = assetChoices[role.id];
      const target = description.dressing.catalog.find((asset) => asset.key === targetKey);
      if (!target || role.currentKeys.length === 0) return [];
      return [
        {
          role: role.id as PreviewRole,
          fromKeys: role.currentKeys,
          target: { pack: target.packId, assetId: target.assetId },
        },
      ];
    });
    applyPreviewAssetOverrides(overrides);
    setAssetRevision((revision) => revision + 1);
    return () => clearPreviewAssetOverrides();
  }, [assetChoices, description]);

  const activeWorldLearner =
    previewWorld?.placements.find((entry) => entry.state === "live")?.position ??
    previewWorld?.placements[0]?.position ??
    null;
  const worldFrame = useMemo(() => frameWorld(activeWorldLearner), [activeWorldLearner]);
  const courseFrame = useMemo(() => frameCourse(courseLessons), [courseLessons]);
  const camera =
    activeLayer === "world"
      ? worldFrame
      : (courseFrame ?? { cameraFrom: [0, 22, 48] as const, lookAt: [0, 0, 0] as const });

  const modificationText = useMemo(
    () => buildModificationText(description, controlValues, assetChoices),
    [assetChoices, controlValues, description],
  );

  const exportConfig = () => {
    downloadJson(`map-studio-${activeLayer}.json`, {
      schemaVersion: 1,
      layer: activeLayer,
      liveSource: description.liveSource,
      parameters: mutableParameterIds(description).map((parameter) => ({
        id: parameter.id,
        source: parameter.source,
        baseValue: parameter.value,
        previewValue: changeValue(parameter, controlValues),
      })),
      assets: description.dressing.roles.map((role) => ({
        role: role.id,
        source: role.source,
        targetKey: assetChoices[role.id] ?? null,
      })),
      budget: description.budget,
    });
  };

  const copyModification = async () => {
    try {
      await navigator.clipboard.writeText(modificationText);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = modificationText;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1600);
  };

  const projectOptions =
    studies.length > 0 ? studies : planetStudies.map((study) => ({ ...study, courses: [] }));
  const displayControlValues = {
    keyLightIntensity: Number(controlValues.keyLightIntensity),
    ambientLightIntensity: Number(controlValues.ambientLightIntensity),
    grassDensityLimit: Number(controlValues.grassDensityLimit),
    grassHeightMultiplier: Number(controlValues.grassHeightMultiplier),
    terrainBrightness: Number(controlValues.terrainBrightness),
  };

  return (
    <main className="map-studio" data-map-studio>
      <header className="map-studio__header">
        <div>
          <p className="map-studio__eyebrow">作者工作台 / PROCEDURAL MAP</p>
          <h1>地图配方台</h1>
          <p className="map-studio__lede">
            一眼看清三层地图从哪里来。左边是正在运行的场景，右边是可追溯、可预览的配方。
          </p>
        </div>
        <div className="map-studio__actions">
          <GameBadge tone="success">AUTHORING ONLY</GameBadge>
          <GameButton variant="secondary" onClick={exportConfig}>
            导出配置 JSON
          </GameButton>
          <GameButton variant="primary" onClick={() => void copyModification()}>
            {copyState === "copied" ? "已复制修改说明" : "复制修改说明"}
          </GameButton>
        </div>
      </header>

      <GameTabs
        activeId={activeLayer}
        id="map-studio-tabs"
        onSelect={(id) => setActiveLayer(id as StudioLayer)}
        tabs={TABS}
      />

      <section
        aria-labelledby={`map-studio-tabs-${activeLayer}`}
        className="map-studio__workspace"
        id="map-studio-panel"
        role="tabpanel"
      >
        <div className="map-studio__preview-column">
          <div className="map-studio__preview-header">
            <div>
              <span className="map-studio__kicker">LIVE PREVIEW / {description.projection}</span>
              <h2>{layerTitle(activeLayer)}</h2>
            </div>
            <div className="map-studio__context-fields">
              <GameField label="预览项目">
                <select
                  aria-label="预览项目"
                  className="map-studio__select"
                  disabled={projectOptions.length === 0}
                  onChange={(event) => onSelectStudy(event.currentTarget.value)}
                  value={selectedStudyId ?? ""}
                >
                  {projectOptions.map((study) => (
                    <option key={study.id} value={study.id}>
                      {study.title}
                    </option>
                  ))}
                </select>
              </GameField>
              {activeLayer === "island" ? (
                <GameField label="预览课程">
                  <select
                    aria-label="预览课程"
                    className="map-studio__select"
                    disabled={!selectedStudy || selectedStudy.courses.length === 0}
                    onChange={(event) => setSelectedCourseId(event.currentTarget.value)}
                    value={selectedCourse?.id ?? ""}
                  >
                    {selectedStudy?.courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </GameField>
              ) : null}
            </div>
          </div>
          <div className="map-studio__canvas-shell">
            <div className="map-studio__renderer">
              {activeLayer === "planet" ? (
                <PlanetStage
                  studies={planetStudies}
                  selectedId={selectedStudyId}
                  onSelect={onSelectStudy}
                >
                  <PreviewOverrideBridge layer="planet" tuning={tuning} onMetrics={setRuntime} />
                </PlanetStage>
              ) : (
                <WorldMapCanvas
                  world={activeLayer === "world" ? previewWorld : null}
                  cameraFrom={camera.cameraFrom}
                  lookAt={camera.lookAt}
                  learnerAt={activeLayer === "world" ? activeWorldLearner : null}
                  avatarRecipe={null}
                  avatarSignedIn={false}
                  skyStudyId={selectedStudyId}
                  markers={activeLayer === "island" ? courseMarkers(courseLessons) : []}
                  onPick={() => undefined}
                  onHover={() => undefined}
                  polar={activeLayer === "island" ? COURSE_POLAR : undefined}
                  stageChildren={
                    activeLayer === "island" ? (
                      <>
                        <CourseScene
                          lessons={courseLessons}
                          onPick={() => undefined}
                          onHover={() => undefined}
                          skyStudyId={selectedStudyId}
                          assetRevision={assetRevision}
                        />
                        <PreviewOverrideBridge
                          layer="island"
                          tuning={tuning}
                          onMetrics={setRuntime}
                        />
                      </>
                    ) : (
                      <PreviewOverrideBridge layer="world" tuning={tuning} onMetrics={setRuntime} />
                    )
                  }
                />
              )}
            </div>
            <div className="map-studio__canvas-caption">
              <span>场景实现</span>
              <code>{sourceText(description.liveSource)}</code>
            </div>
          </div>
        </div>

        <aside className="map-studio__inspector" aria-label="地图配方检视面板">
          <div className="map-studio__inspector-intro">
            <div>
              <span className="map-studio__kicker">RECIPE INSPECTOR</span>
              <h2>检视面板</h2>
            </div>
            <GameBadge tone="ai">来源可追溯</GameBadge>
          </div>
          <div className="map-studio__runtime-callout">
            <strong>预览覆盖层</strong>
            <span>数值改动和资源替换只存在于这个页面，不会写回磁盘。</span>
          </div>
          <RecipePanel
            description={description}
            controlValues={displayControlValues}
            assetChoices={assetChoices}
            onAssetChoice={(roleId, targetKey) =>
              setAssetChoices((current) => {
                if (!targetKey) {
                  const next = { ...current };
                  delete next[roleId];
                  return next;
                }
                return { ...current, [roleId]: targetKey };
              })
            }
            onParameterChange={onParameterChange}
          />
          <GamePanel
            className="map-studio__recipe map-studio__modification"
            title="可直接交给 AI 的修改说明"
          >
            <pre>{modificationText}</pre>
          </GamePanel>
        </aside>
      </section>
    </main>
  );
}

function buildModificationText(
  description: InspectorLayerDescription,
  values: {
    readonly keyLightIntensity: number;
    readonly ambientLightIntensity: number;
    readonly grassDensityLimit: number;
    readonly grassHeightMultiplier: number;
    readonly terrainBrightness: number;
  },
  assetChoices: Readonly<Record<string, string>>,
): string {
  const lines: string[] = [];
  for (const parameter of mutableParameterIds(description)) {
    const current = changeValue(parameter, values);
    if (typeof parameter.value !== "number" || current === parameter.value) continue;
    lines.push(parameter.source.file);
    lines.push(
      `  ${parameter.source.export}: ${valueText(parameter.value, parameter.unit)} -> ${valueText(current, parameter.unit)}`,
    );
  }
  for (const role of description.dressing.roles) {
    const targetKey = assetChoices[role.id];
    if (!targetKey) continue;
    const target = description.dressing.catalog.find((asset) => asset.key === targetKey);
    if (!target) continue;
    const current = description.dressing.assets.find((asset) =>
      role.currentKeys.includes(asset.key),
    );
    lines.push("packages/world/src/island/island-dressing.ts");
    lines.push(
      `  ${role.label}的资源: ${current ? `${current.pack}/${current.assetId}` : "配方原资源"} -> ${target.pack}/${target.assetId}`,
    );
  }
  return lines.length > 0
    ? lines.join("\n")
    : "当前预览没有未写回的修改。\n\n所有显示数值都来自真实 renderer 模块。";
}
