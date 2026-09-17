import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";
import { humanClick } from "./harness/click.js";
import { prototypeClick } from "./harness/prototype-click.js";

const ids = (source: "blocks" | "arcade") =>
  [
    ...readFileSync(`docs/reference/interaction-prototype/${source}.html`, "utf8").matchAll(
      /\{\s*id:\s*"([\w-]+)",\s*title:\s*"[^"]+",\s*from:\s*"[^"]*",\s*build:\s*\w+/g,
    ),
  ].map((m) => m[1]!);

for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  test(`catalog ${mode}: complete inventory, live native component and all 28 research mounts`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${origin}/play-lab/catalog?lang=zh-CN`);
    await expect(page.locator("[data-entry-id]")).toHaveCount(50);
    await expect(page.locator(".play-catalog__count")).toHaveText("找到 50 项");
    await expect(page.locator('[data-entry-id="path:follow-a-claim"]')).toHaveCount(1);
    await expect(page.locator('[data-activity="connect"]')).toBeVisible();
    for (const source of ["blocks", "arcade"] as const) {
      for (const id of ids(source)) {
        await page.locator(`[data-entry-id="${source}:${id}"]`).click();
        const frame = page.frameLocator(".play-catalog__prototype iframe");
        await expect(frame.locator("body")).not.toBeEmpty();
        // These include dragging, painting and two-dimensional fields, not
        // just buttons. Require the actual built play surface for each ID.
        const surface = frame.locator(source === "blocks" ? ".stagearea > div" : ".screen").first();
        await expect(surface).toBeVisible();
        await expect(surface).not.toBeEmpty();
        const bounds = await surface.boundingBox();
        expect(bounds!.width).toBeGreaterThan(160);
        expect(bounds!.height).toBeGreaterThan(44);
        if (id === "redact") {
          const text = frame.locator(".redactbox .rk").filter({ hasText: "屏住了呼吸" });
          await expect(text).toBeVisible();
          await text.click();
          await expect(text).toHaveClass(/\bink\b/);
        }
        expect(
          await frame.locator("body").evaluate(() => Reflect.get(window, "__PLAY_CATALOG_ENTRY__")),
        ).toBe(id);
        if (source === "arcade" && id === "defenseline") {
          await prototypeClick(page, frame.locator(".overlay .playbtn"));
          const geometry = await frame.locator(".screen").evaluate((node) => {
            const boxes = [".dl-hint", ".dl-go", ".dl-reader"].map(
              (selector) => node.querySelector(selector)!.getBoundingClientRect().top,
            );
            return {
              footerTop: Math.min(...boxes),
              slots: [...node.querySelectorAll(".dl-slot")].map(
                (slot) => slot.getBoundingClientRect().bottom,
              ),
            };
          });
          expect(geometry.slots).toHaveLength(4);
          for (const bottom of geometry.slots) expect(bottom).toBeLessThan(geometry.footerTop);
          await page.screenshot({ path: info.outputPath("defense-four-slots.png") });
          await prototypeClick(page, frame.locator('.dl-slot[data-i="3"]'));
          await expect(frame.locator(".dl-shophd")).toContainText(/第\s*4\s*位/);
        }
        await expect(page.locator(".play-catalog__prototype iframe")).toHaveAttribute(
          "sandbox",
          "allow-scripts",
        );
        await expect(frame.locator("html")).toHaveAttribute("data-single-prototype", "true");
        if (["forge", "shift", "stamp"].includes(id))
          await page.screenshot({ path: info.outputPath(`${source}-${id}.png`) });
      }
    }
    await page.getByRole("searchbox").fill("no-such-operation");
    await expect(page.locator("[data-entry-id]")).toHaveCount(0);
    await expect(page.locator("#play-catalog-results")).toContainText("没有找到");
    await page.getByRole("searchbox").fill("follow-a-claim");
    await expect(page.locator("[data-entry-id]")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test("catalog prototype clock pauses, inputs stop, resume and exit are real", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${ONLINE_ORIGIN}/play-lab/catalog?lang=zh-CN`);
  await page.locator('[data-entry-id="arcade:forge"]').click();
  const frame = page.frameLocator(".play-catalog__prototype iframe");
  const start = frame.getByRole("button", { name: "接第一单", exact: true });
  await expect(start).toBeVisible();
  await prototypeClick(page, start);
  await expect(frame.getByRole("heading", { name: "AI 交来的", exact: true })).toBeVisible();
  // The first order randomly omits one or two facts and varies the others'
  // wording. Select a present factual clause, not one optional fixed sentence.
  const unsupported = frame.locator('.rf-line.tap[data-k]:not([data-k^="_"])').first();
  await expect(unsupported).toBeVisible();
  const pause = page.getByRole("button", { name: "暂停", exact: true });
  await humanClick(page, pause, "pause this embedded prototype");
  await expect(frame.locator("html")).toHaveAttribute("data-paused", "");
  const stoppedTime = await frame.locator("body").evaluate(() => performance.now());
  const before = await frame.locator("body").innerText();
  // Deliberately click the paused playfield with a real pointer. A locator
  // click would wait for the very input blocking that this assertion tests.
  await unsupported.scrollIntoViewIfNeeded();
  const blocked = await unsupported.boundingBox();
  expect(blocked).not.toBeNull();
  await page.mouse.click(blocked!.x + blocked!.width / 2, blocked!.y + blocked!.height / 2);
  await page.waitForTimeout(180); // Deliberate clock assertion, not an arbitrary loading wait.
  expect(await frame.locator("body").evaluate(() => performance.now())).toBe(stoppedTime);
  expect(await frame.locator("body").innerText()).toBe(before);
  await humanClick(
    page,
    page.getByRole("button", { name: "继续", exact: true }),
    "resume this prototype",
  );
  await expect(frame.locator("html")).not.toHaveAttribute("data-paused", "");
  await expect
    .poll(() => frame.locator("body").evaluate(() => performance.now()))
    .toBeGreaterThan(stoppedTime);
  await prototypeClick(page, unsupported);
  await expect.poll(() => frame.locator("body").innerText()).not.toBe(before);
  await page.screenshot({ path: info.outputPath("forge-detected-claim.png") });
  await humanClick(
    page,
    page.getByRole("button", { name: "退出试玩", exact: true }),
    "remove the prototype and stop its timers",
  );
  await expect(page.locator(".play-catalog__prototype iframe")).toHaveCount(0);
});

test("catalog phone can choose a long game and restore its picker", async ({ browser }, info) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "zh-CN",
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.goto(`${ONLINE_ORIGIN}/play-lab/catalog?lang=zh-CN`);
    await page.locator('[data-entry-id="arcade:shift"]').click();
    await expect(page.locator(".play-catalog__picker")).not.toHaveAttribute("open", "");
    const frame = page.frameLocator(".play-catalog__prototype iframe");
    await expect(frame.locator("button").first()).toBeVisible();
    expect(
      await frame
        .locator("body")
        .evaluate(() => ({ width: innerWidth, screen: screen.width }))
        .then((x) => x.width),
    ).toBeLessThan(400);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath("long-game-phone.png") });
    await page.getByRole("button", { name: "退出试玩", exact: true }).click();
    await expect(page.locator(".play-catalog__picker")).toHaveAttribute("open", "");
    await expect(page.locator(".play-catalog__results button").first()).toBeFocused();
  } finally {
    await context.close();
  }
});
