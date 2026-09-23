import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";
import { waitForCourseFraming, assertCompleteCourseOverview } from "./harness/course-overview.js";
import {
  enterableLessonMarker,
  openMapQuickActions,
  runMapCommand,
} from "./harness/map-actions.js";
import { watchConsole } from "./harness/console.js";
import { measureStageGpu } from "./harness/stage-gpu-timing.js";

import { scrollIntoView } from "./harness/click.js";
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
  // The learner map keeps no permanent chrome, so the appearance switch is an
  // on-demand command in the same palette as the other map actions. Settings
  // holds the identical control; both write the one account preference. Choose
  // it here so the page is never reloaded and the scene is restyled in place.
  let button = page.locator(`[data-world-style-choice="${style}"]:visible`).first();
  let palette: Locator | null = null;
  if ((await button.count()) === 0) {
    palette = await openMapQuickActions(page);
    button = palette.locator(`[data-world-style-choice="${style}"]`).first();
  }
  await expect(button).toBeVisible();
  // A short landscape palette scrolls; a learner scrolls to the command before
  // pressing it. Reachability is judged where the press actually lands.
  await scrollIntoView(button);
  const hit = await button.evaluate((element) => {
    const r = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });
  expect(hit, "the style button must be genuinely reachable, not behind shell chrome").toBe(true);
  const layout = await button.evaluate((element) => {
    const r = element.getBoundingClientRect();
    const host = element.closest(".stagewrap, .planet-stage");
    const canvas = host?.querySelector("canvas")?.getBoundingClientRect();
    const feedback = document.querySelector(".feedback-note__open--float")?.getBoundingClientRect();
    const overlaps = (other: DOMRect | undefined) =>
      Boolean(
        other &&
        other.width > 0 &&
        Math.min(r.right, other.right) - Math.max(r.left, other.left) > 0.5 &&
        Math.min(r.bottom, other.bottom) - Math.max(r.top, other.top) > 0.5,
      );
    return {
      inMap: Boolean(host),
      height: r.height,
      canvasOverlap: overlaps(canvas),
      feedbackOverlap: overlaps(feedback),
    };
  });
  if (layout.inMap) {
    expect(layout.height).toBeGreaterThanOrEqual(44);
    expect(layout.canvasOverlap, "style controls own a real lane outside projected lessons").toBe(
      false,
    );
    expect(layout.feedbackOverlap, "style and feedback must never overlap").toBe(false);
  }
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  if (palette) {
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
  }
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
const geometryIdentity = (r: Awaited<ReturnType<typeof receipt>>, source = false) =>
  r.canvases.map((c: any) => ({
    scene: c.scene,
    meshes: c.meshes.map((m: any) => [m.id, m.name, source ? m.sourceGeometry : m.geometry]),
  }));
const SHAPED = new Set([
  "course-bush-crowns",
  "course-rock-outcrops",
  "course-fir-trees",
  "course-broadleaf-trees",
]);
function expectBoundedViews(r: Awaited<ReturnType<typeof receipt>>) {
  for (const canvas of r.canvases) {
    expect(canvas.ownedGeometries).toBeLessThanOrEqual(4);
    for (const mesh of canvas.meshes) {
      if (!SHAPED.has(mesh.name)) {
        expect(mesh.geometry).toBe(mesh.sourceGeometry);
        expect(mesh.geometryKind).toBeNull();
      } else {
        expect(mesh.geometry).not.toBe(mesh.sourceGeometry);
        expect(mesh.triangles).toBeLessThanOrEqual(
          mesh.sourceTriangles * (mesh.geometryKind === "stone" ? 4 : 1),
        );
      }
    }
  }
}
const materialIdentity = (r: Awaited<ReturnType<typeof receipt>>) =>
  r.canvases.map((c: any) => c.meshes.map((m: any) => m.materials.map((v: any) => v.id)));
const resourceCounts = (r: Awaited<ReturnType<typeof receipt>>) =>
  r.canvases.map((c: any) => [
    c.materialCount,
    c.programs,
    c.textures,
    c.ownedGeometries,
    c.ownedVertices,
  ]);

