import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { assertVisibleText } from "./harness/assert.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { openOnline, waitForMapReady, FIRST_LESSON_TITLE } from "./harness/online-learner.js";
import { namedStep } from "./harness/step.js";
import { ONLINE_ORIGIN } from "./ports.js";

const RECOVERY_TIMEOUT_MS = 20_000;
const FIRST_LESSON_PATH =
  "/turing-pact/foundations-before-zero/what-is-an-app/you-already-know-apps";
const EVIDENCE_DIR = fileURLToPath(new URL("../.scratch/recovery/", import.meta.url));
const VIEWPORTS = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "mobile", viewport: { width: 375, height: 812 } },
] as const;

function evidencePath(name: string): string {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  return join(EVIDENCE_DIR, `${name}.png`);
}

async function captureEvidence(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: evidencePath(name), fullPage: true });
}

async function expectRecovery(
  page: Page,
  reason: "context-lost" | "webgl-unavailable" | "scene-timeout" | "content",
  timeout: number,
) {
  const state = page.locator(`[data-recovery-state="${reason}"]`);
  await expect(state).toBeVisible({ timeout });
  await expect(state.getByRole("button").first()).toBeEnabled();
  return state;
}

function assertExpectedConsoleErrors(
  consoleErrors: ReturnType<typeof watchConsole>,
  allowed: readonly RegExp[] = [],
): void {
  const unexpected = consoleErrors
    .errors()
    .filter((error) => !allowed.some((pattern) => pattern.test(error)));
  expect(unexpected).toEqual([]);
}

async function openReadyMap(page: Page): Promise<void> {
  await namedStep(page, "打开正常地图作为故障前基线", async () => {
    await openOnline(page);
    await waitForMapReady(page);
    await expect(page.locator(".stagewrap canvas")).toBeVisible();
  });
}

