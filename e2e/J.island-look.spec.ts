import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { contrastRatio } from "../scripts/check-contrast.mjs";
import { ISLAND_LOOK_SHOT_IDS } from "../packages/world/src/island/island-look.js";
import { ISLAND_LOOK_CONTRACT } from "../packages/world/src/island/look-contract.js";
import type { IslandLookBrowserReport } from "../packages/world/src/island/look-metrics.js";
import { ONLINE_ORIGIN } from "./ports.js";

const PRESSURE_STUDY_ID = "turing-pact";
const PRESSURE_COURSE_ID = "foundations-before-zero";
const MATRIX_MODE = process.env.ISLAND_LOOK_MATRIX === "1";
const VARIANT = process.env.ISLAND_LOOK_VARIANT ?? "main";
const SHOT_IDS = MATRIX_MODE
  ? (["course-near", "course-design", "world-design"] as const)
  : ISLAND_LOOK_SHOT_IDS;
const VIEWPORTS = MATRIX_MODE
  ? [{ name: "desktop", width: 1440, height: 900 }]
  : ([
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 },
    ] as const);
const OUTPUT_DIR = resolve(
  process.cwd(),
  process.env.ISLAND_LOOK_OUTPUT_DIR ?? "SHOTS/island-look",
);
const SAMPLE_COUNTS = [6, 12, 24, 41] as const;
const SAMPLE_ARCHETYPES = [
  "arc",
  "horseshoe",
  "loop-around-hill",
  "switchback",
  "serpentine",
] as const;
const ACTIVE_SAMPLE_COUNTS = process.env.ISLAND_LOOK_COUNTS
  ? SAMPLE_COUNTS.filter((count) =>
      process.env.ISLAND_LOOK_COUNTS!.split(",").some((value) => Number(value) === count),
    )
  : SAMPLE_COUNTS;
const ACTIVE_SAMPLE_ARCHETYPES = process.env.ISLAND_LOOK_ARCHETYPES
  ? SAMPLE_ARCHETYPES.filter((archetype) =>
      process.env.ISLAND_LOOK_ARCHETYPES!.split(",").includes(archetype),
    )
  : SAMPLE_ARCHETYPES;

type MetricEntry = {
  readonly metric: string;
  readonly value: unknown;
  readonly threshold: unknown;
  readonly pass: boolean;
};

type JudgeRun = {
  readonly shot: (typeof SHOT_IDS)[number];
  readonly detail: IslandLookBrowserReport["code"]["detail"];
  readonly viewport: { readonly width: number; readonly height: number };
  readonly screenshot: string;
  readonly deterministic: boolean;
  readonly firstPixelHash: string;
  readonly secondPixelHash: string;
  readonly canvas: IslandLookBrowserReport["canvas"];
  readonly colorSpace: NonNullable<IslandLookBrowserReport["pixels"]>["colorSpace"];
  readonly sampledPixels: number | null;
  readonly sample?: {
    readonly lessonCount: number;
    readonly routeArchetype: (typeof SAMPLE_ARCHETYPES)[number];
    readonly layoutSeed: string;
  };
  readonly displayDarkPixelShare: number | null;
  readonly sceneLinearRange: number | null;
  readonly domLabelContrast: readonly {
    readonly label: string;
    readonly contrast: number | null;
  }[];
  readonly metrics: readonly MetricEntry[];
};

type JudgeOutput = {
  readonly version: 1;
  readonly variant: string;
  readonly contract: typeof ISLAND_LOOK_CONTRACT;
  readonly pressureSeed: {
    readonly studyId: string;
    readonly courseId: string;
    readonly lessonCount: number;
  };
  readonly runs: readonly JudgeRun[];
};

declare global {
  interface Window {
    __islandLookMetrics?: () => IslandLookBrowserReport;
  }
}

function numberValue(value: number | null): number | null {
  return value === null ? null : Number(value.toFixed(4));
}

function atLeast(metric: string, value: number | null, threshold: number): MetricEntry {
  return {
    metric,
    value: numberValue(value),
    threshold,
    pass: value !== null && value >= threshold,
  };
}

