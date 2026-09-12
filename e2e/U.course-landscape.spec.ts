import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { ONLINE_ORIGIN } from "./ports.js";
import {
  CATALOGUE_ROLES,
  COURSE_SCENE_FIXTURE,
  coursePathOf,
  installCourseSceneFixture,
} from "./harness/catalogue.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { assertCompleteCourseOverview, waitForCourseFraming } from "./harness/course-overview.js";
import { captureSurfaceMaterialStudy } from "./harness/surface-material-study.js";
import { captureCourseShadowStudy } from "./harness/course-shadow-study.js";
import { captureSourceSwatchStudy } from "./harness/source-swatch-study.js";

const COURSE = coursePathOf(COURSE_SCENE_FIXTURE.course);
const STUDY_TITLE = CATALOGUE_ROLES.settlement.study.title;
const OUTPUT = process.env.R46_EVIDENCE_DIR ?? "SCRATCH/e2e/course-landscape";

async function ready(page: Page) {
  await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
  await page.waitForFunction(
    () => {
      const bag = window as any;
      return (
        bag.three?.gl.domElement === document.querySelector(".stagewrap:not([hidden]) canvas") &&
        bag.three?.scene.getObjectByName("island-dressing-course")?.userData.islandDressingReady &&
        bag.__stageFrameMetrics?.sceneUuid === bag.three.scene.uuid
      );
    },
    undefined,
    { timeout: 90_000 },
  );
  await waitForCourseFraming(page);
}