for (const { name, viewport } of VIEWPORTS) {
  test.describe(`M 地图/课程恢复 · ${name}`, () => {
    test.use({ viewport, hasTouch: false });

    test("WebGL context lost 后可重试，也能在 restored 后重新挂载场景", async ({ page }) => {
      const consoleErrors = watchConsole(page);
      await openReadyMap(page);
      await captureEvidence(page, `context-lost-before-${name}`);

      await namedStep(page, "注入 webglcontextlost", async () => {
        const cancelled = await page.locator(".stagewrap canvas").evaluate((canvas) => {
          const event = new Event("webglcontextlost", { cancelable: true });
          return !canvas.dispatchEvent(event);
        });
        expect(cancelled).toBe(true);
      });

      const lostStartedAt = Date.now();
      const lostState = await expectRecovery(page, "context-lost", 5_000);
      expect(Date.now() - lostStartedAt).toBeLessThan(5_000);
      await captureEvidence(page, `context-lost-after-${name}`);

      await namedStep(page, "点击重试并确认恢复态按钮可达", async () => {
        await humanClick(page, lostState.getByRole("button", { name: "再试一次" }), "重试地图");
        await waitForMapReady(page);
      });

      await namedStep(page, "注入 webglcontextrestored", async () => {
        await page.locator(".stagewrap canvas").evaluate((canvas) => {
          canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
          canvas.dispatchEvent(new Event("webglcontextrestored"));
        });
      });
      await waitForMapReady(page);
      await expect(page.locator('[data-recovery-state="context-lost"]')).toHaveCount(0);
      await captureEvidence(page, `context-lost-after-restored-${name}`);
      assertExpectedConsoleErrors(consoleErrors, [/Context Lost/i]);
    });

    test("WebGL 不可用时在短时间内说明原因，并可直接进入今天的课", async ({ page }) => {
      const consoleErrors = watchConsole(page);
      await openReadyMap(page);
      await captureEvidence(page, `webgl-unavailable-before-${name}`);

      await page.addInitScript(() => {
        const windowWithRecoveryProbe = window as typeof window & {
          __recoveryWebglAvailable?: boolean;
        };
        windowWithRecoveryProbe.__recoveryWebglAvailable ??= false;
        const prototype = HTMLCanvasElement.prototype as unknown as {
          getContext: (contextId: string, options?: unknown) => RenderingContext | null;
        };
        const original = prototype.getContext;
        prototype.getContext = function getContext(contextId, options) {
          if (/^webgl/.test(contextId) && !windowWithRecoveryProbe.__recoveryWebglAvailable) {
            return null;
          }
          return original.call(this, contextId, options);
        };
      });
      await namedStep(page, "注入浏览器没有 WebGL", async () => {
        await page.reload({ waitUntil: "domcontentloaded" });
      });

      const unavailableStartedAt = Date.now();
      const unavailableState = await expectRecovery(page, "webgl-unavailable", 5_000);
      expect(Date.now() - unavailableStartedAt).toBeLessThan(5_000);
      await captureEvidence(page, `webgl-unavailable-after-${name}`);

      await namedStep(page, "WebGL 恢复后重试并重新探测场景", async () => {
        await page.evaluate(() => {
          (
            window as typeof window & { __recoveryWebglAvailable?: boolean }
          ).__recoveryWebglAvailable = true;
        });
        await humanClick(
          page,
          unavailableState.getByRole("button", { name: "再试一次" }),
          "再试一次",
        );
        await waitForMapReady(page);
      });

      await page.evaluate(() => {
        (
          window as typeof window & { __recoveryWebglAvailable?: boolean }
        ).__recoveryWebglAvailable = false;
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      const unavailableAgain = await expectRecovery(page, "webgl-unavailable", 5_000);

      await namedStep(page, "点击直接开始今天的课", async () => {
        await humanClick(
          page,
          unavailableAgain.getByRole("button", { name: "直接开始今天的课" }),
          "直接开始今天的课",
        );
        await expect(page.locator("main.reader")).toBeVisible({ timeout: 30_000 });
        await assertVisibleText(page, FIRST_LESSON_TITLE);
      });
      consoleErrors.assertClean();
    });

    test("场景 20 秒没有 ready 时出现超时恢复态，而不是黑屏", async ({ page }) => {
      const consoleErrors = watchConsole(page);
      await openReadyMap(page);
      await captureEvidence(page, `scene-timeout-before-${name}`);

      await page.route("**/*.glb", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, RECOVERY_TIMEOUT_MS + 5_000));
        await route.abort().catch(() => undefined);
      });
      await namedStep(page, "注入场景资源一直不返回", async () => {
        await page.reload({ waitUntil: "domcontentloaded" });
      });

      const timeoutStartedAt = Date.now();
      const timeoutState = await expectRecovery(page, "scene-timeout", RECOVERY_TIMEOUT_MS + 5_000);
      expect(Date.now() - timeoutStartedAt).toBeLessThan(RECOVERY_TIMEOUT_MS + 5_000);
      await captureEvidence(page, `scene-timeout-after-${name}`);

      await namedStep(page, "超时态仍可直接开始今天的课", async () => {
        await humanClick(
          page,
          timeoutState.getByRole("button", { name: "直接开始今天的课" }),
          "超时态直接开始今天的课",
        );
        await expect(page.locator("main.reader")).toBeVisible({ timeout: 30_000 });
        await assertVisibleText(page, FIRST_LESSON_TITLE);
      });
      assertExpectedConsoleErrors(consoleErrors);
    });

    test("课程包返回 5xx 时可重试，正文路由不被书架错误挡住", async ({ page }) => {
      const consoleErrors = watchConsole(page);
      await namedStep(page, "打开正常课程作为故障前基线", async () => {
        await page.goto(`${ONLINE_ORIGIN}${FIRST_LESSON_PATH}`, {
          waitUntil: "domcontentloaded",
        });
        await assertVisibleText(page, FIRST_LESSON_TITLE);
      });
      await captureEvidence(page, `content-before-${name}`);

      let failOnce = true;
      await page.route("**/content/turing-pact/foundations-before-zero.json", async (route) => {
        if (failOnce) {
          failOnce = false;
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "injected recovery test failure" }),
          });
          return;
        }
        await route.continue();
      });
      await namedStep(page, "注入课程包 503", async () => {
        await page.reload({ waitUntil: "domcontentloaded" });
      });

      const contentStartedAt = Date.now();
      const contentState = await expectRecovery(page, "content", 10_000);
      expect(Date.now() - contentStartedAt).toBeLessThan(10_000);
      await captureEvidence(page, `content-after-${name}`);

      await namedStep(page, "点击重试课程资料并恢复正文", async () => {
        await humanClick(
          page,
          contentState.getByRole("button", { name: "重试这节课" }),
          "重试这节课",
        );
        await assertVisibleText(page, FIRST_LESSON_TITLE);
      });
      assertExpectedConsoleErrors(consoleErrors, [/status of 503/i]);
    });
  });
}
