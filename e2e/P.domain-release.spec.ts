import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { LOCAL_ORIGIN, ONLINE_ORIGIN } from "./ports.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { GAME_ROUTE_TITLE } from "./harness/online-learner.js";

const RUN = new Date().toISOString().replaceAll(":", "-");

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
          "astra-r40",
          "domains-default",
          RUN,
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
          page.getByRole("button", { name: /回到\s*.+地图/ }),
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
          page.getByRole("button", { name: `当前系列 ${GAME_ROUTE_TITLE}`, exact: true }),
          "study choices",
        );
        await humanClick(
          page,
          page.getByRole("option", { name: "看所有课程系列", exact: true }),
          "domain catalogue",
        );
        const expand = page.getByRole("button", { name: "展开上下文", exact: true });
        if (await expand.isVisible()) await humanClick(page, expand, "reveal the domain choices");
        await expect(page.locator("button[data-domain-id]")).toHaveCount(4);
        await page.waitForFunction(() => {
          const bag = window as any;
          const projection = bag.__planetProjection?.();
          return (
            projection?.domainCount === 4 &&
            projection.domains.every(
              (domain: { id: string }) =>
                bag.three?.scene.getObjectByName(`domain-planet-${domain.id}`)?.userData
                  .planetAssetsReady,
            )
          );
        });
        const initial = await page.evaluate(() => {
          const bag = window as any;
          return ["programming", "ai-foundations", "ai-games", "ai-media"].map((id) => {
            const globe = bag.three.scene.getObjectByName(`domain-globe-${id}`);
            return { id, geometry: globe.geometry.uuid, texture: globe.material.map.uuid };
          });
        });
        await page.screenshot({ path: join(folder, "four-domains.png") });
        for (const [domain, expected] of [
          ["programming", ["browser-ai", "general"]],
          ["ai-foundations", ["ai-foundations"]],
          ["ai-games", ["turing-pact"]],
        ] as const) {
          await humanClick(
            page,
            page.locator(`button[data-domain-id="${domain}"]`),
            `inspect populated ${domain}`,
          );
          const actual = await page
            .locator("[data-study-id]")
            .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-study-id")).sort());
          expect(actual).toEqual([...expected].sort());
          await expect(page.locator(".planet-page__enter")).toBeVisible();
          await expect(page.locator("[data-study-description]")).toBeVisible();
          if (domain === "ai-foundations")
            await expect(page.locator('[data-study-id="ai-foundations"]')).toContainText("61 节");
        }
        for (const id of ["ai-media"]) {
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
        // Actual sphere picking restores the original game's route after
        // visits to populated and empty domains, without cloning its courses.
        const target = await page.evaluate(() => {
          const state = (window as any).three;
          const globe = state.scene.getObjectByName("domain-globe-ai-games");
          const point = state.camera.position.clone();
          globe.getWorldPosition(point);
          point.project(state.camera);
          const r = state.gl.domElement.getBoundingClientRect();
          const x = r.left + ((point.x + 1) * r.width) / 2,
            y = r.top + ((1 - point.y) * r.height) / 2;
          if (document.elementFromPoint(x, y) !== state.gl.domElement)
            throw new Error("Game globe is occluded");
          return { x, y };
        });
        await page.mouse.move(target.x, target.y);
        await page.mouse.down();
        await page.waitForTimeout(40);
        await page.mouse.up();
        await expect(page.locator('button[data-domain-id="ai-games"]')).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        await expect(page.locator('[data-study-id="turing-pact"]')).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        const returned = await page.evaluate(() => {
          const bag = window as any;
          return ["programming", "ai-foundations", "ai-games", "ai-media"].map((id) => {
            const globe = bag.three.scene.getObjectByName(`domain-globe-${id}`);
            return { id, geometry: globe.geometry.uuid, texture: globe.material.map.uuid };
          });
        });
        expect(returned).toEqual(initial);

        // Opening foundations means entering actual authored material, not
        // merely removing the unpublished badge from a placeholder globe.
        await humanClick(
          page,
          page.locator('button[data-domain-id="ai-foundations"]'),
          "enter AI foundations",
        );
        await humanClick(page, page.locator(".planet-page__enter"), "open foundations archipelago");
        await humanClick(
          page,
          page.locator('button.label--course[data-map-marker="what-is-ai-really"]'),
          "choose the 61-lesson course",
        );
        await humanClick(
          page,
          page.getByRole("button", { name: /进入这门课/ }),
          "enter the actual foundations course",
        );
        await expect(page).toHaveURL(`${origin}/ai-foundations/what-is-ai-really`);
        await humanClick(
          page,
          page.getByRole("button", { name: "开始", exact: true }),
          "choose the first actual lesson",
        );
        await humanClick(
          page,
          page.getByRole("dialog").getByRole("button", { name: /^开始/ }),
          "read foundations content",
        );
        await expect(page.getByRole("button", { name: "离开课文", exact: true })).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "手机怎么一眼就认出是你", exact: true }),
        ).toBeVisible();
        await page.screenshot({ path: join(folder, "foundations-reader.png") });
        await humanClick(
          page,
          page.getByRole("button", { name: "离开课文", exact: true }),
          "return from foundations reader",
        );
        await humanClick(
          page,
          page.getByRole("button", { name: /回到\s*.+地图/ }),
          "return to foundations route",
        );
        await humanClick(page, page.locator(".study-switcher__trigger"), "open route switcher");
        await humanClick(
          page,
          page.getByRole("option", { name: "看所有课程系列", exact: true }),
          "return to domain selection",
        );
        if (await expand.isVisible())
          await humanClick(page, expand, "reveal returned domain choices");
        await humanClick(
          page,
          page.locator('button[data-domain-id="ai-games"]'),
          "return to game learning",
        );
        await expect(page.locator('[data-study-id="turing-pact"]')).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        await humanClick(
          page,
          page.getByRole("button", { name: `进入 ${GAME_ROUTE_TITLE}`, exact: true }),
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
                "Four real declared domains, three with authored courses and one unpublished; real foundations reading and game-route return. Desktop Chrome viewport, not a phone.",
            },
            null,
            2,
          ),
        );
      });
    }
  }
});
