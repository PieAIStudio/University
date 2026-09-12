import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ONLINE_ORIGIN } from "./ports.js";
import {
  CATALOGUE_ROLES,
  REFERENCE_ARCHIPELAGO_COURSE_IDS,
  coursePathOf,
  installReferenceArchipelagoFixture,
} from "./harness/catalogue.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";

const COURSE = CATALOGUE_ROLES.settlement.course;
const COURSE_PATH = coursePathOf(COURSE);
const OUTPUT = process.env.R44_EVIDENCE_DIR ?? "SCRATCH/e2e/archipelago-reference";

async function ready(page: Page, group: string) {
  await page.waitForFunction(
    (name) => {
      const bag = window as any;
      const canvas = document.querySelector(".stagewrap:not([hidden]) canvas");
      return (
        canvas === bag.three?.gl.domElement &&
        bag.three?.scene.getObjectByName(name) &&
        bag.__stageFrameMetrics?.sceneUuid === bag.three.scene.uuid &&
        !document.querySelector(".loading-trivia")
      );
    },
    group,
    { timeout: 90_000 },
  );
}

/** Wrap only the actual Stage render subscriber, then restore it in finally. */
async function gpuReceipt(page: Page) {
  return page.evaluate(async () => {
    const state = (window as any).three;
    const gl = state.gl.getContext() as WebGL2RenderingContext;
    const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as any;
    const owner = state.internal.subscribers.find((s: any) => s.priority === 1);
    const scope =
      "Warm unique Stage render callback, including shadow and post submissions; excludes DOM compositing and other canvases. GPU milliseconds, not FPS or VRAM.";
    if (!ext || !owner) return { available: false, scope };
    const original = owner.ref.current;
    const pending: WebGLQuery[] = [],
      samples: number[] = [];
    let issued = 0;
    const started = performance.now();
    owner.ref.current = (...args: any[]) => {
      const query = issued < 40 && !gl.getParameter(ext.GPU_DISJOINT_EXT) ? gl.createQuery() : null;
      if (query) {
        issued++;
        gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
      }
      try {
        return original(...args);
      } finally {
        if (query) {
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          pending.push(query);
        }
      }
    };
    try {
      while (samples.length < 24 && performance.now() - started < 15_000) {
        await new Promise(requestAnimationFrame);
        if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
          pending.splice(0).forEach((q) => gl.deleteQuery(q));
          continue;
        }
        for (let i = pending.length - 1; i >= 0; i--) {
          const query = pending[i]!;
          if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) continue;
          const ms = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
          if (Number.isFinite(ms) && ms >= 0) samples.push(ms);
          gl.deleteQuery(query);
          pending.splice(i, 1);
        }
      }
    } finally {
      owner.ref.current = original;
      pending.forEach((q) => gl.deleteQuery(q));
    }
    samples.sort((a, b) => a - b);
    return {
      available: samples.length >= 24,
      samples,
      issued,
      medianMs: samples.length ? samples[Math.floor(samples.length / 2)] : null,
      p95Ms: samples.length
        ? samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))]
        : null,
      scope,
    };
  });
}