function atMost(metric: string, value: number | null, threshold: number): MetricEntry {
  return {
    metric,
    value: numberValue(value),
    threshold,
    pass: value !== null && value <= threshold,
  };
}

function between(
  metric: string,
  value: number | null,
  minimum: number,
  maximum: number,
): MetricEntry {
  return {
    metric,
    value: numberValue(value),
    threshold: { min: minimum, max: maximum },
    pass: value !== null && value >= minimum && value <= maximum,
  };
}

function informational(metric: string, value: unknown): MetricEntry {
  return { metric, value, threshold: null, pass: true };
}

type RatchetMode = "min" | "max" | "range";
type RatchetBaseline = Readonly<Record<string, number>>;

/**
 * Fixed-pressure baselines captured from the selected course composition on
 * 2026-08-30: 66° polar, a -1 target-height offset, and the course-design
 * shot's own fit. These are observations, not replacement targets: `pass`
 * below still reports the existing look contract, so a red metric remains
 * red-today. The ratchet only prevents a later run from moving farther in the
 * bad direction.
 */
const ISLAND_LOOK_RATCHET_MODES: Readonly<Record<string, RatchetMode>> = {
  sceneLinearRange: "min",
  landMedianLightness: "range",
  landP95Lightness: "min",
  landLightnessRise: "min",
  backgroundLightnessSpread: "min",
  grassLightnessSpread: "min",
  grassLightnessP95: "min",
  lightnessP2: "max",
  lightnessP98: "min",
  lightnessStdDev: "min",
  grassHueCount: "min",
  grassHueSpread: "min",
  accentArea: "range",
  keyToFillRatio: "min",
  domLabelContrastMin: "min",
  propsPerLessonNode: "min",
  rimPropShare: "min",
  landCoverage: "min",
  nodeOcclusionShare: "max",
  worldPropsPerIsland: "max",
};

