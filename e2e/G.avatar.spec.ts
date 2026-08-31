import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

import { FAST_TRAVEL_UPPER_BOUND_MS } from "../packages/world/src/avatar/hop.js";
import { CLOUD_CARRIER_FOOT_OFFSET } from "../packages/world/src/sky/cloud-carrier-contract.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import {
  openOnline,
  readAndAnswerFirstLesson,
  waitForMapReady,
  waitForSettlementProgress,
} from "./harness/online-learner.js";
import { ONLINE_ORIGIN } from "./ports.js";
import { namedStep } from "./harness/step.js";

const EVIDENCE = ".scratch/evidence-avatar";

type Motion = {
  readonly sequence: number;
  readonly inFlight: boolean;
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
};

type SceneMetrics = {
  readonly calls: number;
  readonly triangles: number;
  readonly lines: number;
  readonly points: number;
};

type FrameStats = {
  readonly sampleCount: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly maxMs: number;
  readonly visibilityState: string;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly canvasDataUrlLength: number;
};

async function motion(page: Page, surface: "planet" | "world" | "course"): Promise<Motion | null> {
  return page.evaluate((key) => {
    const bag = globalThis as unknown as {
      __avatarMotion?: Record<string, Motion>;
    };
    return bag.__avatarMotion?.[key] ?? null;
  }, surface);
}

async function waitForFlight(
  page: Page,
  surface: "planet" | "world" | "course",
  previousSequence: number,
): Promise<{ readonly elapsedMs: number; readonly report: Motion }> {
  const startedAt = await page.evaluate(() => performance.now());
  await page.waitForFunction(
    ({ key, sequence }) => {
      const bag = globalThis as unknown as {
        __avatarMotion?: Record<string, Motion>;
      };
      const current = bag.__avatarMotion?.[key];
      return Boolean(current && current.sequence > sequence && current.inFlight);
    },
    { key: surface, sequence: previousSequence },
    { timeout: 10_000 },
  );
  await page.waitForFunction(
    ({ key, sequence }) => {
      const bag = globalThis as unknown as {
        __avatarMotion?: Record<string, Motion>;
      };
      const current = bag.__avatarMotion?.[key];
      return Boolean(current && current.sequence > sequence && !current.inFlight);
    },
    { key: surface, sequence: previousSequence },
    { timeout: 10_000 },
  );
  const elapsedMs = await page.evaluate((start) => performance.now() - start, startedAt);
  const report = await motion(page, surface);
  if (!report) throw new Error(`${surface} avatar motion report disappeared after landing`);
  return { elapsedMs, report };
}

async function sceneMetrics(page: Page): Promise<SceneMetrics | null> {
  return page.evaluate(() => {
    const bag = globalThis as unknown as {
      __lastStageSceneRender?: SceneMetrics;
    };
    return bag.__lastStageSceneRender ?? null;
  });
}

/**
 * Measure the browser's actual rAF cadence on the visible canvas page. This is
 * deliberately separate from the screenshot pass: a hidden tab is allowed to
 * throttle rAF, and a screenshot can be visually useful while saying nothing
 * about the frame budget.
 */
async function frameStats(page: Page): Promise<FrameStats> {
  return page.evaluate(
    () =>
      new Promise<FrameStats>((resolve) => {
        const samples: number[] = [];
        let previous = performance.now();
        const tick = (now: number) => {
          samples.push(now - previous);
          previous = now;
          if (samples.length < 60) {
            requestAnimationFrame(tick);
            return;
          }
          const sorted = [...samples].sort((left, right) => left - right);
          const canvas = document.querySelector<HTMLCanvasElement>(".stagewrap canvas");
          const dataUrlLength = canvas ? canvas.toDataURL().length : 0;
          resolve({
            sampleCount: samples.length,
            medianMs: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
            p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
            maxMs: sorted.at(-1) ?? 0,
            visibilityState: document.visibilityState,
            canvasWidth: canvas?.width ?? 0,
            canvasHeight: canvas?.height ?? 0,
            canvasDataUrlLength: dataUrlLength,
          });
        };
        requestAnimationFrame(tick);
      }),
  );
}