for (const viewport of [
  { width: 1600, height: 900 },
  { width: 375, height: 812 },
]) {
  test.describe(`U course landscape ${viewport.width}`, () => {
    test.use({ viewport, deviceScaleFactor: 1, colorScheme: "dark" });
    test("scenery stays grounded, bounded and subordinate to the actual learning route", async ({
      page,
    }) => {
      const errors = watchConsole(page);
      const folder = join(OUTPUT, String(viewport.width));
      mkdirSync(folder, { recursive: true });
      await installCourseSceneFixture(page);
      await page.goto(`${ONLINE_ORIGIN}${COURSE}`, { waitUntil: "domcontentloaded" });
      await ready(page);
      if (viewport.width >= 768) {
        const rail = page.locator('#app-shell-rail button[aria-expanded="true"]');
        if (await rail.count()) await humanClick(page, rail, "collapse navigation rail");
        const aside = page.getByRole("button", { name: "收起", exact: true });
        if (await aside.count()) await humanClick(page, aside.last(), "collapse context rail");
      }
      await page.evaluate(() => document.fonts.ready);
      await waitForCourseFraming(page);
      await page.screenshot({ path: join(folder, "course-near.png") });
      const ids = await page
        .locator("[data-lesson-state][data-map-marker]")
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-map-marker")));
      await humanClick(
        page,
        page.getByRole("button", { name: "总览课程岛", exact: true }),
        "overview the real course",
      );
      const overview = await assertCompleteCourseOverview(page);
      const receipt = await page.evaluate(() => {
        const bag = window as any;
        const landscape = bag.three.scene.getObjectByName("course-landscape");
        return {
          url: location.href,
          viewport: [innerWidth, innerHeight],
          dpr: devicePixelRatio,
          camera: bag.three.camera.position.toArray(),
          frame: bag.__stageFrameMetrics,
          landscape: landscape?.userData.landscapeReport ?? null,
          firCount: bag.three.scene.getObjectByName("course-fir-trees")?.count ?? 0,
          bodyWidth: document.documentElement.scrollWidth,
        };
      });
      await page.screenshot({ path: join(folder, "course-overview.png") });
      writeFileSync(
        join(folder, "observed.json"),
        JSON.stringify({ receipt, overview, ids }, null, 2),
      );
      if (process.env.R46_BASELINE !== "1") {
        expect(receipt.landscape).not.toBeNull();
        expect(receipt.landscape.outcropCount).toBeGreaterThan(0);
        expect(receipt.landscape.outcropCount).toBeLessThanOrEqual(4);
        expect(receipt.landscape.floraCount).toBeGreaterThan(20);
        expect(receipt.landscape.floraCount).toBeLessThanOrEqual(220);
        expect(receipt.landscape.triangles).toBeLessThanOrEqual(50_000);
        expect(receipt.firCount).toBeGreaterThan(0);
        expect(receipt.landscape.ruinCount).toBe(1);
        expect(receipt.landscape.springCount).toBeGreaterThanOrEqual(0);
        expect(receipt.landscape.springCount).toBeLessThanOrEqual(1);
        console.log(
          "[current landscape]",
          JSON.stringify({
            viewport,
            trees: receipt.firCount,
            outcrops: receipt.landscape.outcropCount,
            ruins: receipt.landscape.ruinCount,
            flora: receipt.landscape.floraCount,
            springs: receipt.landscape.springCount,
            landscapeTriangles: receipt.landscape.triangles,
            fullFrame: receipt.frame.full,
          }),
        );
      }
      expect(receipt.bodyWidth).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({ path: join(folder, "course-overview.png") });
      if (viewport.width >= 768) {
        // A second readable garden view via ordinary wheel and drag. The
        // complete-root overview above remains the framing acceptance image.
        const point = await page.evaluate(() => {
          const canvas = document.querySelector(".stagewrap:not([hidden]) canvas")!;
          const b = canvas.getBoundingClientRect();
          for (const fx of [0.72, 0.64, 0.56])
            for (const fy of [0.55, 0.48, 0.42]) {
              const x = b.left + b.width * fx,
                y = b.top + b.height * fy;
              if (document.elementFromPoint(x, y) === canvas) return { x, y };
            }
          return null;
        });
        expect(point).not.toBeNull();
        await page.mouse.move(point!.x, point!.y);
        for (let i = 0; i < 12; i++) {
          await page.mouse.wheel(0, -120);
          await page.waitForTimeout(50);
          if (i === 7) {
            // A less enlarged view retains the whole inhabited garden. Keep
            // the original full-root overview and the closer view as well.
            await page.waitForTimeout(600);
            await page.screenshot({ path: join(folder, "course-field.png") });
          }
        }
        await page.waitForTimeout(600);
        const surfaceCentre = () =>
          page.evaluate(() => {
            const s = (window as any).three,
              mesh = s.scene.getObjectByName("island-terrain");
            const positions = mesh.geometry.getAttribute("position"),
              p = s.camera.position.clone();
            let top = Infinity,
              bottom = -Infinity;
            for (let i = 0; i < positions.count; i += 3) {
              if (positions.getY(i) < 0) continue;
              p.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).project(s.camera);
              const y = ((1 - p.y) * innerHeight) / 2;
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
            return (top + bottom) / 2;
          });
        const drag = async (dy: number) => {
          await page.mouse.move(point!.x, point!.y);
          await page.mouse.down();
          await page.mouse.move(point!.x, point!.y + dy, { steps: 12 });
          await page.mouse.up();
          await page.waitForTimeout(500);
        };
        // Calibrate the existing ground-plane pan from a small real drag.
        // No camera assignment, fixed-shot override or hidden renderer path.
        const priorCentre = await surfaceCentre();
        await drag(36);
        const movedCentre = await surfaceCentre(),
          response = movedCentre - priorCentre;
        if (Math.abs(response) > 2) {
          const correction = Math.max(
            -260,
            Math.min(260, ((viewport.height * 0.48 - movedCentre) * 36) / response),
          );
          await drag(correction);
        }
        await page.screenshot({ path: join(folder, "course-garden.png") });
        await captureSurfaceMaterialStudy(page, folder, "course-garden");
        await captureSourceSwatchStudy(page, folder);
        await captureCourseShadowStudy(page, folder);
        if (process.env.R46_LIGHT_STUDY === "1") {
          const saved = await page.evaluate(() => {
            const light = (window as any).three.scene.getObjectByName("map-key-light");
            return { position: light.position.toArray(), intensity: light.intensity };
          });
          try {
            await page.evaluate(async () => {
              const s = (window as any).three,
                light = s.scene.getObjectByName("map-key-light");
              const length = light.position.length(),
                elevation = (40 * Math.PI) / 180,
                azimuth = (315 * Math.PI) / 180;
              light.position.set(
                Math.sin(azimuth) * Math.cos(elevation) * length,
                Math.sin(elevation) * length,
                Math.cos(azimuth) * Math.cos(elevation) * length,
              );
              light.intensity = 3.8;
              for (let i = 0; i < 12; i++) await new Promise(requestAnimationFrame);
            });
            await page.screenshot({ path: join(folder, "course-light-diagnostic.png") });
          } finally {
            await page.evaluate((saved) => {
              const light = (window as any).three.scene.getObjectByName("map-key-light");
              light.position.fromArray(saved.position);
              light.intensity = saved.intensity;
            }, saved);
          }
        }
        writeFileSync(
          join(folder, "garden-camera.json"),
          JSON.stringify(
            await page.evaluate(() => ({
              camera: (window as any).three.camera.position.toArray(),
              scope:
                "Real wheel zoom and pointer drag after the complete overview; not a replacement for the matched overview pair.",
            })),
            null,
            2,
          ),
        );
      }
      const trail = page.getByRole("navigation", { name: "当前位置", exact: true });
      await humanClick(
        page,
        trail.getByRole("link", { name: STUDY_TITLE, exact: true }),
        "return to series",
      );
      await expect(page).toHaveURL(`${ONLINE_ORIGIN}/`);
      await page.goBack();
      await ready(page);
      expect(
        await page
          .locator("[data-lesson-state][data-map-marker]")
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-map-marker"))),
      ).toEqual(ids);
      errors.assertClean();
      writeFileSync(
        join(folder, "receipt.json"),
        JSON.stringify(
          {
            receipt,
            overview,
            ids,
            scope:
              "Ordinary Chrome viewport, not a physical phone; baseline flag changes assertions only, not product.",
            consoleErrors: errors.errors(),
          },
          null,
          2,
        ),
      );
    });
  });
}
