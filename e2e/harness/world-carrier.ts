import { expect, type Page } from "@playwright/test";

/** Raycast the actual distant terrain beneath the waiting avatar. N06
 * deliberately replaces the former above-current-island default: with no
 * explicit choice it must remain outside real ground and visible labels.
 * Selected-island contact and movement are independently guarded in avatar.spec.
 */
export async function assertWorldCarrierAboveGround(page: Page) {
  await page.waitForFunction(() => {
    const bag = window as any;
    return (
      bag.three?.scene.getObjectByName("remote-island-terrain") &&
      bag.__avatarMotion?.world?.inFlight === false &&
      bag.__cloudCarrierMotion?.world?.inFlight === false
    );
  });
  const result = await page.evaluate(() => {
    const state = (window as any).three;
    const terrain = state.scene.getObjectByName("remote-island-terrain");
    const marker = state.scene.getObjectByName("learner-marker-world");
    state.scene.updateMatrixWorld(true);
    const feet = marker.getWorldPosition(state.camera.position.clone());
    const ray = new state.raycaster.constructor();
    ray.ray.origin.set(feet.x, 1000, feet.z);
    ray.ray.direction.set(0, -1, 0);
    const ground = ray.intersectObject(terrain, true)[0]?.point.y ?? null;
    const avatar = marker.getObjectByName("university-avatar-occlusion-target");
    if (!avatar) throw new Error("Actual avatar geometry is missing");
    terrain.geometry.computeBoundingBox();
    const bounds = terrain.geometry.boundingBox.clone().setFromObject(avatar);
    const canvas = state.gl.domElement.getBoundingClientRect();
    const corners = [];
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const point = feet.clone().set(x, y, z).project(state.camera);
          corners.push({
            x: canvas.left + ((point.x + 1) * canvas.width) / 2,
            y: canvas.top + ((1 - point.y) * canvas.height) / 2,
          });
        }
    const box = {
      left: Math.min(...corners.map((p) => p.x)),
      right: Math.max(...corners.map((p) => p.x)),
      top: Math.min(...corners.map((p) => p.y)),
      bottom: Math.max(...corners.map((p) => p.y)),
    };
    const labelBlockers = [...document.querySelectorAll("button.label--course.is-visible")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.left < box.right &&
          rect.right > box.left &&
          rect.top < box.bottom &&
          rect.bottom > box.top
        );
      })
      .map((element) => element.getAttribute("data-map-marker"));
    return {
      feet: feet.toArray(),
      ground,
      gap: ground === null ? null : feet.y - ground,
      avatarBounds: box,
      labelBlockers,
    };
  });
  expect(
    result.ground,
    "without a selection the waiting cloud must not occupy an island",
  ).toBeNull();
  expect(result.feet.every(Number.isFinite)).toBe(true);
  const viewport = page.viewportSize()!;
  expect(result.avatarBounds.right).toBeGreaterThan(0);
  expect(result.avatarBounds.left).toBeLessThan(viewport.width);
  expect(result.avatarBounds.bottom).toBeGreaterThan(0);
  expect(result.avatarBounds.top).toBeLessThan(viewport.height);
  expect(result.labelBlockers, "visible course names must not cover the actual player").toEqual([]);
  return result;
}
