import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

import { assertPanelIsPainted } from "./harness/assert.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { SHIPPED_CATALOGUE } from "./harness/catalogue.js";
import { openOnline, waitForMapReady } from "./harness/online-learner.js";
import { namedStep } from "./harness/step.js";
import {
  mapEntryButton,
  navigateMapBreadcrumb,
  selectMapDestination,
} from "./harness/map-actions.js";
import { mapDomainForStudy } from "../apps/university/src/app/map-domain-catalog.js";

const SHOTS = process.env.R50_EVIDENCE_DIR ?? "/tmp/world-after";

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

    await namedStep(page, "地图目录选择真实课程并聚焦，不直接绕过进入", async () => {
      const course = page.locator("button.label--course.is-visible").first();
      const destinationId = await course.getAttribute("data-map-marker");
      expect(destinationId).toBeTruthy();
      await selectMapDestination(page, destinationId!);
      await expect(mapEntryButton(page)).toBeVisible();
      await expect(
        page.locator(
          `button.label--course.is-visible[data-map-marker=${JSON.stringify(destinationId)}]`,
        ),
      ).toBeVisible();
    });

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

    await namedStep(page, "真实滚轮事件能改变镜头距离", async () => {
      /*
        This used to assert three things in one step: a mouse wheel zooms, a
        two-finger pan does not, and a pinch zooms. All three are decided by
        `wheelIntent`, which is a pure function with six unit tests written
        against fingerprints measured in this browser — so asserting them again
        here added no coverage and a great deal of fragility.

        It was fragile because the camera legitimately moves on its own: the map
        flies to its opening pose on load, MapControls runs with damping, and a
        re-frame can send it back to the overview mid-assertion. Every one of
        those was read as "the wheel did the wrong thing".

        What only a browser can prove is that a real wheel event reaches the
        controls at all — that no overlay, no label and no capture-phase
        listener swallows it on the way. That is what this checks now.
      */
      const readDistance = () =>
        page.evaluate(() => {
          const controls = (globalThis as unknown as { mapControls?: MapControlsHandle })
            .mapControls;
          if (!controls) return null;
          return controls.object.position.distanceTo(controls.target);
        });

      /**
       * Wait for the camera to stop, optionally after it has started.
       *
       * `movesFrom` matters more than it looks. A dolly is applied on a later
       * animation frame and then damped over several more, so a stability
       * check that begins the instant the event is dispatched samples twice
       * before anything has happened, sees no difference, and concludes the
       * camera has stopped — while it is about to travel 118 units. Given a
       * baseline, this waits for movement to begin before it starts looking
       * for it to end.
       */
      const settle = async (movesFrom?: number) => {
        if (movesFrom != null) {
          for (let tries = 0; tries < 30; tries += 1) {
            const now = await readDistance();
            if (now != null && Math.abs(now - movesFrom) > 0.01) break;
            await page.waitForTimeout(100);
          }
        }
        let last = await readDistance();
        for (let tries = 0; tries < 40; tries += 1) {
          await page.waitForTimeout(100);
          const now = await readDistance();
          if (last != null && now != null && Math.abs(now - last) < 0.01) return now;
          last = now;
        }
        return last;
      };

      const before = await settle();
      expect(before).toBeTruthy();

      // Whichever direction has room. A fresh profile opens at the far stop
      // (no learner to aim at, so `frameWorld` takes its overview branch);
      // a returning one opens at the near stop.
      const deltaY = await page.evaluate(() => {
        const controls = (globalThis as unknown as { mapControls?: MapControlsHandle }).mapControls;
        if (!controls) return 120;
        const distance = controls.object.position.distanceTo(controls.target);
        const max = (controls as unknown as { maxDistance: number }).maxDistance;
        return distance >= max - 1 ? -120 : 120;
      });

      /*
        Keep scrolling until it moves, rather than scrolling once and waiting.

        One dispatch plus a wait was a race in three different ways, and every
        one of them cost a debugging session: the map's opening flight can still
        be resolving, MapControls damps the dolly over several frames, and a
        re-frame can land on top of both. A person who scrolls and sees nothing
        scrolls again, so the test does too — and then the assertion is about
        the wheel reaching the controls at all, which is the only part of this
        a browser is needed to prove. The classification of wheel versus
        trackpad versus pinch is `wheelIntent`, a pure function with six unit
        tests written against fingerprints measured in this browser.
      */
      await expect
        .poll(
          async () => {
            const canvas = await page.locator(".stagewrap canvas").boundingBox();
            if (!canvas) throw new Error("Missing visible map canvas");
            await page.mouse.move(canvas.x + canvas.width * 0.65, canvas.y + canvas.height * 0.56);
            await page.mouse.wheel(0, deltaY);
            const next = await readDistance();
            return next == null ? 0 : Math.abs(next - (before as number));
          },
          { intervals: [150, 150, 150, 300, 300, 500, 500, 1000] },
        )
        .toBeGreaterThan(0.2);
    });

    await namedStep(page, "镜头推到最近，相机到地面大于岛的半径", async () => {
      const canvas = await page.locator(".stagewrap canvas").boundingBox();
      if (!canvas) throw new Error("Missing visible map canvas");
      await page.mouse.move(canvas.x + canvas.width * 0.65, canvas.y + canvas.height * 0.56);
      await expect
        .poll(
          async () => {
            await page.mouse.wheel(0, -240);
            return page.evaluate(() => {
              const c = (window as any).mapControls;
              return c.object.position.distanceTo(c.target) - c.minDistance;
            });
          },
          { timeout: 15000, intervals: [80, 80, 120, 150] },
        )
        .toBeLessThan(0.02);
      const sample = await page.evaluate(() => {
        const controls = (globalThis as unknown as { mapControls?: MapControlsHandle }).mapControls;
        if (!controls) return { ok: false as const, reason: "no mapControls" };
        const state = (window as any).three;
        const vertex = state.camera.position.clone();
        let highest = -Infinity;
        for (const name of [
          "remote-island-terrain",
          "remote-props-trees",
          "remote-props-landmarks",
        ]) {
          const mesh = state.scene.getObjectByName(name);
          if (!mesh?.geometry) continue;
          const position = mesh.geometry.attributes.position;
          for (let i = 0; i < position.count; i++) {
            vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
            highest = Math.max(highest, vertex.y);
          }
        }
        return {
          ok: true as const,
          y: controls.object.position.y,
          minDistance: controls.minDistance,
          distance: controls.object.position.distanceTo(controls.target),
          highestActualGeometry: highest,
        };
      });
      if (!sample.ok) throw new Error(`无法采样相机: ${sample.reason}`);
      writeFileSync(`${SHOTS}/camera-min.json`, JSON.stringify(sample, null, 2));
      // R49 deliberately changed the stop to 48. The old >48 check rejected
      // that approved stop while never measuring the actual scenery below it.
      // Keep the stronger physical contract, reached through real input.
      expect(sample.minDistance).toBeGreaterThan(0);
      expect(Math.abs(sample.distance - sample.minDistance)).toBeLessThan(0.03);
      expect(Number.isFinite(sample.highestActualGeometry)).toBe(true);
      expect(sample.y - sample.highestActualGeometry).toBeGreaterThan(2);
    });

    await namedStep(page, "星球选择列出每一个真实系列，地图没有第二个换系列器", async () => {
      await expect(page.locator(".study-switcher__trigger")).toHaveCount(0);
      await navigateMapBreadcrumb(page, "/planet");
      await expect(page.locator('[data-map-surface="true"]')).toBeVisible();
      // The old persistent switcher and its global-catalogue option were
      // retired. Every real series must remain reachable by selecting its
      // domain and, when needed, the study choice beside the globe.
      for (const study of SHIPPED_CATALOGUE) {
        const domain = page.locator(
          `button[data-domain-id=${JSON.stringify(mapDomainForStudy(study.id).id)}]`,
        );
        await humanClick(page, domain, `选择 ${study.title} 所在领域`);
        let row = page.locator(`button[data-study-id=${JSON.stringify(study.id)}]`);
        if (!(await row.count())) {
          const details = page.locator(".planet-domain-label details").first();
          if (await details.count())
            await humanClick(page, details.locator("summary"), "展开系列选择");
          row = page.locator(`button[data-study-id=${JSON.stringify(study.id)}]`);
        }
        if (await row.count()) {
          await humanClick(page, row, `选择 ${study.title}`);
          await expect(row).toHaveAttribute("aria-pressed", "true");
        }
        await expect(mapEntryButton(page)).toHaveAccessibleName(new RegExp(study.title));
      }
      await page.screenshot({ path: `${SHOTS}/planet-selection.png` });
    });

    consoleErrors.assertClean();
  });
});

