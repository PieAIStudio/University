/** Browser and blueprint metrics for the DEV-only island look judge. */
import * as THREE from "three";

import type { IslandDressingPlacement, IslandDressingPlan } from "./island-dressing.js";
import type { IslandBlueprint, IslandPoint } from "./island-blueprint.js";
import type { IslandLookSceneSource } from "./island-look.js";

export interface IslandLookLayerDistribution {
  /** Procedural terrain patch count: the broad landform layer. */
  readonly terrainPatches: number;
  /** Centerline samples: the route layer that carries teaching order. */
  readonly routeSamples: number;
  /** Dressing placements: the natural/accent decoration layer. */
  readonly dressingProps: number;
  /** Semantic nodes: the learner-facing lesson layer. */
  readonly lessonNodes: number;
}

export interface IslandLookCodeMetrics {
  readonly detail: "course" | "world";
  readonly lessonNodeCount: number;
  readonly coursePropCount: number;
  readonly propsPerLessonNode: number;
  readonly rimPropShare: number;
  /** Four structural layers, read from the shared blueprint and plan. */
  readonly layerDistribution: IslandLookLayerDistribution;
  readonly keyToFillRatio: number | null;
  readonly worldPropsPerIsland: number;
  /** Conservative x/z footprint overlap, not a second renderer measurement. */
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
  /** Actual chip colour after compositing its CSS alpha over the canvas pixel. */
  readonly background: readonly [number, number, number];
}

export interface IslandLookBrowserReport {
  readonly ready: boolean;
  readonly canvas: { readonly width: number; readonly height: number };
  readonly pixels: IslandLookPixelMetrics | null;
  readonly code: IslandLookCodeMetrics;
  readonly domLabelContrastSamples: readonly DomLabelContrastSample[];
}

