import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "./harness/learner-test.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { assertCompleteCourseOverview, waitForCourseFraming } from "./harness/course-overview.js";
import { CATALOGUE_ROLES } from "./harness/catalogue.js";
import { LOCAL_ORIGIN, ONLINE_ORIGIN } from "./ports.js";
import { waitForCourseTrees } from "./harness/course-foliage.js";
import { enterSelectedMapObject, runMapCommand } from "./harness/map-actions.js";
import {
  FIRST_COURSE_ROUTE,
  GAME_ROUTE_TITLE as HARNESS_GAME_ROUTE_TITLE,
} from "./harness/online-learner.js";

const COURSE = FIRST_COURSE_ROUTE;
const COURSE_ID = CATALOGUE_ROLES.settlement.course.id;
/* One implementation of the settlement fixture; see harness/online-learner.ts. */
const GAME_ROUTE_TITLE = HARNESS_GAME_ROUTE_TITLE;
const RUN = new Date().toISOString().replaceAll(":", "-");

async function inspectWholeCourse(page: Page, screenshot: string) {
  await runMapCommand(page, "overview");
  await assertCompleteCourseOverview(page);
  const trees = await waitForCourseTrees(page);
  await page.screenshot({ path: screenshot });
  await runMapCommand(page, "learning-view");
  await waitForCourseFraming(page);
  return trees;
}

test.describe("S 课程岛与学习玩法的整合边界", () => {
  for (const [mode, origin] of [
    ["delivery", ONLINE_ORIGIN],
    ["authoring", LOCAL_ORIGIN],
  ] as const) {
    for (const width of [1440, 375]) {
      test(`${mode} ${width}px 真实导航往返不丢系列、课程或地图入口`, async ({ page }) => {
        const errors = watchConsole(page);
        const folder = join(
          process.cwd(),
          ".devspace-visual",
          "integration",
          RUN,
          `${mode}-${width}`,
        );
        mkdirSync(folder, { recursive: true });
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 812 });
        await page.goto(`${origin}${COURSE}`);
        await expect(page.locator('[data-map-surface="true"]')).toBeVisible();
        await page.waitForFunction(() =>
          (window as any).three?.scene.getObjectByName("island-terrain"),
        );
        await waitForCourseFraming(page);
        const crownsBefore = await inspectWholeCourse(page, join(folder, "course-before.png"));

        if (!(await page.getByRole("link", { name: "图鉴", exact: true }).isVisible()))
          await page.locator(".app-shell__collapse--rail").click();
        await humanClick(
          page,
          page.getByRole("link", { name: "图鉴", exact: true }),
          "open the real library door",
        );
        await expect(
          page.getByRole("button", { name: `当前系列 ${GAME_ROUTE_TITLE}`, exact: true }),
        ).toBeVisible();
        await humanClick(
          page,
          page.locator(".library-tabs").getByRole("button", { name: "互动课件", exact: true }),
          "open the learning activities from their V7 album home",
        );
        await expect(page.locator(".learning-activity")).toHaveAttribute(
          "data-activity",
          "connect",
        );
        await expect(
          page.getByRole("button", { name: `当前系列 ${GAME_ROUTE_TITLE}`, exact: true }),
        ).toBeVisible();
        await expect(page.locator(".stagewrap")).toHaveCount(0);

        await humanClick(
          page,
          page.locator('[data-entry-id="native:sort"]'),
          "switch to the sort activity",
        );
        await expect(page.locator(".learning-activity")).toHaveAttribute("data-activity", "sort");
        await expect(
          page.getByRole("button", { name: `当前系列 ${GAME_ROUTE_TITLE}`, exact: true }),
        ).toBeVisible();
        await expect(page.locator(".learning-activity")).toHaveAttribute("data-guided", "true");
        await humanClick(
          page,
          page.locator(".play-sort__item").first(),
          "try the retained sort activity",
        );
        await expect(page.locator(".play-sort__guide")).toBeVisible();
        await expect(page.locator(".stagewrap")).toHaveCount(0);
        await page.screenshot({ path: join(folder, "sort-after-action.png") });

        await humanClick(
          page,
          page.getByRole("button", { name: /关卡地图/ }),
          "return from the album activity to the map",
        );
        await expect(page.locator('.map-breadcrumbs [aria-current="page"]')).toHaveText(
          GAME_ROUTE_TITLE,
        );
        const course = page.locator(
          `button.label--course[data-map-marker=${JSON.stringify(COURSE_ID)}]`,
        );
        await expect(course).toContainText("当前");
        await humanClick(page, course, "select the original course after remounting the world");
        await enterSelectedMapObject(page, "enter the retained course");
        await expect(page).toHaveURL(`${origin}${COURSE}`);
        await page.waitForFunction(() =>
          (window as any).three?.scene.getObjectByName("island-terrain"),
        );
        await waitForCourseFraming(page);
        await expect(page.locator(".stagewrap:not([hidden]) canvas")).toHaveCount(1);
        await expect(page.locator('[data-map-surface="true"]')).toBeVisible();
        const crownsAfter = await inspectWholeCourse(page, join(folder, "course-returned.png"));
        expect(
          crownsAfter,
          "returning from the album activity must retain the actual course foliage",
        ).toBe(crownsBefore);
        errors.assertClean();
        writeFileSync(
          join(folder, "receipt.json"),
          JSON.stringify(
            {
              crownsBefore,
              crownsAfter,
              mode,
              width,
              url: page.url(),
              head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
              scope:
                "Default E2E: real pointer navigation, prototype action, map unmount/remount and original course return. Desktop Chrome viewports, not physical phones or a GPU benchmark.",
              status: "PASS",
            },
            null,
            2,
          ),
        );
      });
    }
  }
});
