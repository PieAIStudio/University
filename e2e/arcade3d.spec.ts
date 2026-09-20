import { expect, test, type Page } from "@playwright/test";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";
import { CLAIMS, wordIndex, FLIGHT_CARDS } from "../packages/world/src/toy-play/arcade-content.js";
import type { ArcadeState } from "../packages/world/src/toy-play/arcade-engine.js";

import { scrollIntoView } from "./harness/click.js";
test("delivery arcade3d: three simultaneous targets keep readable separated labels on a phone", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=invaders&lang=zh-CN`);
    await page.getByRole("checkbox").check();
    await page.getByTestId("arcade-start").click();
    await expect.poll(async () => (await state(page)).enemies.length, { timeout: 20000 }).toBe(3);
    await expect(page.locator(".arcade3d__foe-label")).toHaveCount(3);
    await page.screenshot({ path: info.outputPath("three-active-targets.png") });
    const boxes = await page.locator(".arcade3d__foe-label").evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height, text: n.textContent };
      }),
    );
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!,
          b = boxes[j]!;
        const overlap =
          Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) &&
          Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
        expect(overlap, `${a.text} overlaps ${b.text}`).toBe(false);
      }
  } finally {
    await context.close();
  }
});

test("delivery arcade3d: both entry sides keep the actual drone visible, not just its DOM label", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=invaders&lang=zh-CN`);
  const sides = new Set<number>();
  for (let round = 0; round < 2; round++) {
    await page.getByTestId("arcade-start").click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const data = Reflect.get(window, "__arcade3d")();
          const stage = Reflect.get(window, "three");
          const foe = data.enemies[0];
          const body = foe && stage.scene.getObjectByName(`arcade-foe-${foe.id}`);
          if (!body) return "waiting-for-real-body";
          const point = body.getWorldPosition(body.position.clone()).project(stage.camera);
          stage.raycaster.setFromCamera(stage.pointer.clone().set(point.x, point.y), stage.camera);
          const hit = stage.raycaster.intersectObjects(stage.scene.children, true).find(
            (h: {
              object: {
                visible: boolean;
                name: string;
                material?: { colorWrite?: boolean; visible?: boolean };
              };
            }) =>
              h.object.visible &&
              h.object.material &&
              h.object.material.colorWrite !== false &&
              h.object.material.visible !== false &&
              h.object.name !== "arcade-projectiles",
          );
          let node = hit?.object;
          while (node) {
            if (node === body) return "drone-visible";
            node = node.parent;
          }
          return `occluded-by-${hit?.object.name || hit?.object.type || "unknown"}`;
        }),
      )
      .toBe("drone-visible");
    sides.add(Math.sign((await state(page)).enemies[0]!.x));
    await page.screenshot({ path: info.outputPath(`entry-clearance-${round}.png`) });
    await page.getByRole("button", { name: "暂停", exact: true }).click();
    await page
      .locator(".arcade3d__toolbar")
      .getByRole("button", { name: "重新开一局", exact: true })
      .click();
  }
  expect(sides.size).toBe(2);
});

const state = (page: Page): Promise<ArcadeState> =>
  page.evaluate(() => Reflect.get(window, "__arcade3d")());

