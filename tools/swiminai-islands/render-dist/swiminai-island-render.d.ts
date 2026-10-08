import type { ReactElement, ReactNode } from "react";
import type * as THREE from "three";
import type { GradeConfig } from "@pieai/swimmer-render-kit";

export type IslandRouteArchetype =
  | "arc"
  | "horseshoe"
  | "loop-around-hill"
  | "switchback"
  | "serpentine";
export type IslandUnitSigil = "leaf" | "wave" | "star" | "shell" | "mountain" | "sun";
export type IslandUnitMotionVariant = "drift" | "pulse" | "orbit" | "sway" | "spark" | "breathe";

export interface IslandThemeSelection {
  readonly naturalBasePackId: string;
  readonly accentPackIds: readonly string[];
  readonly recipeId?: string;
}

export interface IslandPoint {
  readonly x: number;
  readonly z: number;
}

export interface IslandOutlinePoint extends IslandPoint {
  readonly angle: number;
  readonly scale: number;
}

export interface IslandUnitVisualToken {
  readonly palette: string;
  readonly sigil: IslandUnitSigil;
  readonly motionVariant: IslandUnitMotionVariant;
  readonly variant: string;
}

export interface IslandRouteNode extends IslandPoint {
  readonly id: string;
  readonly index: number;
  readonly next: string | null;
  readonly t: number;
  readonly y: number;
  readonly unitId: string;
  readonly unitIndex: number;
  readonly visualToken: IslandUnitVisualToken;
}

export interface IslandGeometryNode extends IslandPoint {
  readonly index: number;
  readonly t: number;
  readonly y: number;
}

export interface IslandCenterlinePoint extends IslandPoint {
  readonly t: number;
  readonly y: number;
}

export interface IslandRoute {
  readonly semantic: "linear";
  readonly archetype: IslandRouteArchetype;
  readonly branchCount: 0;
  readonly nodeCount: number;
  readonly centerlineSamples: number;
  readonly roadWidth: number;
  readonly shoulderWidth: number;
  readonly nodeRadius: number;
  readonly clearance: number;
}

export interface IslandTerrainPatch extends IslandPoint {
  readonly id: string;
  readonly radius: number;
  readonly amplitude: number;
  readonly frequency: number;
  readonly phase: number;
}

export interface IslandZone extends IslandPoint {
  readonly id: "arrival" | "journey" | "summit";
  readonly radius: number;
  readonly importance: number;
}

export interface IslandHero extends IslandPoint {
  readonly y: number;
  readonly heading: number;
  readonly radius: number;
  readonly importance: number;
}

export interface IslandUnderside {
  readonly depth: number;
  readonly taper: number;
  readonly ringCount: number;
  readonly importance: number;
}

export interface IslandVisibilityImportance {
  readonly course: number;
  readonly world: number;
}

export interface IslandBlueprint {
  readonly version: 2;
  readonly layoutRevision: string;
  readonly studyId: string;
  readonly courseId: string;
  readonly seed: string;
  readonly lessonCount: number;
  readonly route: IslandRoute;
  readonly geometryNodes: readonly IslandGeometryNode[];
  readonly checkpointGaps?: readonly number[];
  readonly centerline: readonly IslandCenterlinePoint[];
  readonly outline: readonly IslandOutlinePoint[];
  readonly bounds: {
    readonly halfX: number;
    readonly halfZ: number;
    readonly maxHalf: number;
  };
  readonly terrainPatches: readonly IslandTerrainPatch[];
  readonly zones: readonly IslandZone[];
  readonly hero: IslandHero;
  readonly underside: IslandUnderside;
  readonly themeSelection: IslandThemeSelection;
  readonly visibilityImportance: IslandVisibilityImportance;
  readonly nodes: readonly IslandRouteNode[];
}

export interface SwimInAIIslandDisplay {
  readonly id?: string;
  readonly name?: string;
  readonly dimmed?: boolean;
}

export interface SwimInAIIslandRenderProps {
  readonly blueprint: IslandBlueprint;
  readonly detail: "course" | "world";
  readonly targetRadius?: number;
  readonly display?: SwimInAIIslandDisplay;
  readonly showDressing?: boolean;
  readonly showGrass?: boolean;
  readonly onClick?: () => void;
  readonly onPointerOver?: () => void;
  readonly onPointerOut?: () => void;
}

export declare function SwimInAIIslandRender(props: SwimInAIIslandRenderProps): ReactElement | null;

export interface MapLightingProps {
  readonly groundRadius: number;
  readonly skyMid: number;
  readonly shadows?: boolean;
  readonly sunProfile?: MapSunProfile;
}
export declare function MapLighting(props: MapLightingProps): ReactElement;

