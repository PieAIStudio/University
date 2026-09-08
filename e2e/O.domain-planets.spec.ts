import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";

const ORIGIN = `http://127.0.0.1:${process.env.E2E_ONLINE_PORT ?? "18093"}`;
const cases = [
  { domains: 1, series: 1, width: 1440, height: 900, empty: false, long: false, reduced: false },
  { domains: 1, series: 20, width: 375, height: 812, empty: false, long: false, reduced: false },
  { domains: 1, series: 30, width: 1440, height: 900, empty: false, long: false, reduced: true },
  { domains: 4, series: 1, width: 375, height: 812, empty: false, long: false, reduced: false },
  { domains: 4, series: 20, width: 1440, height: 900, empty: false, long: false, reduced: false },
  { domains: 4, series: 30, width: 375, height: 812, empty: false, long: false, reduced: true },
  { domains: 4, series: 30, width: 1440, height: 900, empty: true, long: true, reduced: false },
  { domains: 4, series: 20, width: 375, height: 812, empty: true, long: true, reduced: true },
  { domains: 4, series: 30, width: 872, height: 286, empty: false, long: true, reduced: false },
] as const;

async function waitForPreparedDomains(page: Page, count: number) {
  await page.waitForFunction((domainCount) => {
    const bag = window as any;
    const projection = bag.__planetProjection?.();
    const state = bag.three;
    const canvas = document.querySelector(".planet-stage canvas");
    if (!projection || projection.domainCount !== domainCount || !state || state.gl.domElement !== canvas || !canvas?.getBoundingClientRect().width) return false;
    return projection.domains.every((domain: { id: string }) => state.scene.getObjectByName(`domain-planet-${domain.id}`)?.userData.planetAssetsReady === true)
      && bag.__stageFrameMetrics?.sceneUuid === state.scene.uuid && bag.__stageFrameMetrics.full.calls > 0;
  }, count, { timeout: 90_000 });
  await page.evaluate(async () => { for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame); });
  await expect(page.locator("[data-planet-resources]")).toHaveCount(0);
}

async function fieldIdentity(page: Page) {
  return page.evaluate(() => {
    const bag = window as any;
    return bag.__planetProjection().domains.map((domain: { id: string }) => {
      const root = bag.three.scene.getObjectByName(`domain-planet-${domain.id}`);
      const globe = bag.three.scene.getObjectByName(`domain-globe-${domain.id}`);
      const islands = bag.three.scene.getObjectByName(`domain-course-islands-${domain.id}`);
      return { id: domain.id, position: root.position.toArray(), scale: root.scale.toArray(), globe: globe.geometry.uuid, texture: globe.material.map?.uuid, islands: islands?.geometry.uuid ?? null };
    });
  });
}