for (const theme of ["light", "dark"] as const)
  for (const width of [390, 1440]) {
    test(`arcade3d: ${theme} ${width}px word text contrasts with its actual 3D surface`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=cloze-tetris&lang=zh-CN`);
      await expect(page.locator("html")).toHaveAttribute(
        "data-game-ui-theme",
        theme === "dark" ? "night" : "light",
      );
      await page.getByRole("checkbox").check();
      await page.getByTestId("arcade-start").click();
      await expect(page.locator(".arcade3d__word-tray button")).toHaveCount(6);
      await expect(page.locator(".arcade3d__sentence")).toHaveCount(3);
      // DOM commits can precede the first frame that positions its mesh. Do
      // not sample the previous frame's scenery under a newly mounted word.
      await expect
        .poll(() =>
          page.evaluate(() => {
            const stage = Reflect.get(window, "three");
            const bounds = stage.gl.domElement.getBoundingClientRect();
            return Array.from(
              document.querySelectorAll<HTMLElement>(".arcade3d__word-tray button"),
            ).every((element) => {
              const node = stage.scene.getObjectByName(element.dataset.testid);
              if (!node) return false;
              const point = node.getWorldPosition(node.position.clone()).project(stage.camera);
              const rect = element.getBoundingClientRect();
              const x = bounds.left + ((point.x + 1) * bounds.width) / 2;
              const y = bounds.top + ((1 - point.y) * bounds.height) / 2;
              return Math.hypot(x - rect.left - rect.width / 2, y - rect.top - rect.height / 2) < 2;
            });
          }),
        )
        .toBe(true);
      const placedFrame = await page.evaluate(
        () => Reflect.get(window, "__stageFrameMetrics").frame,
      );
      await expect
        .poll(() => page.evaluate(() => Reflect.get(window, "__stageFrameMetrics").frame))
        .toBeGreaterThan(placedFrame);
      const samples = await page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>(".arcade3d__viewport canvas")!;
        // Sample the real WebGL output beneath DOM text, not an assumed CSS
        // background. Transparent DOM text is not covered by ordinary axe contrast.
        const image = document.createElement("canvas");
        image.width = canvas.width;
        image.height = canvas.height;
        const context = image.getContext("2d")!;
        context.drawImage(canvas, 0, 0);
        const bounds = canvas.getBoundingClientRect();
        const luminance = (rgb: number[]) => {
          const linear = rgb.map((v) => {
            const s = v / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
          return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
        };
        return Array.from(
          document.querySelectorAll<HTMLElement>(
            ".arcade3d__word-tray button, .arcade3d__sentence > span:first-child",
          ),
        ).map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const foreground = (style.color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
          const x = Math.floor(
            ((rect.left + rect.width / 2 - bounds.left) * canvas.width) / bounds.width,
          );
          const y = Math.floor(
            ((rect.top + rect.height / 2 - bounds.top) * canvas.height) / bounds.height,
          );
          const background = Array.from(context.getImageData(x, y, 1, 1).data).slice(0, 3);
          const a = luminance(foreground),
            b = luminance(background);
          return {
            text: element.textContent,
            foreground,
            background,
            ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          };
        });
      });
      await info.attach("text-on-rendered-material", {
        body: JSON.stringify(samples, null, 2),
        contentType: "application/json",
      });
      await page.screenshot({ path: info.outputPath(`words-${theme}-${width}.png`) });
      expect(samples).toHaveLength(9);
      for (const sample of samples) {
        expect(sample.ratio, `${sample.text}: ${JSON.stringify(sample)}`).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    });
  }

async function start(page: Page, origin: string, mode: string) {
  await page.goto(`${origin}/play-lab/toy-3d?game=${mode}&lang=zh-CN`);
  await page.getByTestId("arcade-start").click();
  await expect(page.getByTestId("arcade3d")).toHaveAttribute("data-frozen", "false");
}
for (const [shell, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  test(`${shell} arcade3d: falling classification, wrong stack, completion and restart`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await start(page, origin, "stack");
    const first = await state(page);
    await expect.poll(async () => (await state(page)).falling?.y).toBeLessThan(first.falling!.y);
    const wrong = (CLAIMS[first.falling!.card]!.answer + 1) % 3;
    await page.getByTestId(`arcade-lane-${wrong}`).click();
    await page.getByTestId("arcade-drop").click();
    expect((await state(page)).piles[wrong]).toHaveLength(1);
    await page.screenshot({ path: info.outputPath("stack-wrong.png") });
    for (let count = 1; count < 24; count++) {
      await expect(page.getByTestId("arcade-drop")).toBeEnabled();
      const s = await state(page);
      const answer = CLAIMS[s.falling!.card]!.answer;
      await page.getByTestId(`arcade-lane-${answer}`).click();
      await page.getByTestId("arcade-drop").click();
    }
    await expect(page.getByTestId("arcade3d")).toHaveAttribute("data-phase", "won");
    expect((await state(page)).correct).toBe(23);
    await expect(page.locator(".arcade3d__review")).toBeVisible();
    await page.screenshot({ path: info.outputPath("stack-complete.png") });
    await page.locator(".arcade3d__overlay").getByRole("button", { name: "重新开一局" }).click();
    await expect(page.getByTestId("arcade-start")).toBeVisible();
    expect((await state(page)).score).toBe(0);
  });
  test(`${shell} arcade3d: word rows clear, a wrong row returns and all 24 finish`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await start(page, origin, "cloze-tetris");
    const first = await state(page);
    const row = first.rows[0]!;
    const bad = first.bag.find((w) => w !== wordIndex(row.card))!;
    await page.getByTestId(`arcade-word-${bad}`).click();
    await page.getByTestId(`arcade-gap-${row.id}`).click();
    expect((await state(page)).junk).toBe(1);
    await page.screenshot({ path: info.outputPath("words-wrong.png") });
    for (let guard = 0; guard < 45 && (await state(page)).phase === "playing"; guard++) {
      await expect
        .poll(
          async () =>
            (await state(page)).rows.some((r) => !r.filled) || (await state(page)).phase === "won",
        )
        .toBe(true);
      const s = await state(page);
      if (s.phase === "won") break;
      const r = s.rows.find((r) => !r.filled)!;
      await page.getByTestId(`arcade-word-${wordIndex(r.card)}`).click();
      await page.getByTestId(`arcade-gap-${r.id}`).click();
    }
    await expect(page.getByTestId("arcade3d")).toHaveAttribute("data-phase", "won");
    const final = await state(page);
    expect(final.resolved).toBe(24);
    expect(final.correct).toBe(25);
    expect(final.firstTry).toBe(23);
    await page.screenshot({ path: info.outputPath("words-complete.png") });
  });
}
test("delivery arcade3d: real steering, projectile collision, wave upgrade and pause", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page, ONLINE_ORIGIN, "invaders");
  await page.keyboard.down("ArrowLeft");
  await expect.poll(async () => (await state(page)).shipX).toBeLessThan(-1);
  await page.keyboard.up("ArrowLeft");
  await expect.poll(async () => (await state(page)).shots.length).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath("flight-live.png") });
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  const paused = await state(page);
  await page.waitForTimeout(700);
  expect((await state(page)).elapsed).toBe(paused.elapsed);
  await page.locator(".arcade3d__overlay").getByRole("button", { name: "继续玩" }).click();
  // Aim using the current visible target's future position. Read-only diagnostic
  // data supplies projection; every input is a real mouse move, never a kill API.
  for (let i = 0; i < 330 && (await state(page)).phase === "playing"; i++) {
    const s = await state(page);
    const candidates = s.enemies
      .map((f) => {
        let x = f.x + (f.vx * Math.max(0, 3.25 - f.z)) / 8.5;
        if (x > 3.3) x = 6.6 - x;
        if (x < -3.3) x = -6.6 - x;
        return { f, x };
      })
      .filter(({ f, x }) => (x < 0 ? 0 : 1) === FLIGHT_CARDS[f.card]![2]);
    const aim = candidates.sort((a, b) => b.f.z - a.f.z)[0]?.x ?? -3.5;
    const point = await page.evaluate((x) => {
      const s = Reflect.get(window, "three");
      const v = s.scene
        .getObjectByName("arcade-player")
        .position.clone()
        .set(x, 0.8, 3.2)
        .project(s.camera);
      const r = s.gl.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) * r.width) / 2, y: r.top + ((1 - v.y) * r.height) / 2 };
    }, aim);
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(90);
  }
  await expect(page.getByTestId("arcade3d")).toHaveAttribute("data-phase", "upgrade");
  expect((await state(page)).score).toBeGreaterThan(0);
  await page.getByTestId("arcade-upgrade-rapid").click();
  expect((await state(page)).wave).toBe(2);
  expect((await state(page)).fireEvery).toBeLessThan(0.48);
  await page.screenshot({ path: info.outputPath("flight-wave-two.png") });
  expect(errors).toEqual([]);
});
for (const width of [320, 390])
  for (const mode of ["invaders", "stack", "cloze-tetris"]) {
    test(`delivery arcade3d: ${mode} ${width}px touch is readable and playable`, async ({
      browser,
    }, info) => {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage();
        await start(page, ONLINE_ORIGIN, mode);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        if (mode === "cloze-tetris") {
          await expect(page.locator(".arcade3d__word-tray button")).toHaveCount(6);
          const bounds = await page.getByTestId("arcade-board").boundingBox();
          const wordBoxes = await page.locator(".arcade3d__word-tray button").evaluateAll((nodes) =>
            nodes.map((n) => {
              const r = n.getBoundingClientRect();
              return { x: r.x, y: r.y, w: r.width, h: r.height };
            }),
          );
          expect(wordBoxes).toHaveLength(6);
          await page.screenshot({ path: info.outputPath(`words-${width}-before.png`) });
          for (const box of wordBoxes) {
            expect(box.h).toBeGreaterThanOrEqual(44);
            expect(box.x).toBeGreaterThanOrEqual(bounds!.x);
            expect(box.y + box.h).toBeLessThanOrEqual(bounds!.y + bounds!.height);
            expect(box.x + box.w).toBeLessThanOrEqual(bounds!.x + bounds!.width);
          }
          const blocked = await page.locator(".arcade3d__word-tray button").evaluateAll((nodes) =>
            nodes.flatMap((n) => {
              const r = n.getBoundingClientRect();
              return [
                [0.5, 0.5],
                [0.8, 0.8],
              ]
                .filter(
                  ([x, y]) =>
                    !n.contains(document.elementFromPoint(r.x + r.width * x!, r.y + r.height * y!)),
                )
                .map(() => n.textContent);
            }),
          );
          expect(blocked).toEqual([]);
          const s = await state(page);
          const r = s.rows[0]!;
          await page.getByTestId(`arcade-word-${wordIndex(r.card)}`).tap();
          await page.getByTestId(`arcade-gap-${r.id}`).tap();
          expect((await state(page)).resolved).toBe(1);
        } else if (mode === "stack") {
          const s = await state(page);
          const answer = CLAIMS[s.falling!.card]!.answer;
          await page.getByTestId(`arcade-lane-${answer}`).tap();
          await page.getByTestId("arcade-drop").tap();
          expect((await state(page)).score).toBeGreaterThan(0);
        } else {
          await page.getByRole("button", { name: "向左飞" }).tap();
          await expect.poll(async () => (await state(page)).shipX).toBeLessThan(-1);
        }
        await scrollIntoView(page.getByTestId("arcade-board"));
        await page.screenshot({ path: info.outputPath(`${mode}-${width}.png`) });
      } finally {
        await context.close();
      }
    });
  }
test("delivery arcade3d: catalog adds three playable entries without removing any 2D entry", async ({
  page,
}, info) => {
  await page.goto(`${ONLINE_ORIGIN}/play-lab/catalog?group=three&entry=three:invaders&lang=zh-CN`);
  await expect(page.getByRole("tab", { name: "3D组件 9", exact: true })).toBeVisible();
  await expect(page.locator("[data-entry-id^='three:']")).toHaveCount(9);
  await page.getByTestId("arcade-start").click();
  await expect(page.getByTestId("arcade-board").locator("canvas")).toBeVisible();
  await page.screenshot({ path: info.outputPath("catalog-3d.png") });
  await page.getByRole("tab", { name: "游戏研究 8", exact: true }).click();
  await expect(page.locator("[data-entry-id='arcade:invaders']")).toBeVisible();
  await expect(page.getByTestId("arcade3d")).toHaveCount(0);
  await expect(page.locator("[data-entry-id^='arcade:']")).toHaveCount(8);
});

test("delivery arcade3d: real word drag checks both target axes, not just a word click", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await start(page, ONLINE_ORIGIN, "cloze-tetris");
  const s = await state(page);
  const row = s.rows[0]!;
  const from = page.getByTestId(`arcade-word-${wordIndex(row.card)}`);
  const startBox = await from.boundingBox();
  await page.mouse.move(startBox!.x + startBox!.width / 2, startBox!.y + startBox!.height / 2);
  await page.mouse.down();
  const gap = page.getByTestId(`arcade-gap-${row.id}`);
  await expect(gap).toBeEnabled();
  const end = await gap.boundingBox();
  await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height / 2, { steps: 18 });
  await page.mouse.up();
  await expect.poll(async () => (await state(page)).resolved).toBe(1);
  await page.screenshot({ path: info.outputPath("word-dragged.png") });
});

test("delivery arcade3d: English word rows and all six tiles remain readable on a phone", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=cloze-tetris&lang=en`);
    await page.getByRole("button", { name: "Start playing", exact: true }).tap();
    const s = await state(page);
    const r = s.rows[0]!;
    await page.getByTestId(`arcade-word-${wordIndex(r.card)}`).tap();
    await page.getByTestId(`arcade-gap-${r.id}`).tap();
    expect((await state(page)).resolved).toBe(1);
    const boxes = await page.locator(".arcade3d__sentence").evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      }),
    );
    for (let i = 1; i < boxes.length; i++)
      expect(boxes[i]!.top).toBeGreaterThan(boxes[i - 1]!.bottom);
    await scrollIntoView(page.getByTestId("arcade-board"));
    await page.screenshot({ path: info.outputPath("words-phone-en.png") });
  } finally {
    await context.close();
  }
});