for (const viewport of [
  { width: 1600, height: 900 },
  { width: 375, height: 812 },
]) {
  test.describe(`T reference archipelago ${viewport.width}`, () => {
    test.use({ viewport, deviceScaleFactor: 1, colorScheme: "dark" });
    test("renders distinct grounded miniatures and preserves the real course round trip", async ({
      page,
    }) => {
      const console = watchConsole(page);
      const folder = join(OUTPUT, String(viewport.width));
      mkdirSync(folder, { recursive: true });
      await installReferenceArchipelagoFixture(page);
      await page.goto(`${ONLINE_ORIGIN}${COURSE_PATH}`, { waitUntil: "domcontentloaded" });
      await ready(page, "island-dressing-course");
      const courseLight = await page.evaluate(() => {
        const light = (window as any).three.scene.getObjectByName("map-key-light");
        return { profile: light.userData.sunProfile, intensity: light.intensity };
      });
      // R46 adopts the garden profile for the ordinary course camera. This
      // check still guards projection separation, not the retired backlight.
      expect(courseLight).toEqual({ profile: "garden", intensity: 3.8 });
      await humanClick(
        page,
        page.getByRole("button", { name: /回到\s*.+地图/ }),
        "return to the real series",
      );
      await ready(page, "remote-props");
      if (viewport.width >= 768) {
        const collapseRail = page.locator('#app-shell-rail button[aria-expanded="true"]');
        if (await collapseRail.count())
          await humanClick(page, collapseRail, "show the full archipelago");
        const collapseAside = page.getByRole("button", { name: "收起", exact: true });
        if (await collapseAside.count())
          await humanClick(page, collapseAside.last(), "collapse the contextual rail");
      }
      await page.waitForFunction(async () => {
        const state = (window as any).three;
        const position = state.camera.position.clone();
        for (let i = 0; i < 8; i++) await new Promise(requestAnimationFrame);
        return state.camera.position.distanceTo(position) < 0.001;
      });
      const receipt = await page.evaluate(() => {
        const bag = window as any,
          state = bag.three;
        const props = state.scene.getObjectByName("remote-props");
        const field = state.scene.getObjectByName("remote-island-field");
        const meshes: { name: string; triangles: number }[] = [];
        props.traverse((object: any) => {
          if (object.isMesh)
            meshes.push({ name: object.name, triangles: object.geometry.index.count / 3 });
        });
        return {
          url: location.href,
          viewport: [innerWidth, innerHeight],
          dpr: devicePixelRatio,
          debug: location.search,
          visibility: document.visibilityState,
          islandIds: field.userData.remoteIslandIds,
          surfaceAtlas: field.userData.surfaceAtlas ?? null,
          daylight: (() => {
            const light = state.scene.getObjectByName("map-key-light");
            const sky = state.scene.getObjectByName("world-skydome");
            return {
              profile: light.userData.sunProfile,
              intensity: light.intensity,
              direction: light.position.clone().normalize().toArray(),
              skyDirection: sky.material.uniforms.uSunDirection.value.toArray(),
            };
          })(),
          surfaceTexture: (() => {
            const ground = state.scene.getObjectByName("remote-island-terrain");
            const texture = ground?.material?.map;
            let min = 255,
              max = 0;
            if (texture?.image?.data)
              for (let i = 0; i < texture.image.data.length; i += 4) {
                min = Math.min(min, texture.image.data[i]);
                max = Math.max(max, texture.image.data[i]);
              }
            return texture
              ? {
                  name: texture.name,
                  width: texture.image.width,
                  height: texture.image.height,
                  uvCount: ground.geometry.getAttribute("uv")?.count,
                  min,
                  max,
                  firstUV: [
                    ground.geometry.getAttribute("uv").getX(0),
                    ground.geometry.getAttribute("uv").getY(0),
                  ],
                  firstPixel: (() => {
                    const uv = ground.geometry.getAttribute("uv");
                    const i =
                      (Math.floor(uv.getY(0) * texture.image.height) * texture.image.width +
                        Math.floor(uv.getX(0) * texture.image.width)) *
                      4;
                    return Array.from(texture.image.data.slice(i, i + 4));
                  })(),
                  colourSpace: texture.colorSpace,
                }
              : null;
          })(),
          props: props.userData,
          labels: Array.from(
            document.querySelectorAll<HTMLElement>(".labels [data-map-marker].is-visible"),
          ).map((element) => {
            const r = element.getBoundingClientRect();
            return {
              id: element.dataset.mapMarker,
              state: element.dataset.courseState,
              left: r.left,
              top: r.top,
              right: r.right,
              bottom: r.bottom,
            };
          }),
          sceneryBoxes: ["remote-props-trees", "remote-props-landmarks"].flatMap((name) => {
            const mesh = state.scene.getObjectByName(name),
              rect = state.gl.domElement.getBoundingClientRect();
            return (mesh.geometry.userData.miniatureSceneryBounds ?? []).flatMap((box: any) => {
              const p = state.camera.position.clone();
              let left = Infinity,
                top = Infinity,
                right = -Infinity,
                bottom = -Infinity,
                inDepth = false;
              for (let corner = 0; corner < 8; corner++) {
                p.set(
                  corner & 1 ? box.max[0] : box.min[0],
                  corner & 2 ? box.max[1] : box.min[1],
                  corner & 4 ? box.max[2] : box.min[2],
                );
                p.applyMatrix4(mesh.matrixWorld).project(state.camera);
                inDepth ||= p.z >= -1 && p.z <= 1;
                const x = rect.left + ((p.x + 1) * rect.width) / 2,
                  y = rect.top + ((1 - p.y) * rect.height) / 2;
                left = Math.min(left, x);
                right = Math.max(right, x);
                top = Math.min(top, y);
                bottom = Math.max(bottom, y);
              }
              return inDepth &&
                right > rect.left &&
                left < rect.right &&
                bottom > rect.top &&
                top < rect.bottom
                ? [{ islandId: box.islandId, left, right, top, bottom }]
                : [];
            });
          }),
          meshes,
          frame: bag.__stageFrameMetrics,
          camera: state.camera.position.toArray(),
          bodyWidth: document.documentElement.scrollWidth,
          theme: document.documentElement.getAttribute("data-game-theme"),
        };
      });
      expect(receipt.visibility).toBe("visible");
      expect(receipt.daylight.profile).toBe("catalogue");
      expect(receipt.daylight.intensity).toBe(3.4);
      expect(receipt.surfaceAtlas.sunProfile).toBe("catalogue");
      for (let axis = 0; axis < 3; axis++) {
        expect(receipt.daylight.direction[axis]).toBeCloseTo(
          receipt.daylight.skyDirection[axis],
          6,
        );
        expect(receipt.daylight.direction[axis]).toBeCloseTo(
          receipt.surfaceAtlas.shadowDirection[axis],
          6,
        );
      }
      expect(receipt.islandIds.length).toBeGreaterThan(10);
      expect(new Set(receipt.props.miniatureStyles).size).toBeGreaterThanOrEqual(6);
      expect(receipt.props.remoteAccentCount).toBeGreaterThan(receipt.islandIds.length * 4);
      expect(receipt.meshes.length).toBeLessThanOrEqual(3);
      expect(receipt.meshes.some((mesh) => mesh.name === "remote-props-contact")).toBe(false);
      expect(receipt.props.remoteTriangleCount).toBe(
        receipt.meshes.reduce((sum, m) => sum + m.triangles, 0),
      );
      expect(receipt.props.remoteTriangleCount).toBeLessThanOrEqual(
        receipt.islandIds.length * 6000,
      );
      expect(receipt.bodyWidth).toBeLessThanOrEqual(viewport.width);
      expect(receipt.labels.some((label) => label.state === "live")).toBe(true);
      /*
       * Calibrated against the fixture, not against the catalogue. The
       * reference map is a fixed thirteen islands — one real course plus
       * REFERENCE_ARCHIPELAGO_COURSE_IDS — so these floors stay put when a
       * package is locked or unlocked. They moved before because the fixture
       * appended to whatever shipped: the desktop floor of six was calibrated
       * on a thirty-seven-course catalogue and went red at four courses while
       * label placement itself was fine. Change the fixture's course list and
       * these two numbers have to be re-measured with it.
       */
      expect(receipt.islandIds.length).toBe(1 + REFERENCE_ARCHIPELAGO_COURSE_IDS.length);
      expect(receipt.labels.length).toBeGreaterThanOrEqual(viewport.width >= 768 ? 4 : 2);
      for (const label of receipt.labels)
        for (const box of receipt.sceneryBoxes) {
          const overlapX = Math.min(label.right, box.right) - Math.max(label.left, box.left);
          const overlapY = Math.min(label.bottom, box.bottom) - Math.max(label.top, box.top);
          expect(
            overlapX > 0.5 && overlapY > 0.5,
            `${label.id} covers ${box.islandId} scenery`,
          ).toBe(false);
        }
      await page.screenshot({ path: join(folder, "world.png") });
      if (process.env.R44_COMPARE_ATLAS === "1") {
        await page.evaluate(() => {
          const bag = window as any;
          const material = bag.three.scene.getObjectByName("remote-island-terrain").material;
          bag.__atlasComparisonMap = material.map;
          material.map = null;
          material.needsUpdate = true;
        });
        try {
          await page.waitForTimeout(700);
          await page.screenshot({ path: join(folder, "atlas-off-diagnostic.png") });
        } finally {
          await page.evaluate(() => {
            const bag = window as any;
            const material = bag.three.scene.getObjectByName("remote-island-terrain").material;
            material.map = bag.__atlasComparisonMap;
            material.needsUpdate = true;
            delete bag.__atlasComparisonMap;
          });
        }
        await page.waitForTimeout(700);
      }
      const gpu = await gpuReceipt(page);
      if (process.env.R49_DETAIL_CAPTURE === "1" && viewport.width >= 768) {
        // A normal user zoom, not a screenshot-only camera. Keep the default
        // frame above for comparisons and budget accounting.
        await page.mouse.move(viewport.width * 0.58, viewport.height * 0.51);
        for (let i = 0; i < 3; i++) {
          await page.mouse.wheel(0, -160);
          await page.waitForTimeout(100);
        }
        await page.mouse.move(2, 2);
        await page.waitForTimeout(1100);
        await page.screenshot({ path: join(folder, "world-detail.png") });
      }
      const breadcrumb = page.getByRole("navigation", { name: "当前位置", exact: true });
      await expect(breadcrumb.getByRole("link", { name: "学习星球" })).toBeVisible();
      // Click real canvas scenery, not the DOM label or a programmatic .click().
      const target = await page.evaluate((courseKey) => {
        const state = (window as any).three;
        const mesh = state.scene.getObjectByName("remote-props-trees");
        const range = mesh.geometry.userData.miniatureRanges.find(
          (r: any) => r.islandId === courseKey,
        );
        const p = state.camera.position.clone().set(0, 0, 0);
        const position = mesh.geometry.getAttribute("position"),
          index = mesh.geometry.index;
        for (let i = range.start * 3; i < range.start * 3 + 3; i++) {
          const vertex = state.camera.position.clone().fromBufferAttribute(position, index.getX(i));
          p.add(vertex);
        }
        p.multiplyScalar(1 / 3)
          .applyMatrix4(mesh.matrixWorld)
          .project(state.camera);
        const rect = state.gl.domElement.getBoundingClientRect();
        return {
          x: rect.left + ((p.x + 1) * rect.width) / 2,
          y: rect.top + ((1 - p.y) * rect.height) / 2,
        };
      }, `${COURSE.studyId}/${COURSE.id}`);
      await page.mouse.click(target.x, target.y);
      await expect(page.getByRole("button", { name: /进入这门课/ })).toBeVisible();
      await humanClick(
        page,
        page.getByRole("button", { name: /进入这门课/ }),
        "enter selected miniature course",
      );
      await expect(page).toHaveURL(new RegExp(`${COURSE_PATH.replaceAll("/", "\\/")}$`));
      await ready(page, "island-dressing-course");
      await expect(breadcrumb.locator('[aria-current="page"]')).toContainText(COURSE.title);
      await humanClick(
        page,
        breadcrumb.getByRole("link", {
          name: CATALOGUE_ROLES.settlement.study.title,
          exact: true,
        }),
        "return through the shared trail",
      );
      await ready(page, "remote-props");
      const returned = await page.evaluate(() => {
        const bag = window as any;
        return {
          ids: bag.three.scene.getObjectByName("remote-island-field").userData.remoteIslandIds,
          triangles: bag.three.scene.getObjectByName("remote-props").userData.remoteTriangleCount,
        };
      });
      expect(returned.ids).toEqual(receipt.islandIds);
      expect(returned.triangles).toBe(receipt.props.remoteTriangleCount);
      writeFileSync(
        join(folder, "receipt.json"),
        JSON.stringify({ receipt, gpu, returned, consoleErrors: console.errors() }, null, 2),
      );
      console.assertClean();
    });
  });
}