const ISLAND_LOOK_RATCHET: Readonly<Record<string, RatchetBaseline>> = {
  "course-design/desktop": {
    sceneLinearRange: 5.774,
    landMedianLightness: 50.6403,
    landP95Lightness: 75.3413,
    landLightnessRise: 24.7011,
    backgroundLightnessSpread: 32.1656,
    grassLightnessSpread: 39.9292,
    grassLightnessP95: 76.3821,
    lightnessP2: 35.8535,
    lightnessP98: 78.6655,
    lightnessStdDev: 12.7092,
    grassHueCount: 9,
    grassHueSpread: 120,
    accentArea: 0.0015,
    keyToFillRatio: 5.3608,
    domLabelContrastMin: 9.2021,
    propsPerLessonNode: 7.7073,
    rimPropShare: 0.2753,
    landCoverage: 0.4285,
    nodeOcclusionShare: 0,
  },
  "course-near/desktop": {
    sceneLinearRange: 5.686,
    landMedianLightness: 39.2856,
    landP95Lightness: 53.4286,
    landLightnessRise: 14.1431,
    backgroundLightnessSpread: 0,
    grassLightnessSpread: 25.6484,
    grassLightnessP95: 48.8736,
    lightnessP2: 22.2487,
    lightnessP98: 56.191,
    lightnessStdDev: 6.7783,
    grassHueCount: 5,
    grassHueSpread: 70.677,
    accentArea: 0,
    keyToFillRatio: 5.3608,
    domLabelContrastMin: 12.5226,
    propsPerLessonNode: 7.7073,
    rimPropShare: 0.2753,
    landCoverage: 1,
    nodeOcclusionShare: 0,
  },
  "course-far/desktop": {
    sceneLinearRange: 13.796,
    landMedianLightness: 50.4706,
    landP95Lightness: 75.5462,
    landLightnessRise: 25.0756,
    backgroundLightnessSpread: 43.5495,
    grassLightnessSpread: 53.6879,
    grassLightnessP95: 77.258,
    lightnessP2: 23.0834,
    lightnessP98: 85.8128,
    lightnessStdDev: 16.2035,
    grassHueCount: 9,
    grassHueSpread: 119.717,
    accentArea: 0.0015,
    keyToFillRatio: 5.3608,
    domLabelContrastMin: 10.64,
    propsPerLessonNode: 7.7073,
    rimPropShare: 0.2753,
    landCoverage: 0.7714,
    nodeOcclusionShare: 0,
  },
  "world-design/desktop": {
    sceneLinearRange: 2.907,
    landMedianLightness: 48.7604,
    landP95Lightness: 77.0935,
    landLightnessRise: 28.3331,
    backgroundLightnessSpread: 47.6364,
    grassLightnessSpread: 56.0291,
    grassLightnessP95: 91.5368,
    lightnessP2: 34.6623,
    lightnessP98: 92.0102,
    lightnessStdDev: 14.315,
    grassHueCount: 9,
    grassHueSpread: 120,
    accentArea: 0.0054,
    keyToFillRatio: 5.3608,
    domLabelContrastMin: 12.6155,
    worldPropsPerIsland: 8,
  },
  "course-design/mobile": {
    sceneLinearRange: 3.286,
    landMedianLightness: 73.9746,
    landP95Lightness: 82.8142,
    landLightnessRise: 8.8396,
    backgroundLightnessSpread: 38.2898,
    grassLightnessSpread: 32.4269,
    grassLightnessP95: 78.4226,
    lightnessP2: 37.8218,
    lightnessP98: 82.9636,
    lightnessStdDev: 14.3495,
    grassHueCount: 9,
    grassHueSpread: 120,
    accentArea: 0.0904,
    keyToFillRatio: 5.3608,
    domLabelContrastMin: 10.0051,
    propsPerLessonNode: 7.7073,
    rimPropShare: 0.2753,
    landCoverage: 0.4242,
    nodeOcclusionShare: 0,
  },
  "course-near/mobile": {
    sceneLinearRange: 4.361,
    landMedianLightness: 39.6919,
    landP95Lightness: 48.0839,
    landLightnessRise: 8.392,
    backgroundLightnessSpread: 0,
    grassLightnessSpread: 22.1062,
    grassLightnessP95: 45.7713,
    lightnessP2: 22.2487,
    lightnessP98: 54.9768,
    lightnessStdDev: 6.4264,
    grassHueCount: 6,
    grassHueSpread: 73.6407,
    accentArea: 0,
    keyToFillRatio: 5.3608,
    domLabelContrastMin: 12.5524,
    propsPerLessonNode: 7.7073,
    rimPropShare: 0.2753,
    landCoverage: 1,
    nodeOcclusionShare: 0,
  },
  "course-far/mobile": {
    sceneLinearRange: 15.735,
    landMedianLightness: 52.605,
    landP95Lightness: 80.8839,
    landLightnessRise: 28.279,
    backgroundLightnessSpread: 31.8223,
    grassLightnessSpread: 49.4044,
    grassLightnessP95: 72.9974,
    lightnessP2: 22.7128,
    lightnessP98: 83.7498,
    lightnessStdDev: 16.4666,
    grassHueCount: 9,
    grassHueSpread: 120,
    accentArea: 0.0511,
    keyToFillRatio: 5.3608,
    domLabelContrastMin: 10.576,
    propsPerLessonNode: 7.7073,
    rimPropShare: 0.2753,
    landCoverage: 0.8671,
    nodeOcclusionShare: 0,
  },
  "world-design/mobile": {
    sceneLinearRange: 3.039,
    landMedianLightness: 80.4531,
    landP95Lightness: 85.7285,
    landLightnessRise: 5.2754,
    backgroundLightnessSpread: 34.5319,
    grassLightnessSpread: 40.192,
    grassLightnessP95: 74.8088,
    lightnessP2: 34.4671,
    lightnessP98: 83.5046,
    lightnessStdDev: 12.9957,
    grassHueCount: 9,
    grassHueSpread: 120,
    accentArea: 0.3923,
    keyToFillRatio: 5.3608,
    domLabelContrastMin: 13.4513,
    worldPropsPerIsland: 8,
  },
};

