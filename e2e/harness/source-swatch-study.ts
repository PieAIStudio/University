import { expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** Source-isolation diagnostic: the exact R50 scalar formula versus the
 * retained tile data, in the SAME compiled material/camera/geometry/light.
 * It does not claim mode=0 is an unmodified-shader performance baseline.
 */
export async function captureSourceSwatchStudy(page: Page, folder: string) {
  if (process.env.R51_SWATCH_STUDY !== "1") return;
  const records = [];
  await page.evaluate(() => {
    const bag = window as any;
    const map =
      bag.three.scene.getObjectByName("island-terrain").material.userData.surfaceDetail
        .uSurfaceSwatch.value;
    if (!map?.image?.data) throw new Error("No committed swatch texture");
    bag.__sourceSwatchStudy = { map, data: map.image.data.slice() };
  });
  try {
    for (const mode of ["r50-sine", "retained-wear"] as const) {
      const record = await page.evaluate(async (mode) => {
        const bag = window as any,
          state = bag.three;
        const { map, data } = bag.__sourceSwatchStudy;
        map.image.data.set(data);
        if (mode === "r50-sine") {
          const size = map.image.width,
            tau = Math.PI * 2;
          for (let y = 0; y < size; y++)
            for (let x = 0; x < size; x++) {
              const u = ((x + 0.5) / size) * tau,
                v = ((y + 0.5) / size) * tau;
              const worn =
                0.5 +
                Math.sin(u + Math.sin(v) * 0.65) * Math.cos(v * 2 - Math.sin(u) * 0.3) * 0.22 +
                Math.cos(u * 3 + v * 2) * 0.065 +
                Math.sin(u * 9 - v * 7) * 0.018;
              const at = (y * size + x) * 4;
              map.image.data[at] = Math.round(worn * 255);
              map.image.data[at + 1] = Math.round((0.96 - worn * 0.12) * 255);
              map.image.data[at + 2] = Math.round((0.76 + worn * 0.24) * 255);
            }
        }
        map.needsUpdate = true;
        for (let i = 0; i < 12; i++) await new Promise(requestAnimationFrame);
        const key = state.scene.getObjectByName("map-key-light");
        return {
          camera: state.camera.matrixWorld.toArray().map((n: number) => Number(n.toFixed(7)) || 0),
          projection: state.camera.projectionMatrix.toArray(),
          light: [key.position.toArray(), key.intensity, key.shadow.intensity],
          geometry: ["island-terrain", "course-rock-outcrops"].map((name) => {
            const m = state.scene.getObjectByName(name);
            return [
              m.geometry.uuid,
              m.geometry.attributes.position.version,
              m.geometry.index.version,
            ];
          }),
          texture: map.uuid,
        };
      }, mode);
      records.push(record);
      await page.screenshot({ path: join(folder, `source-${mode}.png`) });
    }
    writeFileSync(
      join(folder, "source-swatch-study.json"),
      JSON.stringify(
        {
          modes: ["exact R50 sine swatch formula", "retained periodic wear"],
          records,
          scope:
            "Only packed scalar texture bytes differ; same terrain/rock geometry, camera, light and compiled shader. Live ordinary route, not a frozen screenshot scene.",
        },
        null,
        2,
      ),
    );
    expect(records[1]).toEqual(records[0]);
  } finally {
    await page.evaluate(() => {
      const bag = window as any,
        saved = bag.__sourceSwatchStudy;
      if (saved) {
        saved.map.image.data.set(saved.data);
        saved.map.needsUpdate = true;
      }
      delete bag.__sourceSwatchStudy;
    });
  }
}
