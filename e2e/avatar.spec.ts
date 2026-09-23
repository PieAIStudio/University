import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

import { FAST_TRAVEL_UPPER_BOUND_MS } from "../packages/world/src/avatar/hop.js";
import { CLOUD_CARRIER_FOOT_OFFSET } from "../packages/world/src/sky/cloud-carrier-contract.js";
import { humanClick } from "./harness/click.js";
import { landingTiming, timedPointerClick } from "./harness/motion-time.js";
import { watchConsole } from "./harness/console.js";
import { CATALOGUE_ROLES, SHIPPED_COURSES, coursePathOf } from "./harness/catalogue.js";
import { EMPTY_DOMAIN_ID, PRIMARY_DOMAIN_ID } from "./harness/domain-catalogue.js";
import {
  FIRST_COURSE_ROUTE,
  openOnline,
  readAndAnswerFirstLesson,
  waitForMapReady,
  waitForSettlementProgress,
} from "./harness/online-learner.js";
import { ONLINE_ORIGIN } from "./ports.js";
import { namedStep } from "./harness/step.js";
import { planetFocusSample } from "./harness/planet-focus.js";
import { enterSelectedMapObject, mapEntryButton } from "./harness/map-actions.js";
import { withProject } from "./harness/project.js";

const EVIDENCE = ".scratch/evidence-avatar";
const PRIMARY_STUDY = CATALOGUE_ROLES.settlement.study;

