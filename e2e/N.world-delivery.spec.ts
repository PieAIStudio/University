import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ONLINE_ORIGIN } from "./ports.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { assertCompleteCourseOverview, courseOverviewEvidence, waitForCourseFraming } from "./harness/course-overview.js";

const COURSE = "/turing-pact/foundations-before-zero";
const OUTPUT = "SCRATCH/e2e/world-delivery";
const STABLE_COMPLETE_FRAMES = 6;
const OWNED_READY_TIMEOUT_MS = 90_000;

type Layer = "course" | "world" | "planet";

/**
 * Visible canvas and named groups as they are spelled in source.
 * Course: packages/world/src/island/island-render.tsx (`island-terrain`),
 * island-dressing-render.tsx (`island-dressing-course`).
 * World/planet terrain+props: remote-island-render.tsx (`remote-island-terrain`)
 * and remote-props-render.tsx (`remote-props`). WorldMapCanvas `.stagewrap[hidden]`
 * vs PlanetPage/MainRouter `[data-planet-globe] canvas` is the layer owner.
 */
const LAYER_CONTRACT: Record<
  Layer,
  {
    canvasSelector: string;
    present: readonly string[];
    absent: readonly string[];
  }
> = {
  course: {
    canvasSelector: ".stagewrap:not([hidden]) canvas",
    present: ["island-terrain", "island-dressing-course"],
    absent: ["remote-island-terrain"],
  },
  world: {
    canvasSelector: ".stagewrap:not([hidden]) canvas",
    present: ["remote-island-terrain", "remote-props"],
    absent: ["island-dressing-course"],
  },
  planet: {
    canvasSelector: "[data-planet-globe] canvas",
    present: ["domain-planet-programming", "domain-globe-programming", "domain-clouds-programming", "domain-course-islands-programming"],
    absent: ["island-dressing-course", "remote-props", "remote-island-terrain"],
  },
};

type FrameMetrics = {
  frame: number;
  sceneUuid: string;
  full: { calls: number; triangles: number };
  scene: { calls: number; triangles: number };
  geometries: number;
  textures: number;
  programs: number;
  submissionMs: number;
  measurementReadback: boolean;
  dpr: number;
  buffer: { width: number; height: number };
};

type FrameEvidence = {
  url: string;
  viewport: [number, number];
  theme: string | null;
  visibility: string;
  layer: Layer;
  sampleCount: number;
  last: FrameMetrics | undefined;
  submissionP50Ms: number | null;
  submissionP95Ms: number | null;
  browserFrameIntervalP95Ms: number | null;
  owner: {
    canvasSelector: string;
    canvasIsVisibleGlDomElement: boolean;
    present: Record<string, boolean>;
    absent: Record<string, boolean>;
    sceneUuid: string | null;
  };
  scope: string;
};

type ResourceSnapshot = {
  sceneUuid: string | undefined;
  geometries: number | undefined;
  textures: number | undefined;
  programs: number | undefined;
};

function resourcesOf(metrics: FrameEvidence): ResourceSnapshot {
  return {
    sceneUuid: metrics.last?.sceneUuid,
    geometries: metrics.last?.geometries,
    textures: metrics.last?.textures,
    programs: metrics.last?.programs,
  };
}

