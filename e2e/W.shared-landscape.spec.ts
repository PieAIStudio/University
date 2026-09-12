import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ONLINE_ORIGIN } from "./ports.js";
import { humanClick } from "./harness/click.js";
import { assertCompleteCourseOverview, waitForCourseFraming } from "./harness/course-overview.js";
import { watchConsole } from "./harness/console.js";

const cases = [
  { study: "turing-pact", course: "foundations-terrain" },
  { study: "turing-pact", course: "testing-strategy" },
  { study: "general", course: "product-website" },
];

test.describe("W shared landscape across real course identities", () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: "light" });
  for (const item of cases)
    test(`${item.course}: shared art preserves this real course and its route`, async ({
      page,
    }) => {
      const errors = watchConsole(page);
      const path = `/${item.study}/${item.course}`;
      const output = join(
        process.env.R49_EVIDENCE_DIR ?? "SCRATCH/e2e/shared-landscape",
        item.course,
      );
      mkdirSync(output, { recursive: true });
      await page.goto(ONLINE_ORIGIN + path);
      await page.waitForFunction(
        () => {
          const bag = window as any;
          return (
            bag.three?.scene.getObjectByName("course-landscape") &&
            !document.querySelector(".loading-trivia")
          );
        },
        undefined,
        { timeout: 90000 },
      );
      await waitForCourseFraming(page);
      const read = () =>
        page.evaluate(() => {
          const s = (window as any).three;
          const b = s.scene.getObjectByName("island-course").userData.islandBlueprint;
          return {
            study: b.studyId,
            course: b.courseId,
            lessonIds: b.nodes.map((p: any) => p.id),
            successors: b.nodes.map((p: any) => p.next),
            count: b.lessonCount,
            seed: b.seed,
            route: b.route.archetype,
            landscape: s.scene.getObjectByName("course-landscape").userData.landscapeReport,
            camera: s.camera.matrixWorld.toArray(),
            frame: (window as any).__stageFrameMetrics,
            overflow: document.documentElement.scrollWidth - innerWidth,
          };
        });
      const before = await read();
      expect(before.study).toBe(item.study);
      expect(before.course).toBe(item.course);
      expect(before.lessonIds.length).toBe(before.count);
      expect(before.lessonIds.every((id: unknown) => typeof id === "string" && id.length > 0)).toBe(
        true,
      );
      expect(new Set(before.lessonIds).size).toBe(before.count);
      expect(before.successors).toEqual([...before.lessonIds.slice(1), null]);
      expect(before.count).toBeGreaterThan(0);
      expect(before.overflow).toBeLessThanOrEqual(1);
      await page.screenshot({ path: join(output, "near.png") });
      const rail = page.locator('#app-shell-rail button[aria-expanded="true"]');
      if (await rail.count()) await humanClick(page, rail, "收起导航栏");
      const aside = page.getByRole("button", { name: "收起", exact: true });
      if (await aside.count()) await humanClick(page, aside.last(), "收起上下文");
      await humanClick(
        page,
        page.getByRole("button", { name: "总览课程岛", exact: true }),
        "总览完整课程",
      );
      const overview = await assertCompleteCourseOverview(page);
      await page.screenshot({ path: join(output, "overview.png") });
      await humanClick(
        page,
        page.getByRole("button", { name: "回到当前关", exact: true }),
        "回到真实节点",
      );
      await waitForCourseFraming(page);
      const after = await read();
      expect(after.lessonIds).toEqual(before.lessonIds);
      expect(after.seed).toBe(before.seed);
      expect(after.landscape.triangles).toBeLessThanOrEqual(50000);
      writeFileSync(
        join(output, "receipt.json"),
        JSON.stringify({ url: page.url(), before, after, overview }, null, 2),
      );
      errors.assertClean();
    });
});