async function measuredScene(page: Page): Promise<{
  readonly scene: SceneMetrics;
  readonly frame: FrameStats;
}> {
  const scene = await sceneMetrics(page);
  expect(scene, "3D 场景还没有完成一次真实渲染").toBeTruthy();
  const frame = await frameStats(page);
  expect(frame.visibilityState).toBe("visible");
  expect(frame.canvasWidth).toBeGreaterThan(0);
  expect(frame.canvasHeight).toBeGreaterThan(0);
  expect(frame.canvasDataUrlLength).toBeGreaterThan(1_000);
  return { scene: scene!, frame };
}

function assertFast(elapsedMs: number, surface: string): void {
  expect(
    elapsedMs,
    `${surface} 的点击到落地应在 ${FAST_TRAVEL_UPPER_BOUND_MS}ms 内，实际 ${elapsedMs.toFixed(1)}ms`,
  ).toBeLessThanOrEqual(FAST_TRAVEL_UPPER_BOUND_MS);
}

test.describe("G 玩家头像 · 三种高度共用云、兔子与跳跃逻辑", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("星球、岛群、岛内都跟随真实点击，并在快速上限内落地", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    const evidence: Record<string, unknown> = {
      viewport: page.viewportSize(),
      fastUpperBoundMs: FAST_TRAVEL_UPPER_BOUND_MS,
      carrierFootOffset: CLOUD_CARRIER_FOOT_OFFSET,
    };

    await namedStep(page, "星球层选择另一个系列，云和兔子一起飞", async () => {
      await page.goto(`${ONLINE_ORIGIN}/planet`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-planet-globe] canvas")).toBeVisible({ timeout: 30_000 });
      await page.waitForFunction(() => {
        const bag = globalThis as unknown as {
          __planetProjection?: () => { readonly clusterCount: number };
          __avatarMotion?: Record<string, Motion>;
        };
        return Boolean(bag.__planetProjection?.().clusterCount && bag.__avatarMotion?.planet);
      });
      const before = (await motion(page, "planet"))?.sequence ?? 0;
      let startedAt = 0;
      await humanClick(page, page.getByRole("button", { name: /^Buzz\b/ }), "星球上的 Buzz 系列", {
        beforePress: async () => {
          startedAt = await page.evaluate(() => performance.now());
        },
      });
      const result = await waitForFlight(page, "planet", before);
      const elapsedMs = await page.evaluate((start) => performance.now() - start, startedAt);
      // The browser-side receipt starts as soon as the real pointer is up;
      // `elapsedMs` is retained to show the full pointer-to-landing latency.
      assertFast(result.elapsedMs, "星球（报告轮询）");
      expect(result.report.position).toEqual(result.report.target);
      const cloud = await page.evaluate(() => {
        const bag = globalThis as unknown as {
          __cloudCarrierMotion?: Record<
            string,
            { readonly position: readonly number[]; readonly target: readonly number[] }
          >;
        };
        return bag.__cloudCarrierMotion?.planet ?? null;
      });
      expect(cloud).toBeTruthy();
      expect(cloud!.position).toEqual(cloud!.target);
      const measured = await measuredScene(page);
      evidence.planet = {
        elapsedMs,
        report: result.report,
        cloud,
        ...measured,
      };
    });

    await namedStep(page, "岛群层点课程，云飞到岛上而不是改写导航焦点", async () => {
      await openOnline(page);
      await waitForMapReady(page);
      const before = (await motion(page, "world"))?.sequence ?? 0;
      const courseLabel = page.locator("button.label--course.is-visible").first();
      await expect(courseLabel).toBeVisible({ timeout: 30_000 });
      let startedAt = 0;
      await humanClick(page, courseLabel, "岛群里的课程", {
        beforePress: async () => {
          startedAt = await page.evaluate(() => performance.now());
        },
      });
      const result = await waitForFlight(page, "world", before);
      const elapsedMs = await page.evaluate((start) => performance.now() - start, startedAt);
      assertFast(result.elapsedMs, "岛群（报告轮询）");
      expect(result.report.position).toEqual(result.report.target);
      const cloud = await page.evaluate(() => {
        const bag = globalThis as unknown as {
          __cloudCarrierMotion?: Record<
            string,
            { readonly position: readonly number[]; readonly target: readonly number[] }
          >;
        };
        return bag.__cloudCarrierMotion?.world ?? null;
      });
      expect(cloud).toBeTruthy();
      expect(cloud!.position).toEqual(cloud!.target);
      expect(result.report.target[1] - cloud!.target[1]).toBeCloseTo(CLOUD_CARRIER_FOOT_OFFSET, 6);
      const measured = await measuredScene(page);
      evidence.world = { elapsedMs, report: result.report, cloud, ...measured };

      await humanClick(page, page.getByRole("button", { name: /进入这门课/ }), "进入课程岛");
      await expect(page).toHaveURL(/\/turing-pact\/[^/]+$/);
    });

    await namedStep(page, "岛内点一个 lesson 标记，真实兔子跳到对应格子", async () => {
      await expect(page.locator(".stagewrap canvas")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
      const before = (await motion(page, "course"))?.sequence ?? 0;
      const lessonIcon = page.locator("button.label--icon.is-visible").first();
      await expect(lessonIcon).toBeVisible({ timeout: 30_000 });
      let startedAt = 0;
      await humanClick(page, lessonIcon, "岛内 lesson 标记", {
        beforePress: async () => {
          startedAt = await page.evaluate(() => performance.now());
        },
      });
      const result = await waitForFlight(page, "course", before);
      const elapsedMs = await page.evaluate((start) => performance.now() - start, startedAt);
      assertFast(result.elapsedMs, "岛内（报告轮询）");
      expect(result.report.position).toEqual(result.report.target);
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
      const measured = await measuredScene(page);
      evidence.course = { elapsedMs, report: result.report, ...measured };
    });

    mkdirSync(EVIDENCE, { recursive: true });
    writeFileSync(`${EVIDENCE}/dynamic-metrics.json`, `${JSON.stringify(evidence, null, 2)}\n`);
    consoleErrors.assertClean();
  });

  test("完成第一节后回到岛内，头像仍停在刚点击的 lesson 格子", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    await page.goto(`${ONLINE_ORIGIN}/turing-pact/foundations-before-zero`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(".stagewrap canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });

    const firstLesson = page.getByRole("button", { name: "开始", exact: true }).first();
    await expect(firstLesson).toBeVisible({ timeout: 30_000 });
    await humanClick(page, firstLesson, "第一节 lesson 标记");
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    const selectedTarget = await page.evaluate(() => {
      const bag = globalThis as unknown as {
        __avatarMotion?: Record<string, Motion>;
      };
      return bag.__avatarMotion?.course?.target ?? null;
    });
    expect(selectedTarget).toBeTruthy();

    await humanClick(
      page,
      page.getByRole("dialog").getByRole("button", { name: /^开始/ }),
      "开始第一节",
    );
    await readAndAnswerFirstLesson(page);
    await waitForSettlementProgress(page);
    const backToCourse = page.getByRole("button", { name: /回关卡地图/ }).first();
    await backToCourse.scrollIntoViewIfNeeded();
    await humanClick(page, backToCourse, "回到课程岛");
    await expect(page).toHaveURL(/\/turing-pact\/foundations-before-zero$/);
    await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
    await page.waitForFunction(() => {
      const bag = globalThis as unknown as {
        __avatarMotion?: Record<string, Motion>;
      };
      return Boolean(bag.__avatarMotion?.course && !bag.__avatarMotion.course.inFlight);
    });
    const after = await page.evaluate(() => {
      const bag = globalThis as unknown as {
        __avatarMotion?: Record<string, Motion>;
      };
      return bag.__avatarMotion?.course?.target ?? null;
    });
    expect(after).toEqual(selectedTarget);
    consoleErrors.assertClean();
  });
});
