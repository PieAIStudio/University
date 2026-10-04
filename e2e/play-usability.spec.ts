import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "./harness/learner-test.js";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";

const ROOT = resolve("SCRATCH/play-usability/browser");
const errors = new WeakMap<Page, string[]>();
const modes = [
  ["接线台", "connect"],
  ["归类台", "sort"],
  ["调参实验室", "tune"],
] as const;
const open = async (page: Page, origin: string) => {
  await page.goto(`${origin}/play-lab?lang=zh-CN`);
  await expect(page.locator(".learning-activity")).toHaveAttribute("data-guided", "true");
  await expect(page.getByRole("navigation", { name: "挑一种互动课件" })).toBeVisible();
};

test.use({
  viewport: { width: 390, height: 844 },
  video: { mode: "on", size: { width: 390, height: 844 } },
});
test.beforeEach(({ page }) => {
  mkdirSync(ROOT, { recursive: true });
  const found: string[] = [];
  errors.set(page, found);
  page.on("pageerror", (error) => found.push(error.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  test(`R ${mode} 手机：每种玩法首屏都有真正可做的第一步`, async ({ page }, info) => {
    await open(page, origin);
    for (const [label, kind] of modes) {
      await page
        .getByRole("navigation", { name: "挑一种互动课件" })
        .getByRole("button", { name: label, exact: true })
        .click();
      const activity = page.locator(".learning-activity");
      await expect(activity).toHaveAttribute("data-activity", kind);
      await expect(activity.locator(".learning-activity__game")).toBeVisible();
      await expect(activity.locator(".learning-activity__game")).not.toBeEmpty();
      const bounds = await activity.evaluate((node) => ({
        client: node.clientWidth,
        scroll: node.scrollWidth,
      }));
      expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
      const firstControls: Readonly<Record<string, () => Locator>> = {
        connect: () => page.locator(".play-connect__node").first(),
        sort: () => page.locator(".play-sort__item").first(),
        tune: () => page.locator('.play-tune input[type="range"]').first(),
      };
      const first = firstControls[kind]!();
      await expect(first, `${label} 的第一步控件`).toBeInViewport({ ratio: 1 });
      await page.screenshot({
        path: info.outputPath(`${mode}-${kind}.png`),
        animations: "disabled",
      });
      if (kind === "tune") {
        await first.focus();
        const before = await first.inputValue();
        await first.press("ArrowLeft");
        await expect(first).not.toHaveValue(before);
      } else {
        await first.click();
        if (kind === "connect") await expect(first).toHaveAttribute("aria-pressed", "true");
        else await expect(page.locator(".play-sort__guide")).toContainText("现在点它属于的那一格");
      }
      await page.screenshot({
        path: info.outputPath(`${mode}-${kind}-action.png`),
        animations: "disabled",
      });
    }
  });
}

test("R 难度身份：切档清本轮、切帮助保现场、每种玩法三档都可打开", async ({ page }) => {
  await open(page, ONLINE_ORIGIN);
  const seen = new Set<string>();
  for (const [label] of modes) {
    await page
      .getByRole("navigation", { name: "挑一种互动课件" })
      .getByRole("button", { name: label, exact: true })
      .click();
    for (const [button, level] of [
      ["入门", "intro"],
      ["进阶", "practice"],
      ["挑战", "challenge"],
    ] as const) {
      await page.getByRole("button", { name: button, exact: true }).click();
      const activity = page.locator(".learning-activity");
      await expect(activity).toHaveAttribute("data-difficulty", level);
      const id = await activity.getAttribute("data-activity-id");
      expect(id).toBeTruthy();
      expect(seen.has(id!)).toBe(false);
      seen.add(id!);
      await expect(activity.locator('[data-result="completed"]')).toHaveCount(0);
      await expect(page.getByRole("button", { name: "自由探索", exact: true })).toBeVisible();
    }
  }
  expect(seen.size).toBe(modes.length * 3);
  await open(page, ONLINE_ORIGIN);
  const node = page.locator(".play-connect__node").first();
  await node.click();
  await expect(node).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "自由探索", exact: true }).click();
  await page.getByRole("button", { name: "跟着提示玩", exact: true }).click();
  await expect(node).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "挑战", exact: true }).click();
  await expect(page.locator('.play-connect__node[aria-pressed="true"]')).toHaveCount(0);
});

test("R 连玩可以混合难度，后续简单关不会被全局升难", async ({ page }) => {
  await open(page, ONLINE_ORIGIN);
  await page.getByRole("button", { name: `连玩 ${modes.length} 种`, exact: true }).click();
  const levels = [
    ["入门", "intro"],
    ["挑战", "challenge"],
    ["入门", "intro"],
  ] as const;
  for (const [index, [label, level]] of levels.entries()) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator(".learning-activity")).toHaveAttribute("data-difficulty", level);
    await page.getByRole("button", { name: "先跳过", exact: true }).click();
    await page
      .getByRole("button", {
        name: index === levels.length - 1 ? "这一轮结束了" : "下一个玩法",
        exact: true,
      })
      .click();
  }
  await expect(page.locator(".learning-play-lab__finish")).toContainText(
    `完成 0 种，跳过 ${modes.length} 种`,
  );
});
