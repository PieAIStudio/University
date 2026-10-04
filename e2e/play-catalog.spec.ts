import { expect, test } from "./harness/learner-test.js";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";

/*
 * The play lab holds the lesson actions, the sample lessons and the island
 * games. The research prototypes, history pages and earlier 3D editions were
 * deleted on 2026-10-01 (Owner G3); their screenshots stay in the
 * interaction-components album.
 */
const ISLAND_GAMES = ["courtyard", "links", "snake", "moles", "runner", "blocks"];

for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  test(`catalog ${mode}: complete inventory, a live native component and the six island games`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${origin}/play-lab/catalog?lang=zh-CN`);
    await expect(page.locator("[data-entry-id]")).toHaveCount(12);
    await expect(page.locator(".play-catalog__count")).toHaveText("找到 12 项");
    await expect(page.locator('[data-entry-id="path:ask-about-a-picture"]')).toHaveCount(1);
    await expect(page.locator('[data-activity="connect"]')).toBeVisible();
    const three = page.locator("[data-entry-id^='three:']");
    await expect(three).toHaveCount(ISLAND_GAMES.length);
    expect(await three.evaluateAll((nodes) => nodes.map((node) => node.dataset.entryId))).toEqual(
      ISLAND_GAMES.map((game) => `three:${game}`),
    );
    await page.getByRole("searchbox").fill("no-such-operation");
    await expect(page.locator("[data-entry-id]")).toHaveCount(0);
    await expect(page.locator("#play-catalog-results")).toContainText("没有找到");
    await page.getByRole("searchbox").fill("ask-about-a-picture");
    await expect(page.locator("[data-entry-id]")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test("catalog phone can choose an island game and restore its picker", async ({
  browser,
}, info) => {
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
    await page.locator('[data-entry-id="three:links"]').click();
    await expect(page.locator(".play-catalog__picker")).not.toHaveAttribute("open", "");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath("island-game-phone.png") });
    await page.getByRole("button", { name: "退出试玩", exact: true }).click();
    await expect(page.locator(".play-catalog__picker")).toHaveAttribute("open", "");
    await expect(page.locator(".play-catalog__results button").first()).toBeFocused();
  } finally {
    await context.close();
  }
});
