import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { LOCAL_ORIGIN, ONLINE_ORIGIN } from "./ports.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";

test.describe("P 正式领域目录与未发布星球", () => {
  for (const [mode, origin] of [
    ["delivery", ONLINE_ORIGIN],
    ["authoring", LOCAL_ORIGIN],
  ] as const) {
    for (const width of [1440, 375, 872]) {
      test(`${mode} ${width}px 保留真实系列与空星球往返`, async ({ page }) => {
        const errors = watchConsole(page);
        const folder = join(
          process.cwd(),
          ".devspace-visual",
          "astra-r38",
          "domains-default",
          `${mode}-${width}`,
        );
        mkdirSync(folder, { recursive: true });
        await page.setViewportSize({
          width,
          height: width === 1440 ? 900 : width === 872 ? 286 : 812,
        });
        await page.goto(`${origin}/turing-pact/foundations-before-zero`);
        await expect(page.getByRole("button", { name: "总览课程岛", exact: true })).toBeVisible();
        await humanClick(
          page,
          page.getByRole("button", { name: /回到 TuringPact 地图/ }),
          "series return",
        );
        if (width === 872) {
          const current = page.locator(
            'button.label--course[data-map-marker="foundations-before-zero"]',
          );
          await expect(current).toHaveClass(/is-visible/);
          await expect(current).toHaveCSS("opacity", "1");
          const tools = page.locator(".map-tools");
          const [toolBox, canvasBox] = await Promise.all([
            tools.boundingBox(),
            page.locator(".map-viewport canvas").boundingBox(),
          ]);
          expect(toolBox!.y).toBeGreaterThanOrEqual(canvasBox!.y + canvasBox!.height);
        }
        await humanClick(
          page,
          page.getByRole("button", { name: "当前系列 TuringPact", exact: true }),
          "study choices",
        );
        await humanClick(
          page,
          page.getByRole("option", { name: "看所有课程系列", exact: true }),
          "domain catalogue",
        );
        const expand = page.getByRole("button", { name: "展开上下文", exact: true });
        if (await expand.isVisible()) await humanClick(page, expand, "reveal the domain choices");
        await expect(page.locator("button[data-domain-id]")).toHaveCount(3);
        await page.waitForFunction(() => {
          const bag = window as any;
          const projection = bag.__planetProjection?.();
          return (
            projection?.domainCount === 3 &&
            projection.domains.every(
              (domain: { id: string }) =>
                bag.three?.scene.getObjectByName(`domain-planet-${domain.id}`)?.userData
                  .planetAssetsReady,
            )
          );
        });
        const initial = await page.evaluate(() => {
          const bag = window as any;
          return ["programming", "ai-foundations", "ai-media"].map((id) => {
            const globe = bag.three.scene.getObjectByName(`domain-globe-${id}`);
            return { id, geometry: globe.geometry.uuid, texture: globe.material.map.uuid };
          });
        });
        await page.screenshot({ path: join(folder, "three-domains.png") });
        for (const id of ["ai-foundations", "ai-media"]) {
          await humanClick(page, page.locator(`button[data-domain-id="${id}"]`), `select ${id}`);
          await expect(page.locator(`[data-domain-empty="${id}"]`)).toContainText("暂未发布");
          await expect(page.locator("[data-study-id]")).toHaveCount(0);
          await expect(page.locator(".planet-page__enter")).toHaveCount(0);
          const empty = await page.evaluate((id) => {
            const scene = (window as any).three.scene;
            return (
              !scene.getObjectByName(`domain-course-islands-${id}`) &&
              !scene.getObjectByName(`domain-region-targets-${id}`)
            );
          }, id);
          expect(empty, "unpublished domains must not invent course islands").toBe(true);
          await page.screenshot({ path: join(folder, `${id}.png`) });
        }
        // Actual sphere picking must restore the remembered TuringPact, not
        // overwrite the shell's decision with the first alphabetic study.
        const target = await page.evaluate(() => {
          const state = (window as any).three;
          const globe = state.scene.getObjectByName("domain-globe-programming");
          const point = state.camera.position.clone();
          globe.getWorldPosition(point);
          point.project(state.camera);
          const r = state.gl.domElement.getBoundingClientRect();
          const x = r.left + ((point.x + 1) * r.width) / 2,
            y = r.top + ((1 - point.y) * r.height) / 2;
          if (document.elementFromPoint(x, y) !== state.gl.domElement)
            throw new Error("Program globe is occluded");
          return { x, y };
        });
        await page.mouse.move(target.x, target.y);
        await page.mouse.down();
        await page.waitForTimeout(40);
        await page.mouse.up();
        await expect(page.locator('button[data-domain-id="programming"]')).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        await expect(page.locator('[data-study-id="turing-pact"]')).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        const returned = await page.evaluate(() => {
          const bag = window as any;
          return ["programming", "ai-foundations", "ai-media"].map((id) => {
            const globe = bag.three.scene.getObjectByName(`domain-globe-${id}`);
            return { id, geometry: globe.geometry.uuid, texture: globe.material.map.uuid };
          });
        });
        expect(returned).toEqual(initial);
        await humanClick(
          page,
          page.getByRole("button", { name: "进入 TuringPact", exact: true }),
          "return to existing series",
        );
        await expect(
          page.getByRole("button", { name: "《在开始之前：App、代码、和你》", exact: true }),
        ).toBeVisible();
        errors.assertClean();
        writeFileSync(
          join(folder, "receipt.json"),
          JSON.stringify(
            {
              mode,
              width,
              origin,
              initial,
              returned,
              status: "PASS",
              scope:
                "Real declared domains, two unpublished; no synthetic studies. Desktop Chrome viewport, not a phone.",
            },
            null,
            2,
          ),
        );
      });
    }
  }
});
