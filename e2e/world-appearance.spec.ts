import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";
import { waitForCourseFraming, assertCompleteCourseOverview } from "./harness/course-overview.js";
import { watchConsole } from "./harness/console.js";
import { measureStageGpu } from "./harness/stage-gpu-timing.js";

const OUTPUT = process.env.R55_EVIDENCE_DIR ?? "SCRATCH/e2e/world-appearance";
type Style = "classic" | "clay";
async function settled(page: Page, style: Style) {
  await page.waitForFunction((value) => {
    const canvases = Array.from(document.querySelectorAll("canvas")) as Array<
      HTMLCanvasElement & { __worldAppearanceInspect?: () => any }
    >;
    const visible = canvases.filter((c) => c.getBoundingClientRect().width > 0);
    return (
      visible.length > 0 &&
      visible.every((c) => {
        if (!c.__worldAppearanceInspect) return false;
        const r = c.__worldAppearanceInspect();
        return (
          r.eligibleCount > 0 &&
          r.style === value &&
          r.styledCount === (value === "clay" ? r.eligibleCount : 0)
        );
      })
    );
  }, style);
  await page.evaluate(async () => {
    for (let i = 0; i < 5; i++) await new Promise(requestAnimationFrame);
  });
}
async function choose(page: Page, style: Style) {
  const button = page.locator(`[data-world-style-choice="${style}"]:visible`).first();
  await expect(button).toBeVisible();
  const hit = await button.evaluate((element) => {
    const r = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });
  expect(hit, "the style button must be genuinely reachable, not behind shell chrome").toBe(true);
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await settled(page, style);
}
async function receipt(page: Page) {
  return page.evaluate(() => {
    const state = (window as any).three;
    const canvases = Array.from(document.querySelectorAll("canvas")) as any[];
    const inspected = canvases
      .filter((c) => c.getBoundingClientRect().width > 0 && c.__worldAppearanceInspect)
      .map((c) => c.__worldAppearanceInspect());
    const course = state?.scene.getObjectByName("island-course")?.userData.islandBlueprint;
    const landscape = state?.scene.getObjectByName("course-landscape")?.userData.landscapeReport;
    const raw = localStorage.getItem("university.progress.v2");
    const progress = raw ? JSON.parse(raw) : null;
    return {
      url: location.href,
      camera: state?.camera.matrixWorld.toArray(),
      canvases: inspected,
      landscape,
      nodes: course?.nodes,
      frame: (window as any).__stageFrameMetrics?.full,
      accountStyle: progress?.account?.preferences?.worldStyle,
      avatarRecipe: progress?.account?.preferences?.avatarRecipe ?? null,
      uiTheme: progress?.account?.preferences?.theme ?? "system",
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
}
const geometryIdentity = (r: Awaited<ReturnType<typeof receipt>>) =>
  r.canvases.map((c: any) => ({
    scene: c.scene,
    meshes: c.meshes.map((m: any) => [m.id, m.name, m.geometry]),
  }));
const materialIdentity = (r: Awaited<ReturnType<typeof receipt>>) =>
  r.canvases.map((c: any) => c.meshes.map((m: any) => m.materials.map((v: any) => v.id)));
const resourceCounts = (r: Awaited<ReturnType<typeof receipt>>) =>
  r.canvases.map((c: any) => [c.materialCount, c.programs, c.textures]);

for (const sample of [
  {
    name: "short-delivery",
    origin: ONLINE_ORIGIN,
    route: "/browser-ai/run-a-real-project-with-ai",
    flora: 12,
    width: 1440,
    height: 900,
    locale: "zh-CN",
    reduce: false,
  },
  {
    name: "long-delivery",
    origin: ONLINE_ORIGIN,
    route: "/ai-literacy/understanding-ai",
    flora: 71,
    width: 1440,
    height: 900,
    locale: "en",
    reduce: true,
  },
  {
    name: "phone-authoring",
    origin: LOCAL_ORIGIN,
    route: "/ai-literacy/ai-for-real-life",
    flora: 69,
    width: 375,
    height: 812,
    locale: "zh-CN",
    reduce: true,
  },
]) {
  test(`R55 ${sample.name}: same world, all scenery retained, reversible clay and no rebuild`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: sample.width, height: sample.height });
    await page.emulateMedia({
      colorScheme: "dark",
      reducedMotion: sample.reduce ? "reduce" : "no-preference",
    });
    const errors = watchConsole(page);
    const folder = join(OUTPUT, sample.name);
    mkdirSync(folder, { recursive: true });
    await page.goto(`${sample.origin}${sample.route}?lang=${sample.locale}`);
    await page.waitForFunction(
      () => {
        const bag = window as any,
          s = bag.three;
        return (
          s?.scene.getObjectByName("course-landscape") &&
          s.scene.getObjectByName("island-dressing-course")?.userData.islandDressingReady &&
          bag.__stageFrameMetrics?.sceneUuid === s.scene.uuid &&
          !document.querySelector(".loading-trivia")
        );
      },
      undefined,
      { timeout: 90000 },
    );
    await settled(page, "classic");
    await waitForCourseFraming(page);
    const original = await receipt(page);
    expect(original.landscape.floraCount).toBe(sample.flora);
    // The narrow shell has no persistent avatar canvas; all canvases it does
    // mount are still required by settled(), rather than inventing another.
    expect(original.canvases.length).toBeGreaterThanOrEqual(sample.width >= 768 ? 2 : 1);
    await page.screenshot({ path: join(folder, "classic.png") });
    await choose(page, "clay");
    const clay = await receipt(page);
    expect(geometryIdentity(clay)).toEqual(geometryIdentity(original));
    expect(clay.camera).toEqual(original.camera);
    expect(clay.landscape).toEqual(original.landscape);
    expect(clay.nodes).toEqual(original.nodes);
    expect(clay.avatarRecipe).toBe(original.avatarRecipe);
    expect(clay.uiTheme).toBe(original.uiTheme);
    expect(clay.accountStyle).toBe("clay");
    expect(clay.frame).toEqual(original.frame);
    await page.screenshot({ path: join(folder, "clay.png") });
    const gpu = process.env.R55_MEASURE_GPU === "1" ? await measureStageGpu(page) : null;
    for (let i = 0; i < 10; i++) {
      await choose(page, "classic");
      await choose(page, "clay");
    }
    const repeated = await receipt(page);
    expect(resourceCounts(repeated)).toEqual(resourceCounts(clay));
    expect(geometryIdentity(repeated)).toEqual(geometryIdentity(original));
    await choose(page, "classic");
    const restored = await receipt(page);
    expect(materialIdentity(restored)).toEqual(materialIdentity(original));
    expect(geometryIdentity(restored)).toEqual(geometryIdentity(original));
    expect(restored.overflow).toBeLessThanOrEqual(1);
    await choose(page, "clay");
    const overview = page.getByRole("button", {
      name: sample.locale === "en" ? "Course island overview" : "总览课程岛",
      exact: true,
    });
    await overview.click();
    await assertCompleteCourseOverview(page);
    await page.screenshot({ path: join(folder, "clay-overview.png") });
    await page.reload();
    await page.waitForFunction(
      () => {
        const s = (window as any).three;
        return (
          s?.scene.getObjectByName("course-landscape") &&
          s.scene.getObjectByName("island-dressing-course")?.userData.islandDressingReady
        );
      },
      undefined,
      { timeout: 90000 },
    );
    await settled(page, "clay");
    expect((await receipt(page)).landscape.floraCount).toBe(sample.flora);
    const icon = page.locator("button.label--icon.is-visible").first();
    await icon.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    writeFileSync(
      join(folder, "receipt.json"),
      JSON.stringify({ original, clay, repeated, restored, gpu }, null, 2),
    );
    errors.assertClean();
  });
}

