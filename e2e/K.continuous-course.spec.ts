import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { decodePng } from "./harness/png.js";
import { humanClick, waitForStableBox } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { ONLINE_ORIGIN } from "./ports.js";
import { namedStep } from "./harness/step.js";
import { waitForCourseTrees } from "./harness/course-foliage.js";
import { FIRST_COURSE_ROUTE } from "./harness/online-learner.js";

const DEFAULT_CAPTURE_DIR = fileURLToPath(
  new URL("../SCRATCH/e2e/continuous-course", import.meta.url),
);
const CAPTURE_DIR = process.env.UNIVERSITY_COURSE_CAPTURE_DIR
  ? resolve(process.env.UNIVERSITY_COURSE_CAPTURE_DIR)
  : DEFAULT_CAPTURE_DIR;
const COURSE_PATH = FIRST_COURSE_ROUTE;

interface ViewportConfig {
  readonly name: "desktop" | "narrow-viewport";
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly hasTouch?: boolean;
}

const VIEWPORTS: readonly ViewportConfig[] = [
  {
    name: "desktop",
    label: "desktop (1440x900)",
    width: 1440,
    height: 900,
    hasTouch: false,
  },
  {
    name: "narrow-viewport",
    label: "narrow viewport mouse simulation (375x812, hasTouch: false; not physical phone)",
    width: 375,
    height: 812,
    hasTouch: false,
  },
];

interface SceneReceipt {
  readonly calls: number;
  readonly triangles: number;
  readonly lines: number;
  readonly points: number;
}

async function readSceneReceipt(page: Page): Promise<SceneReceipt | null> {
  return page.evaluate(() => {
    const bag = globalThis as unknown as {
      __lastStageSceneRender?: SceneReceipt;
    };
    return bag.__lastStageSceneRender ? { ...bag.__lastStageSceneRender } : null;
  });
}