interface ImageRgb {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

const LAND_HUE_MIN = 40;
const LAND_HUE_MAX = 175;
const LAND_SATURATION_MIN = 0.1;
const LAND_WARM_HUE_MAX = 45;
const LAND_WARM_SATURATION_MIN = 0.12;
const SKY_HUE_MIN = 185;
const SKY_HUE_MAX = 265;
const HSL_GRASS_HUE_MIN = 45;
const HSL_GRASS_HUE_MAX = 165;
const HSL_GRASS_SATURATION_MIN = 0.18;
const HSL_GRASS_HUE_BIN_DEGREES = 15;
const HSL_ACCENT_SATURATION_MIN = 0.55;
const HSL_ACCENT_LIGHTNESS_MIN = 0.18;
const HSL_ACCENT_LIGHTNESS_MAX = 0.82;
const IMAGE_SAMPLE_TARGET = 1_000_000;

function round(value: number): number {
  return Number(value.toFixed(4));
}

function srgbToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

/** CIELAB L* using sRGB -> linear sRGB -> D65 XYZ, with no display grade. */
function lightnessLStar(rgb: ImageRgb): number {
  const red = srgbToLinear(rgb.red);
  const green = srgbToLinear(rgb.green);
  const blue = srgbToLinear(rgb.blue);
  const y = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const epsilon = 216 / 24_389;
  const kappa = 24_389 / 27;
  const fy = y > epsilon ? Math.cbrt(y) : (kappa * y + 16) / 116;
  return 116 * fy - 16;
}

/** HSL is used for hue/saturation because these thresholds are human-auditable. */
function hslFromSrgb(rgb: ImageRgb): {
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
} {
  const red = rgb.red / 255;
  const green = rgb.green / 255;
  const blue = rgb.blue / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (maximum === red) hue = ((green - blue) / delta) % 6;
  else if (maximum === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  hue *= 60;
  return { hue: hue < 0 ? hue + 360 : hue, saturation, lightness };
}

function quantile(sorted: readonly number[], share: number): number {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * share;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  const amount = position - lower;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * amount;
}

function standardDeviation(values: readonly number[], average: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function imageRgb(data: Uint8ClampedArray, offset: number): ImageRgb {
  return { red: data[offset]!, green: data[offset + 1]!, blue: data[offset + 2]! };
}

/**
 * Measure the pixels after the browser has painted the WebGL canvas. Sampling
 * is capped at one million regularly spaced pixels so a 2× desktop DPR does
 * not make a judge run depend on an avoidable multi-million-element sort.
 */
export function measureIslandImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): IslandLookPixelMetrics {
  const stride = Math.max(1, Math.ceil(Math.sqrt((width * height) / IMAGE_SAMPLE_TARGET)));
  const allLightness: number[] = [];
  const landLightness: number[] = [];
  const backgroundLightness: number[] = [];
  const grassLightness: number[] = [];
  const grassHues: number[] = [];
  let grassHueMinimum = Number.POSITIVE_INFINITY;
  let grassHueMaximum = Number.NEGATIVE_INFINITY;
  let accentPixels = 0;

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const rgb = imageRgb(data, (y * width + x) * 4);
      const lightness = lightnessLStar(rgb);
      allLightness.push(lightness);
      const hsl = hslFromSrgb(rgb);

      /*
        Land is segmented by hue, not by where the pixel sits in the frame.
        A centre crop against an outer ring measures composition: an island
        that reaches the top of its frame scores as if it had no contrast at
        all, and an archipelago view scores its own sea against its own sea.
        Greens through to warm earth are land here; the blue sea and sky are
        not. The renderer can hand over an exact mask later; this is what the
        same numbers mean when read off donor art that has no mask.
      */
      const isLand =
        (hsl.hue >= LAND_HUE_MIN &&
          hsl.hue <= LAND_HUE_MAX &&
          hsl.saturation >= LAND_SATURATION_MIN) ||
        (hsl.hue < LAND_WARM_HUE_MAX && hsl.saturation >= LAND_WARM_SATURATION_MIN);
      if (isLand) landLightness.push(lightness);
      else backgroundLightness.push(lightness);

      const isGrass =
        hsl.hue >= HSL_GRASS_HUE_MIN &&
        hsl.hue <= HSL_GRASS_HUE_MAX &&
        hsl.saturation >= HSL_GRASS_SATURATION_MIN;
      if (isGrass) {
        grassHues.push(hsl.hue);
        grassLightness.push(lightness);
        grassHueMinimum = Math.min(grassHueMinimum, hsl.hue);
        grassHueMaximum = Math.max(grassHueMaximum, hsl.hue);
      }

      /*
        Accent is counted inside the land only, and sky blue is excluded even
        there. Measured across the whole frame it reports the sky, which is how
        an early version of this read 24.9% on a reference image whose accent
        colour is nothing like that.
      */
      if (
        isLand &&
        !isGrass &&
        !(hsl.hue >= SKY_HUE_MIN && hsl.hue <= SKY_HUE_MAX) &&
        hsl.saturation >= HSL_ACCENT_SATURATION_MIN &&
        hsl.lightness >= HSL_ACCENT_LIGHTNESS_MIN &&
        hsl.lightness <= HSL_ACCENT_LIGHTNESS_MAX
      ) {
        accentPixels += 1;
      }
    }
  }

