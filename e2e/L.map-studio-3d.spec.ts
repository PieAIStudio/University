import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { LOCAL_ORIGIN } from "./ports.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";

const OUTPUT = "SCRATCH/e2e/map-studio-3d";

test.describe("L actual 3D asset inspector", () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "light",
  });

  test("reads live medallion, footing, model dimensions and atomic assembly evidence", async ({
    page,
  }) => {
    const console = watchConsole(page);
    mkdirSync(OUTPUT, { recursive: true });
    await page.goto(`${LOCAL_ORIGIN}/studio/map`);
    await expect(page.locator("[data-map-studio]")).toBeVisible();
    await page.getByRole("combobox", { name: "预览项目", exact: true }).selectOption("turing-pact");

    // 1. Initial planet projection verification
    await expect(page.locator(".map-studio__generator")).toContainText("createDomainGlobeGeometry");
    await page.waitForFunction(() => {
      const bag = globalThis as unknown as {
        three?: { scene: { getObjectByName(name: string): unknown } };
      };
      return Boolean(bag.three?.scene.getObjectByName("domain-globe-programming"));
    });
    await expect
      .poll(async () => page.locator(".map-studio__budget-hero strong").last().innerText())
      .not.toBe("加载中");
    const planetActualTriangles = await page
      .locator(".map-studio__budget-hero strong")
      .last()
      .innerText();
    await page.screenshot({ path: join(OUTPUT, "planet-inspector.png") });

    // 2. World archipelago projection verification
    await humanClick(
      page,
      page.getByRole("tab", { name: "群岛", exact: true }),
      "world projection",
    );
    await expect(page.locator(".map-studio__generator")).toContainText("RemoteIslandField");
    await page.waitForFunction(() => {
      const bag = globalThis as unknown as {
        three?: { scene: { getObjectByName(name: string): unknown } };
      };
      return Boolean(bag.three?.scene.getObjectByName("remote-island-terrain"));
    });
    await expect
      .poll(async () => page.locator(".map-studio__budget-hero strong").last().innerText())
      .not.toBe("加载中");
    const worldActualTriangles = await page
      .locator(".map-studio__budget-hero strong")
      .last()
      .innerText();
    await expect(page.locator('[data-asset-key="procedural/tree-crown"]')).toHaveCount(0);
    await expect(page.locator('[data-asset-key="procedural/world-tree-crown"]')).toBeAttached();
    await page.screenshot({ path: join(OUTPUT, "world-inspector.png") });

    // 3. Course island projection verification
    await humanClick(
      page,
      page.getByRole("tab", { name: "课程岛", exact: true }),
      "course projection",
    );
    await expect(page.locator(".map-studio__generator")).toContainText("buildIslandGeometry");
    const course = page.getByRole("combobox", {
      name: "预览课程",
      exact: true,
    });
    await expect(course).toBeEnabled();
    await course.selectOption("foundations-before-zero");
    await page.waitForFunction(() => {
      const bag = globalThis as unknown as {
        three?: {
          scene: {
            getObjectByName(name: string): { userData: Record<string, unknown> } | undefined;
          };
        };
      };
      return (
        bag.three?.scene.getObjectByName("island-dressing-course")?.userData.islandDressingReady ===
        true
      );
    });
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const canvas = document.querySelector<HTMLCanvasElement>(".map-studio canvas")!;
            const box = document.querySelector(".map-studio__renderer")!.getBoundingClientRect();
            return Math.abs(canvas.getBoundingClientRect().height - box.height);
          }),
        {
          message: "the preview must use its own viewport, not a clipped 100dvh learner stage",
        },
      )
      .toBeLessThan(2);

    const medallion = page.locator('[data-asset-key="procedural/lesson-medallion"]');
    await expect(medallion).toContainText("168");
    const footing = page.locator('[data-asset-key="procedural/lesson-footing"]');
    await expect(footing).toBeAttached();
    // Unknown is not zero: the row must settle to the actual scene's projected geometry.
    await expect
      .poll(async () => footing.locator(".map-studio__metric strong").last().innerText())
      .not.toBe("加载中");
    const roof = page.locator('[data-asset-key="fantasy-town-kit/roof-gable"]');
    await expect(roof).toContainText("原始模型尺寸");
    await expect(roof).toContainText("场景尺寸范围");
    await expect(page.locator('[data-assembly-id="summit-academy-building"]')).toBeAttached();
    const before = await page.evaluate(() => {
      const bag = globalThis as unknown as {
        three?: {
          scene: {
            getObjectByName(name: string): { uuid: string } | undefined;
          };
        };
      };
      return bag.three?.scene.getObjectByName("island-dressing-course")?.uuid;
    });
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => {
      const bag = globalThis as unknown as {
        three?: {
          scene: {
            getObjectByName(name: string): { uuid: string } | undefined;
          };
        };
      };
      return bag.three?.scene.getObjectByName("island-dressing-course")?.uuid;
    });
    expect(before, "statistics updates must not remount the actual scene").toBe(after);
    await footing.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(OUTPUT, "island-footing-inspector.png"),
    });
    const assembly = page.locator('[data-assembly-id="summit-academy-building"]');
    await humanClick(page, assembly.locator("summary"), "complete building members");
    await expect(assembly).toContainText("fantasy-town-kit/roof-gable");
    await expect(assembly.locator("code")).toHaveCount(5);
    await page.screenshot({ path: join(OUTPUT, "assembly-members.png") });

    const rocks = page.getByRole("combobox", { name: "石头模型", exact: true });
    const option = rocks.locator('option:not([value=""]):not([disabled])').first();
    const replacement = await option.getAttribute("value");
    expect(replacement).toBeTruthy();
    await rocks.selectOption(replacement!);
    await expect(page.locator(`[data-asset-key="${replacement}"]`)).toBeAttached();
    await rocks.selectOption("");
    await page.screenshot({
      path: join(OUTPUT, "island-replacement-restored.png"),
    });
    writeFileSync(
      join(OUTPUT, "receipt.json"),
      JSON.stringify(
        {
          planetActualTriangles,
          worldActualTriangles,
          replacement,
          before,
          after,
          console: console.errors(),
        },
        null,
        2,
      ),
    );
    console.assertClean();
  });
});