test.describe("O 多领域星球 · 合成边界夹具（非课程目录）", () => {
  for (const scenario of cases) {
    test(`${scenario.domains}领域 ${scenario.series}系列 ${scenario.width}px${scenario.empty ? " 长名称与空领域" : ""}${scenario.reduced ? " 减少动态" : ""}`, async ({ page }) => {
      test.setTimeout(180_000);
      const console = watchConsole(page);
      const glbRequests: string[] = [];
      page.on("request", (request) => { if (/\.glb(?:\?|$)/i.test(request.url())) glbRequests.push(request.url()); });
      await page.setViewportSize({ width: scenario.width, height: scenario.height });
      await page.emulateMedia({ reducedMotion: scenario.reduced ? "reduce" : "no-preference" });
      await page.addInitScript(() => {
        const receipt = { tasks: [] as { start: number; duration: number }[] };
        (window as any).__domainInputReceipt = receipt;
        new PerformanceObserver((entries) => { for (const entry of entries.getEntries()) receipt.tasks.push({ start: entry.startTime, duration: entry.duration }); }).observe({ type: "longtask", buffered: true });
      });
      const url = `${ORIGIN}/e2e-fixtures/planet.html?domains=${scenario.domains}&series=${scenario.series}&long=${Number(scenario.long)}&empty=${Number(scenario.empty)}`;
      const folder = join(process.cwd(), ".devspace-visual", "domain-acceptance", `${scenario.domains}-${scenario.series}-${scenario.width}-${Number(scenario.empty)}`);
      mkdirSync(folder, { recursive: true });
      const receipt: Record<string, unknown> = { url, scenario, scope: "Synthetic catalogue in the actual PlanetPage/PlanetStage, not published lessons; ordinary real-catalogue route navigation is tested by G/N. Chrome viewport emulation is not a physical phone." };
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("合成验收夹具 · 非课程目录", { exact: true })).toBeVisible();
      const progress = page.locator("[data-fixture-progress]");
      let pressedAt = 0;
      await humanClick(page, progress, "use the DOM while domain resources prepare", { beforePress: async () => { pressedAt = await page.evaluate(() => performance.now()); } });
      await expect(page.locator("[data-fixture-revision]")).toHaveText("1");
      const inputMs = await page.evaluate((start) => performance.now() - start, pressedAt);
      receipt.coldInputMs = inputMs;
      expect(inputMs, "cold resource preparation must not monopolize the real pointer path").toBeLessThan(300);
      await waitForPreparedDomains(page, scenario.domains);
      receipt.detailsReadyAt = await page.evaluate(() => performance.now());
      const initial = await fieldIdentity(page);
      for (const domain of initial) expect(domain.scale).toEqual([1, 1, 1]);

      // Actual projected vertices, not a count of scene objects, must fit the visible canvas.
      const framing = await page.evaluate(() => {
        const bag = window as any;
        const scene = bag.three.scene;
        scene.updateMatrixWorld(true);
        let maxNdc = 0;
        for (const domain of bag.__planetProjection().domains) {
          const globe = scene.getObjectByName(`domain-globe-${domain.id}`);
          const positions = globe.geometry.getAttribute("position");
          const point = globe.position.clone();
          for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i).applyMatrix4(globe.matrixWorld).project(bag.three.camera);
            maxNdc = Math.max(maxNdc, Math.abs(point.x), Math.abs(point.y));
          }
        }
        return { maxNdc, scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
      });
      expect(framing.maxNdc).toBeLessThan(1);
      expect(framing.scrollWidth).toBeLessThanOrEqual(framing.viewportWidth);
      const labels = await page.locator("[data-planet-domain-label]").evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        const parent = element.parentElement!.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
          clip: { left: parent.left, right: parent.right, top: parent.top, bottom: parent.bottom } };
      }));
      for (const label of labels) {
        expect(label.left).toBeGreaterThanOrEqual(label.clip.left);
        expect(label.right).toBeLessThanOrEqual(label.clip.right);
        expect(label.top, "a complete label, not just its anchor, must be inside the clipped viewport").toBeGreaterThanOrEqual(label.clip.top);
        expect(label.bottom).toBeLessThanOrEqual(label.clip.bottom);
      }
      for (let i = 0; i < labels.length; i++) for (let j = 0; j < i; j++) {
        const a = labels[i]!;
        const b = labels[j]!;
        expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, "projected domain labels must not collide").toBe(true);
      }

      if (scenario.domains === 4 && scenario.series === 20 && !scenario.empty) {
        const target = await page.evaluate(() => {
          const bag = window as any;
          const projection = bag.__planetProjection();
          const domain = projection.domains[0];
          const hitMesh = bag.three.scene.getObjectByName(`domain-region-targets-${domain.id}`);
          const camera = bag.three.camera;
          const cameraPosition = camera.position.clone();
          camera.getWorldPosition(cameraPosition);
          hitMesh.updateWorldMatrix(true, false);
          const rect = bag.three.gl.domElement.getBoundingClientRect();
          for (const region of domain.regions) {
            if (region.studyId === projection.selectedId) continue;
            const local = camera.position.clone().fromArray(region.position);
            const normal = local.clone().normalize().transformDirection(hitMesh.matrixWorld);
            const world = local.applyMatrix4(hitMesh.matrixWorld);
            if (normal.dot(cameraPosition.clone().sub(world).normalize()) < 0.55) continue;
            const point = world.project(camera);
            const x = rect.left + (point.x * .5 + .5) * rect.width;
            const y = rect.top + (-point.y * .5 + .5) * rect.height;
            if (document.elementFromPoint(x, y) !== bag.three.gl.domElement) continue;
            return { id: region.studyId, x, y };
          }
          return null;
        });
        expect(target, "a real front-side region must be pickable on a peer globe").not.toBeNull();
        await page.mouse.move(target!.x, target!.y);
        const pressed = await page.evaluate(() => performance.now());
        await page.mouse.down();
        await page.waitForTimeout(40);
        await page.mouse.up();
        await page.waitForFunction((id) => (window as any).__planetProjection().selectedId === id, target!.id);
        receipt.realGlobeClickMs = await page.evaluate((start) => performance.now() - start, pressed);
        expect(receipt.realGlobeClickMs).toBeLessThan(300);
        await expect(page.locator(`[data-study-id="${target!.id}"]`)).toHaveAttribute("aria-pressed", "true");
      }

      const selectedDomain = `fixture-domain-${scenario.domains - 1}`;
      await humanClick(page, page.locator(`button[data-domain-id="${selectedDomain}"]`), "select a peer domain");
      await expect(page.locator(`button[data-domain-id="${selectedDomain}"]`)).toHaveAttribute("aria-pressed", "true");
      const rows = page.locator("[data-study-id]");
      await expect(rows).toHaveCount(scenario.empty ? 0 : scenario.series);
      if (scenario.empty) {
        await expect(page.locator(".planet-page__detail").getByRole("status")).toHaveText("这个领域还没有课程系列。");
        await expect(page.locator(".planet-page__enter")).toHaveCount(0);
        const emptyMeshes = await page.evaluate((id) => {
          const scene = (window as any).three.scene;
          return [scene.getObjectByName(`domain-course-islands-${id}`), scene.getObjectByName(`domain-region-targets-${id}`)].map(Boolean);
        }, selectedDomain);
        expect(emptyMeshes).toEqual([false, false]);
      } else {
        const ids = await rows.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-study-id")));
        expect(ids.every((id) => id?.startsWith(`fixture-series-${scenario.domains - 1}-`))).toBe(true);
        await humanClick(page, rows.first(), "select the real ID supplied by the fixture");
        const selectedId = await rows.first().getAttribute("data-study-id");
        await humanClick(page, page.locator(".planet-page__enter"), "emit the series navigation intent");
        await expect(page.locator("[data-fixture-entered]")).toHaveText(selectedId!);
        const enter = page.locator(".planet-page__enter");
        await expect(enter).toHaveAccessibleName(/^进入 /);
        const labelFit = await enter.locator(".planet-page__enter-label").evaluate((label) => {
          const button = label.closest("button")!;
          const bounds = button.getBoundingClientRect();
          return {
            height: bounds.height,
            width: bounds.width,
            lineDoesNotOverflowVertically: label.scrollHeight <= label.clientHeight + 1,
            buttonContainsLabel: label.getBoundingClientRect().width <= bounds.width,
            fullName: label.textContent,
            whiteSpace: getComputedStyle(label).whiteSpace,
          };
        });
        expect(labelFit.height).toBeGreaterThanOrEqual(44);
        expect(labelFit.width).toBeGreaterThanOrEqual(44);
        expect(labelFit.lineDoesNotOverflowVertically).toBe(true);
        expect(labelFit.buttonContainsLabel).toBe(true);
        expect(labelFit.fullName).toContain("进入");
        expect(labelFit.whiteSpace).toBe("nowrap");
      }
      await humanClick(page, progress, "update progress without rebuilding domain geometry");
      await expect(page.locator("[data-fixture-revision]")).toHaveText("2");
      expect(await fieldIdentity(page)).toEqual(initial);
      receipt.projection = await page.evaluate(() => (window as any).__planetProjection());

      // Reduced motion is proven from real live cloud transforms, not a CSS media flag.
      if (scenario.reduced) {
        const motion = await page.evaluate(async () => {
          const bag = window as any;
          const clouds = bag.__planetProjection().domains.map((domain: { id: string }) => bag.three.scene.getObjectByName(`domain-clouds-${domain.id}`));
          const before = clouds.map((cloud: any) => cloud.quaternion.toArray());
          for (let i = 0; i < 8; i++) await new Promise(requestAnimationFrame);
          return { before, after: clouds.map((cloud: any) => cloud.quaternion.toArray()) };
        });
        expect(motion.after).toEqual(motion.before);
      }
      const beforeReturn = await page.evaluate(() => ({ frame: (window as any).__stageFrameMetrics, longTasks: (window as any).__domainInputReceipt.tasks }));
      receipt.beforeReturn = beforeReturn;
      if (scenario.domains === 4 && scenario.series === 30 && !scenario.empty) {
        expect(beforeReturn.frame.full.triangles).toBeLessThan(300_000);
        expect((receipt.projection as { representativeLimit: number }).representativeLimit).toBe(3);
      }
      await page.screenshot({ path: join(folder, "field.png"), fullPage: true });
      await humanClick(page, page.locator("[data-fixture-mount]"), "unmount the planet viewport");
      await expect(page.locator(".planet-stage canvas")).toHaveCount(0);
      await page.waitForFunction(() => !(window as any).__planetProjection);
      await humanClick(page, page.locator("[data-fixture-mount]"), "return to the same selected domain");
      await waitForPreparedDomains(page, scenario.domains);
      await expect(page.locator(`button[data-domain-id="${selectedDomain}"]`)).toHaveAttribute("aria-pressed", "true");
      const returned = await fieldIdentity(page);
      expect(returned.map((domain: any) => domain.position)).toEqual(initial.map((domain: any) => domain.position));
      for (let i = 0; i < initial.length; i++) expect(returned[i]!.globe).not.toBe(initial[i]!.globe);
      receipt.returned = await page.evaluate(() => ({ frame: (window as any).__stageFrameMetrics, preparation: (window as any).__planetProjection().preparation }));
      expect(glbRequests).toEqual([]);
      receipt.glbRequests = glbRequests;
      receipt.consoleErrors = console.errors();
      writeFileSync(join(folder, "receipt.json"), JSON.stringify(receipt, null, 2));
      console.assertClean();
    });
  }

  test("worker failure keeps the real DOM usable and retry reaches actual scene readiness", async ({ page }) => {
    const workerRequests: string[] = [];
    const workerRoute = "**/domain-preparation.worker.ts*";
    await page.route(workerRoute, async (route) => { workerRequests.push(route.request().url()); await route.abort("failed"); });
    await page.goto(`${ORIGIN}/e2e-fixtures/planet.html?domains=1&series=1`);
    await expect(page.locator('[data-planet-resources="error"]')).toBeVisible();
    expect(workerRequests.length).toBeGreaterThan(0);
    await humanClick(page, page.locator(".planet-page__enter"), "navigate using the list even when detail generation fails");
    await expect(page.locator("[data-fixture-entered]")).toHaveText("fixture-series-0-0");
    await page.unroute(workerRoute);
    await humanClick(page, page.getByRole("button", { name: "重试地图准备", exact: true }), "retry the failed worker");
    await waitForPreparedDomains(page, 1);
    expect(await page.evaluate(() => (window as any).three.scene.getObjectByName("domain-globe-fixture-domain-0").material.map?.image.data.length)).toBe(1024 * 512 * 4);
  });
});
