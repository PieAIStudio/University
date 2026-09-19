import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ONLINE_ORIGIN } from "./ports.js";
import {
  CATALOGUE_ROLES,
  coursePathOf,
  installSingleCourseShelfFixture,
} from "./harness/catalogue.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";

const COURSE = CATALOGUE_ROLES.settlement.course;
const STUDY = CATALOGUE_ROLES.settlement.study;

test("Y a real one-course archipelago retains identity and readable atmosphere", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await installSingleCourseShelfFixture(page, COURSE);
  await page.goto(`${ONLINE_ORIGIN}${coursePathOf(COURSE)}`);
  const back = page.getByRole("button", { name: new RegExp(`回到.*${STUDY.title}.*地图`) });
  await expect(back).toBeVisible({ timeout: 90000 });
  await humanClick(page, back, "回到单课程飞岛群");
  await page.waitForFunction(
    () => (window as any).three?.scene.getObjectByName("remote-island-field"),
    undefined,
    { timeout: 90000 },
  );
  const probe = await page.evaluate(async () => {
    const state = (window as any).three,
      mesh = state.scene.getObjectByName("remote-island-terrain");
    const records: unknown[] = [],
      old = mesh.onAfterRender;
    mesh.onAfterRender = function (...args: any[]) {
      old.apply(this, args);
      if (records.length < 6)
        records.push({
          actualScene: args[1].uuid,
          fog: args[1].fog ? { density: args[1].fog.density, kind: args[1].fog.type } : null,
        });
    };
    try {
      for (let f = 0; f < 10; f++) await new Promise(requestAnimationFrame);
    } finally {
      mesh.onAfterRender = old;
    }
    const parents = [];
    let parent = mesh;
    while (parent) {
      parents.push({
        name: parent.name,
        uuid: parent.uuid,
        type: parent.type,
        fog: parent.fog ? { density: parent.fog.density } : null,
      });
      parent = parent.parent;
    }
    return {
      records,
      parents,
      stateScene: state.scene.uuid,
      visibleCanvas:
        document.querySelector(".stagewrap:not([hidden]) canvas") === state.gl.domElement,
    };
  });
  const diagnostics = process.env.R50_EVIDENCE_DIR ?? "SCRATCH/e2e/small-catalogue";
  mkdirSync(diagnostics, { recursive: true });
  writeFileSync(join(diagnostics, "fog-diagnostic.json"), JSON.stringify(probe, null, 2));
  await page.waitForFunction(
    () => {
      const state = (window as any).three;
      const s = state?.scene;
      return (
        s?.getObjectByName("remote-island-field")?.userData.remoteIslandIds?.length === 1 &&
        document.querySelector(".stagewrap:not([hidden]) canvas") === state.gl.domElement &&
        (window as any).__stageFrameMetrics?.sceneUuid === s.uuid &&
        s.fog?.isFogExp2 &&
        !document.querySelector(".loading-trivia")
      );
    },
    undefined,
    { timeout: 90000 },
  );
  await page.waitForTimeout(1800);
  const receipt = await page.evaluate(() => {
    const s = (window as any).three;
    const ids = s.scene.getObjectByName("remote-island-field").userData.remoteIslandIds;
    const fog = s.scene.fog;
    return {
      ids,
      url: location.href,
      fogDensity: fog.density,
      hazeAtArrival: 1 - Math.exp(-Math.pow(fog.density * 62, 2)),
      breadcrumb: document.querySelector('[aria-label="当前位置"]')?.textContent,
      mapSurface: document.querySelector('[data-map-surface="true"]') != null,
      mapInformation: document.querySelector(".map-information")?.textContent,
      persistentStudySwitcher: document.querySelector(".study-switcher__trigger") != null,
      frame: (window as any).__stageFrameMetrics,
    };
  });
  expect(receipt.ids).toEqual([`${COURSE.studyId}/${COURSE.id}`]);
  expect(receipt.hazeAtArrival).toBeLessThan(0.08);
  expect(receipt.breadcrumb).toContain(STUDY.title);
  expect(receipt.mapSurface).toBe(true);
  expect(receipt.mapInformation).toContain(STUDY.title);
  expect(receipt.persistentStudySwitcher).toBe(false);
  const folder = process.env.R50_EVIDENCE_DIR ?? "SCRATCH/e2e/small-catalogue";
  mkdirSync(folder, { recursive: true });
  await page.screenshot({ path: join(folder, "one-course-world.png") });
  writeFileSync(join(folder, "one-course-world.json"), JSON.stringify(receipt, null, 2));
  errors.assertClean();
});