for (const sample of [
  {
    name: "short-delivery",
    origin: ONLINE_ORIGIN,
    route: "/browser-ai/run-a-real-project-with-ai",
    // 12 until 2026-09-23: an interior copse added 6 trees and 9 shrubs to this
    // island's bare west side, and one meadow flower now yields to a trunk.
    // 11 until R58-04 the same day: denser interior groves take two more.
    flora: 9,
    width: 1440,
    height: 900,
    locale: "zh-CN",
    reduce: false,
  },
  {
    // 71 until 2026-09-23: the interior groves added 12 trees and 21 shrubs
    // to this island, and three meadow flowers now yield to their trunks.
    // 68 until R58-01 the same day: lesson stones moved along the road to give
    // each checkpoint gate a wider gap, and one more flower yields to them.
    // 67 until R58-04: denser interior groves take two more.
    name: "long-delivery",
    origin: ONLINE_ORIGIN,
    route: "/ai-literacy/understanding-ai",
    flora: 65,
    width: 1440,
    height: 900,
    locale: "en",
    reduce: true,
  },
  {
    name: "landscape-delivery",
    origin: ONLINE_ORIGIN,
    route: "/browser-ai/run-a-real-project-with-ai",
    // 12 until 2026-09-23: an interior copse added 6 trees and 9 shrubs to this
    // island's bare west side, and one meadow flower now yields to a trunk.
    // 11 until R58-04 the same day: denser interior groves take two more.
    flora: 9,
    width: 872,
    height: 286,
    locale: "en",
    reduce: true,
  },
  {
    name: "phone-authoring",
    origin: LOCAL_ORIGIN,
    route: "/ai-literacy/ai-for-real-life",
    // 69 until R58-01 (2026-09-23): lesson stones moved along the road to give
    // each checkpoint gate a wider gap, and one flower yields to them.
    // 68 until R58-04: with denser interior groves the landscape plan places
    // 72 here (it rose on this island while it fell on the two above).
    flora: 72,
    width: 375,
    height: 812,
    locale: "zh-CN",
    reduce: true,
  },
]) {
  test(`R56 ${sample.name}: canonical world retained, bounded clay views and exact classic return`, async ({
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
    // The portrait and short-landscape chrome omit the persistent avatar.
    // Keep the original desktop two-canvas floor; settled() still requires
    // every actually mounted canvas to adopt the choice in every sample.
    expect(original.canvases.length).toBeGreaterThanOrEqual(
      sample.width >= 768 && sample.height > 420 ? 2 : 1,
    );
    await page.screenshot({ path: join(folder, "classic.png") });
    await choose(page, "clay");
    const clay = await receipt(page);
    // Owner permits display-only asset rounding, never a new canonical world.
    expect(geometryIdentity(clay, true)).toEqual(geometryIdentity(original));
    expectBoundedViews(clay);
    expect(clay.camera).toEqual(original.camera);
    expect(clay.landscape).toEqual(original.landscape);
    expect(clay.nodes).toEqual(original.nodes);
    expect(clay.avatarRecipe).toBe(original.avatarRecipe);
    expect(clay.uiTheme).toBe(original.uiTheme);
    expect(clay.accountStyle).toBe("clay");
    expect(clay.frame.calls).toBe(original.frame.calls);
    expect(clay.frame.lines).toBe(original.frame.lines);
    expect(clay.frame.points).toBe(original.frame.points);
    expect(clay.frame.triangles).toBeLessThanOrEqual(original.frame.triangles * 1.15);
    await page.screenshot({ path: join(folder, "clay.png") });
    const gpu = process.env.R55_MEASURE_GPU === "1" ? await measureStageGpu(page) : null;
    for (let i = 0; i < 10; i++) {
      await choose(page, "classic");
      await choose(page, "clay");
    }
    const repeated = await receipt(page);
    expect(resourceCounts(repeated)).toEqual(resourceCounts(clay));
    expect(geometryIdentity(repeated)).toEqual(geometryIdentity(clay));
    expect(geometryIdentity(repeated, true)).toEqual(geometryIdentity(original));
    await choose(page, "classic");
    const restored = await receipt(page);
    expect(materialIdentity(restored)).toEqual(materialIdentity(original));
    expect(geometryIdentity(restored)).toEqual(geometryIdentity(original));
    expect(restored.frame).toEqual(original.frame);
    expect(restored.overflow).toBeLessThanOrEqual(1);
    await choose(page, "clay");
    // Overview is an on-demand command now, not a permanent map button.
    await runMapCommand(page, "overview");
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
    // Selecting a lesson is a non-modal object action: the scene keeps working
    // and one short entry button appears beside it. Escape cancels the choice.
    const icon = enterableLessonMarker(page);
    await icon.click();
    await expect(page.locator('[data-map-entry="true"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-map-entry="true"]')).toHaveCount(0);
    writeFileSync(
      join(folder, "receipt.json"),
      JSON.stringify({ original, clay, repeated, restored, gpu }, null, 2),
    );
    errors.assertClean();
  });
}

test("R56 one choice reaches the globe, series, profile, settings and avatar workshop", async ({
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
