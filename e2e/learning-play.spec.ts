import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { humanClick } from "./harness/click.js";
import { LOCAL_ORIGIN, ONLINE_ORIGIN } from "./ports.js";

const EVIDENCE = resolve("SCRATCH/learning-play-lab/browser");
const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(
    pageErrors.get(page),
    "A completed activity must not hide an uncaught browser error",
  ).toEqual([]);
});
/*
  The foundation shelf, in the order the lab prints it. Eight now: `sort` had an
  engine, a renderer, three lessons and a gate before it had a button here, and
  `contrast` and `weigh` arrived together to cover the 对比 and 决策 lesson
  shapes — 221 of 469 lessons — that had no playable shape at all. Keeping the list explicit is deliberate — a spec that derived it from
  the component could not notice a game disappearing from both at once — but
  `LearningPlayLab.test.tsx` is what holds the component against the wire enum.

  The first entry said 「因果接线台」 and the button has said 「接线台」 for a while,
  so the two mobile cases below could never find it and had been red on their
  first click. Nothing else in this file uses the list, which is why it went
  unnoticed: a stale name in a fixture fails loudly only where it is read.
*/
const MODES = [
  "接线台",
  "归类台",
  "对照台",
  "取舍台",
  "调参实验室",
  "反例猎手",
  "请求调度台",
  "指令画布",
];
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

// Exercise the browser's range input through its real keyboard behavior.
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
  // Building branches first must be just as valid as starting at the first node.
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

