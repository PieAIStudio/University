import { expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** Same rendered scene and normal camera; only the material uniform changes. */
export async function captureSurfaceMaterialStudy(page: Page, folder: string, prefix: string) {
  if (process.env.R47_MATERIAL_STUDY !== "1") return;
  const receipts: unknown[] = [];
  // Let the real control's inertia finish. Do not zero its velocity or assign
  // a camera transform merely to make a visual test pass.
  await page.mouse.move(2, 2);
  await page.evaluate(async () => {
    const camera = (window as any).three.camera;
    let previous = camera.matrixWorld.toArray(),
      stable = 0;
    for (let frame = 0; frame < 600; frame++) {
      await new Promise(requestAnimationFrame);
      const next = camera.matrixWorld.toArray();
      stable = next.every((v: number, i: number) => Math.abs(v - previous[i]) < 1e-10)
        ? stable + 1
        : 0;
      previous = next;
      if (stable >= 12) return;
    }
    throw new Error("Material study camera did not settle naturally");
  });
  try {
    for (const mode of [0, 1, 2]) {
      const receipt = await page.evaluate(async (mode) => {
        const state = (window as any).three;
        const targets = [
          "remote-island-terrain",
          "island-terrain",
          "course-rock-outcrops",
          "course-garden-flora",
        ]
          .map((name) => state.scene.getObjectByName(name))
          .filter((mesh) => mesh?.material?.userData?.surfaceDetail);
        if (!targets.length) throw new Error("No drawn surface-study material");
        for (const mesh of targets)
          mesh.material.userData.surfaceDetail.uSurfaceDetailMode.value = mode;
        for (let i = 0; i < 5; i++) await new Promise(requestAnimationFrame);
        const light = state.scene.getObjectByName("map-key-light");
        return {
          camera: state.camera.matrixWorld.toArray().map((v: number) => {
            const rounded = Number(v.toFixed(7));
            // IEEE -0 and +0 encode the same camera transform. Canonicalize
            // only signed zero, retaining the original 1e-7 precision gate.
            return rounded === 0 ? 0 : rounded;
          }),
          projection: state.camera.projectionMatrix.toArray(),
          light: [light.position.toArray(), light.intensity],
          surfaces: targets.map((mesh) => ({
            name: mesh.name,
            geometry: mesh.geometry.uuid,
            positionVersion: mesh.geometry.attributes.position.version,
            indexVersion: mesh.geometry.index.version,
            texture: mesh.material.userData.surfaceDetail.uSurfaceSwatch.value.uuid,
          })),
        };
      }, mode);
      receipts.push(receipt);
      await page.screenshot({ path: join(folder, `${prefix}-material-${mode}.png`) });
    }
    writeFileSync(
      join(folder, `${prefix}-material-study.json`),
      JSON.stringify(
        {
          modes: ["baseline", "colour only", "colour plus roughness and shallow relief"],
          invariant:
            "same geometry buffers, camera (1e-7 world-unit receipt precision), projection and light; ordinary live page",
          receipts,
        },
        null,
        2,
      ),
    );
    expect(receipts[1]).toEqual(receipts[0]);
    expect(receipts[2]).toEqual(receipts[0]);
  } finally {
    await page.evaluate(() => {
      (window as any).three.scene.traverse((mesh: any) => {
        const detail = mesh.material?.userData?.surfaceDetail;
        if (detail) detail.uSurfaceDetailMode.value = 2;
      });
    });
  }
}
