import { test, expect, type Page } from "@playwright/test";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";
import { CLAIMS } from "../packages/world/src/toy-play/arcade-content.js";
import { WIRING_ROUNDS } from "../packages/world/src/toy-play/workshop-engine.js";
const modes = ["sky-invaders", "factory-stack", "press-words", "slice", "wire", "rank"] as const;
const objects = [
  "scene-cloud-flight",
  "scene-sorting-factory",
  "scene-sentence-press",
  "scene-information-slice",
  "scene-evidence-wiring",
  "scene-process-railway",
];
const data = (page: Page) => page.evaluate(() => Reflect.get(window, "__workshop3d")());
for (const lang of ["zh-CN", "en"]) {
  test(`game-first slice ${lang}: crossing capsules retain separate readable labels at 320px`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: 320, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=slice&lang=${lang}`);
      await page.getByTestId("workshop-start").tap();
      // Wait for the genuine ballistic crossing, not an injected fixture or a moved target.
      await page.waitForFunction(() => {
        const c = Reflect.get(window, "__workshop3d")().capsules;
        return c.length === 2 && Math.abs(c[0].y - c[1].y) < 0.9;
      });
      await expect(page.locator("[data-capsule-id]")).toHaveCount(2);
      const boxes = await page.locator("[data-capsule-id]").evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            w: r.width,
            h: r.height,
            text: n.textContent,
            fontSize: Number.parseFloat(getComputedStyle(n).fontSize),
            visible: getComputedStyle(n).visibility,
          };
        }),
      );
      const [a, b] = boxes;
      const overlap =
        Math.min(a!.x + a!.w, b!.x + b!.w) > Math.max(a!.x, b!.x) &&
        Math.min(a!.y + a!.h, b!.y + b!.h) > Math.max(a!.y, b!.y);
      expect(overlap, JSON.stringify(boxes)).toBe(false);
      boxes.forEach((b) => {
        expect(b.fontSize).toBeGreaterThanOrEqual(12);
        expect(b.visible).toBe("visible");
      });
      await expect(page.locator("[data-capsule-leader]")).toHaveCount(2);
      expect((await data(page)).capsules).toHaveLength(2);
      await page
        .getByTestId("workshop-board")
        .screenshot({ path: info.outputPath(`slice-crossing-${lang}.png`) });
    } finally {
      await context.close();
    }
  });
}
for (const mode of ["slice", "wire", "rank"])
  test(`game-first ${mode}: English phone supports material reading and resumes the same task`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      colorScheme: "dark",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=${mode}&lang=en`);
      await page.getByTestId("workshop-start").tap();
      await expect(page.getByTestId("workshop-player")).toHaveAttribute("data-frozen", "false");
      await page.locator(".workshop .arcade3d__sources summary").tap();
      await expect(page.getByTestId("workshop-player")).toHaveAttribute("data-frozen", "true");
      const before = await data(page);
      await page.waitForTimeout(350);
      expect((await data(page)).elapsed).toBe(before.elapsed);
      await page.getByRole("button", { name: "Back to game", exact: true }).tap();
      await expect(page.getByTestId("workshop-player")).toHaveAttribute("data-frozen", "false");
      expect((await data(page)).round).toBe(before.round);
      await page
        .getByTestId("workshop-board")
        .screenshot({ path: info.outputPath(`${mode}-phone-english.png`) });
      const overflowing = await page
        .locator(".workshop__face-button")
        .evaluateAll((nodes) =>
          nodes
            .filter((n) => n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1)
            .map((n) => n.textContent),
        );
      expect(overflowing).toEqual([]);
    } finally {
      await context.close();
    }
  });
