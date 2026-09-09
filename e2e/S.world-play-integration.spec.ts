import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { assertCompleteCourseOverview, waitForCourseFraming } from "./harness/course-overview.js";
import { LOCAL_ORIGIN, ONLINE_ORIGIN } from "./ports.js";

const COURSE = "/turing-pact/foundations-before-zero";
const RUN = new Date().toISOString().replaceAll(":", "-");

async function inspectWholeCourse(page: Page, screenshot: string) {
  await humanClick(
    page,
    page.getByRole("button", { name: "总览课程岛", exact: true }),
    "inspect the whole retained island",
  );
  await assertCompleteCourseOverview(page);
  await page.waitForFunction(
    () => (window as any).three?.scene.getObjectByName("course-tree-crowns")?.count > 0,
  );
  const crowns = await page.evaluate(
    () => (window as any).three.scene.getObjectByName("course-tree-crowns").count as number,
  );
  await page.screenshot({ path: screenshot });
  await humanClick(
    page,
    page.getByRole("button", { name: "回到当前关", exact: true }),
    "restore the learning camera",
  );
  await waitForCourseFraming(page);
  return crowns;
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
        await expect(page.getByRole("button", { name: "总览课程岛", exact: true })).toBeVisible();
        await page.waitForFunction(() =>
          (window as any).three?.scene.getObjectByName("island-terrain"),
        );
        await waitForCourseFraming(page);
        const crownsBefore = await inspectWholeCourse(page, join(folder, "course-before.png"));

        await humanClick(
          page,
          page.getByRole("link", { name: "练习", exact: true }),
          "open practice from the real shell",
        );
        await expect(
          page.getByRole("button", { name: "当前系列 TuringPact", exact: true }),
        ).toBeVisible();
        await humanClick(
          page,
          page.getByRole("button", { name: "去互动游乐场", exact: true }),
          "open the learning activities",
        );
        await expect(page.locator(".learning-activity")).toHaveAttribute(
          "data-activity",
          "connect",
        );
        await expect(
          page.getByRole("button", { name: "当前系列 TuringPact", exact: true }),
        ).toBeVisible();
        await expect(page.locator(".stagewrap")).toHaveCount(0);

        await humanClick(
          page,
          page.getByRole("link", { name: "用 AI 做产品", exact: true }),
          "switch to the AI collection",
        );
        await expect(page.locator(".learning-activity")).toHaveAttribute(
          "data-activity",
          "ai-brief",
        );
        await expect(
          page.getByRole("button", { name: "当前系列 TuringPact", exact: true }),
        ).toBeVisible();
        await expect(page.locator(".learning-activity")).toHaveAttribute("data-guided", "true");
        await humanClick(
          page,
          page.getByRole("button", { name: "同样提交一次", exact: true }),
          "actually try both prototype products",
        );
        await expect(page.getByRole("button", { name: "去问问组织者", exact: true })).toBeVisible();
        await expect(page.locator(".stagewrap")).toHaveCount(0);
        await page.screenshot({ path: join(folder, "ai-after-action.png") });

        await humanClick(
          page,
          page.getByRole("link", { name: "回到练习", exact: true }),
          "return from the activity",
        );
        await humanClick(page, page.getByRole("button", { name: /关卡地图/ }), "return to the map");
        await expect(
          page.getByRole("button", { name: "当前系列 TuringPact", exact: true }),
        ).toBeVisible();
        const course = page.locator(
          'button.label--course[data-map-marker="foundations-before-zero"]',
        );
        await expect(course).toContainText("当前");
        await humanClick(page, course, "select the original course after remounting the world");
        await humanClick(
          page,
          page.getByRole("button", { name: /进入这门课/ }),
          "enter the retained course",
        );
        await expect(page).toHaveURL(`${origin}${COURSE}`);
        await page.waitForFunction(() =>
          (window as any).three?.scene.getObjectByName("island-terrain"),
        );
        await waitForCourseFraming(page);
        await expect(page.locator(".stagewrap:not([hidden]) canvas")).toHaveCount(1);
        await expect(page.getByRole("button", { name: "总览课程岛", exact: true })).toBeVisible();
        const crownsAfter = await inspectWholeCourse(page, join(folder, "course-returned.png"));
        expect(crownsAfter, "returning from the lab must retain the actual course foliage").toBe(
          crownsBefore,
        );
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
