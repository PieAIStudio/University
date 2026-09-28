import { expect, test } from "@playwright/test";
import { worldCarrierIsHome } from "./world-carrier.js";

test("carrier idle receipts must belong to the cleared selection", async ({ page }) => {
  // Isolated predicate regression, not a substitute for F's actual terrain raycast.
  await page.evaluate(() => {
    Object.assign(window, {
      three: { scene: { getObjectByName: () => ({}) } },
      __avatarMotion: { world: { inFlight: false, targetKey: "previous-island" } },
      __cloudCarrierMotion: { world: { inFlight: false, targetKey: "previous-island" } },
    });
  });
  expect(await page.evaluate(worldCarrierIsHome)).toBe(false);
  await page.evaluate(() => {
    const bag = window as any;
    bag.__avatarMotion.world = { inFlight: false, targetKey: null };
  });
  expect(await page.evaluate(worldCarrierIsHome)).toBe(false);
  await page.evaluate(() => {
    const bag = window as any;
    bag.__cloudCarrierMotion.world = { inFlight: true, targetKey: null };
  });
  expect(await page.evaluate(worldCarrierIsHome)).toBe(false);
  await page.evaluate(() => {
    const bag = window as any;
    bag.__cloudCarrierMotion.world.inFlight = false;
  });
  expect(await page.evaluate(worldCarrierIsHome)).toBe(true);
});
