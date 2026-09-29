import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "./harness/learner-test.js";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";
import { watchConsole } from "./harness/console.js";
const folder = "SCRATCH/e2e/cosmetics";
async function capture(page: Page, name: string) {
  mkdirSync(folder, { recursive: true });
  await page.screenshot({ path: `${folder}/${name}.png` });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    (await page.evaluate(() => innerWidth)) + 1,
  );
}
for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  for (const width of [1440, 390])
    test(`${mode} ${width}: wardrobe states the release boundary and odds, never calls an unopened service`, async ({
      page,
    }) => {
      const errors = watchConsole(page);
      const requests: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/rpc/cosmetics")) requests.push(request.url());
      });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/wardrobe?lang=zh-CN`);
      await expect(page.locator('[data-cosmetics-phase="closed"]')).toBeVisible();
      await expect(page.locator("[data-cosmetic-open]")).toHaveCount(0);
      await expect(page.locator(".cosmetic-odds dd")).toHaveText(["70%", "22%", "7%", "1%"]);
      await noOverflow(page);
      await capture(page, `${mode}-${width}-closed`);
      await page.locator(".cosmetics-panel > button").click();
      await expect(page).toHaveURL(/\/me(?:\?|$)/);
      expect(requests).toEqual([]);
      errors.assertClean();
    });
}
for (const width of [1440, 390])
  test(`synthetic ${width}: lost response recovers one pack, ordered reveal and equipped receipts survive closing`, async ({
    page,
  }) => {
    const errors = watchConsole(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${ONLINE_ORIGIN}/e2e-fixtures/cosmetics.html?lost`);
    await expect(page.locator('[data-cosmetics-phase="ready"]')).toBeVisible();
    await page.locator("[data-cosmetic-open]").click();
    await expect(page.locator('[data-cosmetic-error="network"]')).toBeVisible();
    await expect(page.locator("[data-cosmetic-open]")).toBeDisabled();
    await page.locator("[data-cosmetic-retry]").click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    for (let index = 0; index < 3; index++) {
      await expect(dialog.locator("[data-cosmetic-reveal]")).toHaveAttribute(
        "data-cosmetic-reveal",
        String(index),
      );
      const card = dialog.locator(".game-ui-collect-card");
      await expect(card).toHaveAttribute("aria-pressed", "true");
      await card.focus();
      await page.keyboard.press("Enter");
      await expect(card).toHaveAttribute("aria-pressed", "false");
      await card.evaluate(async (element) => {
        element.getBoundingClientRect();
        await Promise.all(
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
            .map((animation) => animation.finished),
        );
      });
      if (index === 2) {
        await expect(card).toHaveClass(/legendary/);
        await noOverflow(page);
        await capture(page, `synthetic-${width}-reveal`);
      }
      await dialog.locator(".cosmetic-reveal > button").last().click();
    }
    await expect(dialog).toHaveCount(0);
    const operations = await page.evaluate(() => (window as any).__cosmeticsFixture.operations);
    expect(operations).toHaveLength(2);
    expect(operations[0]).toEqual(operations[1]);
    const face = page.locator('[data-cosmetic-item="face-harbour"]');
    await face.getByRole("button").click();
    await expect(face).toHaveAttribute("data-cosmetic-equipped", "true");
    await expect(page.locator('[data-card-face-cosmetic="face-harbour"]')).toBeVisible();
    const island = page.locator('[data-cosmetic-item="island-crystal"]');
    await island.getByRole("button").click();
    await expect(island).toHaveAttribute("data-cosmetic-owned", "true");
    await island.getByRole("button").click();
    await expect(island).toHaveAttribute("data-cosmetic-equipped", "true");
    await page.locator('[data-cosmetic-item="avatar-flower"]').getByRole("button").click();
    await expect(page.locator('[data-cosmetic-item="avatar-flower"]')).toHaveAttribute(
      "data-cosmetic-equipped",
      "true",
    );
    await noOverflow(page);
    await capture(page, `synthetic-${width}-inventory`);
    await page.locator("[data-fixture-scene]").click();
    await expect(page.locator('.cosmetic-fixture__scene[data-scene-ready="true"]')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean((window as any).three?.scene.getObjectByName("cosmetic:island-crystal")),
        ),
      )
      .toBe(true);
    await page.locator(".cosmetic-fixture__scene").scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const world = (window as any).three;
      const ornament = world.scene.getObjectByName("cosmetic:island-crystal");
      const target = ornament.position.clone();
      const from = target.clone().add({ x: 3, y: 3, z: 4 });
      world.scene.userData.cameraOverride = { from, look: target };
      world.camera.position.copy(from);
      world.camera.lookAt(target);
      world.invalidate();
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await capture(page, `synthetic-${width}-island`);
    await page.evaluate(() => {
      const mesh = (window as any).three.scene.getObjectByName("cosmetic:island-crystal");
      const disposed = { geometry: false, material: false };
      (window as any).__cosmeticsDisposed = disposed;
      mesh.geometry.addEventListener("dispose", () => {
        disposed.geometry = true;
      });
      mesh.material.addEventListener("dispose", () => {
        disposed.material = true;
      });
    });
    await page.locator("[data-fixture-switch]").click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__cosmeticsFixture.snapshot().owner))
      .toBe("00000000-0000-4000-8000-000000000012");
    await expect(page.locator('[data-cosmetic-equipped="true"]')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean((window as any).three?.scene.getObjectByName("cosmetic:island-crystal")),
        ),
      )
      .toBe(false);
    await expect
      .poll(() => page.evaluate(() => (window as any).__cosmeticsDisposed))
      .toEqual({ geometry: true, material: true });
    errors.assertClean();
  });