function ratchetPass(metric: MetricEntry, baseline: number): boolean {
  if (typeof metric.value !== "number") return false;
  const mode = ISLAND_LOOK_RATCHET_MODES[metric.metric];
  if (!mode) throw new Error(`Missing island-look ratchet direction for ${metric.metric}`);
  if (mode === "min") return metric.value >= baseline;
  if (mode === "max") return metric.value <= baseline;

  const threshold = metric.threshold as { min?: unknown; max?: unknown };
  if (typeof threshold.min !== "number" || typeof threshold.max !== "number") {
    throw new Error(`Range ratchet needs a bounded contract for ${metric.metric}`);
  }
  if (baseline < threshold.min) {
    return metric.value >= baseline && metric.value <= threshold.max;
  }
  if (baseline > threshold.max) {
    return metric.value >= threshold.min && metric.value <= baseline;
  }
  const baselineMargin = Math.min(baseline - threshold.min, threshold.max - baseline);
  const currentMargin = Math.min(metric.value - threshold.min, threshold.max - metric.value);
  return (
    metric.value >= threshold.min &&
    metric.value <= threshold.max &&
    currentMargin >= baselineMargin
  );
}

function assertIslandLookRatchet(
  shot: string,
  viewportName: string,
  metrics: readonly MetricEntry[],
): void {
  const key = `${shot}/${viewportName}`;
  const baseline = ISLAND_LOOK_RATCHET[key];
  if (!baseline) throw new Error(`Missing island-look ratchet baseline for ${key}`);

  for (const metric of metrics) {
    if (metric.threshold === null) continue;
    const pinned = baseline[metric.metric];
    if (typeof pinned !== "number") {
      throw new Error(`Missing island-look ratchet value for ${key}/${metric.metric}`);
    }
    expect(
      ratchetPass(metric, pinned),
      `${key}/${metric.metric} regressed: observed ${String(metric.value)}, pinned ${pinned}`,
    ).toBe(true);
  }
}