  const sortedLightness = [...allLightness].sort((a, b) => a - b);
  const sortedLand = [...landLightness].sort((a, b) => a - b);
  const sortedBackground = [...backgroundLightness].sort((a, b) => a - b);
  const sortedGrass = [...grassLightness].sort((a, b) => a - b);
  const average = allLightness.length
    ? allLightness.reduce((sum, value) => sum + value, 0) / allLightness.length
    : 0;
  const grassBins = new Set(grassHues.map((hue) => Math.floor(hue / HSL_GRASS_HUE_BIN_DEGREES)));
  const grassHueSpread = grassHues.length === 0 ? 0 : grassHueMaximum - grassHueMinimum;
  const landMedian = quantile(sortedLand, 0.5);
  const landP95 = quantile(sortedLand, 0.95);
  return {
    colorSpace: {
      lightness: "CIELAB L* D65 from sRGB",
      hueAndSaturation: "HSL from sRGB",
    },
    sampledPixels: allLightness.length,
    lightnessP2: round(quantile(sortedLightness, 0.02)),
    lightnessP98: round(quantile(sortedLightness, 0.98)),
    lightnessStdDev: round(standardDeviation(allLightness, average)),
    landCoverage: allLightness.length === 0 ? 0 : round(landLightness.length / allLightness.length),
    landMedianLightness: round(landMedian),
    landP95Lightness: round(landP95),
    /*
      The pair that cannot be gamed. Speckling dark tufts into the albedo lifts
      the grass spread without lighting anything; the whole ground's median
      against its own 95th percentile does not move unless a light does.
    */
    landLightnessRise: round(landP95 - landMedian),
    backgroundLightnessSpread: round(
      quantile(sortedBackground, 0.95) - quantile(sortedBackground, 0.05),
    ),
    grassLightnessSpread: round(quantile(sortedGrass, 0.95) - quantile(sortedGrass, 0.05)),
    grassLightnessP95: round(quantile(sortedGrass, 0.95)),
    grassHueCount: grassBins.size,
    grassHueSpread: round(grassHueSpread),
    accentArea: landLightness.length === 0 ? 0 : round(accentPixels / landLightness.length),
  };
}

function normalizedRadial(blueprint: IslandBlueprint, placement: IslandPoint): number {
  return Math.hypot(
    placement.x / Math.max(blueprint.bounds.halfX, Number.EPSILON),
    placement.z / Math.max(blueprint.bounds.halfZ, Number.EPSILON),
  );
}

function placementFootprintRadius(placement: IslandDressingPlacement): number {
  if (placement.kind === "landmark") return Math.max(0.42, placement.height * 0.22);
  if (placement.kind === "prop") return Math.max(0.2, placement.height * 0.18);
  return Math.max(0.12, placement.height * 0.14);
}

function dressingAssetsReady(scene: THREE.Scene, source: IslandLookSceneSource): boolean {
  const expected = source.dressingPlans.reduce((sum, plan) => sum + plan.placements.length, 0);
  if (expected === 0) return true;
  let loaded = 0;
  scene.traverse((object) => {
    if (object.userData.islandLookPlacementCount) {
      loaded += Number(object.userData.islandLookPlacementCount);
    }
  });
  return loaded >= expected;
}

function aerialPlateReady(scene: THREE.Scene): boolean {
  const plate = scene.getObjectByName("island-look-aerial-plate");
  if (!plate || !(plate as THREE.Mesh).isMesh) return false;
  const material = (plate as THREE.Mesh).material;
  const materials = Array.isArray(material) ? material : [material];
  return materials.some((entry) => {
    const map = (entry as THREE.MeshBasicMaterial).map;
    const image = map?.image as { readonly width?: number; readonly height?: number } | undefined;
    return Boolean(image && image.width && image.height);
  });
}

function islandLookSceneReady(scene: THREE.Scene, source: IslandLookSceneSource): boolean {
  // The V2 course/world scenes keep their dressing and aerial plate inside
  // nested Suspense boundaries. `ScenePresence` cannot see those boundaries,
  // so the judge waits on the actual render objects instead of timing a guess.
  return dressingAssetsReady(scene, source) && aerialPlateReady(scene);
}

function nodeIsConservativelyOccluded(
  node: IslandPoint,
  blueprint: IslandBlueprint,
  plan: IslandDressingPlan,
): boolean {
  return plan.placements.some((placement) => {
    const distance = Math.hypot(node.x - placement.x, node.z - placement.z);
    return distance < blueprint.route.nodeRadius + placementFootprintRadius(placement);
  });
}