export declare function WorldEnvironment(props: { readonly children: ReactNode }): ReactElement;
export declare const WORLD_ENVIRONMENT: {
  readonly cubeSize: number;
  readonly intensity: 0.16;
};
export declare const DEFAULT_WORLD_ENVIRONMENT_STOPS: SkyDomeStops;
export interface EnvironmentTextureMemory {
  readonly persistent: number;
  readonly generationPeak: number;
  readonly atlasWidth: number;
  readonly atlasHeight: number;
}
export declare function estimateEnvironmentTextureMemory(
  requestedCubeSize?: number,
): EnvironmentTextureMemory;
export declare function skyEnvironmentKey(stops: SkyDomeStops): string;

export type SkyDomeStops = {
  readonly zenith: number;
  readonly mid: number;
  readonly horizon: number;
  readonly nadir?: number;
  readonly sunProfile?: MapSunProfile;
};
export declare function SkyDome(props: { readonly stops: SkyDomeStops }): ReactElement;
export declare function createSkyDomeUniforms(stops: SkyDomeStops): {
  readonly uZenith: { readonly value: THREE.Color };
  readonly uMid: { readonly value: THREE.Color };
  readonly uHorizon: { readonly value: THREE.Color };
  readonly uNadir: { readonly value: THREE.Color };
  readonly uSunDirection: { readonly value: THREE.Vector3 };
  readonly uSunColor: { readonly value: THREE.Color };
  readonly uSunGlowColor: { readonly value: THREE.Color };
  readonly uSunSize: { readonly value: number };
  readonly uSunGlowSize: { readonly value: number };
};
export declare const SKY_DOME_NAME: string;
export declare const SKY_DOME_STOPS_KEY: string;
export declare const SKY_DOME_VERTEX_SHADER: string;
export declare const SKY_DOME_FRAGMENT_SHADER: string;

export interface AerialWorldPlateProps {
  readonly extent: number;
  readonly level: number;
  readonly visible?: boolean;
}
export declare function AerialWorldPlate(props: AerialWorldPlateProps): ReactElement;
export interface DeepSeaProps {
  readonly extent: number;
  readonly level: number;
}
export declare function DeepSea(props: DeepSeaProps): ReactElement;
export declare const SEA_COLORS: Readonly<{
  readonly shallow: number;
  readonly deep: number;
  readonly plateTint: number;
  readonly beyond: number;
}>;

export type MapSunProfile = "course" | "catalogue" | "garden";
export interface WorldSunStyle {
  readonly elevationDeg: number;
  readonly azimuthDeg: number;
  readonly keyIntensity: number;
  readonly keyColor: number;
  readonly hemisphereIntensity: number;
  readonly hemisphereGround: number;
  readonly ambientIntensity: number;
  readonly ambientColor: number;
  readonly rimIntensity: number;
  readonly rimColor: number;
  readonly distanceFactor: number;
}
export declare const WORLD_SUN: Readonly<WorldSunStyle>;
export declare const CATALOGUE_SUN: Readonly<WorldSunStyle>;
export declare const GARDEN_SUN: Readonly<WorldSunStyle>;
export declare function mapSunStyle(profile?: MapSunProfile): Readonly<WorldSunStyle>;
export declare const worldSunStyle: typeof mapSunStyle;
export declare function worldSunDirection(
  profile?: MapSunProfile,
): readonly [number, number, number];
export declare function worldSunPosition(
  distance: number,
  profile?: MapSunProfile,
): readonly [number, number, number];
export declare function worldKeyToFillRatio(): number;
export declare function worldTotalFill(environmentIntensity: number): number;
export interface WorldShadowFrustum {
  readonly half: number;
  readonly near: number;
  readonly far: number;
  readonly mapSize: number;
  readonly lightDistance: number;
}
export declare function worldShadowFrustum(groundRadius: number): WorldShadowFrustum;
export declare function worldShadowNormalBias(
  frustum: Pick<WorldShadowFrustum, "half">,
  mapSize: number,
): number;

export declare const WORLD_GRADE_PIVOT_SRGB8: 72;
export declare const WORLD_GRADE: GradeConfig;
export declare const WORLD_GRADE_FRAGMENT: string;
export interface GradePass {
  readonly target: THREE.WebGLRenderTarget;
  resize(width: number, height: number): void;
  render(renderer: THREE.WebGLRenderer, input?: THREE.Texture): void;
  dispose(): void;
}
export declare function createGradePass(): GradePass;
export declare function assertWorldGradePipeline(renderer: THREE.WebGLRenderer): void;