type Motion = {
  readonly sequence: number;
  readonly inFlight: boolean;
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly finishedAt: number | null;
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
  pressedAt: number,
): Promise<{
  readonly elapsedMs: number;
  readonly observationDelayMs: number;
  readonly report: Motion;
}> {
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
  const report = await motion(page, surface);
  if (!report) throw new Error(`${surface} avatar motion report disappeared after landing`);
  const observedAt = await page.evaluate(() => performance.now());
  return { ...landingTiming(pressedAt, report.finishedAt, observedAt), report };
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
          const canvas = document.querySelector<HTMLCanvasElement>(
            "[data-planet-globe] canvas, .stagewrap:not([hidden]) canvas",
          );
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

/** Select the actual atmospheric region, not the retired permanent study list. */
async function clickStudyRegion(page: Page, studyId: string, beforePress?: () => Promise<void>) {
  const point = await page.evaluate(
    withProject((project, id) => {
      const bag = window as any;
      const projection = bag.__planetProjection();
      const domain = projection.domains.find((entry: any) => entry.studyIds.includes(id));
      const region = domain?.regions.find((entry: any) => entry.studyId === id);
      const scene = bag.three;
      const hits = domain && scene?.scene.getObjectByName(`domain-region-targets-${domain.id}`);
      if (!region || !hits) return null;
      hits.updateWorldMatrix(true, false);
      const position = scene.camera.position
        .clone()
        .fromArray(region.position)
        .applyMatrix4(hits.matrixWorld);
      const pixel = project.projectWorldToViewport(position, scene.camera, scene.gl.domElement);
      return document.elementFromPoint(pixel.x, pixel.y) === scene.gl.domElement ? pixel : null;
    }),
    studyId,
  );
  expect(point, "the real study region must have an unobstructed canvas hit").not.toBeNull();
  await page.mouse.move(point!.x, point!.y);
  await beforePress?.();
  await page.mouse.down();
  await page.waitForTimeout(40);
  await page.mouse.up();
}

function assertFast(elapsedMs: number, surface: string): void {
  expect(
    elapsedMs,
    `${surface} 的点击到落地应在 ${FAST_TRAVEL_UPPER_BOUND_MS}ms 内，实际 ${elapsedMs.toFixed(1)}ms`,
  ).toBeLessThanOrEqual(FAST_TRAVEL_UPPER_BOUND_MS);
}

test.describe("G 地图定位 · 星球区域转向与两层头像跳跃", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("星球测量尺：平移不改变对准精度（合成校准，不是产品验收）", () => {
    const origin = planetFocusSample({
      kind: "calibration",
      centre: [0, 0, 0],
      eye: [0, 0, 100],
      focus: [0, 0, 10],
      alignedOnly: true,
    });
    const translated = planetFocusSample({
      kind: "calibration",
      centre: [20, 10, 5],
      eye: [20, 10, 105],
      focus: [20, 10, 15],
      alignedOnly: true,
    });
    expect(origin?.alignment).toBe(1);
    expect(translated?.alignment).toBe(origin?.alignment);
    expect(translated!.legacyWorldOriginAlignment).toBeLessThan(0.95);
    expect(
      planetFocusSample({
        kind: "calibration",
        centre: [20, 10, 5],
        eye: [20, 10, 105],
        focus: [20.02, 10, 15],
        alignedOnly: true,
      }),
    ).toBeNull();
    expect(
      planetFocusSample({
        kind: "calibration",
        centre: [0, 0, 0],
        eye: [0, 0, 0],
        focus: [0, 0, 10],
      }),
    ).toBeNull();
  });

  test("星球区域与两层头像都跟随真实点击，并在快速上限内就位", async ({ page }) => {
    // Which course the archipelago walk lands on is chosen from what the label
    // projector actually drew, so the island steps below read it rather than a
    // fixture that may not have been placed.
    const consoleErrors = watchConsole(page);
    const evidence: Record<string, unknown> = {
      viewport: page.viewportSize(),
      fastUpperBoundMs: FAST_TRAVEL_UPPER_BOUND_MS,
      carrierFootOffset: CLOUD_CARRIER_FOOT_OFFSET,
    };

    await namedStep(page, "星球层选择系列，真实球体转向对应大气区域", async () => {
      await page.goto(`${ONLINE_ORIGIN}/planet`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-planet-globe] canvas")).toBeVisible({ timeout: 30_000 });
      await page.waitForFunction((domainId) => {
        const bag = globalThis as any;
        return (
          bag.__planetProjection?.().domainCount > 0 &&
          bag.three?.scene.getObjectByName(`domain-globe-${domainId}`)
        );
      }, PRIMARY_DOMAIN_ID);
      await humanClick(
        page,
        page.locator(`button[data-domain-id="${PRIMARY_DOMAIN_ID}"]`),
        "select the populated programming domain",
      );
      // Exercise an actually empty domain, then the selected course's domain.
      // A newly published study must not be mistaken for a product regression.
      await humanClick(
        page,
        page.locator(`button[data-domain-id="${EMPTY_DOMAIN_ID}"]`),
        "先看尚未发布的空域",
      );
      await expect(page.locator("[data-study-id]")).toHaveCount(0);
      await humanClick(
        page,
        page.locator(`button[data-domain-id="${PRIMARY_DOMAIN_ID}"]`),
        "回到已发布的学习域",
      );
      await clickStudyRegion(page, PRIMARY_STUDY.id);
      await page.waitForFunction(planetFocusSample, {
        kind: "scene",
        studyId: PRIMARY_STUDY.id,
        alignedOnly: true,
      } as const);
      if (process.env.UNIVERSITY_TIMING_PLANET === "1") {
        await page.evaluate(planetFocusSample, { kind: "install" } as const);
        await page.evaluate((studyId) => {
          const receipt = {
            events: [] as { name: string; at: number }[],
            tasks: [] as { at: number; duration: number }[],
            frames: [] as { at: number; selected: string | null; angle: number | null }[],
          };
          const observer = new PerformanceObserver((entries) => {
            for (const task of entries.getEntries())
              receipt.tasks.push({ at: task.startTime, duration: task.duration });
          });
          observer.observe({ type: "longtask", buffered: true });
          for (const name of ["pointerdown", "pointerup", "click"]) {
            document.addEventListener(
              name,
              () => receipt.events.push({ name, at: performance.now() }),
              { once: true, capture: true },
            );
          }
          let active = true;
          let frameId = 0;
          const sample = () => {
            if (!active) return;
            const bag = window as any;
            const angle =
              bag.__testPlanetFocusSample({ kind: "scene", studyId })?.alignment ?? null;
            receipt.frames.push({
              at: performance.now(),
              selected: bag.__planetProjection?.().selectedId ?? null,
              angle,
            });
            if (receipt.frames.length < 180) frameId = requestAnimationFrame(sample);
          };
          frameId = requestAnimationFrame(sample);
          (window as any).__planetTiming = {
            receipt,
            stop: () => {
              active = false;
              cancelAnimationFrame(frameId);
              observer.disconnect();
              delete (window as any).__testPlanetFocusSample;
            },
          };
        }, PRIMARY_STUDY.id);
      }
      // Opt-in CPU evidence for the actual pointer path. Traces/screenshots
      // stay off during this measurement so capture cannot stretch the turn.
      const profile = process.env.UNIVERSITY_PROFILE_PLANET
        ? await page.context().newCDPSession(page)
        : null;
      if (profile) {
        await profile.send("Profiler.enable");
        await profile.send("Profiler.start");
        await page.evaluate(() => {
          const events: { name: string; at: number }[] = [];
          for (const name of ["pointerdown", "pointerup", "click"] as const) {
            document.addEventListener(name, () => events.push({ name, at: performance.now() }), {
              capture: true,
              once: true,
            });
          }
          Object.assign(window, { __planetClickProfile: events });
        });
      }
      let startedAt = 0;
      await clickStudyRegion(page, PRIMARY_STUDY.id, async () => {
        startedAt = await page.evaluate(() => performance.now());
      });
      const facing = await page.waitForFunction(
        planetFocusSample,
        { kind: "scene", studyId: PRIMARY_STUDY.id, alignedOnly: true } as const,
        { polling: "raf", timeout: 10_000 },
      );
      const alignment = await facing.jsonValue();
      await facing.dispose();
      const elapsedMs = await page.evaluate((start) => performance.now() - start, startedAt);
      if (process.env.UNIVERSITY_TIMING_PLANET === "1") {
        const timing = await page.evaluate(() => {
          const entry = (window as any).__planetTiming;
          entry.stop();
          return entry.receipt;
        });
        console.log("PLANET_TIMING", JSON.stringify({ startedAt, elapsedMs, ...timing }));
      }
      if (profile) {
        const cpu = await profile.send("Profiler.stop");
        const events = await page.evaluate(() => (window as any).__planetClickProfile);
        const directory = process.env.UNIVERSITY_PROFILE_PLANET!;
        mkdirSync(directory, { recursive: true });
        writeFileSync(`${directory}/planet-click.cpuprofile`, JSON.stringify(cpu.profile));
        writeFileSync(
          `${directory}/timing.json`,
          JSON.stringify({ startedAt, elapsedMs, events }, null, 2),
        );
        await profile.detach();
      }
      assertFast(elapsedMs, "星球区域转向");
      await expect(
        page.getByRole("button", { name: `进入 ${PRIMARY_STUDY.title}`, exact: true }),
      ).toBeVisible();
      const measured = await measuredScene(page);
      evidence.planet = { elapsedMs, alignment, selectedStudyId: PRIMARY_STUDY.id, ...measured };
    });

    await namedStep(page, "岛群层点课程，云飞到岛上而不是改写导航焦点", async () => {
      await openOnline(page);
      await waitForMapReady(page);
      await page.waitForFunction(() => {
        const current = (window as any).__avatarMotion?.world;
        return current && !current.inFlight;
      });
      const home = (await motion(page, "world"))!;
      const currentCourse = page.locator(
        'button.label--course.is-visible[data-course-state="live"]',
      );
      await expect(currentCourse).toHaveCount(1);
      const firstPressedAt = await timedPointerClick(
        page,
        currentCourse,
        "从岛外等待位置选择当前课程",
      );
      const firstArrival = await waitForFlight(page, "world", home.sequence, firstPressedAt);
      assertFast(firstArrival.elapsedMs, "首次选择的真实到达");
      expect(firstArrival.report.target).not.toEqual(home.target);
      await humanClick(page, currentCourse, "重复点同一课程不伪造新飞行");
      const entry = mapEntryButton(page);
      await expect(entry).toBeVisible();
      await page.evaluate(async () => {
        for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
      });
      const sameTarget = (await motion(page, "world"))!;
      expect(sameTarget.sequence).toBe(firstArrival.report.sequence);
      expect(sameTarget.target).toEqual(firstArrival.report.target);
      expect(sameTarget.inFlight).toBe(false);
      evidence.worldSameTarget = { home, sameTarget };
      // Course selection is now a non-modal object action. Escape cancels the
      // explicit choice and proves the map remains usable without a scrim.
      await page.keyboard.press("Escape");
      await expect(page.locator('[data-map-entry="true"]')).toHaveCount(0);

      await page.waitForFunction((target) => {
        const report = (window as any).__avatarMotion?.world;
        return (
          report && !report.inFlight && JSON.stringify(report.target) === JSON.stringify(target)
        );
      }, home.target);
      // Cancellation returns outside the islands; the next explicit choice
      // must make a real flight to a stable, actual course destination.
      /*
        Any course other than the live one proves a second real flight; which
        one it is was never the subject. Naming one made this depend on the
        label projector choosing to place that particular name, and on an
        archipelago of four courses it places three — see
        docs/reference/execution/archipelago-framing-gap.md. Ask the map which
        alternates it actually drew, and fail loudly if it drew none.
      */
      const liveId = await currentCourse.getAttribute("data-map-marker");
      const alternates = page.locator(
        'button.label--course.is-visible[data-map-marker]:not([data-course-state="live"])',
      );
      await expect(alternates.first(), "岛群上没有第二门可点的课").toBeVisible({ timeout: 30_000 });
      const courseLabel = alternates.first();
      const targetId = await courseLabel.getAttribute("data-map-marker");
      expect(targetId, "替代课程必须与当前课程不同").not.toBe(liveId);
      const before = (await motion(page, "world"))?.sequence ?? 0;
      const startedAt = await timedPointerClick(page, courseLabel, "岛群里的课程");
      const result = await waitForFlight(page, "world", before, startedAt);
      const elapsedMs = await page.evaluate((start) => performance.now() - start, startedAt);
      assertFast(result.elapsedMs, "岛群（真实绘制落地帧）");
      expect(result.report.target).not.toEqual(home.target);
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
      evidence.world = {
        elapsedMs,
        clickToLandingMs: result.elapsedMs,
        observationDelayMs: result.observationDelayMs,
        report: result.report,
        cloud,
        ...measured,
      };

      await enterSelectedMapObject(page, "进入课程岛");
      const entered = SHIPPED_COURSES.find((course) => course.id === targetId);
      expect(entered, `点中的课程 ${targetId} 不在已发布目录里`).toBeTruthy();
      await expect(page).toHaveURL(`${ONLINE_ORIGIN}${coursePathOf(entered!)}`);
    });

    await namedStep(page, "岛内点一个 lesson 标记，真实兔子跳到对应格子", async () => {
      await expect(page.locator(".stagewrap canvas")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
      await page.waitForFunction(() => {
        const current = (window as any).__avatarMotion?.course;
        return current && !current.inFlight;
      });
      const resting = (await motion(page, "course"))!;
      const before = resting.sequence;
      // The avatar rests at the idle point beside the island, so the current
      // lesson is a real jump. Later lessons are locked on a fresh profile
      // (V5 §12 C′) and correctly do not move it; the current lesson carries
      // its "Start" label instead of a kind icon.
      const lessonIcon = page
        .locator('button.label--lesson.is-visible[data-lesson-state="live"]')
        .first();
      await expect(lessonIcon).toBeVisible({ timeout: 30_000 });
      const startedAt = await timedPointerClick(page, lessonIcon, "岛内 lesson 标记");
      const result = await waitForFlight(page, "course", before, startedAt);
      const elapsedMs = await page.evaluate((start) => performance.now() - start, startedAt);
      assertFast(result.elapsedMs, "岛内（真实绘制落地帧）");
      expect(result.report.target).not.toEqual(resting.target);
      expect(result.report.position).toEqual(result.report.target);
      await expect(page.locator('[data-map-entry="true"]')).toBeVisible({ timeout: 10_000 });
      const measured = await measuredScene(page);
      evidence.course = {
        elapsedMs,
        clickToLandingMs: result.elapsedMs,
        observationDelayMs: result.observationDelayMs,
        report: result.report,
        ...measured,
      };
    });

    mkdirSync(EVIDENCE, { recursive: true });
    writeFileSync(`${EVIDENCE}/dynamic-metrics.json`, `${JSON.stringify(evidence, null, 2)}\n`);
    consoleErrors.assertClean();
  });

  test("完成第一节后回到岛内，头像仍停在刚点击的 lesson 格子", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    await page.goto(`${ONLINE_ORIGIN}${FIRST_COURSE_ROUTE}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".stagewrap canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });

    const firstLesson = page.getByRole("button", { name: "开始", exact: true }).first();
    await expect(firstLesson).toBeVisible({ timeout: 30_000 });
    await humanClick(page, firstLesson, "第一节 lesson 标记");
    await expect(page.locator('[data-map-entry="true"]')).toBeVisible({ timeout: 10_000 });
    const selectedTarget = await page.evaluate(() => {
      const bag = globalThis as unknown as {
        __avatarMotion?: Record<string, Motion>;
      };
      return bag.__avatarMotion?.course?.target ?? null;
    });
    expect(selectedTarget).toBeTruthy();

    await enterSelectedMapObject(page, "开始第一节");
    await readAndAnswerFirstLesson(page);
    await waitForSettlementProgress(page);
    const backToCourse = page.getByRole("button", { name: /回关卡地图/ }).first();
    // The pointer helper reacquires and scrolls the live control if the
    // completed-lesson view remounts before the first physical press.
    await humanClick(page, backToCourse, "回到课程岛");
    await expect(page).toHaveURL(`${ONLINE_ORIGIN}${FIRST_COURSE_ROUTE}`);
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
