import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "./harness/learner-test.js";

import { humanClick } from "./harness/click.js";
import { LOCAL_ORIGIN, ONLINE_ORIGIN } from "./ports.js";

const EVIDENCE = resolve("SCRATCH/learning-play-lab/browser");
const MODES = ["接线台", "归类台", "调参实验室"] as const;
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(pageErrors.get(page), "完成的活动不能吞掉浏览器异常").toEqual([]);
});

const activity = (page: Page) => page.locator(".learning-activity");
const button = (page: Page, name: string | RegExp) =>
  page.getByRole("button", { name, exact: typeof name === "string" });

async function explore(page: Page) {
  const control = page.getByRole("button", { name: "自由探索", exact: true });
  if (await control.count()) await control.click();
}

async function openLab(page: Page, origin = ONLINE_ORIGIN) {
  await page.goto(`${origin}/play-lab`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "进阶", exact: true }).click();
  await expect(activity(page)).toHaveAttribute("data-activity-id", /^connect-web:/);
  await page.evaluate(() => document.documentElement.setAttribute("data-game-ui-theme", "light"));
  await explore(page);
}

async function mode(page: Page, name: string) {
  await humanClick(
    page,
    page
      .getByRole("navigation", { name: "挑一种互动课件" })
      .getByRole("button", { name: new RegExp(`^${name}`) }),
    name,
  );
  await explore(page);
}

async function capture(page: Page, name: string) {
  mkdirSync(EVIDENCE, { recursive: true });
  await activity(page).evaluate((node) => {
    const scroller = node.closest(".app-shell__main");
    if (scroller && scroller.scrollHeight > scroller.clientHeight)
      scroller.scrollTop +=
        node.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16;
    else node.scrollIntoView({ block: "start", behavior: "instant" });
  });
  await page.screenshot({ path: resolve(EVIDENCE, `${name}.png`) });
}

async function completed(page: Page) {
  await expect(activity(page).locator('[data-result="completed"]')).toBeVisible();
}

async function setRange(slider: Locator, value: number) {
  await slider.focus();
  await slider.press("Home");
  const min = Number(await slider.getAttribute("min"));
  const max = Number(await slider.getAttribute("max"));
  for (let count = 0; count < Math.floor((value - min) / ((max - min) / 10)); count++)
    await slider.press("PageUp");
  const remaining = value - Number(await slider.inputValue());
  for (let count = 0; count < Math.abs(remaining); count++)
    await slider.press(remaining > 0 ? "ArrowRight" : "ArrowLeft");
  await expect(slider).toHaveValue(String(value));
}

async function connect(page: Page, labels: readonly string[]) {
  for (const [from, to] of [
    [3, 5],
    [3, 4],
    [2, 3],
    [1, 2],
    [0, 1],
  ]) {
    await humanClick(page, button(page, labels[from!]!), "接线起点");
    await humanClick(page, button(page, labels[to!]!), "接线终点");
  }
  await humanClick(page, button(page, "放出测试信号"), "放出信号");
  await completed(page);
  await expect(page.locator(".play-connect__traces p")).toHaveCount(2);
}

