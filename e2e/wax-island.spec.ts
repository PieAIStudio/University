import { test, expect, type Page } from "@playwright/test";
import { ONLINE_ORIGIN } from "./ports.js";
import { LOCAL_ORIGIN } from "./ports.js";
import { writeFile } from "node:fs/promises";

const inspect = (page: Page) =>
  page
    .getByTestId("wax-viewport")
    .locator("canvas")
    .evaluate((node) => (node as HTMLCanvasElement & { __waxSlice: () => any }).__waxSlice());

test("wax slice: real island and avatar, matte rendering and exact classic restoration", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  const errorsPath = info.outputPath("browser-errors.json");
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(`${ONLINE_ORIGIN}/play-lab/wax-island?finish=classic&lang=zh-CN`);
  await expect(page.getByTestId("wax-island")).toHaveAttribute("data-ready", "true");
  await expect
    .poll(async () =>
      (await inspect(page)).meshes.some((m: any) => m.name === "course-garden-flora"),
    )
    .toBe(true);
  await expect
    .poll(async () => (await inspect(page)).meshes.some((m: any) => m.name === "body"))
    .toBe(true);
  await page.getByTestId("wax-pause").click();
  await page
    .getByTestId("wax-viewport")
    .screenshot({ path: info.outputPath("classic-island.png") });
  const classic = await inspect(page);
  await page.getByTestId("wax-on").click();
  await expect.poll(async () => (await inspect(page)).styled).toBeGreaterThan(0);
  await page.getByTestId("wax-viewport").screenshot({ path: info.outputPath("wax-island.png") });
  const wax = await inspect(page);
  const strongPixels = await page.getByTestId("wax-viewport").screenshot();
  const strength = page.getByRole("slider", { name: "蜡质强度" });
  await strength.fill("0.3");
  await expect.poll(async () => (await inspect(page)).strength).toBe(0.3);
  const lightPixels = await page
    .getByTestId("wax-viewport")
    .screenshot({ path: info.outputPath("wax-low-strength.png") });
  expect(strongPixels.equals(lightPixels)).toBe(false);
  expect((await inspect(page)).camera).toEqual(wax.camera);
  await strength.fill("1");
  await expect.poll(async () => (await inspect(page)).strength).toBe(1);
  expect(wax.course).toBe("browser-ai/run-a-real-project-with-ai");
  expect(wax.nodes).toEqual(classic.nodes);
  const warmed = wax.memory;
  for (let i = 0; i < 10; i++) {
    await page.getByTestId("wax-classic").click();
    await expect.poll(async () => (await inspect(page)).styled).toBe(0);
    await page.getByTestId("wax-on").click();
    await expect.poll(async () => (await inspect(page)).styled).toBe(wax.styled);
  }
  expect((await inspect(page)).memory).toEqual(warmed);
  expect(wax.camera).toEqual(classic.camera);
  expect(wax.scene).toBe(classic.scene);
  expect(wax.recipe).toBe(classic.recipe);
  expect(errors).toEqual([]);
  await page.getByTestId("wax-view-avatar").click();
  await page.getByTestId("wax-viewport").screenshot({ path: info.outputPath("wax-avatar.png") });
  await writeFile(errorsPath, JSON.stringify(errors, null, 2));
  expect(errors).toEqual([]);
  await page.getByTestId("wax-grade").uncheck();
  await page
    .getByTestId("wax-viewport")
    .screenshot({ path: info.outputPath("wax-avatar-no-grade.png") });
  const withScattering = await page.getByTestId("wax-viewport").screenshot();
  await page.getByTestId("wax-scattering").uncheck();
  await expect.poll(async () => (await inspect(page)).scattering).toBe(false);
  const withoutScattering = await page
    .getByTestId("wax-viewport")
    .screenshot({ path: info.outputPath("wax-avatar-scattering-off.png") });
  expect(withScattering.equals(withoutScattering)).toBe(false);
  await page.getByTestId("wax-scattering").check();
  await page.getByTestId("wax-grade").check();
  await page.getByTestId("wax-classic").click();
  await expect.poll(async () => (await inspect(page)).styled).toBe(0);
  await page
    .getByTestId("wax-viewport")
    .screenshot({ path: info.outputPath("classic-avatar.png") });
  await page.getByTestId("wax-view-island").click();
  const restored = await inspect(page);
  expect(
    restored.meshes.map((m: any) => [m.id, m.geometry, m.materials.map((v: any) => v.id)]),
  ).toEqual(classic.meshes.map((m: any) => [m.id, m.geometry, m.materials.map((v: any) => v.id)]));
  await info.attach("material-identities", {
    body: JSON.stringify({ classic, wax, restored }, null, 2),
    contentType: "application/json",
  });
  await writeFile(
    info.outputPath("comparison.json"),
    JSON.stringify({ classic, wax, restored }, null, 2),
  );
  await page.getByTestId("wax-on").click();
  await page.getByTestId("wax-view-detail").click();
  await page.getByTestId("wax-viewport").screenshot({ path: info.outputPath("wax-detail.png") });
  await page.screenshot({ path: info.outputPath("whole-page.png"), fullPage: true });
  await writeFile(errorsPath, JSON.stringify(errors, null, 2));
  expect(errors).toEqual([]);
});