test("delivery arcade3d: sources and focus loss pause immediately, context recovery retains this round", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await start(page, ONLINE_ORIGIN, "stack");
  await page.locator(".arcade3d__sources summary").click();
  await expect(page.getByTestId("arcade3d")).toHaveAttribute("data-frozen", "true");
  const reading = await state(page);
  await page.waitForTimeout(500);
  expect((await state(page)).elapsed).toBe(reading.elapsed);
  await expect(page.locator(".arcade3d__sources img")).toHaveJSProperty("complete", true);
  await page.getByRole("button", { name: "回到游戏", exact: true }).click();
  await expect(page.getByTestId("arcade3d")).toHaveAttribute("data-frozen", "false");
  // Simulated browser focus notification, not a claim of physical-phone testing.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const blurred = await state(page);
  await page.waitForTimeout(500);
  expect((await state(page)).elapsed).toBe(blurred.elapsed);
  await page
    .locator(".arcade3d__overlay")
    .getByRole("button", { name: "继续玩", exact: true })
    .click();
  const before = await state(page);
  await page
    .getByTestId("arcade-board")
    .locator("canvas")
    .evaluate((el) => el.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
  await expect(page.getByTestId("arcade3d")).toHaveAttribute("data-frozen", "true");
  await expect(page.getByRole("button", { name: "重新打开 3D", exact: true })).toBeVisible();
  expect((await state(page)).resolved).toBe(before.resolved);
  await page.getByRole("button", { name: "重新打开 3D", exact: true }).click();
  await expect(page.getByTestId("arcade3d")).toHaveAttribute("data-frozen", "false");
  expect((await state(page)).resolved).toBe(before.resolved);
  await page.screenshot({ path: info.outputPath("context-reopened.png") });
});