function metricsFor(
  report: IslandLookBrowserReport,
  sceneLinearRange: number | null,
): readonly MetricEntry[] {
  const pixels = report.pixels;
  const code = report.code;
  const labelRatios = report.domLabelContrastSamples.map((sample) =>
    contrastRatio(sample.foreground, sample.background),
  );
  const domLabelContrastMin = labelRatios.length > 0 ? Math.min(...labelRatios) : null;
  const common: MetricEntry[] = [
    atLeast("sceneLinearRange", sceneLinearRange, ISLAND_LOOK_CONTRACT.sceneLinearRangeMin),
    between(
      "landMedianLightness",
      pixels?.landMedianLightness ?? null,
      ISLAND_LOOK_CONTRACT.landMedianLightnessMin,
      ISLAND_LOOK_CONTRACT.landMedianLightnessMax,
    ),
    atLeast(
      "landP95Lightness",
      pixels?.landP95Lightness ?? null,
      ISLAND_LOOK_CONTRACT.landP95LightnessMin,
    ),
    atLeast(
      "landLightnessRise",
      pixels?.landLightnessRise ?? null,
      ISLAND_LOOK_CONTRACT.landLightnessRiseMin,
    ),
    atLeast(
      "backgroundLightnessSpread",
      pixels?.backgroundLightnessSpread ?? null,
      ISLAND_LOOK_CONTRACT.backgroundLightnessSpreadMin,
    ),
    atLeast(
      "grassLightnessSpread",
      pixels?.grassLightnessSpread ?? null,
      ISLAND_LOOK_CONTRACT.grassLightnessSpreadMin,
    ),
    atLeast(
      "grassLightnessP95",
      pixels?.grassLightnessP95 ?? null,
      ISLAND_LOOK_CONTRACT.grassLightnessP95Min,
    ),
    atMost("lightnessP2", pixels?.lightnessP2 ?? null, ISLAND_LOOK_CONTRACT.lightnessP2Max),
    atLeast("lightnessP98", pixels?.lightnessP98 ?? null, ISLAND_LOOK_CONTRACT.lightnessP98Min),
    atLeast(
      "lightnessStdDev",
      pixels?.lightnessStdDev ?? null,
      ISLAND_LOOK_CONTRACT.lightnessStdDevMin,
    ),
    atLeast("grassHueCount", pixels?.grassHueCount ?? null, ISLAND_LOOK_CONTRACT.grassHueCountMin),
    atLeast(
      "grassHueSpread",
      pixels?.grassHueSpread ?? null,
      ISLAND_LOOK_CONTRACT.grassHueSpreadMin,
    ),
    between(
      "accentArea",
      pixels?.accentArea ?? null,
      ISLAND_LOOK_CONTRACT.accentAreaMin,
      ISLAND_LOOK_CONTRACT.accentAreaMax,
    ),
    atLeast("keyToFillRatio", code.keyToFillRatio, ISLAND_LOOK_CONTRACT.keyToFillMin),
    atLeast("domLabelContrastMin", domLabelContrastMin, ISLAND_LOOK_CONTRACT.domLabelContrastMin),
    informational("domLabelCount", report.domLabelContrastSamples.length),
    informational("layerDistribution", code.layerDistribution),
    informational("lessonNodeCount", code.lessonNodeCount),
    informational("coursePropCount", code.coursePropCount),
  ];

  if (code.detail !== "course")
    common.push(informational("landCoverage", pixels?.landCoverage ?? null));

  if (code.detail === "course") {
    common.push(
      atLeast(
        "propsPerLessonNode",
        code.propsPerLessonNode,
        ISLAND_LOOK_CONTRACT.propsPerLessonNodeMin,
      ),
      atLeast("rimPropShare", code.rimPropShare, ISLAND_LOOK_CONTRACT.rimPropShareMin),
      /*
        Land coverage binds the course island only. The archipelago is supposed
        to show many courses at once, so pushing its camera in to satisfy a
        coverage floor would trade information for a number.
      */
      atLeast("landCoverage", pixels?.landCoverage ?? null, ISLAND_LOOK_CONTRACT.landCoverageMin),
      atMost("nodeOcclusionShare", code.nodeOcclusionShare, ISLAND_LOOK_CONTRACT.nodeOcclusionMax),
    );
  } else {
    common.push(
      atMost(
        "worldPropsPerIsland",
        code.worldPropsPerIsland,
        ISLAND_LOOK_CONTRACT.worldPropsPerIslandMax,
      ),
    );
  }
  return common;
}

function shotUrl(shot: (typeof SHOT_IDS)[number], sample?: CaptureSample): string {
  const params = new URLSearchParams({
    shot,
    post: "off",
    seed: PRESSURE_COURSE_ID,
    freeze: "1",
  });
  if (sample) {
    params.set("routeArchetype", sample.routeArchetype);
    params.set("lessonCount", String(sample.lessonCount));
    params.set("layoutSeed", sample.layoutSeed);
  }
  return `${ONLINE_ORIGIN}/${PRESSURE_STUDY_ID}/${PRESSURE_COURSE_ID}?${params}`;
}

type CaptureSample = {
  readonly lessonCount: (typeof SAMPLE_COUNTS)[number];
  readonly routeArchetype: (typeof SAMPLE_ARCHETYPES)[number];
  readonly layoutSeed: string;
};

function captureSamples(): readonly (CaptureSample | undefined)[] {
  if (!MATRIX_MODE) return [undefined];
  return ACTIVE_SAMPLE_COUNTS.flatMap((lessonCount) =>
    ACTIVE_SAMPLE_ARCHETYPES.map((routeArchetype) => ({
      lessonCount,
      routeArchetype,
      layoutSeed: `lighting-review/${lessonCount}-${routeArchetype}`,
    })),
  );
}

async function readLookMetrics(page: Page): Promise<IslandLookBrowserReport | null> {
  return page.evaluate(() => window.__islandLookMetrics?.() ?? null);
}

/**
 * The scene's own luminance range, read before the grade sees it.
 *
 * `measureScene` is Stage's development helper and it is the only reading here
 * that grading cannot move, because it samples the linear render target
 * upstream of the blit. Every pixel metric below it can be pushed around by a
 * curve; this one only changes when the lighting changes.
 */