for (const sample of [
  { width: 320, locale: "zh-CN", origin: ONLINE_ORIGIN },
  { width: 390, locale: "en", origin: LOCAL_ORIGIN },
])
  test(`wax slice: ${sample.width}px ${sample.locale} touch has clear controls and unchanged avatar`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: sample.width, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
      colorScheme: "dark",
    });
    try {
      const page = await context.newPage(),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${sample.origin}/play-lab/wax-island?lang=${sample.locale}`);
      await expect(page.getByTestId("wax-island")).toHaveAttribute("data-ready", "true");
      await expect
        .poll(async () => (await inspect(page)).meshes.some((m: any) => m.name === "body"))
        .toBe(true);
      await page.getByTestId("wax-view-avatar").tap();
      await page.getByTestId("wax-pause").tap();
      await page
        .getByTestId("wax-viewport")
        .screenshot({ path: info.outputPath("wax-avatar-phone.png") });
      const before = await inspect(page);
      await page.getByTestId("wax-classic").tap();
      await expect.poll(async () => (await inspect(page)).styled).toBe(0);
      const classic = await inspect(page);
      expect(classic.camera).toEqual(before.camera);
      expect(classic.recipe).toBe(before.recipe);
      await page
        .getByTestId("wax-viewport")
        .screenshot({ path: info.outputPath("classic-avatar-phone.png") });
      await page.getByTestId("wax-on").tap();
      await page.getByTestId("wax-view-island").tap();
      await page.screenshot({ path: info.outputPath("wax-phone-page.png"), fullPage: true });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1);
      const buttons = await page.locator(".wax-island__toolbar button").evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return { width: r.width, height: r.height, overflow: n.scrollWidth - n.clientWidth };
        }),
      );
      for (const b of buttons) {
        expect(b.width).toBeGreaterThanOrEqual(44);
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.overflow).toBeLessThanOrEqual(1);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("wax slice: real controls move the avatar, orbit and recover without writing learning state", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${ONLINE_ORIGIN}/play-lab/wax-island?lang=en`);
  await expect(page.getByTestId("wax-island")).toHaveAttribute("data-ready", "true");
  await expect
    .poll(async () => (await inspect(page)).meshes.some((m: any) => m.name === "body"))
    .toBe(true);
  const before = await inspect(page);
  const storageBefore = await page.evaluate(() =>
    Object.fromEntries(
      Object.entries(localStorage).filter(([k]) => /progress|account|avatar/i.test(k)),
    ),
  );
  const select = page.getByRole("combobox", { name: "Inspect lesson" });
  const second = await select.locator("option").nth(1).getAttribute("value");
  await select.selectOption(second!);
  await expect.poll(async () => (await inspect(page)).selected).toBe(second);
  await expect
    .poll(async () => JSON.stringify((await inspect(page)).avatarPosition))
    .not.toBe(JSON.stringify(before.avatarPosition));
  await page.getByTestId("wax-pause").click();
  const board = page.getByTestId("wax-viewport");
  await board.scrollIntoViewIfNeeded();
  const box = (await board.boundingBox())!;
  const camera = (await inspect(page)).camera;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.66, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => JSON.stringify((await inspect(page)).camera))
    .not.toBe(JSON.stringify(camera));
  const frozen = await inspect(page);
  await page.waitForTimeout(200);
  expect((await inspect(page)).time).toBe(frozen.time);
  await board.screenshot({ path: info.outputPath("orbited-paused.png") });
  const lost = await board.locator("canvas").evaluate((node) => {
    const gl = (node as HTMLCanvasElement).getContext("webgl2");
    const extension = gl?.getExtension("WEBGL_lose_context");
    extension?.loseContext();
    return Boolean(extension);
  });
  expect(lost).toBe(true);
  await expect(page.getByRole("button", { name: "Reopen 3D", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reopen 3D", exact: true }).click();
  await expect(page.getByTestId("wax-island")).toHaveAttribute("data-ready", "true");
  await expect.poll(async () => (await inspect(page)).styled).toBeGreaterThan(0);
  const recovered = await inspect(page);
  expect(recovered.selected).toBe(second);
  expect(recovered.recipe).toBe(before.recipe);
  const storageAfter = await page.evaluate(() =>
    Object.fromEntries(
      Object.entries(localStorage).filter(([k]) => /progress|account|avatar/i.test(k)),
    ),
  );
  expect(storageAfter).toEqual(storageBefore);
  await writeFile(
    info.outputPath("lifecycle.json"),
    JSON.stringify({ before, frozen, recovered }, null, 2),
  );
});