async function measurePointerRaf(page: Page) {
  await page.evaluate(() => {
    const bag = globalThis as unknown as {
      __rafDeltas?: number[];
      __stopRaf?: () => void;
    };
    bag.__rafDeltas = [];
    let last = performance.now();
    let active = true;
    bag.__stopRaf = () => {
      active = false;
    };
    function tick(now: number) {
      if (!active) return;
      bag.__rafDeltas?.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  const canvas = page.locator(".stagewrap canvas").first();
  const box = await canvas.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down({ button: "left" });
    const t0 = Date.now();
    let step = 0;
    while (Date.now() - t0 < 2000) {
      step = (step + 14) % 180;
      await page.mouse.move(cx + step, cy + (step % 20), { steps: 2 });
      await page.waitForTimeout(40);
    }
    await page.mouse.up({ button: "left" });
  }

  return page.evaluate(() => {
    const bag = globalThis as unknown as {
      __rafDeltas?: number[];
      __stopRaf?: () => void;
    };
    bag.__stopRaf?.();
    const raw = bag.__rafDeltas ?? [];
    const valid = raw.slice(1).sort((a, b) => a - b);
    if (valid.length === 0) return null;
    const median = valid[Math.floor(valid.length * 0.5)];
    const p95 = valid[Math.floor(valid.length * 0.95)];
    return {
      sampleCount: valid.length,
      durationMs: 2000,
      medianIntervalMs: +median.toFixed(2),
      p95IntervalMs: +p95.toFixed(2),
      minIntervalMs: +valid[0].toFixed(2),
      maxIntervalMs: +valid[valid.length - 1].toFixed(2),
      label: "headless browser frame intervals",
      note: "requestAnimationFrame delta under 2s pointer camera drag; narrow viewport desktop mouse simulation, never physical phone FPS or touch test. Current-only measurement.",
    };
  });
}

async function runCourseWalk(page: Page, vp: ViewportConfig): Promise<void> {
  const consoleErrors = watchConsole(page);
  mkdirSync(CAPTURE_DIR, { recursive: true });

  await namedStep(page, `[${vp.name}] 打开课程岛直达地址并等待就绪`, async () => {
    const glbFailures: string[] = [];
    page.on("response", (res) => {
      const url = res.url();
      if (url.includes(".glb")) {
        if (!res.ok()) {
          glbFailures.push(`${url} (HTTP ${res.status()})`);
        }
      }
    });

    await page.goto(`${ONLINE_ORIGIN}${COURSE_PATH}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
    await expect(page.locator(".stagewrap canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".picked--left")).toBeVisible({ timeout: 30_000 });

    // R46 complete tree fields replace donor-trunk downloads. Wait for the
    // actual planned number of rendered tree instances on the visible canvas,
    // not a retired asset URL (which made WebKit wait forever for no reason).
    await waitForCourseTrees(page);

    if (glbFailures.length > 0) {
      throw new Error(`Dressing asset HTTP load failed: ${glbFailures.join(", ")}`);
    }

    // 等待 Stage 场景渲染非零收据，并留出有界的解析绘制稳定窗口（避免硬编码特定三角形下限）
    await page.waitForFunction(
      () => {
        const bag = globalThis as unknown as { __lastStageSceneRender?: SceneReceipt };
        return Boolean(bag.__lastStageSceneRender && bag.__lastStageSceneRender.triangles > 0);
      },
      null,
      { timeout: 30_000 },
    );
    await page.waitForTimeout(600);
  });

  const domFacts = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      theme: doc.getAttribute("data-game-ui-theme"),
      courseTitle: document.querySelector(".picked--left h3")?.textContent?.trim() ?? "",
      progressText:
        document.querySelector(".picked--left .picked__study")?.textContent?.trim() ?? "",
    };
  });

  const stageReceipt = await readSceneReceipt(page);

  const closeupScreenshot = `course-island-${vp.width}x${vp.height}.png`;
  await namedStep(page, `[${vp.name}] 交互前采集基线特写截图与渲染回执`, async () => {
    const screenshotPath = join(CAPTURE_DIR, closeupScreenshot);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const bytes = readFileSync(screenshotPath);
    const header = decodePng(bytes);
    expect(header.width).toBe(vp.width);
    expect(header.height).toBe(vp.height);
  });

  let frameIntervals: unknown = null;
  await namedStep(page, `[${vp.name}] 2秒真实指针拖拽测量帧间隔`, async () => {
    frameIntervals = await measurePointerRaf(page);
  });

  await namedStep(page, `[${vp.name}] 验证学习路线抽屉展开与查看单元内容`, async () => {
    const island = page.locator(".picked--left");
    const route = island.locator("details.picked__route");
    await expect(route).toBeVisible({ timeout: 10_000 });
    const summary = route.locator(":scope > summary");
    await humanClick(page, summary, `${vp.name} 展开学习路线`);
    await expect(route).toHaveAttribute("open", "");
    await expect(island.getByRole("button", { name: /先看这一单元讲什么/ })).toBeVisible();
  });

  await namedStep(page, `[${vp.name}] 真实指针点击首节关卡标记打开课程卡`, async () => {
    const lessonMarker = page
      .locator("button.label--icon.is-visible, button.label--lesson.is-visible")
      .first();
    await expect(lessonMarker).toBeVisible({ timeout: 30_000 });
    await waitForStableBox(lessonMarker);
    await humanClick(page, lessonMarker, `${vp.name} 首节关卡标记`);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toContainText("读 ");
  });

  await namedStep(page, `[${vp.name}] 点击开始进入课文并确认进入阅读器`, async () => {
    const startBtn = page.getByRole("dialog").getByRole("button", { name: /^开始/ });
    await humanClick(page, startBtn, `${vp.name} 开始课文`);
    await expect(page).toHaveURL(
      new RegExp(`${COURSE_PATH.replaceAll("/", "\\/")}\/[^/]+\/[^/]+$`),
    );
    await expect(page.locator(".lesson-reader")).toBeVisible({ timeout: 30_000 });
  });

  await namedStep(page, `[${vp.name}] 点击离开课文返回课程岛并确认抽屉仍然可用`, async () => {
    const exitBtn = page.getByRole("button", { name: "离开课文" });
    await humanClick(page, exitBtn, `${vp.name} 离开课文`);
    await expect(page).toHaveURL(new RegExp(`${COURSE_PATH}$`));
    await expect(page.locator(".stagewrap canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".picked--left")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".picked--left details.picked__route")).toBeVisible({
      timeout: 10_000,
    });
  });

  const overviewScreenshot = `course-island-overview-${vp.width}x${vp.height}.png`;
  await namedStep(page, `[${vp.name}] 收起学习路线、鼠标滚轮拉远并采集连续地貌概览图`, async () => {
    const route = page.locator(".picked--left details.picked__route");
    if ((await route.getAttribute("open")) !== null) {
      await humanClick(page, route.locator(":scope > summary"), `${vp.name} 收起学习路线`);
      await expect(route).not.toHaveAttribute("open", "");
    }

    // Search the actual canvas, not four fixed window fractions. The shared
    // breadcrumb/tool bars move a narrow canvas below the window midpoint.
    // A real hit-test still rejects every card, label and opaque toolbar.
    const unobstructedPoint = await page.evaluate(() => {
      const canvas = document.querySelector(".stagewrap:not([hidden]) canvas");
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const left = Math.max(0, rect.left),
        top = Math.max(0, rect.top);
      const width = Math.min(innerWidth, rect.right) - left;
      const height = Math.min(innerHeight, rect.bottom) - top;
      if (width <= 0 || height <= 0) return null;
      for (const fy of [0.65, 0.8, 0.5, 0.35, 0.2]) {
        for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85]) {
          const pt = { x: Math.round(left + width * fx), y: Math.round(top + height * fy) };
          if (document.elementFromPoint(pt.x, pt.y) === canvas) return pt;
        }
      }
      return null;
    });

    expect(
      unobstructedPoint,
      "Expected to find an unobstructed point on canvas for wheel zoom",
    ).not.toBeNull();

    if (unobstructedPoint) {
      await page.mouse.move(unobstructedPoint.x, unobstructedPoint.y);
      // 正向 wheel deltaY 向外拉远（zoom out）至正常用户视距上限
      for (let i = 0; i < 16; i += 1) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(40);
      }
    }

    // 等待相机位姿平滑落定
    await page.waitForTimeout(1000);
    await page.waitForFunction(
      () => {
        const bag = globalThis as unknown as { __lastStageSceneRender?: SceneReceipt };
        return Boolean(bag.__lastStageSceneRender && bag.__lastStageSceneRender.calls > 0);
      },
      null,
      { timeout: 10_000 },
    );

    const overviewPath = join(CAPTURE_DIR, overviewScreenshot);
    await page.screenshot({ path: overviewPath, fullPage: false });

    const bytes = readFileSync(overviewPath);
    const header = decodePng(bytes);
    expect(header.width).toBe(vp.width);
    expect(header.height).toBe(vp.height);
  });

  // 保存独立视口证据文件，防止多 worker 重启覆盖
  const evidenceFile = join(CAPTURE_DIR, `evidence-${vp.width}x${vp.height}.json`);
  const evidence = {
    capturedAt: new Date().toISOString(),
    url: page.url(),
    viewport: {
      width: vp.width,
      height: vp.height,
      dpr: 1,
      name: vp.name,
      label: vp.label,
      note:
        vp.name === "narrow-viewport"
          ? "Narrow viewport desktop mouse simulation; hasTouch: false is not physical phone testing"
          : "Desktop viewport",
    },
    domFacts,
    screenshot: closeupScreenshot,
    screenshotActualDimensions: { width: vp.width, height: vp.height },
    overviewScreenshot,
    overviewScreenshotActualDimensions: { width: vp.width, height: vp.height },
    stageSceneReceipt: stageReceipt,
    stageReceiptScopeNote:
      "Actual scene scope: Three.js gl.render(scene, camera) in packages/world/src/Stage.tsx via window.__lastStageSceneRender. Complete-frame scope includes subsequent post-processing passes. Triangles must never be used to infer FPS.",
    frameIntervals,
    consoleErrors: consoleErrors.errors(),
  };
  writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  consoleErrors.assertClean();
}

test.describe("K 连续地形课程岛 · 聚焦测试套件", () => {
  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name} ${vp.width}x${vp.height}`, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        colorScheme: "light",
        hasTouch: vp.hasTouch ?? false,
      });

      test(`基线截图、交互进入课文并返回 (${vp.name})`, async ({ page }) => {
        await runCourseWalk(page, vp);
      });
    });
  }
});