async function readSceneLinearRange(page: Page): Promise<number | null> {
  return page.evaluate(async () => {
    const measure = (globalThis as { measureScene?: () => Promise<unknown> }).measureScene;
    if (typeof measure !== "function") return null;
    const report = (await measure()) as { p05?: number; p95?: number } | null;
    if (!report || typeof report.p05 !== "number" || typeof report.p95 !== "number") return null;
    if (report.p05 <= 0) return null;
    return Math.round((report.p95 / report.p05) * 1000) / 1000;
  });
}

async function waitForLookReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const report = window.__islandLookMetrics?.();
      return (
        report?.ready === true &&
        report.pixels !== null &&
        document.querySelector(".loading-trivia") === null
      );
    },
    undefined,
    { timeout: 150_000 },
  );
}

/** Hash every RGBA byte in the canvas; this checks pixels, not PNG metadata. */
async function readCanvasPixelHash(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".stagewrap canvas");
    if (!canvas) return "missing";
    const raster = document.createElement("canvas");
    raster.width = canvas.width;
    raster.height = canvas.height;
    const context = raster.getContext("2d", { willReadFrequently: true });
    if (!context) return "unreadable";
    context.drawImage(canvas, 0, 0);
    const pixels = context.getImageData(0, 0, raster.width, raster.height).data;
    let hash = 2_166_136_261;
    for (const pixel of pixels) hash = Math.imul(hash ^ pixel, 16_777_619) >>> 0;
    return hash.toString(16).padStart(8, "0");
  });
}

async function readDisplayDarkPixelShare(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".stagewrap canvas");
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
    const raster = document.createElement("canvas");
    raster.width = canvas.width;
    raster.height = canvas.height;
    const context = raster.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(canvas, 0, 0);
    const pixels = context.getImageData(0, 0, raster.width, raster.height).data;
    const linear = (channel: number) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    let dark = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const luminance =
        0.2126 * linear(pixels[offset]!) +
        0.7152 * linear(pixels[offset + 1]!) +
        0.0722 * linear(pixels[offset + 2]!);
      if (luminance < 0.08) dark += 1;
    }
    return Number((dark / (raster.width * raster.height)).toFixed(6));
  });
}

async function waitForStableCanvas(page: Page): Promise<string> {
  let previous: string | null = null;
  let stableSamples = 0;
  for (let sample = 0; sample < 30; sample += 1) {
    await page.waitForTimeout(100);
    const current = await readCanvasPixelHash(page);
    if (current === previous) stableSamples += 1;
    else stableSamples = 0;
    if (stableSamples >= 2) return current;
    previous = current;
  }
  throw new Error("island look canvas did not settle to a stable pixel hash");
}

/** Playwright clips the page compositing layer; hide overlays for a canvas-only PNG. */
async function screenshotCanvasOnly(page: Page, canvas: Locator, path: string): Promise<void> {
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".stagewrap canvas");
    if (!canvas) throw new Error("island look canvas is missing");
    for (const element of document.body.querySelectorAll<HTMLElement>("*")) {
      if (element === canvas || element.contains(canvas)) continue;
      element.dataset.islandLookPreviousVisibility = element.style.visibility;
      element.style.visibility = "hidden";
    }
  });
  try {
    await canvas.screenshot({ path });
  } finally {
    await page.evaluate(() => {
      for (const element of document.querySelectorAll<HTMLElement>(
        "[data-island-look-previous-visibility]",
      )) {
        element.style.visibility = element.dataset.islandLookPreviousVisibility ?? "";
        delete element.dataset.islandLookPreviousVisibility;
      }
    });
  }
}

