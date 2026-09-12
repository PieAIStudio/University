import type { Page } from "@playwright/test";

/** Check actual complete-tree instances against the canonical dressing plan.
 * Retired GLB downloads/crown names are not evidence of current readiness. */
export async function waitForCourseTrees(page: Page): Promise<number> {
  const handle = await page.waitForFunction(
    () => {
      const bag = window as any,
        state = bag.three;
      if (
        !state ||
        state.gl.domElement !== document.querySelector(".stagewrap:not([hidden]) canvas")
      )
        return false;
      const plan =
        state.scene.getObjectByName("island-dressing-course")?.userData.islandDressingPlan;
      if (!plan) return false;
      const expected = plan.placements.filter(
        (p: { assetId: string }) => p.assetId === "treeTrunks",
      ).length;
      const actual = ["course-fir-trees", "course-broadleaf-trees"].reduce(
        (sum, name) => sum + (state.scene.getObjectByName(name)?.count ?? 0),
        0,
      );
      return expected > 0 &&
        actual === expected &&
        bag.__stageFrameMetrics?.sceneUuid === state.scene.uuid &&
        bag.__stageFrameMetrics.full.calls > 0
        ? actual
        : false;
    },
    undefined,
    { timeout: 30_000 },
  );
  try {
    return (await handle.jsonValue()) as number;
  } finally {
    await handle.dispose();
  }
}
