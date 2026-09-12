import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ONLINE_ORIGIN } from "./ports.js";
import {
  installTerrainLengthFixture,
  TERRAIN_LENGTH_FIXTURES,
  coursePathOf,
} from "./harness/catalogue.js";
import { humanClick } from "./harness/click.js";
import { waitForCourseFraming, assertCompleteCourseOverview } from "./harness/course-overview.js";
import { watchConsole } from "./harness/console.js";
import { measureStageGpu } from "./harness/stage-gpu-timing.js";
import { captureDrawnMaterials } from "./harness/drawn-materials.js";

const OUTPUT = process.env.R47_EVIDENCE_DIR ?? "SCRATCH/e2e/surface-landscape";

for (const viewport of [
  { width: 1600, height: 900 },
  { width: 375, height: 812 },
]) {
  test.describe(`V hybrid landscape ${viewport.width}`, () => {
    test.use({
      viewport,
      deviceScaleFactor: 1,
      colorScheme: "dark",
      reducedMotion: viewport.width === 375 ? "reduce" : "no-preference",
    });
    for (const fixture of TERRAIN_LENGTH_FIXTURES) {
      test(`${fixture.name}: shaped length, shared texture, broad bank and reversible navigation`, async ({
        page,
      }) => {
        const errors = watchConsole(page);
        const folder = join(OUTPUT, `${viewport.width}`, fixture.name);
        mkdirSync(folder, { recursive: true });
        await installTerrainLengthFixture(page, fixture);
        const ready = async () => {
          await page.waitForFunction(
            () => {
              const bag = window as any;
              return (
                bag.three?.scene.getObjectByName("course-landscape") &&
                bag.__stageFrameMetrics?.sceneUuid === bag.three.scene.uuid &&
                !document.querySelector(".loading-trivia")
              );
            },
            undefined,
            { timeout: 90000 },
          );
          await waitForCourseFraming(page);
        };
        const receipt = () =>
          page.evaluate(() => {
            const bag = window as any,
              state = bag.three;
            const terrain = state.scene.getObjectByName("island-terrain");
            const rock = state.scene.getObjectByName("course-rock-outcrops");
            const detail = terrain.material.userData.surfaceDetail;
            const blue = state.scene.getObjectByName("island-course").userData.islandBlueprint;
            const swatch = detail.uSurfaceSwatch.value;
            return {
              url: location.pathname,
              viewport: [innerWidth, innerHeight],
              dpr: devicePixelRatio,
              reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
              lessonIds: blue.nodes.map((n: any) => n.id),
              successors: blue.nodes.map((n: any) => n.next),
              visibleLessonIds: Array.from(
                document.querySelectorAll(".label--lesson[data-lesson-state][data-map-marker]"),
              ).map((n) => n.getAttribute("data-map-marker")),
              landscape: state.scene.getObjectByName("course-landscape").userData.landscapeReport,
              frame: bag.__stageFrameMetrics,
              swatch: {
                uuid: swatch.uuid,
                width: swatch.image.width,
                height: swatch.image.height,
                colorSpace: swatch.colorSpace,
                mipmaps: swatch.generateMipmaps,
                sharedWithRock:
                  rock?.material.userData.surfaceDetail.uSurfaceSwatch.value === swatch,
                ...terrain.material.userData.surfaceDetailInfo,
              },
              rendererObjectCounts: {
                ...state.gl.info.memory,
                programs: state.gl.info.programs?.length,
              },
              memoryScope:
                "Three object counters, not process/GPU VRAM; render-target bytes and driver allocations are not measured",
              overflow: document.documentElement.scrollWidth - innerWidth,
            };
          });
        await page.goto(ONLINE_ORIGIN + coursePathOf(fixture.course));
        await ready();
        if (viewport.width >= 768) {
          const rail = page.locator('#app-shell-rail button[aria-expanded="true"]');
          if (await rail.count()) await humanClick(page, rail, "收起导航栏查看真实场景");
          const aside = page.getByRole("button", { name: "收起", exact: true });
          if (await aside.count()) await humanClick(page, aside.last(), "收起上下文栏");
          await waitForCourseFraming(page);
        }
        const before = await receipt();
        const materials = await captureDrawnMaterials(page);
        const drawnTerrain = materials.materials.find((m) => m.mesh === "island-terrain");
        expect(drawnTerrain?.maps.uCourseSurface?.width).toBe(256);
        expect(drawnTerrain?.maps.uCourseSurface?.colourSpace).toBe("srgb-linear");
        const drawnCraft = materials.materials.find((m) => m.mesh === "course-garden-flora");
        expect(drawnCraft?.maps.uSurfaceSwatch?.uuid).toBe(drawnTerrain?.maps.uSurfaceSwatch?.uuid);
        expect(drawnCraft?.craftCoordinateBytes).toBeGreaterThan(0);
        if (fixture.name === "short-shaped")
          expect(drawnCraft?.craftRoles).toEqual([0, 1, 2, 3, 4, 5]);
        expect(before.lessonIds).toHaveLength(fixture.lessonCount);
        expect(
          before.lessonIds.every((id: unknown) => typeof id === "string" && id.length > 0),
        ).toBe(true);
        expect(new Set(before.lessonIds).size).toBe(fixture.lessonCount);
        expect(before.successors).toEqual([...before.lessonIds.slice(1), null]);
        expect(new Set(before.visibleLessonIds)).toEqual(new Set(before.lessonIds));
        expect(before.swatch.sharedWithRock).toBe(true);
        expect(before.swatch.width).toBe(128);
        expect(before.swatch.height).toBe(128);
        expect(before.swatch.colorSpace).toBe("");
        expect(before.swatch.mipmaps).toBe(true);
        expect(before.overflow).toBeLessThanOrEqual(1);
        await page.screenshot({ path: join(folder, "near.png") });
        const icon = page.locator("button.label--icon.is-visible").first();
        await expect(icon).toBeVisible();
        await humanClick(page, icon, "真实课序关卡");
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toBeHidden();
        await humanClick(
          page,
          page.getByRole("button", { name: "总览课程岛", exact: true }),
          "完整课程岛",
        );
        await assertCompleteCourseOverview(page);
        await page.screenshot({ path: join(folder, "overview.png") });
        const canvas = await page.locator(".stagewrap canvas").boundingBox();
        if (!canvas) throw new Error("Missing actual course canvas");
        // Normal wheel input brings the complete-island overview into a
        // readable walking-distance view. No camera property assignments.
        await page.mouse.move(canvas.x + canvas.width * 0.68, canvas.y + canvas.height * 0.57);
        for (let i = 0; i < 8; i++) {
          await page.mouse.wheel(0, -120);
          await page.waitForTimeout(55);
        }
        await page.mouse.move(2, 2);
        await waitForCourseFraming(page);
        await page.screenshot({ path: join(folder, "walking.png") });
        const gpu = process.env.R47_MEASURE_GPU === "1" ? await measureStageGpu(page) : null;
        const after = await receipt();
        expect(after.lessonIds).toEqual(before.lessonIds);
        expect(after.swatch.uuid).toBe(before.swatch.uuid);
        const back = page.getByRole("button", { name: /回到.+地图/ });
        await humanClick(page, back, "飞岛群");
        await page.waitForFunction(() =>
          (window as any).three?.scene.getObjectByName("remote-island-field"),
        );
        await page.goBack();
        await ready();
        const returned = await receipt();
        expect(returned.lessonIds).toEqual(before.lessonIds);
        expect(returned.swatch.sharedWithRock).toBe(true);
        expect(returned.landscape.triangles).toBe(before.landscape.triangles);
        expect(returned.rendererObjectCounts.textures).toBeLessThanOrEqual(
          before.rendererObjectCounts.textures + 2,
        );
        writeFileSync(
          join(folder, "receipt.json"),
          JSON.stringify({ before, after, returned, gpu, materials }, null, 2),
        );
        errors.assertClean();
      });
    }
  });
}