test.describe("J island look judge · fixed-pressure ratchet", () => {
  test("固定镜头 × 桌面/手机，输出画布 PNG 与逐项 metrics.json", async ({ page }) => {
    test.setTimeout(MATRIX_MODE ? 90 * 60_000 : 12 * 180_000);
    mkdirSync(OUTPUT_DIR, { recursive: true });
    const runs: JudgeRun[] = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const shot of SHOT_IDS) {
        for (const sample of captureSamples()) {
          const url = shotUrl(shot, sample);
          await page.goto(url, { waitUntil: "domcontentloaded" });
          await waitForLookReady(page);
          // Asset uploads, first shader compilation, and the world focus state
          // can finish after Suspense has committed. Require three consecutive
          // equal hashes before reading pixels so the reload comparison measures
          // the settled scene, not whichever async commit happened first.
          await waitForStableCanvas(page);

          const canvas = page.locator(".stagewrap canvas");
          await canvas.waitFor({ state: "visible", timeout: 30_000 });
          const samplePrefix = sample ? `${sample.lessonCount}-${sample.routeArchetype}-` : "";
          const filename = `${samplePrefix}${shot}-${viewport.name}.png`;
          const screenshotPath = join(OUTPUT_DIR, filename);
          const report = await readLookMetrics(page);
          if (!report?.ready || !report.pixels) {
            throw new Error(`island look probe was not ready for ${shot}/${viewport.name}`);
          }
          await screenshotCanvasOnly(page, canvas, screenshotPath);
          const firstPixelHash = await waitForStableCanvas(page);
          // The normal pressure judge reloads the exact URL for a second run.
          // A matrix run is visual sampling: keep the same ready/stable proof
          // but avoid paying for a second shader/Suspense bootstrap per sample.
          const verifyReload = !MATRIX_MODE || process.env.ISLAND_LOOK_RELOAD === "1";
          let secondPixelHash = firstPixelHash;
          if (verifyReload) {
            await page.reload({ waitUntil: "domcontentloaded" });
            await waitForLookReady(page);
            await waitForStableCanvas(page);
            secondPixelHash = await readCanvasPixelHash(page);
          }
          const deterministic = !verifyReload || firstPixelHash === secondPixelHash;
          const sceneLinearRange = await readSceneLinearRange(page);
          const displayDarkPixelShare = await readDisplayDarkPixelShare(page);
          const metrics = metricsFor(report, sceneLinearRange);
          const run: JudgeRun = {
            shot,
            detail: report.code.detail,
            viewport: { width: viewport.width, height: viewport.height },
            screenshot: `${OUTPUT_DIR.replace(`${process.cwd()}/`, "")}/${filename}`,
            deterministic,
            firstPixelHash,
            secondPixelHash,
            canvas: report.canvas,
            colorSpace: report.pixels.colorSpace,
            sampledPixels: report.pixels.sampledPixels,
            sample,
            displayDarkPixelShare,
            sceneLinearRange,
            domLabelContrast: report.domLabelContrastSamples.map((sample) => ({
              label: sample.label,
              contrast: numberValue(contrastRatio(sample.foreground, sample.background)),
            })),
            metrics,
          };
          runs.push(run);

          console.log(
            `\n${VARIANT} · ${sample ? `${sample.lessonCount}/${sample.routeArchetype} · ` : ""}${shot} · ${viewport.name} · ${viewport.width}×${viewport.height}`,
          );
          console.log(`displayDarkPixelShare=${displayDarkPixelShare}`);
          console.table(
            metrics.map(({ metric, value, threshold, pass }) => ({
              metric,
              value: typeof value === "object" ? JSON.stringify(value) : value,
              threshold: typeof threshold === "object" ? JSON.stringify(threshold) : threshold,
              pass: pass ? "PASS" : "RED",
            })),
          );
          assertIslandLookRatchet(shot, viewport.name, metrics);
          if (!deterministic) {
            console.warn(`island look freeze drift: ${shot}/${viewport.name}`);
          }
        }
      }
    }

    const output: JudgeOutput = {
      version: 1,
      variant: VARIANT,
      contract: ISLAND_LOOK_CONTRACT,
      pressureSeed: {
        studyId: PRESSURE_STUDY_ID,
        courseId: PRESSURE_COURSE_ID,
        lessonCount: 41,
      },
      runs,
    };
    writeFileSync(join(OUTPUT_DIR, "metrics.json"), `${JSON.stringify(output, null, 2)}\n`);
  });
});
