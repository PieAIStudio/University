import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { test, type Locator, type Page } from "@playwright/test";

import { contrastRatio } from "../scripts/check-contrast.mjs";
import { ISLAND_LOOK_SHOT_IDS } from "../packages/world/src/island/island-look.js";
import { ISLAND_LOOK_CONTRACT } from "../packages/world/src/island/look-contract.js";
import type { IslandLookBrowserReport } from "../packages/world/src/island/look-metrics.js";
import { ONLINE_ORIGIN } from "./ports.js";

const SHOT_IDS = ISLAND_LOOK_SHOT_IDS;
const PRESSURE_STUDY_ID = "turing-pact";
const PRESSURE_COURSE_ID = "foundations-before-zero";
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;
const OUTPUT_DIR = resolve(process.cwd(), "SHOTS", "island-look");

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
  readonly domLabelContrast: readonly {
    readonly label: string;
    readonly contrast: number | null;
  }[];
  readonly metrics: readonly MetricEntry[];
};

type JudgeOutput = {
  readonly version: 1;
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

function metricsFor(report: IslandLookBrowserReport): readonly MetricEntry[] {
  const pixels = report.pixels;
  const code = report.code;
  const labelRatios = report.domLabelContrastSamples.map((sample) =>
    contrastRatio(sample.foreground, sample.background),
  );
  const domLabelContrastMin = labelRatios.length > 0 ? Math.min(...labelRatios) : null;
  const common: MetricEntry[] = [
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
    informational("landCoverage", pixels?.landCoverage ?? null),
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
      atLeast(
        "landCoverage",
        pixels?.landCoverage ?? null,
        ISLAND_LOOK_CONTRACT.landCoverageMin,
      ),
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

function shotUrl(shot: (typeof SHOT_IDS)[number]): string {
  return `${ONLINE_ORIGIN}/${PRESSURE_STUDY_ID}/${PRESSURE_COURSE_ID}?shot=${shot}&post=off&seed=${PRESSURE_COURSE_ID}&freeze=1`;
}

async function readLookMetrics(page: Page): Promise<IslandLookBrowserReport | null> {
  return page.evaluate(() => window.__islandLookMetrics?.() ?? null);
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

test.describe("J island look judge · non-blocking measurement", () => {
  test("固定镜头 × 桌面/手机，输出画布 PNG 与逐项 metrics.json", async ({ page }) => {
    test.setTimeout(12 * 180_000);
    mkdirSync(OUTPUT_DIR, { recursive: true });
    const runs: JudgeRun[] = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const shot of SHOT_IDS) {
        await page.goto(shotUrl(shot), { waitUntil: "domcontentloaded" });
        await waitForLookReady(page);
        // Asset uploads, first shader compilation, and the world focus state
        // can finish after Suspense has committed. Require three consecutive
        // equal hashes before reading pixels so the reload comparison measures
        // the settled scene, not whichever async commit happened first.
        await waitForStableCanvas(page);

        const canvas = page.locator(".stagewrap canvas");
        await canvas.waitFor({ state: "visible", timeout: 30_000 });
        const filename = `${shot}-${viewport.name}.png`;
        const screenshotPath = join(OUTPUT_DIR, filename);
        const report = await readLookMetrics(page);
        if (!report?.ready || !report.pixels) {
          throw new Error(`island look probe was not ready for ${shot}/${viewport.name}`);
        }
        await screenshotCanvasOnly(page, canvas, screenshotPath);
        const firstPixelHash = await waitForStableCanvas(page);
        // Reload the exact same URL for the second run. This checks the full
        // DEV-only input/camera/scene bootstrap, not just two frames of one
        // mounted React tree, without adding a second committed/output PNG.
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitForLookReady(page);
        const secondPixelHash = await waitForStableCanvas(page);
        const deterministic = firstPixelHash === secondPixelHash;
        const metrics = metricsFor(report);
        const run: JudgeRun = {
          shot,
          detail: report.code.detail,
          viewport: { width: viewport.width, height: viewport.height },
          screenshot: `SHOTS/island-look/${filename}`,
          deterministic,
          firstPixelHash,
          secondPixelHash,
          canvas: report.canvas,
          colorSpace: report.pixels.colorSpace,
          sampledPixels: report.pixels.sampledPixels,
          domLabelContrast: report.domLabelContrastSamples.map((sample) => ({
            label: sample.label,
            contrast: numberValue(contrastRatio(sample.foreground, sample.background)),
          })),
          metrics,
        };
        runs.push(run);

        console.log(`\n${shot} · ${viewport.name} · ${viewport.width}×${viewport.height}`);
        console.table(
          metrics.map(({ metric, value, threshold, pass }) => ({
            metric,
            value: typeof value === "object" ? JSON.stringify(value) : value,
            threshold: typeof threshold === "object" ? JSON.stringify(threshold) : threshold,
            pass: pass ? "PASS" : "RED",
          })),
        );
        if (!deterministic) {
          console.warn(`island look freeze drift: ${shot}/${viewport.name}`);
        }
      }
    }

    const output: JudgeOutput = {
      version: 1,
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
