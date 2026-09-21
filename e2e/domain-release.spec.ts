import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { LOCAL_ORIGIN, ONLINE_ORIGIN } from "./ports.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import {
  CATALOGUE_ROLES,
  HAS_MULTIPLE_SHIPPED_STUDIES,
  MULTI_STUDY_CATALOGUE_REASON,
  coursePathOf,
} from "./harness/catalogue.js";
import {
  PRIMARY_DOMAIN_ID,
  RELEASED_DOMAIN_STUDIES,
  SECONDARY_DOMAIN_ID,
  SECONDARY_START_COURSE as SECONDARY_COURSE,
} from "./harness/domain-catalogue.js";
import { GAME_ROUTE_TITLE } from "./harness/online-learner.js";
import {
  enterSelectedMapObject,
  mapEntryButton,
  navigateMapBreadcrumb,
  openMapDirectory,
} from "./harness/map-actions.js";
import { withProject } from "./harness/project.js";

const RUN = new Date().toISOString().replaceAll(":", "-");
const PRIMARY_STUDY = CATALOGUE_ROLES.settlement.study;
const PRIMARY_COURSE = CATALOGUE_ROLES.settlement.course;

test.describe("P 正式领域目录与未发布星球", () => {
  for (const [mode, origin] of [
    ["delivery", ONLINE_ORIGIN],
    ["authoring", LOCAL_ORIGIN],
  ] as const) {
    for (const width of [1440, 375, 872]) {
      test(`${mode} ${width}px 保留真实系列与空星球往返`, async ({ page }) => {
        test.skip(!HAS_MULTIPLE_SHIPPED_STUDIES, MULTI_STUDY_CATALOGUE_REASON);
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
        await page.goto(`${origin}${coursePathOf(PRIMARY_COURSE)}`);
        await expect(page.locator('[data-map-surface="true"]')).toBeVisible();
        // This is a steady-catalogue identity test. The authoring route can
        // expose its chrome before the asynchronous real course graph arrives;
        // wait for its actual lesson marker, not a populated shell alone.
        await expect(page.locator("button.label--lesson.is-visible").first()).toBeVisible();
        await navigateMapBreadcrumb(page, "/");
        if (width === 872) {
          const current = page.locator(
            `button.label--course[data-map-marker=${JSON.stringify(PRIMARY_COURSE.id)}]`,
          );
          await expect(current).toHaveClass(/is-visible/);
          await expect(current).toHaveCSS("opacity", "1");
          const canvasBox = await page.locator(".map-viewport canvas").boundingBox();
          expect(canvasBox).not.toBeNull();
          expect(canvasBox!.height).toBeGreaterThanOrEqual(284);
          await expect(
            page.locator(".map-tools button:visible, .map-framing-tools button:visible"),
          ).toHaveCount(0);
        }
        await navigateMapBreadcrumb(page, "/planet");
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
        if (width === 375) {
          await page.locator(`button[data-domain-id="${PRIMARY_DOMAIN_ID}"]`).click();
          const enter = await mapEntryButton(page).boundingBox();
          const feedback = await page
            .getByRole("button", { name: "提意见", exact: true })
            .boundingBox();
          expect(enter).not.toBeNull();
          expect(feedback).not.toBeNull();
          const overlapX = Math.max(
            0,
            Math.min(enter!.x + enter!.width, feedback!.x + feedback!.width) -
              Math.max(enter!.x, feedback!.x),
          );
          const overlapY = Math.max(
            0,
            Math.min(enter!.y + enter!.height, feedback!.y + feedback!.height) -
              Math.max(enter!.y, feedback!.y),
          );
          expect(overlapX * overlapY, "feedback must not cover the domain entry action").toBe(0);
          await expect(page.locator(".planet-domain-label")).toHaveCount(4);
          const clipped = await page
            .locator(".planet-domain-label")
            .evaluateAll((labels) =>
              labels
                .filter((label) => label.scrollWidth > label.clientWidth + 1)
                .map((label) => label.textContent),
            );
          expect(clipped, "the four ordinary domain names must fit their globe labels").toEqual([]);
        }
        const initial = await page.evaluate(() => {
          const bag = window as any;
          return ["programming", "ai-foundations", "ai-games", "ai-media"].map((id) => {
            const globe = bag.three.scene.getObjectByName(`domain-globe-${id}`);
            return { id, geometry: globe.geometry.uuid, texture: globe.material.map.uuid };
          });
        });
        await page.screenshot({ path: join(folder, "four-domains.png") });
        for (const { id: domain, studies } of RELEASED_DOMAIN_STUDIES.filter(
          (entry) => entry.studies.length > 0,
        )) {
          await humanClick(
            page,
            page.locator(`button[data-domain-id="${domain}"]`),
            `inspect populated ${domain}`,
          );
          // The complete directory is retained on demand, not copied into the
          // read-only information sidebar. Selecting there is still not Enter.
          const directory = await openMapDirectory(page);
          const actual = await directory
            .locator("[data-map-destination]")
            .evaluateAll((rows) =>
              rows.map((row) => row.getAttribute("data-map-destination")).sort(),
            );
          expect(actual).toEqual(RELEASED_DOMAIN_STUDIES.map((item) => item.id).sort());
          await directory.locator(`[data-map-destination=${JSON.stringify(domain)}]`).click();
          if (studies.length > 1) {
            const regions = page.locator(`[data-planet-domain-label="${domain}"] details`);
            await regions.locator("summary").click();
            await expect(regions.locator("[data-study-id]")).toHaveCount(studies.length);
            for (const study of studies)
              await expect(
                regions.locator(`[data-study-id=${JSON.stringify(study.id)}]`),
              ).toHaveText(study.title);
            await regions.locator(`[data-study-id=${JSON.stringify(studies[0]!.id)}]`).click();
          }
          await expect(mapEntryButton(page)).toHaveAttribute(
            "aria-label",
            `进入 ${studies[0]!.title}`,
          );
          const info = page.locator("#app-shell-aside [data-map-information]");
          if (width < 768) await page.locator(".app-shell__collapse--aside").click();
          await expect(info).toContainText(
            `${studies[0]!.courses.reduce((sum, course) => sum + course.lessonCount, 0)} 节`,
          );
          if (width < 768) await page.keyboard.press("Escape");
        }
        for (const { id } of RELEASED_DOMAIN_STUDIES.filter(
          (entry) => entry.studies.length === 0,
        )) {
          await humanClick(page, page.locator(`button[data-domain-id="${id}"]`), `select ${id}`);
          await expect(page.locator(`[data-planet-domain-label="${id}"]`)).toContainText(
            "暂未发布",
          );
          await expect(page.locator("[data-study-id]")).toHaveCount(0);
          await expect(page.locator('[data-map-entry="true"]')).toHaveCount(0);
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
        const target = await page.evaluate(
          withProject((project, domainId) => {
            const state = (window as any).three;
            const globe = state.scene.getObjectByName(`domain-globe-${domainId}`);
            const point = state.camera.position.clone();
            globe.getWorldPosition(point);
            const pixel = project.projectWorldToViewport(point, state.camera, state.gl.domElement);
            if (document.elementFromPoint(pixel.x, pixel.y) !== state.gl.domElement)
              throw new Error("Game globe is occluded");
            return pixel;
          }),
          PRIMARY_DOMAIN_ID,
        );
        await page.mouse.move(target.x, target.y);
        await page.mouse.down();
        await page.waitForTimeout(40);
        await page.mouse.up();
        await expect(page.locator(`button[data-domain-id="${PRIMARY_DOMAIN_ID}"]`)).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        await expect(mapEntryButton(page)).toHaveAttribute(
          "aria-label",
          `进入 ${PRIMARY_STUDY.title}`,
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
          page.locator(`button[data-domain-id="${SECONDARY_DOMAIN_ID}"]`),
          "enter the other released domain",
        );
        await enterSelectedMapObject(page, "open foundations archipelago");
        await humanClick(
          page,
          page.locator(
            `button.label--course[data-map-marker=${JSON.stringify(SECONDARY_COURSE.id)}]`,
          ),
          `choose the ${SECONDARY_COURSE.lessonCount}-lesson course`,
        );
        await enterSelectedMapObject(page, "enter the actual foundations course");
        await expect(page).toHaveURL(`${origin}${coursePathOf(SECONDARY_COURSE)}`);
        await humanClick(
          page,
          page.getByRole("button", { name: "开始", exact: true }),
          "choose the first actual lesson",
        );
        await enterSelectedMapObject(page, "read foundations content");
        await expect(page.getByRole("button", { name: "离开课文", exact: true })).toBeVisible();
        await expect(
          page.getByRole("heading", {
            name: SECONDARY_COURSE.units[0]!.lessons[0]!.title,
            exact: true,
          }),
        ).toBeVisible();
        await page.screenshot({ path: join(folder, "foundations-reader.png") });
        await humanClick(
          page,
          page.getByRole("button", { name: "离开课文", exact: true }),
          "return from foundations reader",
        );
        await navigateMapBreadcrumb(page, "/");
        await navigateMapBreadcrumb(page, "/planet");
        await humanClick(
          page,
          page.locator(`button[data-domain-id="${PRIMARY_DOMAIN_ID}"]`),
          "return to game learning",
        );
        await expect(mapEntryButton(page)).toHaveAttribute(
          "aria-label",
          `进入 ${PRIMARY_STUDY.title}`,
        );
        await humanClick(
          page,
          page.getByRole("button", { name: `进入 ${GAME_ROUTE_TITLE}`, exact: true }),
          "return to existing series",
        );
        await expect(
          page.getByRole("button", { name: PRIMARY_COURSE.title, exact: true }),
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
                "Four declared domains with release-derived populated/empty states; actual cross-domain reading and return. Desktop Chrome viewport, not a physical phone.",
            },
            null,
            2,
          ),
        );
      });
    }
  }
});
