import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

import { assertPanelIsPainted } from "./harness/assert.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { openOnline, waitForMapReady } from "./harness/online-learner.js";
import { namedStep } from "./harness/step.js";

const SHOTS = "/tmp/world-after";

type MapControlsHandle = {
  minDistance: number;
  object: {
    position: {
      y: number;
      clone: () => { sub: (target: unknown) => { setLength: (n: number) => unknown } };
      copy: (target: unknown) => { add: (offset: unknown) => void };
      distanceTo: (target: unknown) => number;
    };
  };
  target: unknown;
  update: () => void;
};

test.describe("E 世界地图 · 画布铺满 · 相机 · 换课", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("画布贴齐视口、面板不是灰砖、收起记得住、滚轮缩放、镜头不钻岛", async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true });
    const consoleErrors = watchConsole(page);
    await openOnline(page);
    await waitForMapReady(page);

    await namedStep(page, "画布从视口左边缘铺到右边缘", async () => {
      const box = await page.locator(".stagewrap canvas").first().boundingBox();
      expect(box, "canvas has a box").toBeTruthy();
      const viewport = page.viewportSize();
      expect(viewport).toBeTruthy();
      expect(Math.round(box!.x)).toBe(0);
      expect(Math.round(box!.x + box!.width)).toBe(viewport!.width);
    });

    const rail = page.locator(".nav-rail");
    const aside = page.locator(".app-shell__aside");
    await namedStep(page, "展开时左右栏不是灰砖", async () => {
      await expect(rail).toBeVisible();
      await expect(aside).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/expanded.png` });
      await assertPanelIsPainted(page, rail, page.locator(".stagewrap").first(), "左栏导航");
      await assertPanelIsPainted(page, aside, page.locator(".stagewrap").first(), "右栏今天");
    });

    await namedStep(page, "收起左右栏，刷新后仍收起", async () => {
      await humanClick(page, page.locator(".app-shell__collapse--rail"), "收起导航");
      await humanClick(page, page.locator(".app-shell__collapse--aside"), "收起上下文");
      await expect(page.locator(".app-shell")).toHaveAttribute("data-rail-collapsed", "true");
      await expect(page.locator(".app-shell")).toHaveAttribute("data-aside-collapsed", "true");
      await page.screenshot({ path: `${SHOTS}/collapsed.png` });

      const stored = await page.evaluate(() => localStorage.getItem("app-shell.collapsed"));
      expect(stored).toContain('"rail":true');
      expect(stored).toContain('"aside":true');

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
      await expect(page.locator(".stagewrap canvas")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".app-shell")).toHaveAttribute("data-rail-collapsed", "true");
      await expect(page.locator(".app-shell")).toHaveAttribute("data-aside-collapsed", "true");
    });

    await namedStep(page, "鼠标滚轮缩放，双指平移不改距离，捏合缩放", async () => {
      const readDistance = () =>
        page.evaluate(() => {
          const controls = (globalThis as unknown as { mapControls?: MapControlsHandle })
            .mapControls;
          if (!controls) return null;
          return controls.object.position.distanceTo(controls.target);
        });

      const before = await readDistance();
      expect(before).toBeTruthy();

      // Default pose sits on WORLD_DISTANCE_MIN, so zoom *out* (positive
      // deltaY) is the direction that can move. Dispatch on the canvas so a
      // DOM label cannot swallow the event.
      await page.evaluate(() => {
        document.querySelector(".stagewrap canvas")?.dispatchEvent(
          new WheelEvent("wheel", {
            deltaX: 0,
            deltaY: 120,
            deltaMode: 0,
            ctrlKey: false,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      await expect
        .poll(async () => {
          const next = await readDistance();
          return next == null ? 0 : Math.abs(next - (before as number));
        })
        .toBeGreaterThan(0.2);
      const afterMouse = await readDistance();
      expect(afterMouse).not.toBeNull();

      const mid = afterMouse as number;
      await page.evaluate(() => {
        document.querySelector(".stagewrap canvas")?.dispatchEvent(
          new WheelEvent("wheel", {
            deltaX: 8,
            deltaY: 12,
            deltaMode: 0,
            ctrlKey: false,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      await page.waitForTimeout(200);
      const afterPan = await readDistance();
      expect(Math.abs((afterPan as number) - mid)).toBeLessThan(0.2);

      await page.evaluate(() => {
        document.querySelector(".stagewrap canvas")?.dispatchEvent(
          new WheelEvent("wheel", {
            deltaX: 0,
            deltaY: 20,
            deltaMode: 0,
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      await expect
        .poll(async () => {
          const next = await readDistance();
          return next == null ? 0 : Math.abs(next - (afterPan as number));
        })
        .toBeGreaterThan(0.05);
    });

    await namedStep(page, "镜头推到最近，相机到地面大于岛的半径", async () => {
      const sample = await page.evaluate(() => {
        const controls = (globalThis as unknown as { mapControls?: MapControlsHandle }).mapControls;
        if (!controls) return { ok: false as const, reason: "no mapControls" };
        const offset = controls.object.position.clone().sub(controls.target);
        offset.setLength(controls.minDistance);
        controls.object.position.copy(controls.target).add(offset);
        controls.update();
        return {
          ok: true as const,
          y: controls.object.position.y,
          minDistance: controls.minDistance,
        };
      });
      if (!sample.ok) throw new Error(`无法采样相机: ${sample.reason}`);
      writeFileSync(`${SHOTS}/camera-min.json`, JSON.stringify(sample, null, 2));
      expect(sample.minDistance).toBeGreaterThan(48);
      expect(sample.y).toBeGreaterThan(3.24);
    });

    await namedStep(page, "换课控件列出四套课", async () => {
      const trigger = page.locator(".study-switcher__trigger");
      await expect(trigger).toBeVisible();
      await humanClick(page, trigger, "换课 ▾");
      const menu = page.locator("[role='listbox'][aria-label='换课']");
      await expect(menu).toBeVisible();
      await expect(menu).toContainText("看全部四片海");
      await page.screenshot({ path: `${SHOTS}/switcher.png` });
    });

    consoleErrors.assertClean();
  });
});