test("R55 one choice reaches the globe, series, profile, settings and avatar workshop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = watchConsole(page);
  const folder = join(OUTPUT, "all-surfaces");
  mkdirSync(folder, { recursive: true });
  await page.goto(`${ONLINE_ORIGIN}/planet?lang=en`);
  await settled(page, "classic");
  await choose(page, "clay");
  await page.screenshot({ path: join(folder, "planet-clay.png") });
  const outputs: unknown[] = [];
  for (const [name, path] of [
    ["series", "/"],
    ["profile", "/me"],
    ["settings", "/settings"],
    ["avatar-workshop", "/avatar-lab"],
  ]) {
    await page.goto(`${ONLINE_ORIGIN}${path}?lang=en`);
    if (name === "avatar-workshop") {
      const stage = await page.locator(".avatar-lab__stage").boundingBox();
      expect(stage).not.toBeNull();
      expect(stage!.height).toBeGreaterThan(300);
      expect(stage!.y + stage!.height).toBeLessThanOrEqual(900);
      await page.waitForFunction(() => {
        const c = document.querySelector(".avatar-lab canvas") as any;
        return c?.__worldAppearanceInspect?.().meshes.some((m: any) => m.name === "body");
      });
    }
    await settled(page, "clay");
    const current = await receipt(page);
    expect(current.overflow).toBeLessThanOrEqual(1);
    outputs.push({ name, ...current });
    await page.screenshot({ path: join(folder, `${name}-clay.png`) });
  }
  const before = await receipt(page);
  await choose(page, "classic");
  const classic = await receipt(page);
  await page.screenshot({ path: join(folder, "avatar-workshop-classic.png") });
  await choose(page, "clay");
  const after = await receipt(page);
  expect(geometryIdentity(after)).toEqual(geometryIdentity(before));
  expect(geometryIdentity(classic)).toEqual(geometryIdentity(before));
  expect(after.avatarRecipe).toBe(before.avatarRecipe);
  expect(after.canvases.map((c: any) => c.camera)).toEqual(
    before.canvases.map((c: any) => c.camera),
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await settled(page, "clay");
  const phoneStage = await page.locator(".avatar-lab__stage").boundingBox();
  expect(phoneStage).not.toBeNull();
  expect(phoneStage!.height).toBeGreaterThanOrEqual(220);
  expect(phoneStage!.y + phoneStage!.height).toBeLessThanOrEqual(812);
  await page.locator('[data-world-style-choice="classic"]:visible').first().click();
  await settled(page, "classic");
  await page.screenshot({ path: join(folder, "avatar-workshop-phone.png") });
  expect((await receipt(page)).overflow).toBeLessThanOrEqual(1);
  writeFileSync(
    join(folder, "receipt.json"),
    JSON.stringify({ outputs, before, classic, after }, null, 2),
  );
  errors.assertClean();
});
