import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ONLINE_ORIGIN } from "./ports.js";
import {
  COURSE_SCENE_FIXTURE,
  coursePathOf,
  installCourseSceneFixture,
} from "./harness/catalogue.js";
import { watchConsole } from "./harness/console.js";

const COURSE_ROUTE = coursePathOf(COURSE_SCENE_FIXTURE.course);

test("X real coastal spring: restrained flow stops and resets without moving water support", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installCourseSceneFixture(page);
  await page.goto(`${ONLINE_ORIGIN}${COURSE_ROUTE}`);
  await page.waitForFunction(
    () => {
      const s = (window as any).three?.scene;
      return !!s?.getObjectByName("course-coastal-spring")?.material.userData.springFlow;
    },
    undefined,
    { timeout: 90000 },
  );
  const sample = () =>
    page.evaluate(() => {
      const m = (window as any).three.scene.getObjectByName("course-coastal-spring");
      return {
        time: m.material.userData.springFlow.uSpringFlowTime.value,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        renderFrame: (window as any).__stageFrameMetrics?.frame ?? 0,
        geometry: m.geometry.uuid,
        position: Array.from(m.geometry.attributes.position.array),
        flow: Array.from(m.geometry.attributes.springFlow.array),
      };
    });
  const waitForFlowFrame = async (previousFrame: number, previousTime?: number) => {
    await page.waitForFunction(
      ({ previousFrame: frame, previousTime: time }) => {
        const state = (window as any).three;
        const spring = state?.scene.getObjectByName("course-coastal-spring");
        const nextTime = spring?.material.userData.springFlow?.uSpringFlowTime?.value;
        const stageFrame = (window as any).__stageFrameMetrics?.frame ?? 0;
        return (
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
          stageFrame > frame &&
          typeof nextTime === "number" &&
          nextTime > (time ?? 0)
        );
      },
      { previousFrame, previousTime },
      { timeout: 5_000 },
    );
    return sample();
  };
  const a = await sample();
  expect(a.time).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const b = await waitForFlowFrame(a.renderFrame);
  const c = await waitForFlowFrame(b.renderFrame, b.time);
  expect(c.time).toBeGreaterThan(b.time);
  expect(b.time).toBeGreaterThan(0);
  expect(c.position).toEqual(a.position);
  expect(c.flow).toEqual(a.flow);
  expect(c.geometry).toBe(a.geometry);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    ({ previousFrame }) => {
      const spring = (window as any).three?.scene.getObjectByName("course-coastal-spring");
      const frame = (window as any).__stageFrameMetrics?.frame ?? 0;
      return (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
        frame > previousFrame &&
        spring?.material.userData.springFlow?.uSpringFlowTime?.value === 0
      );
    },
    { previousFrame: c.renderFrame },
    { timeout: 5_000 },
  );
  const d = await sample();
  expect(d.time).toBe(0);
  expect(d.position).toEqual(a.position);
  const folder = process.env.R50_EVIDENCE_DIR ?? "SCRATCH/e2e/spring-motion";
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, "spring-motion.json"),
    JSON.stringify(
      {
        url: page.url(),
        times: [a.time, b.time, c.time, d.time],
        samples: [a, b, c, d].map(({ geometry, position, flow, ...receipt }) => receipt),
        geometry: a.geometry,
        vertices: a.position.length / 3,
        positionsAndSupportUnchanged: true,
      },
      null,
      2,
    ),
  );
  errors.assertClean();
});