/** Read counts from the same blueprint/plan objects the renderers consume. */
export function measureIslandCodeMetrics(
  source: IslandLookSceneSource,
  keyToFillRatio: number | null = null,
): IslandLookCodeMetrics {
  const lessonNodeCount = source.blueprints.reduce(
    (sum, blueprint) => sum + blueprint.nodes.length,
    0,
  );
  const coursePropCount = source.dressingPlans.reduce(
    (sum, plan) => sum + plan.placements.length,
    0,
  );
  const rimPropCount = source.dressingPlans.reduce((sum, plan, index) => {
    const blueprint = source.blueprints[index];
    if (!blueprint) return sum;
    return (
      sum +
      plan.placements.filter((placement) => normalizedRadial(blueprint, placement) > 0.8).length
    );
  }, 0);
  const firstBlueprint = source.blueprints[0];
  const firstPlan = source.dressingPlans[0];
  const nodes =
    source.nodePositions.length > 0
      ? source.nodePositions
      : (firstBlueprint?.nodes.map((node) => ({ x: node.x, z: node.z })) ?? []);
  const occludedNodes =
    source.detail === "course" && firstBlueprint && firstPlan
      ? nodes.filter((node) => nodeIsConservativelyOccluded(node, firstBlueprint, firstPlan)).length
      : 0;
  const worldPropsPerIsland =
    source.detail === "world"
      ? Math.max(0, ...source.dressingPlans.map((plan) => plan.placements.length))
      : 0;

  return {
    detail: source.detail,
    lessonNodeCount,
    coursePropCount,
    propsPerLessonNode:
      source.detail === "course" && lessonNodeCount > 0
        ? round(coursePropCount / lessonNodeCount)
        : 0,
    rimPropShare: coursePropCount > 0 ? round(rimPropCount / coursePropCount) : 0,
    layerDistribution: {
      terrainPatches: source.blueprints.reduce(
        (sum, blueprint) => sum + blueprint.terrainPatches.length,
        0,
      ),
      routeSamples: source.blueprints.reduce(
        (sum, blueprint) => sum + blueprint.centerline.length,
        0,
      ),
      dressingProps: coursePropCount,
      lessonNodes: lessonNodeCount,
    },
    keyToFillRatio: keyToFillRatio === null ? null : round(keyToFillRatio),
    worldPropsPerIsland,
    nodeOcclusionShare: nodes.length > 0 ? round(occludedNodes / nodes.length) : 0,
  };
}

