import { type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { waitForCourseFraming } from "./course-overview.js";

export async function captureCourseShadowStudy(page: Page, folder: string) {
  if (process.env.R50_SHADOW_STUDY === "1") {
    await waitForCourseFraming(page);
    const initial = await page.evaluate(
      () => (window as any).three.scene.getObjectByName("map-key-light").shadow.radius,
    );
    const samples = [];
    try {
      for (const radius of [1, 2.5, 4]) {
        samples.push(
          await page.evaluate(async (radius) => {
            const s = (window as any).three,
              light = s.scene.getObjectByName("map-key-light");
            light.shadow.radius = radius;
            for (let f = 0; f < 6; f++) await new Promise(requestAnimationFrame);
            return {
              radius,
              camera: s.camera.matrixWorld.toArray(),
              projection: s.camera.projectionMatrix.toArray(),
              intensity: light.intensity,
              shadowIntensity: light.shadow.intensity,
              light: light.position.toArray(),
              geometry: s.scene.getObjectByName("island-terrain").geometry.uuid,
              shadowType: s.gl.shadowMap.type,
            };
          }, radius),
        );
        await page.screenshot({ path: join(folder, `penumbra-${radius}.png`) });
      }
      writeFileSync(join(folder, "penumbra-study.json"), JSON.stringify(samples, null, 2));
    } finally {
      await page.evaluate((radius) => {
        (window as any).three.scene.getObjectByName("map-key-light").shadow.radius = radius;
      }, initial);
    }
  }
  if (process.env.R49_SHADOW_STUDY !== "1") return;
  await waitForCourseFraming(page);
  const original = await page.evaluate(
    () => (window as any).three.scene.getObjectByName("map-key-light").shadow.intensity,
  );
  const receipts = [];
  try {
    for (const strength of [0.76, 0.64, 0.58]) {
      receipts.push(
        await page.evaluate(async (strength) => {
          const s = (window as any).three;
          const light = s.scene.getObjectByName("map-key-light");
          light.shadow.intensity = strength;
          for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame);
          return {
            strength,
            camera: s.camera.matrixWorld.toArray(),
            light: light.position.toArray(),
            intensity: light.intensity,
            terrain: s.scene.getObjectByName("island-terrain").geometry.uuid,
          };
        }, strength),
      );
      await page.screenshot({ path: join(folder, `shadow-${strength}.png`) });
    }
    writeFileSync(join(folder, "shadow-study.json"), JSON.stringify(receipts, null, 2));
  } finally {
    await page.evaluate((original) => {
      (window as any).three.scene.getObjectByName("map-key-light").shadow.intensity = original;
    }, original);
  }
}