test.describe("P 基础玩法", () => {
  test.use({ viewport: { width: 1440, height: 1100 } });

  test("接线能纠正额外关系，两种情境都执行两条路径", async ({ page }) => {
    await openLab(page);
    await button(page, "点击刷新").click();
    await button(page, "显示新内容").click();
    await button(page, "放出测试信号").click();
    await expect(page.locator('.learning-activity__feedback[data-passed="false"]')).toContainText(
      "不会直接触发",
    );
    await button(page, "移除 点击刷新 到 显示新内容").click();
    await connect(page, [
      "点击刷新",
      "发出请求",
      "服务端处理",
      "收到响应",
      "显示新内容",
      "说明失败原因",
    ]);
    await capture(page, "connect-web-success-light");
    await button(page, "换个情境").click();
    await explore(page);
    await expect(activity(page)).toHaveAttribute("data-activity-id", /^connect-film:/);
    await connect(page, [
      "准备分镜素材",
      "剪辑片段",
      "导出预览",
      "检查成片",
      "发布片段",
      "记录问题并修改",
    ]);
    await capture(page, "connect-film-success-light");
  });

  test("归类保留解释，六张材料全部放对才完成", async ({ page }) => {
    await openLab(page);
    await mode(page, "归类台");
    const items = activity(page).locator(".play-sort__item");
    await expect(items).toHaveCount(6);
    const buckets = activity(page).locator(".play-sort__bucket-head");
    while ((await items.count()) > 0) {
      await items.first().click();
      const before = await items.count();
      for (let index = 0; index < (await buckets.count()); index += 1) {
        await buckets.nth(index).click();
        if ((await items.count()) < before) break;
      }
    }
    await completed(page);
    await expect(activity(page).locator(".play-sort__note--right")).toBeVisible();
    await capture(page, "sort-success-light");
  });

  test("调参必须同时满足目标，保留实验对照与多个可行解", async ({ page }) => {
    await openLab(page);
    await mode(page, "调参实验室");
    await button(page, "记录这次实验").click();
    await expect(page.locator('.learning-activity__feedback[data-passed="false"]')).toContainText(
      "目标没达到",
    );
    await setRange(page.getByRole("slider", { name: "图片宽度" }), 840);
    await setRange(page.getByRole("slider", { name: "编码质量" }), 80);
    await button(page, "记录这次实验").click();
    await completed(page);
    await expect(page.locator(".play-tune__history li")).toHaveCount(2);
    await capture(page, "tune-image-success-light");
    await button(page, "换个情境").click();
    await explore(page);
    await setRange(page.getByRole("slider", { name: "每批任务数" }), 6);
    await setRange(page.getByRole("slider", { name: "并发工作者" }), 2);
    await button(page, "记录这次实验").click();
    await completed(page);
    await capture(page, "tune-batch-success-light");
  });

  test("连续试玩只记录保留的三种玩法，刷新后不冒充课程进度", async ({ page }) => {
    await openLab(page);
    await button(page, `连玩 ${MODES.length} 种`).click();
    for (let index = 0; index < MODES.length; index++) {
      await button(page, "先跳过").click();
      await expect(activity(page).locator('[data-result="skipped"]')).toBeVisible();
      await button(page, index === MODES.length - 1 ? "这一轮结束了" : "下一个玩法").click();
    }
    await expect(page.locator(".learning-play-lab__finish")).toContainText(
      `完成 0 种，跳过 ${MODES.length} 种`,
    );
    await expect(page.locator(".learning-play-lab__session")).toContainText(
      `本次发现 0 / ${MODES.length}`,
    );
    await page.reload();
    await expect(activity(page)).toHaveAttribute("data-activity-id", /^connect-web:/);
    await expect(page.locator(".learning-play-lab__session")).toContainText(
      `本次发现 0 / ${MODES.length}`,
    );
  });
});

test.describe("P 手机与同一学习者表面", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    contextOptions: { reducedMotion: "reduce" },
  });

  for (const [name, origin] of [
    ["delivery", ONLINE_ORIGIN],
    ["authoring", LOCAL_ORIGIN],
  ]) {
    test(`${name}：保留的三种玩法在窄屏都能操作`, async ({ page }) => {
      await openLab(page, origin);
      for (const [index, label] of MODES.entries()) {
        await mode(page, label);
        await page.evaluate(
          (theme) => document.documentElement.setAttribute("data-game-ui-theme", theme),
          index % 2 === 0 ? "light" : "dark",
        );
        await capture(page, `${name}-mobile-${index}`);
        const bounds = await activity(page).evaluate((node) => ({
          scroll: node.scrollWidth,
          client: node.clientWidth,
          left: node.getBoundingClientRect().left,
          right: node.getBoundingClientRect().right,
        }));
        expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(390);
        await humanClick(page, button(page, "给我一个线索"), "手机线索按钮");
        await expect(button(page, "收起线索")).toHaveAttribute("aria-expanded", "true");
      }
    });
  }
});