test("game-first: wire dragging connects an actual cable without a forced click", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=wire&lang=zh-CN`);
  await page.getByTestId("workshop-start").click();
  // Wait for the normal browser actionability checks, including the first
  // projected layout, before taking coordinates for the physical gesture.
  await page.getByTestId("wire-source-0").hover();
  const from = await page.getByTestId("wire-source-0").boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId("wire-target-0")).toBeEnabled();
  const to = await page.getByTestId("wire-target-0").boundingBox();
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 16 });
  await page.mouse.up();
  await expect.poll(async () => (await data(page)).links[0]).toBe(0);
  await page.screenshot({ path: info.outputPath("cable-drag.png") });
});
test("game-first: the bottom input is a visible physical button, not DOM over a buried mesh", async ({
  page,
}) => {
  await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=wire&lang=zh-CN`);
  await page.getByTestId("workshop-start").click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stage = Reflect.get(window, "three"),
          body = stage?.scene.getObjectByName("wire-claim-3");
        if (!body) return false;
        const p = body.getWorldPosition(body.position.clone()).project(stage.camera);
        stage.raycaster.setFromCamera(stage.pointer.clone().set(p.x, p.y), stage.camera);
        const hit = stage.raycaster
          .intersectObjects(stage.scene.children, true)
          .find(
            (r: { object: { material?: { colorWrite?: boolean } } }) =>
              r.object.material?.colorWrite !== false,
          );
        let node = hit?.object;
        while (node) {
          if (node === body) return true;
          node = node.parent;
        }
        return false;
      }),
    )
    .toBe(true);
});
for (const width of [1440, 390])
  for (const [index, mode] of modes.entries()) {
    test(`game-first ${mode} ${width}: live distinct scene, no garden, readable controls`, async ({
      browser,
    }, info) => {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        hasTouch: width < 500,
        isMobile: width < 500,
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=${mode}&lang=zh-CN`);
        await page.getByTestId(index < 3 ? "arcade-start" : "workshop-start").click();
        const board = page.getByTestId(index < 3 ? "arcade-board" : "workshop-board");
        await expect
          .poll(() =>
            page.evaluate(
              (name) => Boolean(Reflect.get(window, "three")?.scene.getObjectByName(name)),
              objects[index]!,
            ),
          )
          .toBe(true);
        expect(
          await page.evaluate(() =>
            Boolean(Reflect.get(window, "three").scene.getObjectByName("toy-garden")),
          ),
        ).toBe(false);
        await expect(board.locator("canvas")).toBeVisible();
        await board.scrollIntoViewIfNeeded();
        if (mode === "sky-invaders")
          await expect
            .poll(() => page.evaluate(() => Reflect.get(window, "__arcade3d")().shots.length))
            .toBeGreaterThan(0);
        if (mode === "slice")
          await expect
            .poll(async () => (await data(page)).capsules[0]?.age ?? 0)
            .toBeGreaterThan(1);
        if (mode === "wire") {
          await page.getByTestId("wire-source-0").click();
          await page.getByTestId("wire-target-0").click();
          expect((await data(page)).links[0]).toBe(0);
        }
        if (mode === "rank") {
          await page.getByTestId("train-car-0").click();
          await page.getByTestId("train-car-1").click();
          expect((await data(page)).order).toEqual([0, 2, 3, 1]);
        }
        await board.screenshot({ path: info.outputPath(`${mode}-${width}.png`) });
        await page.screenshot({ path: info.outputPath(`${mode}-${width}-page.png`) });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
for (const origin of [ONLINE_ORIGIN, LOCAL_ORIGIN]) {
  test(`game-first ${origin}: all nine selectable, original three still garden editions`, async ({
    page,
  }) => {
    await page.goto(`${origin}/play-lab/catalog?group=three&entry=three:sky-invaders&lang=zh-CN`);
    await expect(page.getByRole("tab", { name: "3D组件 9", exact: true })).toBeVisible();
    await expect(page.locator("[data-entry-id^='three:']")).toHaveCount(9);
    await expect(page.getByRole("tab", { name: "全部 59", exact: true })).toBeVisible();
    for (const mode of ["invaders", "stack", "cloze-tetris"]) {
      await page.goto(`${origin}/play-lab/toy-3d?game=${mode}&lang=zh-CN`);
      await expect(page.getByTestId("arcade3d")).toHaveAttribute("data-edition", "garden");
      await page.getByTestId("arcade-start").click();
      await expect
        .poll(() =>
          page.evaluate(() =>
            Boolean(Reflect.get(window, "three")?.scene.getObjectByName("toy-garden")),
          ),
        )
        .toBe(true);
    }
  });
}
test("game-first: actual wiring, bad circuit, correction and three full rounds", async ({
  page,
}, info) => {
  await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=wire&lang=zh-CN`);
  await page.getByTestId("workshop-start").click();
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 4; i++) {
      await page.getByTestId(`wire-source-${i}`).click();
      await page.getByTestId("wire-target-2").click();
    }
    await page.getByTestId("workshop-check").click();
    expect((await data(page)).mistakes).toBe(round + 1);
    expect((await data(page)).score).toBe(round * 40);
    for (const [i, c] of WIRING_ROUNDS[round]!.entries()) {
      await page.getByTestId(`wire-source-${i}`).click();
      await page.getByTestId(`wire-target-${CLAIMS[c]!.answer}`).click();
    }
    await page.getByTestId("workshop-check").click();
    await expect(page.getByTestId("workshop-player")).toHaveAttribute(
      "data-phase",
      round === 2 ? "won" : "round",
    );
    if (round < 2) await page.getByTestId("workshop-next").click();
  }
  expect((await data(page)).score).toBe(120);
  await page.screenshot({ path: info.outputPath("wire-completed.png") });
});
test("game-first: train executes steps, halts at missing prerequisite and accepts independent checks", async ({
  page,
}, info) => {
  await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=rank&lang=zh-CN`);
  await page.getByTestId("workshop-start").click();
  await page.getByTestId("workshop-check").click();
  await expect.poll(async () => (await data(page)).mistakes).toBe(1);
  for (let round = 0; round < 3; round++) {
    const desired = round === 1 ? [0, 2, 1, 3] : [0, 1, 2, 3];
    for (const [i, id] of desired.entries()) {
      const at = (await data(page)).order.indexOf(id);
      await page.getByTestId(`train-car-${i}`).click();
      await page.getByTestId(`train-car-${at}`).click();
    }
    await page.getByTestId("workshop-check").click();
    await expect(page.getByTestId("workshop-player")).toHaveAttribute(
      "data-phase",
      round === 2 ? "won" : "round",
    );
    if (round < 2) await page.getByTestId("workshop-next").click();
  }
  expect((await data(page)).correct).toBe(3);
  await page.screenshot({ path: info.outputPath("train-completed.png") });
});
test("game-first: slicing actual capsule with pointer and pausing freezes the physics", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=slice&lang=zh-CN`);
  await page.getByTestId("workshop-start").click();
  await expect.poll(async () => (await data(page)).capsules[0]?.age ?? 0).toBeGreaterThan(1.5);
  const target = await page.evaluate(() => {
    const f = Reflect.get(window, "__workshop3d")().capsules[0],
      stage = Reflect.get(window, "three"),
      v = stage.scene
        .getObjectByName(`slice-capsule-${f.id}`)
        .position.clone()
        .project(stage.camera),
      r = stage.gl.domElement.getBoundingClientRect();
    return { x: r.x + ((v.x + 1) * r.width) / 2, y: r.y + ((1 - v.y) * r.height) / 2 };
  });
  await page.mouse.move(target.x - 28, target.y);
  await page.mouse.down();
  await page.mouse.move(target.x + 28, target.y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await data(page)).collisionCount).toBe(1);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  const elapsed = (await data(page)).elapsed;
  await page.waitForTimeout(450);
  expect((await data(page)).elapsed).toBe(elapsed);
  await page.screenshot({ path: info.outputPath("slice-hit-paused.png") });
});