async function remoteBatchDrawEvidence(page: Page) {
  return page.evaluate(async () => {
    const state = (globalThis as any).three;
    const roots = [state.scene.getObjectByName("remote-island-terrain"), state.scene.getObjectByName("remote-props")];
    const meshes = new Set<any>();
    for (const root of roots) root?.traverse((object: any) => { if (object.isMesh) meshes.add(object); });
    const originals = new Map<any, any>();
    const draws = new Map<number, { calls: number; names: string[] }>();
    try {
      for (const mesh of meshes) {
        originals.set(mesh, mesh.onAfterRender);
        mesh.onAfterRender = function (...args: any[]) {
          originals.get(mesh)?.apply(this, args);
          const rendererFrame = args[0].info.render.frame;
          const entry = draws.get(rendererFrame) ?? { calls: 0, names: [] };
          entry.calls += 1;
          entry.names.push(mesh.name || mesh.uuid);
          draws.set(rendererFrame, entry);
        };
      }
      for (let i = 0; i < 12; i++) await new Promise(requestAnimationFrame);
    } finally {
      for (const [mesh, callback] of originals) mesh.onAfterRender = callback;
    }
    return {
      source: "actual onAfterRender callbacks, grouped by renderer.info.render.frame",
      scope: "remote merged terrain and remote prop batches only, excluding avatars, sky, shadows and post; full Stage cost is recorded separately",
      sceneUuid: state.scene.uuid,
      meshCount: meshes.size,
      samples: [...draws].map(([rendererFrame, entry]) => ({ rendererFrame, ...entry })),
    };
  });
}

async function waitForOwnedLayerReady(page: Page, layer: Layer, mapSceneUuid?: string) {
  const result = await page.evaluate(
    async (args) => {
      const inspect = () => {
        const bag = globalThis as unknown as {
          __stageFrameMetrics?: FrameMetrics;
          three?: {
            scene: {
              uuid: string;
              getObjectByName(name: string): unknown;
            };
            gl: { domElement: HTMLCanvasElement };
          };
        };
        const canvas = document.querySelector(args.contract.canvasSelector);
        const glCanvas = bag.three?.gl.domElement;
        const hiddenAncestor =
          canvas instanceof HTMLElement ? canvas.closest("[hidden]") !== null : true;
        const rect = canvas instanceof HTMLElement ? canvas.getBoundingClientRect() : null;
        const style = canvas instanceof HTMLElement ? getComputedStyle(canvas) : null;
        const visible =
          canvas instanceof HTMLCanvasElement &&
          !hiddenAncestor &&
          style !== null &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect !== null &&
          rect.width > 0 &&
          rect.height > 0;
        const canvasIsVisibleGlDomElement = Boolean(
          visible && glCanvas instanceof HTMLCanvasElement && glCanvas === canvas,
        );
        const present: Record<string, boolean> = {};
        const absent: Record<string, boolean> = {};
        for (const name of args.contract.present) {
          present[name] = Boolean(bag.three?.scene.getObjectByName(name));
        }
        for (const name of args.contract.absent) {
          absent[name] = bag.three?.scene.getObjectByName(name) == null;
        }
        const metrics = bag.__stageFrameMetrics;
        const threeSceneUuid = bag.three?.scene.uuid ?? null;
        const sceneUuid = metrics?.sceneUuid ?? null;
        const sceneMatchesThree = Boolean(
          sceneUuid && threeSceneUuid && sceneUuid === threeSceneUuid,
        );
        const sceneMatchesMap =
          args.mapSceneUuid === null
            ? true
            : args.layer === "planet"
              ? sceneUuid !== args.mapSceneUuid
              : sceneUuid === args.mapSceneUuid;
        const groupsReady =
          Object.values(present).every(Boolean) && Object.values(absent).every(Boolean);
        const complete =
          metrics != null &&
          !metrics.measurementReadback &&
          metrics.full.calls > 0 &&
          metrics.full.triangles > 0;
        const ok =
          canvasIsVisibleGlDomElement &&
          sceneMatchesThree &&
          sceneMatchesMap &&
          groupsReady &&
          complete;
        return {
          ok,
          canvasIsVisibleGlDomElement,
          present,
          absent,
          sceneUuid,
          threeSceneUuid,
          frame: metrics?.frame ?? null,
          measurementReadback: metrics?.measurementReadback ?? null,
          geometries: metrics?.geometries ?? null,
          textures: metrics?.textures ?? null,
          programs: metrics?.programs ?? null,
        };
      };

      const started = performance.now();
      let streak = 0;
      let lastKey = "";
      let lastFrame = -1;
      let last = inspect();
      while (performance.now() - started < args.timeoutMs) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        last = inspect();
        if (!last.ok || last.frame === null) {
          streak = 0;
          lastKey = "";
          lastFrame = -1;
          continue;
        }
        if (last.frame === lastFrame) continue;
        lastFrame = last.frame;
        const key = `${last.geometries}|${last.textures}|${last.programs}`;
        streak = key === lastKey ? streak + 1 : 1;
        lastKey = key;
        if (streak >= args.stableFrames) {
          return { ready: true as const, last, streak };
        }
      }
      return { ready: false as const, last, streak };
    },
    {
      layer,
      contract: LAYER_CONTRACT[layer],
      mapSceneUuid: mapSceneUuid ?? null,
      timeoutMs: OWNED_READY_TIMEOUT_MS,
      stableFrames: STABLE_COMPLETE_FRAMES,
    },
  );
  expect(
    result.ready,
    `${layer} never reached ${STABLE_COMPLETE_FRAMES} consecutive complete frames on the visible canvas with stable geometries/textures/programs (not GPU completeness): ${JSON.stringify(result.last)}`,
  ).toBe(true);
}