async function program(page: Page, commands: readonly (readonly [string, number])[]) {
  for (const [index, [operation, repeat]] of commands.entries()) {
    await button(page, `添加${operation}指令`).click();
    await page
      .getByRole("spinbutton", { name: `第 ${index + 1} 条指令的重复次数` })
      .fill(String(repeat));
  }
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

  test("反例来自用户输入：普通值无功、边界值与负数成立，重玩清空记录", async ({ page }) => {
    await openLab(page);
    await mode(page, "反例猎手");
    const input = activity(page).getByRole("spinbutton");
    await input.fill("");
    await button(page, "运行这个输入").click();
    await expect(activity(page).locator('[data-result="completed"]')).toHaveCount(0);
    await input.fill("120");
    await button(page, "运行这个输入").click();
    await expect(page.locator('.learning-activity__feedback[data-passed="false"]')).toBeVisible();
    await input.fill("100");
    await button(page, "运行这个输入").click();
    await completed(page);
    await capture(page, "hunt-shipping-success-light");
    await button(page, "重新开始").click();
    await expect(input).toHaveValue("120");
    await expect(page.getByRole("region", { name: "测试记录" })).toHaveCount(0);
    await button(page, "换个情境").click();
    await explore(page);
    await input.fill("-1");
    await button(page, "运行这个输入").click();
    await completed(page);
    await capture(page, "hunt-volume-success-light");
  });

  test("调度须先准备缓存，及时数据不能复用，两种工作流均守住预算", async ({ page }) => {
    await openLab(page);
    await mode(page, "请求调度台");
    await button(page, /^缓存 成本/).click();
    await expect(page.locator(".play-dispatch__feedback")).toContainText("缓存");
    await expect(page.getByRole("progressbar", { name: "请求服务进度" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    for (const lane of ["文件服务", "实时服务", "文件服务", "缓存", "实时服务", "缓存", "缓存"])
      await button(page, new RegExp(`^${lane} 成本`)).click();
    await completed(page);
    await expect(page.locator(".play-dispatch__history li")).toHaveCount(7);
    await capture(page, "dispatch-website-success-light");
    await button(page, "换个情境").click();
    await explore(page);
    for (const lane of [
      "素材库",
      "制作服务",
      "素材库",
      "已有副本",
      "制作服务",
      "已有副本",
      "已有副本",
    ])
      await button(page, new RegExp(`^${lane} 成本`)).click();
    await completed(page);
    await capture(page, "dispatch-video-success-light");
  });

  test("指令碰撞能定位，停止保留编辑，重复动作在两个场地都走到终点", async ({ page }) => {
    await openLab(page);
    await mode(page, "指令画布");
    await program(page, [
      ["前进", 1],
      ["右转", 1],
      ["前进", 1],
    ]);
    await button(page, "运行指令").click();
    await expect(page.locator('.learning-activity__feedback[data-passed="false"]')).toContainText(
      "B4 有障碍",
    );
    await capture(page, "program-collision-light");
    await button(page, "清空").click();
    await program(page, [
      ["前进", 2],
      ["右转", 1],
      ["前进", 4],
      ["左转", 1],
      ["前进", 2],
    ]);
    await button(page, "运行指令").click();
    await button(page, "停下重改").click();
    await expect(page.locator(".play-program__commands li")).toHaveCount(5);
    await expect(activity(page).locator('[data-result="completed"]')).toHaveCount(0);
    await button(page, "运行指令").click();
    await completed(page);
    await expect(page.locator(".play-program__pose")).toContainText("E1");
    await capture(page, "program-delivery-success-light");
    await button(page, "换个情境").click();
    await explore(page);
    await program(page, [
      ["前进", 2],
      ["左转", 1],
      ["前进", 3],
      ["右转", 1],
      ["前进", 3],
      ["左转", 1],
      ["前进", 1],
    ]);
    await button(page, "运行指令").click();
    await completed(page);
    await expect(page.locator(".play-program__pose")).toContainText("F1");
    await capture(page, "program-irrigation-success-light");
  });

  test("暂停和超时保留调度现场，可以退出计时继续练习", async ({ page }) => {
    // Install before app initialization: replacing performance.now under an
    // already-running avatar produces a negative frame delta unrelated to the game.
    await page.clock.install();
    await openLab(page);
    await mode(page, "请求调度台");
    await button(page, /^文件服务 成本/).click();
    await page.getByRole("switch", { name: "限时挑战" }).click();
    await page.clock.runFor(3_000);
    await button(page, "暂停").click();
    const paused = await page.getByRole("timer").innerText();
    await page.clock.runFor(10_000);
    await expect(page.getByRole("timer")).toHaveText(paused);
    await expect(button(page, /^实时服务 成本/)).toBeDisabled();
    await button(page, "继续计时").click();
    await page.clock.runFor(61_000);
    await expect(button(page, "继续不限时练习")).toBeVisible();
    await expect(page.locator(".play-dispatch__history li")).toHaveCount(1);
    await button(page, "继续不限时练习").click();
    await expect(button(page, /^实时服务 成本/)).toBeEnabled();
    await button(page, /^实时服务 成本/).click();
    await expect(page.locator(".play-dispatch__history li")).toHaveCount(2);
    await capture(page, "dispatch-timeout-recovery-light");
  });

  test("连续试玩单独记录跳过，刷新后不冒充课程进度", async ({ page }) => {
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
    test(`${name}：基础玩法在窄屏都能操作，键盘找到反例`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await openLab(page, origin);
      for (const [index, label] of MODES.entries()) {
        await mode(page, label!);
        await page.evaluate(
          (theme) => document.documentElement.setAttribute("data-game-ui-theme", theme),
          index % 2 === 0 ? "light" : "night",
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
      await mode(page, "反例猎手");
      const input = activity(page).getByRole("spinbutton");
      await input.focus();
      await input.fill("100");
      await input.press("Tab");
      await expect(button(page, "运行这个输入")).toBeFocused();
      await page.keyboard.press("Enter");
      await completed(page);
      expect(errors).toEqual([]);
    });
  }
});

test("P 手机长程序运行时棋盘和停止按钮都在视口里", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openLab(page);
  await mode(page, "指令画布");
  await button(page, "换个情境").click();
  await explore(page);
  await program(page, [
    ["前进", 2],
    ["左转", 1],
    ["前进", 3],
    ["右转", 1],
    ["前进", 3],
    ["左转", 1],
    ["前进", 1],
  ]);
  await button(page, "运行指令").click();
  const board = page.locator(".play-program__board");
  await expect(board).toBeInViewport({ ratio: 1 });
  await expect(button(page, "停下重改")).toBeInViewport({ ratio: 1 });
  mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: resolve(EVIDENCE, "program-mobile-playing.png") });
  await button(page, "停下重改").click();
  await expect(page.locator(".play-program__commands li")).toHaveCount(7);
  await button(page, "运行指令").click();
  await completed(page);
  await expect(page.locator(".play-program__pose")).toContainText("F1");
});

test("P 宽屏中的窄课文栏仍保留可读棋盘与单栏编辑", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openLab(page);
  await mode(page, "指令画布");
  // Model a narrow lesson column without changing the device or component tree.
  await activity(page).evaluate((node) => {
    (node as HTMLElement).style.inlineSize = "390px";
  });
  const board = page.locator(".play-program__board");
  const editor = page.locator(".play-program__editor");
  const boardRect = await board.boundingBox();
  const editorRect = await editor.boundingBox();
  expect(boardRect!.width).toBeGreaterThan(280);
  expect(editorRect!.y).toBeGreaterThan(boardRect!.y + boardRect!.height);
  for (const control of await page.locator(".play-program__palette button").all()) {
    expect((await control.boundingBox())!.width).toBeGreaterThan(90);
  }
  await program(page, [
    ["前进", 2],
    ["右转", 1],
    ["前进", 4],
    ["左转", 1],
    ["前进", 2],
  ]);
  await button(page, "运行指令").click();
  await completed(page);
  await expect(board).toBeInViewport({ ratio: 1 });
  await capture(page, "program-embedded-success-light");
});
