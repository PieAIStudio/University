import { expect, test } from "@playwright/test";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";
import { SOURCE, TOY_MODES, toyDeck } from "../packages/world/src/toy-play/rules.js";

for (const [shell, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  for (const mode of TOY_MODES) {
    test(`toy ${shell} ${mode}: real scene, wrong answer, retry and complete round`, async ({
      page,
    }, info) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`${origin}/play-lab/toy-3d?game=${mode}&lang=zh-CN`);
      const lab = page.getByTestId("toy-lab");
      await expect(lab).toHaveAttribute("data-mode", mode);
      await expect(page.getByTestId("toy-choice-0")).toBeEnabled();
      await expect(page.getByTestId("toy-scene").locator("canvas")).toBeVisible();
      await expect(page.locator(".toy-lab__material img")).toHaveAttribute("src", SOURCE.image);
      await expect
        .poll(() =>
          page
            .locator(".toy-lab__material img")
            .evaluate((el) => (el as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      // Real model loading, not a static image dressed up as a 3D result.
      expect(
        await page.evaluate(() => {
          const state = Reflect.get(window, "three");
          return Boolean(state?.scene.getObjectByName("toy-garden"));
        }),
      ).toBe(true);
      await page.screenshot({ path: info.outputPath(`${mode}-entry.png`) });

      const act = async (index: number) => {
        await page.getByTestId(`toy-choice-${index}`).click();
        if (mode !== "stack") await page.getByTestId("toy-submit").click();
      };
      const deck = toyDeck(mode);
      await act((deck[0]!.answer + 1) % 2);
      await expect(page.locator(".toy-lab__feedback")).toHaveAttribute("data-correct", "false");
      await expect(lab).toHaveAttribute("data-cursor", "0");
      await page.getByTestId("toy-next").click();
      await expect(lab).toHaveAttribute("data-phase", "playing");

      for (const [index, card] of deck.entries()) {
        await act(card.answer);
        await expect(page.locator(".toy-lab__feedback")).toHaveAttribute("data-correct", "true");
        if (index === 0) await page.screenshot({ path: info.outputPath(`${mode}-corrected.png`) });
        await page.getByTestId("toy-next").click();
      }
      await expect(lab).toHaveAttribute("data-phase", "complete");
      await expect(page.locator(".toy-lab__result")).toContainText(
        `${deck.length - 1} 件首次判断正确`,
      );
      await expect(page.locator(".toy-lab__result")).toContainText("不代表已经学会");
      await page.screenshot({ path: info.outputPath(`${mode}-complete.png`) });
      await page.getByRole("button", { name: "重新开始", exact: true }).click();
      await expect(lab).toHaveAttribute("data-phase", "playing");
      await expect(lab).toHaveAttribute("data-cursor", "0");
      expect(errors).toEqual([]);
    });
  }
}

test("toy: actual geometry drag lands a parcel in the correct socket", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=stack&lang=zh-CN`);
  await expect(page.getByTestId("toy-choice-0")).toBeEnabled();
  await page.getByTestId("toy-scene").scrollIntoViewIfNeeded();
  const coordinates = await page.evaluate(() => {
    const state = Reflect.get(window, "three");
    const rect = state.gl.domElement.getBoundingClientRect();
    const parcel = state.scene.getObjectByName("toy-parcel");
    const target = state.scene.getObjectByName("toy-sort-target-0");
    const start = parcel.getWorldPosition(parcel.position.clone()).project(state.camera);
    const point = target.getWorldPosition(target.position.clone());
    point.y = 0.75;
    const finish = point.project(state.camera);
    const screen = (v: { x: number; y: number }) => ({
      x: rect.left + ((v.x + 1) * rect.width) / 2,
      y: rect.top + ((1 - v.y) * rect.height) / 2,
    });
    return { start: screen(start), finish: screen(finish) };
  });
  await page.mouse.move(coordinates.start.x, coordinates.start.y);
  await page.mouse.down();
  await page.mouse.move(coordinates.finish.x, coordinates.finish.y, { steps: 15 });
  await page.mouse.up();
  await expect(page.locator(".toy-lab__feedback")).toHaveAttribute("data-correct", "true");
  await page.screenshot({ path: info.outputPath("parcel-physical-drag.png") });
});

test("toy: clocks, source reading, keyboard, simple mode and English remain usable", async ({
  page,
}, info) => {
  await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=invaders&lang=en`);
  const lab = page.getByTestId("toy-lab");
  await expect(page.getByTestId("toy-choice-0")).toBeEnabled();
  await page.getByRole("checkbox").check();
  await expect.poll(() => lab.getAttribute("data-seconds")).not.toBe("25");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const paused = await lab.getAttribute("data-seconds");
  await page.waitForTimeout(1250); // Tests the clock, not load readiness.
  await expect(lab).toHaveAttribute("data-seconds", paused!);
  await expect(page.getByTestId("toy-choice-0")).toBeDisabled();
  await page.locator(".toy-lab__cover").getByRole("button", { name: "Resume" }).click();
  await page.getByText("Read NASA's image record", { exact: true }).click();
  const sourcePaused = await lab.getAttribute("data-seconds");
  await page.waitForTimeout(1250);
  await expect(lab).toHaveAttribute("data-seconds", sourcePaused!);
  await page.getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "Simple mode", exact: true }).click();
  await expect(page.getByTestId("toy-scene").locator("canvas")).toHaveCount(0);
  await page.locator(".toy-lab__question h2").focus();
  await page.keyboard.press("1");
  await expect(page.getByTestId("toy-choice-0")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("toy-submit").click();
  await expect(page.locator(".toy-lab__feedback")).toHaveAttribute("data-correct", "true");
  await page.screenshot({ path: info.outputPath("english-simple-mode.png") });
});