async function frameEvidence(
  page: Page,
  layer: Layer,
  mapSceneUuid?: string,
): Promise<FrameEvidence> {
  return page.evaluate(
    async (args) => {
      type Frame = FrameMetrics;
      const inspect = (frame: Frame | undefined) => {
        const bag = globalThis as unknown as {
          three?: {
            scene: {
              uuid: string;
              getObjectByName(name: string): unknown;
            };
            gl: { domElement: HTMLCanvasElement };
          };
        };
        const canvas = document.querySelector(args.contract.canvasSelector);
        const glCanvas = bag.three?.gl.domElement;
        const hiddenAncestor =
          canvas instanceof HTMLElement ? canvas.closest("[hidden]") !== null : true;
        const rect = canvas instanceof HTMLElement ? canvas.getBoundingClientRect() : null;
        const style = canvas instanceof HTMLElement ? getComputedStyle(canvas) : null;
        const visible =
          canvas instanceof HTMLCanvasElement &&
          !hiddenAncestor &&
          style !== null &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect !== null &&
          rect.width > 0 &&
          rect.height > 0;
        const canvasIsVisibleGlDomElement = Boolean(
          visible && glCanvas instanceof HTMLCanvasElement && glCanvas === canvas,
        );
        const present: Record<string, boolean> = {};
        const absent: Record<string, boolean> = {};
        for (const name of args.contract.present) {
          present[name] = Boolean(bag.three?.scene.getObjectByName(name));
        }
        for (const name of args.contract.absent) {
          absent[name] = bag.three?.scene.getObjectByName(name) == null;
        }
        const threeSceneUuid = bag.three?.scene.uuid ?? null;
        const sceneUuid = frame?.sceneUuid ?? null;
        const sceneMatchesThree = Boolean(
          sceneUuid && threeSceneUuid && sceneUuid === threeSceneUuid,
        );
        const sceneMatchesMap =
          args.mapSceneUuid === null
            ? true
            : args.layer === "planet"
              ? sceneUuid !== args.mapSceneUuid
              : sceneUuid === args.mapSceneUuid;
        const groupsReady =
          Object.values(present).every(Boolean) && Object.values(absent).every(Boolean);
        return {
          ok:
            canvasIsVisibleGlDomElement &&
            sceneMatchesThree &&
            sceneMatchesMap &&
            groupsReady &&
            frame != null &&
            !frame.measurementReadback,
          canvasIsVisibleGlDomElement,
          present,
          absent,
          sceneUuid,
        };
      };
      const bag = globalThis as unknown as { __stageFrameMetrics?: Frame };
      const samples: Frame[] = [];
      const intervals: number[] = [];
      let previous = performance.now();
      let lastFrame = -1;
      let owner = inspect(bag.__stageFrameMetrics);
      for (let i = 0; i < 90; i += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const now = performance.now();
        intervals.push(now - previous);
        previous = now;
        const frame = bag.__stageFrameMetrics;
        owner = inspect(frame);
        if (owner.ok && frame && frame.frame !== lastFrame) {
          samples.push(structuredClone(frame));
          lastFrame = frame.frame;
        }
      }
      const percentile = (values: number[], share: number) => {
        const sorted = [...values].sort((a, b) => a - b);
        return sorted[Math.floor((sorted.length - 1) * share)] ?? null;
      };
      return {
        url: location.href,
        viewport: [innerWidth, innerHeight] as [number, number],
        theme: document.documentElement.getAttribute("data-game-ui-theme"),
        visibility: document.visibilityState,
        layer: args.layer,
        sampleCount: samples.length,
        last: samples.at(-1),
        submissionP50Ms: percentile(
          samples.map((frame) => frame.submissionMs),
          0.5,
        ),
        submissionP95Ms: percentile(
          samples.map((frame) => frame.submissionMs),
          0.95,
        ),
        browserFrameIntervalP95Ms: percentile(intervals.slice(1), 0.95),
        owner: {
          canvasSelector: args.contract.canvasSelector,
          canvasIsVisibleGlDomElement: owner.canvasIsVisibleGlDomElement,
          present: owner.present,
          absent: owner.absent,
          sceneUuid: owner.sceneUuid,
        },
        scope:
          "CPU submission and browser scheduling on this machine; not GPU time, not physical-phone FPS, not GPU completeness",
      };
    },
    {
      layer,
      contract: LAYER_CONTRACT[layer],
      mapSceneUuid: mapSceneUuid ?? null,
    },
  );
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
]) {
  test.describe(`N three-layer delivery ${viewport.width}`, () => {
    test.use({ viewport, deviceScaleFactor: 1, colorScheme: "light" });

    test("ordinary navigation preserves the course and records complete-frame costs", async ({
      page,
    }) => {
      const console = watchConsole(page);
      const evidence: Record<string, unknown> = {};
      const folder = join(OUTPUT, String(viewport.width));
      mkdirSync(folder, { recursive: true });
      const started = Date.now();
      await page.goto(`${ONLINE_ORIGIN}${COURSE}`);
      await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
      const firstLesson = page.locator("button.label--icon.is-visible").first();
      await expect(firstLesson).toBeVisible();
      evidence.coldNavigationToVisibleControlMs = Date.now() - started;
      await waitForOwnedLayerReady(page, "course");
      evidence.coldNavigationToReadySceneMs = Date.now() - started;
      const courseMetrics = await frameEvidence(page, "course");
      evidence.course = courseMetrics;
      const originalScene = courseMetrics.last?.sceneUuid;
      expect(originalScene).toBeTruthy();
      await page.screenshot({ path: join(folder, "course.png") });

      const nearView = await courseOverviewEvidence(page);
      const courseUrl = page.url();
      await humanClick(page,page.getByRole("button",{name:"总览课程岛",exact:true}),"frame the entire actual course island");
      const overview = await assertCompleteCourseOverview(page);
      expect(overview.geometryId).toBe(nearView.geometryId);
      expect(overview.sceneId).toBe(nearView.sceneId);
      expect(overview.avatarTarget).toEqual(nearView.avatarTarget);
      expect(overview.fov).toBe(nearView.fov);
      expect(page.url()).toBe(courseUrl);
      await page.screenshot({path:join(folder,"course-overview.png")});
      evidence.overview={near:nearView,full:overview};
      await humanClick(page,page.getByRole("button",{name:"回到当前关",exact:true}),"restore the ordinary learning camera");
      await waitForCourseFraming(page);
      const restored = await courseOverviewEvidence(page);
      expect(restored.distance).toBeCloseTo(36,3);
      expect(restored.avatarTarget).toEqual(nearView.avatarTarget);
      expect(restored.geometryId).toBe(nearView.geometryId);

      await humanClick(
        page,
        page.getByRole("button", { name: /回到 TuringPact 地图/ }),
        "return to archipelago",
      );
      const course = page.getByRole("button", {
        name: "《在开始之前：App、代码、和你》",
        exact: true,
      });
      await expect(course).toBeVisible();
      await waitForOwnedLayerReady(page, "world", originalScene);
      evidence.world = await frameEvidence(page, "world", originalScene);
      const seriesIds = await page.evaluate(() => {
        const field=(window as any).three?.scene.getObjectByName("remote-island-field");
        return field?.userData?.remoteIslandIds ?? null;
      });
      // Names remain in the keyboard DOM even when their visual label is culled.
      const shelfResponse = await page.request.get(`${ONLINE_ORIGIN}/content/shelf.json`);
      expect(shelfResponse.ok()).toBe(true);
      const shelf = await shelfResponse.json();
      const publishedCourses = shelf.studies.find((study: {id:string})=>study.id === "turing-pact").courses.map((course: {id:string})=>course.id);
      expect(publishedCourses.length).toBeGreaterThan(0);
      expect(seriesIds?.slice().sort()).toEqual(publishedCourses.map((id: string)=>`turing-pact/${id}`).sort());
      expect(await page.locator("button.label--course").count()).toBe(publishedCourses.length);
      evidence.seriesIslandIds=seriesIds;
      const remoteDraws = await remoteBatchDrawEvidence(page);
      evidence.remoteBatchDraws = remoteDraws;
      expect(remoteDraws.sceneUuid).toBe(originalScene);
      expect(remoteDraws.samples.length).toBeGreaterThan(3);
      for (const sample of remoteDraws.samples) {
        expect(sample.calls, "terrain + optional pavilion + trees: actual base-pass draw ceiling").toBeLessThanOrEqual(3);
        expect(sample.calls).toBeGreaterThan(0);
      }
      await page.screenshot({ path: join(folder, "world.png") });
      await humanClick(
        page,
        page.getByRole("button", { name: "当前系列 TuringPact", exact: true }),
        "study switcher",
      );
      await humanClick(
        page,
        page.getByRole("option", { name: "看所有课程系列", exact: true }),
        "all studies",
      );
      await expect(page.locator("[data-planet-globe] canvas")).toBeVisible();
      const expand = page.getByRole("button", { name: "展开上下文", exact: true });
      if (await expand.isVisible()) await humanClick(page, expand, "show study choices");
      await expect(page.locator('[data-study-id="turing-pact"]')).toBeVisible();
      await humanClick(page, page.locator('[data-study-id="buzz"]'), "select another study");
      await expect(page.locator('[data-study-id="buzz"]')).toHaveAttribute("aria-pressed", "true");
      await humanClick(
        page,
        page.locator('[data-study-id="turing-pact"]'),
        "restore selected study",
      );
      await waitForOwnedLayerReady(page, "planet", originalScene);
      evidence.planet = await frameEvidence(page, "planet", originalScene);
      await page.screenshot({ path: join(folder, "planet.png") });
      await humanClick(
        page,
        page.getByRole("button", { name: "进入 TuringPact", exact: true }),
        "enter same study",
      );
      await expect(course).toBeVisible();
      await humanClick(page, course, "select original course");
      await humanClick(
        page,
        page.getByRole("button", { name: /进入这门课/ }),
        "enter original course",
      );
      await expect(page).toHaveURL(new RegExp(`${COURSE}$`));
      await expect(page.locator("button.label--icon.is-visible").first()).toBeVisible();
      await waitForOwnedLayerReady(page, "course", originalScene);
      const returnedCourse = await frameEvidence(page, "course", originalScene);
      evidence.returnedCourse = returnedCourse;
      // After caches have warmed, repeated ordinary navigation must not keep
      // accumulating geometries or textures in the active renderer.
      const warmReturns: FrameEvidence[] = [];
      for (let round = 0; round < 2; round += 1) {
        await humanClick(
          page,
          page.getByRole("button", { name: /回到 TuringPact 地图/ }),
          "warm return to world",
        );
        await expect(course).toBeVisible();
        await humanClick(page, course, "warm select course");
        await humanClick(
          page,
          page.getByRole("button", { name: /进入这门课/ }),
          "warm enter course",
        );
        await expect(firstLesson).toBeVisible();
        await waitForOwnedLayerReady(page, "course", originalScene);
        warmReturns.push(await frameEvidence(page, "course", originalScene));
      }
      evidence.warmReturns = warmReturns;
      writeFileSync(join(folder, "receipt.json"), JSON.stringify(evidence, null, 2));
      expect(originalScene).toBeTruthy();
      expect(returnedCourse.last?.sceneUuid).toBe(originalScene);
      for (const returned of warmReturns) expect(returned.last?.sceneUuid).toBe(originalScene);
      expect((evidence.world as FrameEvidence).last?.sceneUuid).toBe(originalScene);
      expect((evidence.planet as FrameEvidence).last?.sceneUuid).toBeTruthy();
      expect((evidence.planet as FrameEvidence).last?.sceneUuid).not.toBe(originalScene);
      expect(warmReturns[1]!.last?.geometries).toBe(warmReturns[0]!.last?.geometries);
      expect(warmReturns[1]!.last?.textures).toBe(warmReturns[0]!.last?.textures);
      expect(warmReturns[1]!.last?.programs).toBe(warmReturns[0]!.last?.programs);
      expect(returnedCourse.last?.geometries).toBe(warmReturns[0]!.last?.geometries);
      expect(returnedCourse.last?.textures).toBe(warmReturns[0]!.last?.textures);
      expect(returnedCourse.last?.programs).toBe(warmReturns[0]!.last?.programs);
      const cold = resourcesOf(courseMetrics);
      const returned = resourcesOf(returnedCourse);
      evidence.coldResourceBaseline = {
        includedInEquality: false,
        reason:
          "persistent first-use cache can still raise geometries, textures, or programs after the first owned stable sample; equality is required only after caches have warmed (returnedCourse, warmReturns[0], warmReturns[1])",
        resources: cold,
        deltaVsReturnedCourse: {
          geometries: (returned.geometries ?? 0) - (cold.geometries ?? 0),
          textures: (returned.textures ?? 0) - (cold.textures ?? 0),
          programs: (returned.programs ?? 0) - (cold.programs ?? 0),
        },
      };
      evidence.warmResourceEquality = {
        compared: ["returnedCourse", "warmReturns[0]", "warmReturns[1]"],
        fields: ["geometries", "textures", "programs"],
        scope:
          "owned renderer gl.info.memory and gl.info.programs.length after warm navigation; not GPU RAM",
      };
      for (const key of ["course", "world", "planet", "returnedCourse"]) {
        const metrics = evidence[key] as FrameEvidence;
        expect(metrics.sampleCount, `${key} must actually render fresh frames`).toBeGreaterThan(10);
        expect(metrics.last?.full.calls).toBeGreaterThan(0);
        expect(metrics.last?.full.triangles).toBeGreaterThan(0);
        expect(metrics.last?.full.calls).toBeGreaterThanOrEqual(metrics.last?.scene.calls ?? 0);
        expect(
          metrics.owner.canvasIsVisibleGlDomElement,
          `${key} must own the visible canvas`,
        ).toBe(true);
      }
      for (const [index, metrics] of warmReturns.entries()) {
        expect(
          metrics.sampleCount,
          `warmReturns[${index}] must actually render fresh frames`,
        ).toBeGreaterThan(10);
        expect(metrics.last?.full.calls).toBeGreaterThan(0);
        expect(metrics.last?.full.triangles).toBeGreaterThan(0);
        expect(metrics.last?.full.calls).toBeGreaterThanOrEqual(metrics.last?.scene.calls ?? 0);
        expect(metrics.owner.canvasIsVisibleGlDomElement).toBe(true);
      }
      evidence.consoleErrors = console.errors();
      writeFileSync(join(folder, "receipt.json"), JSON.stringify(evidence, null, 2));
      console.assertClean();
    });
  });
}