/** Lights are scene data, not pixel guesses: directional is key, ambient is fill. */
export function measureKeyToFillRatio(scene: THREE.Scene): number | null {
  let key = 0;
  let fill = 0;
  scene.traverse((object) => {
    if (object.type === "DirectionalLight") key += (object as THREE.DirectionalLight).intensity;
    else if (object.type === "HemisphereLight" || object.type === "AmbientLight") {
      fill += (object as THREE.HemisphereLight | THREE.AmbientLight).intensity;
    }
  });
  return fill > 0 ? key / fill : null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function parseCssRgb(
  value: string,
): { readonly rgb: readonly [number, number, number]; readonly alpha: number } | null {
  const modernSrgb = value.match(
    /color\(\s*srgb\s+([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)(?:\s*\/\s*([-+]?\d*\.?\d+))?\s*\)/i,
  );
  if (modernSrgb) {
    return {
      rgb: [Number(modernSrgb[1]) * 255, Number(modernSrgb[2]) * 255, Number(modernSrgb[3]) * 255],
      alpha: clamp(Number(modernSrgb[4] ?? 1), 0, 1),
    };
  }
  const channels = value.match(/[-+]?\d*\.?\d+/g)?.map(Number) ?? [];
  if (channels.length < 3) return null;
  return {
    rgb: [channels[0]!, channels[1]!, channels[2]!],
    alpha: clamp(channels[3] ?? 1, 0, 1),
  };
}

function pixelAt(image: ImageData, x: number, y: number): readonly [number, number, number] {
  const offset = (y * image.width + x) * 4;
  return [image.data[offset]!, image.data[offset + 1]!, image.data[offset + 2]!];
}

function composite(
  foreground: readonly [number, number, number],
  alpha: number,
  background: readonly [number, number, number],
): readonly [number, number, number] {
  return [
    foreground[0] * alpha + background[0] * (1 - alpha),
    foreground[1] * alpha + background[1] * (1 - alpha),
    foreground[2] * alpha + background[2] * (1 - alpha),
  ];
}

/**
 * Read DOM label colours and the pixels under them. The ratio itself is not
 * reimplemented here: the E2E judge passes these pairs to the repository's
 * existing `scripts/check-contrast.mjs` WCAG function. That script delegates
 * static token checks to SwimmerUIKit; its exported pure function is the one
 * runtime calculation used for these live pixels.
 */
function domLabelSamples(
  canvas: HTMLCanvasElement,
  image: ImageData,
): readonly DomLabelContrastSample[] {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return [];
  const samples: DomLabelContrastSample[] = [];
  for (const label of document.querySelectorAll<HTMLElement>(".labels .label")) {
    const style = getComputedStyle(label);
    const box = label.getBoundingClientRect();
    if (
      box.width <= 0 ||
      box.height <= 0 ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number.parseFloat(style.opacity) <= 0.01
    ) {
      continue;
    }
    const foreground = parseCssRgb(style.color);
    const chip = parseCssRgb(style.backgroundColor);
    if (!foreground || !chip) continue;
    const x = clamp(
      Math.round(((box.left + box.width / 2 - rect.left) / rect.width) * (image.width - 1)),
      0,
      image.width - 1,
    );
    const y = clamp(
      Math.round(((box.top + box.height / 2 - rect.top) / rect.height) * (image.height - 1)),
      0,
      image.height - 1,
    );
    const underlay = pixelAt(image, x, y);
    const background = composite(chip.rgb, chip.alpha, underlay);
    const effectiveForeground = composite(foreground.rgb, foreground.alpha, background);
    samples.push({
      label: label.textContent?.trim() || label.className,
      foreground: effectiveForeground,
      background,
    });
  }
  return samples;
}

/** Draw the live WebGL canvas into a 2D canvas, then compute all pixel metrics in-page. */
export function measureIslandLookInBrowser(args: {
  readonly canvas: HTMLCanvasElement;
  readonly scene: THREE.Scene;
  readonly source: IslandLookSceneSource;
}): IslandLookBrowserReport {
  const { canvas, scene, source } = args;
  const code = measureIslandCodeMetrics(source, measureKeyToFillRatio(scene));
  if (canvas.width <= 0 || canvas.height <= 0 || !islandLookSceneReady(scene, source)) {
    return {
      ready: false,
      canvas: { width: canvas.width, height: canvas.height },
      pixels: null,
      code,
      domLabelContrastSamples: [],
    };
  }
  const raster = document.createElement("canvas");
  raster.width = canvas.width;
  raster.height = canvas.height;
  const context = raster.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return {
      ready: false,
      canvas: { width: canvas.width, height: canvas.height },
      pixels: null,
      code,
      domLabelContrastSamples: [],
    };
  }
  context.drawImage(canvas, 0, 0, raster.width, raster.height);
  const image = context.getImageData(0, 0, raster.width, raster.height);
  return {
    ready: true,
    canvas: { width: canvas.width, height: canvas.height },
    pixels: measureIslandImageData(image.data, image.width, image.height),
    code,
    domLabelContrastSamples: domLabelSamples(canvas, image),
  };
}

export const ISLAND_LOOK_METRIC_NAMES = [
  "sceneLinearRange",
  "landCoverage",
  "landMedianLightness",
  "landP95Lightness",
  "landLightnessRise",
  "backgroundLightnessSpread",
  "lightnessP2",
  "lightnessP98",
  "lightnessStdDev",
  "grassLightnessSpread",
  "grassLightnessP95",
  "grassHueCount",
  "grassHueSpread",
  "accentArea",
  "keyToFillRatio",
  "propsPerLessonNode",
  "rimPropShare",
  "worldPropsPerIsland",
  "nodeOcclusionShare",
  "domLabelContrastMin",
] as const;