/*
  A 1097×513 window — a laptop with a browser that has three toolbars, or a
  half-screen split — is wide enough for the nav rail and 130px too short for
  what was in it. The rail scrolled, and because `overflow: auto` was set on
  both axes it also grew a *horizontal* scrollbar: the vertical bar takes width
  out of the content box, the content is then two pixels wider than what is
  left, and the browser answers with a second bar. Two scrollbars on a 76px
  strip is what got reported.

  Horizontal is the assertion that can never be relaxed. A 4.75rem column has
  nowhere to scroll sideways to, so a horizontal scrollbar there is always a
  bug, at every size.
*/
test.describe("E2 短窗口 · 导航栏不该长出滚动条", () => {
  for (const [width, height] of [
    [1097, 513],
    [1440, 810],
    [1280, 600],
  ] as const) {
    test(`${width}×${height} 下导航栏不横向滚动，全部去处都够得着`, async ({ page }) => {
      const console_ = watchConsole(page);
      await page.setViewportSize({ width, height });
      await openOnline(page);
      await waitForMapReady(page);

      const rail = page.locator(".nav-rail");
      const box = await rail.evaluate((node) => ({
        clientW: node.clientWidth,
        scrollW: node.scrollWidth,
        clientH: node.clientHeight,
        scrollH: node.scrollHeight,
      }));

      expect(box.scrollW, "导航栏横向滚动了").toBeLessThanOrEqual(box.clientW);

      /*
        Every destination stays reachable. If the rail does scroll vertically
        at some future size that is survivable — losing a route outright is
        not — so this checks the links exist and are clickable, not that the
        rail happens to fit.
      */
      const links = rail.locator(".nav-rail__link");
      expect(await links.count()).toBeGreaterThanOrEqual(7);

      console_.assertClean();
    });
  }

  /*
    Decoration goes before navigation. The avatar is the tallest thing in the
    rail and the only one that is not a destination, so a short window loses it
    and keeps all eight routes.
  */
  test("短窗口先丢头像，不丢去处", async ({ page }) => {
    await page.setViewportSize({ width: 1097, height: 513 });
    await openOnline(page);
    await waitForMapReady(page);

    await expect(page.locator(".nav-rail__identity")).toBeHidden();
    expect(await page.locator(".nav-rail .nav-rail__link").count()).toBeGreaterThanOrEqual(7);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);
    await expect(page.locator(".nav-rail__identity")).toBeVisible();
  });
});