export interface IslandLookBounds {
  readonly halfX: number;
  readonly halfZ: number;
  readonly outline?: readonly IslandPoint[];
}
export interface IslandLookViewport {
  readonly width: number;
  readonly height: number;
}
export interface IslandLookCameraPose {
  readonly cameraFrom: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
  readonly polar: number;
  readonly azimuth: number;
  readonly fov: number;
  readonly distance: number;
}
export type IslandLookShotId = "course-design" | "course-near" | "course-far" | "world-design";
export declare function islandLookCameraForShot(
  shot: IslandLookShotId,
  bounds: IslandLookBounds,
  viewport: IslandLookViewport,
): IslandLookCameraPose;
export interface IslandDressingPlacement {
  readonly x: number;
  readonly z: number;
  readonly radius?: number;
  readonly kind?: string;
}
export interface IslandDressingPlan {
  readonly placements: readonly IslandDressingPlacement[];
}
export interface IslandLookSceneSource {
  readonly detail: "course" | "world";
  readonly blueprints: readonly IslandBlueprint[];
  readonly dressingPlans: readonly IslandDressingPlan[];
  readonly nodePositions: readonly IslandPoint[];
  readonly dressingPlacementCount?: number;
  readonly dressingAssetPlacementCount?: number;
  readonly dressingRimPlacementCount?: number;
  readonly detailBounds?: IslandLookBounds;
}
export interface IslandLookSceneSourceOptions {
  readonly dressingPlacementCount?: number;
  readonly dressingAssetPlacementCount?: number;
  readonly dressingRimPlacementCount?: number;
  readonly detailBounds?: IslandLookBounds;
}
export declare function islandLookSceneSource(
  detail: "course" | "world",
  blueprints: readonly IslandBlueprint[],
  nodePositions?: readonly IslandPoint[],
  options?: IslandLookSceneSourceOptions,
): IslandLookSceneSource;
export declare const ISLAND_LOOK_CONTRACT: Readonly<{
  readonly landCoverageMin: number;
  readonly landMedianLightnessMin: number;
  readonly landMedianLightnessMax: number;
  readonly landP95LightnessMin: number;
  readonly landLightnessRiseMin: number;
  readonly backgroundLightnessSpreadMin: number;
  readonly sceneLinearRangeMin: number;
  readonly lightnessP2Max: number;
  readonly lightnessP98Min: number;
  readonly lightnessStdDevMin: number;
  readonly grassHueCountMin: number;
  readonly grassHueSpreadMin: number;
  readonly grassLightnessSpreadMin: number;
  readonly grassLightnessP95Min: number;
  readonly accentAreaMin: number;
  readonly accentAreaMax: number;
  readonly keyToFillMin: number;
  readonly propsPerLessonNodeMin: number;
  readonly rimPropShareMin: number;
  readonly worldPropsPerIslandMax: number;
  readonly nodeOcclusionMax: number;
  readonly domLabelContrastMin: number;
}>;

export interface IslandLookLayerDistribution {
  readonly terrainPatches: number;
  readonly routeSamples: number;
  readonly dressingProps: number;
  readonly lessonNodes: number;
}
export interface IslandLookCodeMetrics {
  readonly detail: "course" | "world";
  readonly lessonNodeCount: number;
  readonly coursePropCount: number;
  readonly propsPerLessonNode: number;
  readonly rimPropShare: number;
  readonly layerDistribution: IslandLookLayerDistribution;
  readonly keyToFillRatio: number | null;
  readonly worldPropsPerIsland: number;
  readonly nodeOcclusionShare: number;
}
export interface IslandLookPixelMetrics {
  readonly colorSpace: {
    readonly lightness: "CIELAB L* D65 from sRGB";
    readonly hueAndSaturation: "HSL from sRGB";
  };
  readonly sampledPixels: number;
  readonly lightnessP2: number;
  readonly lightnessP98: number;
  readonly lightnessStdDev: number;
  readonly landCoverage: number;
  readonly landMedianLightness: number;
  readonly landP95Lightness: number;
  readonly landLightnessRise: number;
  readonly backgroundLightnessSpread: number;
  readonly grassLightnessSpread: number;
  readonly grassLightnessP95: number;
  readonly grassHueCount: number;
  readonly grassHueSpread: number;
  readonly accentArea: number;
}
export interface DomLabelContrastSample {
  readonly label: string;
  readonly foreground: readonly [number, number, number];
  readonly background: readonly [number, number, number];
}
export interface IslandLookBrowserReport {
  readonly ready: boolean;
  readonly canvas: { readonly width: number; readonly height: number };
  readonly pixels: IslandLookPixelMetrics | null;
  readonly code: IslandLookCodeMetrics;
  readonly domLabelContrastSamples: readonly DomLabelContrastSample[];
}
export declare function measureIslandImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): IslandLookPixelMetrics;
export declare function measureIslandCodeMetrics(
  source: IslandLookSceneSource,
  keyToFillRatio?: number | null,
): IslandLookCodeMetrics;
export declare function measureKeyToFillRatio(scene: THREE.Scene): number | null;
export declare function measureIslandLookInBrowser(args: {
  readonly canvas: HTMLCanvasElement;
  readonly scene: THREE.Scene;
  readonly source: IslandLookSceneSource;
}): IslandLookBrowserReport;

export declare const SWIMINAI_ISLAND_RENDER_EXTERNALS: readonly string[];
export declare const SWIMINAI_ISLAND_RENDER_ALIGNMENT: Readonly<{
  readonly three: "0.185.1";
  readonly react: "19.2.8";
  readonly reactDom: "19.2.8";
  readonly fiber: "9.6.1";
  readonly drei: "10.7.8";
  readonly swimmerRenderKit: "0.5.0";
}>;