test("toy: touch phone has non-overlapping controls and readable labels", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=cloze-tetris&lang=zh-CN`);
    await expect(page.getByTestId("toy-choice-0")).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.getByTestId("toy-choice-0").tap();
    await page.getByTestId("toy-slot").tap();
    await expect(page.locator(".toy-lab__feedback")).toHaveAttribute("data-correct", "true");
    await page.getByTestId("toy-scene").scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("phone-word-fitted.png") });
    const buttons = page.getByTestId("toy-scene").locator("button");
    const boxes = await buttons.evaluateAll((elements) =>
      elements.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }),
    );
    for (let i = 0; i < boxes.length; i++) {
      expect(boxes[i]!.h).toBeGreaterThanOrEqual(44);
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!,
          b = boxes[j]!;
        const overlap =
          Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) &&
          Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
        expect(overlap, `scene controls ${i}/${j}`).toBe(false);
      }
    }
  } finally {
    await context.close();
  }
});

for (const width of [320, 390]) {
  for (const mode of TOY_MODES) {
    test(`toy: ${width}px touch ${mode} has separated controls before and after a choice`, async ({
      browser,
    }, info) => {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage();
        await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=${mode}&lang=zh-CN`);
        await expect(page.getByTestId("toy-choice-0")).toBeEnabled();
        const scene = page.getByTestId("toy-scene");
        const checkLayout = async (phase: string) => {
          await scene.scrollIntoViewIfNeeded();
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
              ),
          );
          const boxes = await scene.locator("button").evaluateAll((elements) =>
            elements.map((e) => {
              const r = e.getBoundingClientRect();
              return { id: e.getAttribute("data-testid"), x: r.x, y: r.y, w: r.width, h: r.height };
            }),
          );
          await page.screenshot({ path: info.outputPath(`${mode}-${width}-${phase}.png`) });
          for (let i = 0; i < boxes.length; i++) {
            expect(boxes[i]!.w).toBeGreaterThanOrEqual(44);
            expect(boxes[i]!.h).toBeGreaterThanOrEqual(44);
            for (let j = i + 1; j < boxes.length; j++) {
              const a = boxes[i]!,
                b = boxes[j]!;
              expect(
                Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) &&
                  Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y),
                `${a.id}/${b.id} ${phase}`,
              ).toBe(false);
            }
          }
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          ).toBe(true);
        };
        await checkLayout("before");
        await page.getByTestId("toy-choice-0").tap();
        if (mode !== "stack") await page.getByTestId("toy-submit").tap();
        await expect(page.locator(".toy-lab__feedback")).toHaveAttribute("data-correct", "true");
        await checkLayout("after");
      } finally {
        await context.close();
      }
    });
  }
}

test("toy: context loss keeps the current task playable and renderer can be reopened", async ({
  page,
}) => {
  await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=stack&lang=en`);
  await expect(page.getByTestId("toy-choice-0")).toBeEnabled();
  await page.getByTestId("toy-choice-0").click();
  await page.getByTestId("toy-next").click();
  await expect(page.getByTestId("toy-lab")).toHaveAttribute("data-cursor", "1");
  const lost = await page.evaluate(() => {
    const state = Reflect.get(window, "three");
    const extension = state.gl.getContext().getExtension("WEBGL_lose_context");
    if (!extension) return false;
    extension.loseContext();
    return true;
  });
  expect(lost).toBe(true);
  await expect(page.getByTestId("toy-scene").locator("canvas")).toHaveCount(0);
  await expect(page.getByTestId("toy-lab")).toHaveAttribute("data-cursor", "1");
  await page.getByTestId("toy-choice-1").click();
  await expect(page.locator(".toy-lab__feedback")).toHaveAttribute("data-correct", "true");
  await page.getByRole("button", { name: "Show 3D", exact: true }).click();
  await expect(page.getByTestId("toy-scene").locator("canvas")).toBeVisible();
  await page.getByTestId("toy-next").click();
  await expect(page.getByTestId("toy-choice-0")).toBeEnabled();
  await expect(page.getByTestId("toy-lab")).toHaveAttribute("data-cursor", "2");
});

test("toy: a word tile can be dragged into its physical slot", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=cloze-tetris&lang=zh-CN`);
  await expect(page.getByTestId("toy-choice-0")).toBeEnabled();
  await page.getByTestId("toy-scene").scrollIntoViewIfNeeded();
  const points = await page.evaluate(() => {
    const state = Reflect.get(window, "three");
    const tile = state.scene.getObjectByName("toy-word-tile-0");
    const rect = state.gl.domElement.getBoundingClientRect();
    const start = tile.getWorldPosition(tile.position.clone()).project(state.camera);
    const end = tile.position.clone().set(0, 0.75, 1.8).project(state.camera);
    const screen = (v: { x: number; y: number }) => ({
      x: rect.left + ((v.x + 1) * rect.width) / 2,
      y: rect.top + ((1 - v.y) * rect.height) / 2,
    });
    return { start: screen(start), end: screen(end) };
  });
  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down();
  await page.mouse.move(points.end.x, points.end.y, { steps: 18 });
  await page.mouse.up();
  await expect(page.locator(".toy-lab__feedback")).toHaveAttribute("data-correct", "true");
  await page.screenshot({ path: info.outputPath("word-physical-drag.png") });
});
