import { expect, type Page } from "@playwright/test";

/** Read what the current visible renderer actually contains, never a planned box. */
export async function courseOverviewEvidence(page: Page) {
  return page.evaluate(() => {
    const bag = window as any;
    const state = bag.three;
    const terrain = state?.scene.getObjectByName("island-terrain");
    if (!terrain) throw new Error("The current scene has no course terrain");
    terrain.updateWorldMatrix(true, false);
    const rect = state.gl.domElement.getBoundingClientRect();
    const positions = terrain.geometry.getAttribute("position");
    const points: { x: number; y: number; z: number }[] = [];
    const scratch = state.camera.position.clone();
    // Test the whole emitted top AND root. Cuboid corners in empty air are
    // not terrain and used to force a needlessly miniature overview.
    for (let i = 0; i < positions.count; i++) {
      const p = scratch
        .fromBufferAttribute(positions, i)
        .applyMatrix4(terrain.matrixWorld)
        .project(state.camera);
      points.push({
        x: rect.left + ((p.x + 1) * rect.width) / 2,
        y: rect.top + ((1 - p.y) * rect.height) / 2,
        z: p.z,
      });
    }
    const projected = {
      left: Math.min(...points.map((p) => p.x)),
      right: Math.max(...points.map((p) => p.x)),
      top: Math.min(...points.map((p) => p.y)),
      bottom: Math.max(...points.map((p) => p.y)),
    };
    const obstacles = [
      ...document.querySelectorAll<HTMLElement>(
        ".nav-rail, .counter-row, .app-shell__aside, .nextup, .tab-bar, .picked--left, .map-framing-tools, .hint:not(.hint--dismissed), .map-breadcrumbs, .map-world-style",
      ),
    ]
      .map((element) => ({ name: element.className, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0)
      .filter(
        ({ rect }) =>
          projected.left < rect.right &&
          projected.right > rect.left &&
          projected.top < rect.bottom &&
          projected.bottom > rect.top,
      )
      .map(({ name }) => name);
    return {
      geometryId: terrain.geometry.uuid,
      sceneId: state.scene.uuid,
      pointCount: points.length,
      projected,
      obstacles,
      entirelyVisible: points.every(
        (p) =>
          p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom && p.z < 1,
      ),
      camera: state.camera.position.toArray(),
      fov: state.camera.fov,
      far: state.camera.far,
      distance: bag.mapControls?.getDistance(),
      range: [bag.mapControls?.minDistance, bag.mapControls?.maxDistance],
      avatarTarget: bag.__avatarMotion?.course?.target,
    };
  });
}

export async function waitForCourseFraming(page: Page): Promise<void> {
  await page.evaluate(async () => {
    let previous: number[] = [],
      streak = 0;
    const bag = window as any;
    for (let i = 0; i < 180; i++) {
      await new Promise(requestAnimationFrame);
      const next: number[] = bag.three?.camera.position.toArray() ?? [];
      streak =
        next.length === 3 && next.every((n, j) => Math.abs(n - (previous[j] ?? Infinity)) < 0.001)
          ? streak + 1
          : 0;
      previous = next;
      if (streak >= 12) return;
    }
    throw new Error("Course camera failed to settle");
  });
}

export async function assertCompleteCourseOverview(page: Page) {
  await expect(page.locator('.stagewrap[data-map-view="overview"]')).toBeVisible();
  await waitForCourseFraming(page);
  const evidence = await courseOverviewEvidence(page);
  expect(
    evidence.entirelyVisible,
    "Top AND natural root must fit, not an empty sky or partial coast",
  ).toBe(true);
  expect(evidence.obstacles, "The actual island bounding box must clear opaque chrome").toEqual([]);
  expect(evidence.pointCount).toBeGreaterThan(100);
  expect(evidence.range[1] / evidence.range[0]).toBeLessThanOrEqual(3);
  return evidence;
}
