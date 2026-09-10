import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";

const ROOT = resolve("SCRATCH/play-usability/browser");
/*
  Label to engine kind, by name rather than by position.

  This was a second array read with `[...AI, ...BASE].indexOf(name)`, so adding
  `sort` to the middle of the foundation shelf silently paired every game after
  it with the wrong engine — and the assertion still looked like it was checking
  something. Three parallel lists in this file went stale the same way at once.
*/
const KIND: Readonly<Record<string, string>> = {
  原型对焦台: "ai-brief",
  上下文装箱: "ai-context",
  "Agent 驾驶舱": "ai-agent",
  "AI 试车场": "ai-eval",
  返工时光机: "ai-repair",
  接线台: "connect",
  归类台: "sort",
  调参实验室: "tune",
  反例猎手: "hunt",
  请求调度台: "dispatch",
  指令画布: "program",
};

const AI = ["原型对焦台", "上下文装箱", "Agent 驾驶舱", "AI 试车场", "返工时光机"];
/*
  The foundation shelf, in the order the lab prints it, index-aligned with the
  「first step」 locators below. The first entry said 「因果接线台」 and the button
  has said 「接线台」 for a while, so both mobile cases had been failing on their
  first click; 「归类台」 is new because `sort` was on the shelf everywhere except
  the page that shows the shelf.
*/
const BASE = ["接线台", "归类台", "调参实验室", "反例猎手", "请求调度台", "指令画布"];
const act = (page: Page) => page.locator(".learning-activity");
const btn = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const errors = new WeakMap<Page, string[]>();
test.use({
  viewport: { width: 390, height: 844 },
  video: { mode: "on", size: { width: 390, height: 844 } },
});
test.beforeEach(({ page }) => {
  const found: string[] = [];
  errors.set(page, found);
  page.on("pageerror", (error) => found.push(error.message));
  mkdirSync(ROOT, { recursive: true });
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));
async function open(page: Page, collection = "ai", origin = ONLINE_ORIGIN) {
  await page.goto(`${origin}/play-lab${collection === "ai" ? "/ai" : ""}`);
  await expect(act(page)).toHaveAttribute("data-guided", "true");
  await page.evaluate(() => document.documentElement.setAttribute("data-game-ui-theme", "night"));
}
async function mode(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "挑一种互动课件" })
    .getByRole("button", { name, exact: true })
    .click();
  await expect(act(page)).toHaveAttribute("data-activity", KIND[name]!);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const s = document.querySelector(".app-shell__main");
    if (s) s.scrollTop = 0;
  });
}
async function capture(page: Page, name: string, selector?: string) {
  if (selector)
    await page
      .locator(selector)
      .first()
      .evaluate((node) => node.scrollIntoView({ block: "start", behavior: "instant" }));
  await page.screenshot({ path: resolve(ROOT, `${name}.png`), animations: "disabled" });
}
async function complete(page: Page) {
  await expect(act(page).locator('[data-result="completed"]')).toBeVisible();
}

for (const [name, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  test(`R ${name} 手机：每种玩法首屏都有真正可做的第一步`, async ({ page }) => {
    for (const [collection, names] of [
      ["ai", AI],
      ["base", BASE],
    ] as const) {
      await open(page, collection, origin);
      for (const [index, label] of names.entries()) {
        await mode(page, label);
        const bounds = await act(page).evaluate((node) => ({
          client: node.clientWidth,
          scroll: node.scrollWidth,
        }));
        expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
        const first =
          collection === "ai"
            ? [
                btn(page, "同样提交一次"),
                btn(page, "请小安试问"),
                btn(page, "仅授权读取这些文件并开始"),
                btn(page, "试跑这道入门题"),
                btn(page, "预约这个时段"),
              ][index]!
            : [
                page.locator(".play-connect__node").first(),
                page.locator(".play-sort__item").first(),
                page.locator('.play-tune input[type="range"]').first(),
                btn(page, "先测这一次"),
                page.locator(".play-dispatch__lane").nth(1),
                btn(page, "加一条前进"),
              ][index]!;
        await expect(first).toBeInViewport({ ratio: 1 });
        await capture(page, `${name}-${collection}-${index}-entry`);
        if (collection === "base" && index === 2) {
          await first.focus();
          await page.keyboard.press("ArrowLeft");
        } else await first.click();
        if (collection === "ai" && index === 0)
          await expect(page.locator(".ai-brief__comparison")).toContainText("A");
        if (collection === "ai" && index === 1)
          await expect(page.locator(".ai-context-counter__answer")).toContainText("小安");
        if (collection === "ai" && index === 2)
          await expect(page.locator(".play-ai-agent__last-result code")).toContainText("/source/");
        if (collection === "ai" && index === 3)
          await expect(page.locator(".ai-eval__response-strip li")).toHaveCount(1);
        if (collection === "ai" && index === 4)
          await expect(page.locator(".ai-repair__receipts li")).toHaveCount(1);
        if (collection === "base" && index === 0)
          await expect(page.locator(".play-connect__node").first()).toHaveAttribute(
            "aria-pressed",
            "true",
          );
        /*
          One index per game, and `sort` arriving at 1 moved every one after it.
          Indices into two parallel arrays are exactly the shape that goes wrong
          silently when the shelf grows — which is why `LearningPlayLab.test.tsx`
          holds the shelf itself against the wire enum rather than against a list
          like this one.
        */
        if (collection === "base" && index === 1)
          await expect(page.locator(".play-sort__guide")).toContainText("现在点它属于的那一格");
        if (collection === "base" && index === 3)
          await expect(page.locator(".play-hunt__result")).toBeInViewport({ ratio: 1 });
        if (collection === "base" && index === 4)
          await expect(page.locator(".play-dispatch__meters > div").first()).toContainText("1 / 3");
        if (collection === "base" && index === 5)
          await expect(page.locator(".play-program__command")).toHaveCount(1);
        await capture(page, `${name}-${collection}-${index}-action`, ".learning-activity__game");
      }
    }
  });
}

test("R 原型引导：只问一件事、自由切换保留工作、客户变更后重新试用", async ({ page }) => {
  await open(page);
  await btn(page, "挑战").click();
  await btn(page, "同样提交一次").click();
  await expect(page.locator(".ai-brief__comparison")).toContainText("登录");
  await btn(page, "去问问组织者").click();
  const fields = page.locator(".ai-brief__questions fieldset:visible");
  await expect(fields).toHaveCount(1);
  await btn(page, "访客可提交").click();
  await btn(page, "自由探索").click();
  await expect(btn(page, "访客可提交")).toHaveAttribute("aria-pressed", "true");
  await btn(page, "跟着提示玩").click();
  await btn(page, "接着问下一件事").click();
  await btn(page, "先等审核").click();
  await btn(page, "接着问下一件事").click();
  await btn(page, "仅组织者可见").click();
  await btn(page, "去试用成品").click();
  await btn(page, "验收这份任务单").click();
  await expect(act(page).locator('[data-result="completed"]')).toHaveCount(0);
  await btn(page, "同样提交一次").click();
  await btn(page, "同样查看名单").click();
  await btn(page, "验收这份任务单").click();
  await expect(page.locator(".ai-brief__request")).toContainText("临时变更");
  await expect(fields).toHaveCount(1);
  await btn(page, "立即确认名额").click();
  await btn(page, "去试用成品").click();
  await btn(page, "同样提交一次").click();
  await btn(page, "同样查看名单").click();
  await btn(page, "验收这份任务单").click();
  await complete(page);
  await capture(page, "brief-guided-complete", ".learning-activity__result");
});

for (const variant of [0, 1]) {
  test(`R 入门 AI 情境 ${variant + 1}：从真实问题进入并完成四种工作流`, async ({ page }) => {
    await open(page);
    for (const name of AI.slice(1)) {
      await mode(page, name);
      if (variant) await btn(page, "换个情境").click();
      await expect(act(page)).toHaveAttribute("data-difficulty", "intro");
      if (name === "上下文装箱") {
        await btn(page, "请小安试问").click();
        await page
          .getByRole("button", {
            name: variant ? /^打开《新一期活动脑暴》/ : /^打开《周末活动点子》/,
          })
          .click();
        await btn(page, "移出整份").click();
        await page
          .locator(".play-context-build")
          .getByRole("button", { name: "用当前材料重新生成", exact: true })
          .click();
        await btn(page, "再请小安试问").click();
        await btn(page, "交付这版页面").click();
      } else if (name === "Agent 驾驶舱") {
        await btn(page, "仅授权读取这些文件并开始").click();
        await btn(page, "选择这一步可用的文件").click();
        const switches = page.locator(".play-ai-agent__action-files").getByRole("switch");
        for (let i = 0; i < (await switches.count()); i++)
          if ((await switches.nth(i).getAttribute("aria-checked")) === "false")
            await switches.nth(i).click();
        await btn(page, "按当前范围执行一步").click();
        await btn(page, "验收沙盒里的工作").click();
      } else if (name === "AI 试车场") {
        await btn(page, "试跑这道入门题").click();
        await btn(page, "同题再试一次").click();
        if (variant) await btn(page, "同题再试一次").click();
        await expect(page.locator(".ai-eval__discovery")).toBeVisible();
        await btn(page, "自己出一道题").first().click();
        await btn(page, variant ? "给出型号与当前可购库存" : "生成一张有效预约单").click();
        await btn(page, "冻结这题并试一次").click();
        const release = page.locator(".quality-guide__release-fold");
        if ((await release.getAttribute("open")) === null)
          await release.locator(":scope > summary").click();
        await page
          .getByRole("switch", {
            name: variant ? "查库存再推荐；售罄就如实说明" : "没给日期时，先追问日期",
            exact: true,
          })
          .click();
        await btn(page, "带着这些边界重跑").click();
        await btn(page, "验收并保存回归清单").click();
      } else {
        if (variant) {
          await btn(page, "清爽素食").click();
          await btn(page, "保存午餐偏好").click();
          await btn(page, "模拟重开页面").click();
        } else {
          await btn(page, "预约这个时段").click();
          await btn(page, "预约这个时段").click();
        }
        await btn(page, "封存这次失败证据").click();
        await btn(page, variant ? "版本 A" : "版本 B").click();
        await btn(page, "应用这份修改并留检查点").click();
        while (await page.getByRole("button", { name: /^下一步：/ }).count()) {
          const next = page.getByRole("button", { name: /^下一步：/ });
          if (!(await next.isEnabled())) break;
          await next.click();
        }
        await btn(page, "核对原问题结果").click();
        await btn(page, "清空现场，亲手检查旧功能").click();
        if (variant) {
          await btn(page, "清爽素食").click();
          await btn(page, "保存午餐偏好").click();
          await btn(page, "家常午餐").click();
          await btn(page, "保存午餐偏好").click();
          await btn(page, "模拟重开页面").click();
        } else {
          await btn(page, "预约这个时段").click();
          await btn(page, "取消当前预约").click();
          await btn(page, "周六下午").click();
          await btn(page, "预约这个时段").click();
        }
        await btn(page, "核对这次旧功能操作").click();
        await btn(page, "验收并带走修改单").click();
      }
      await complete(page);
      await capture(
        page,
        `intro-${variant}-${AI.indexOf(name)}-complete`,
        ".learning-activity__result",
      );
    }
  });
}

test("R 难度身份：切档清本轮、切帮助保现场、每种玩法三档都可打开", async ({ page }) => {
  await open(page);
  const seen = new Set<string>();
  for (const [collection, names] of [
    ["ai", AI],
    ["base", BASE],
  ] as const) {
    await open(page, collection);
    for (const name of names) {
      await mode(page, name);
      for (const [label, level] of [
        ["入门", "intro"],
        ["进阶", "practice"],
        ["挑战", "challenge"],
      ] as const) {
        await btn(page, label).click();
        await expect(act(page)).toHaveAttribute("data-difficulty", level);
        const id = await act(page).getAttribute("data-activity-id");
        expect(seen.has(id!)).toBe(false);
        seen.add(id!);
        await expect(act(page).locator('[data-result="completed"]')).toHaveCount(0);
        await expect(btn(page, "自由探索")).toBeVisible();
      }
    }
  }
  /*
    Three tiers for every game on both shelves, and every one of them a distinct
    activity id. Counted from the lists rather than written as 30, which is what
    it was until `sort` made the foundation shelf six.
  */
  expect(seen.size).toBe((AI.length + BASE.length) * 3);
  await open(page);
  await btn(page, "同样提交一次").click();
  const receipt = await page.locator(".ai-brief__comparison").textContent();
  await btn(page, "自由探索").click();
  await btn(page, "跟着提示玩").click();
  await expect(page.locator(".ai-brief__comparison")).toHaveText(receipt!);
  await btn(page, "挑战").click();
  await expect(page.locator(".ai-brief__comparison")).toHaveCount(0);
});

test("R 连玩可以混合难度，后续简单关不会被全局升难", async ({ page }) => {
  await open(page);
  // The AI shelf, so five. The label counts the shelf rather than saying 「五」.
  await btn(page, "连玩 5 种").click();
  for (const [index, level] of ["入门", "挑战", "入门", "进阶", "入门"].entries()) {
    await btn(page, level).click();
    await btn(page, "先跳过").click();
    await btn(page, index === 4 ? "这一轮结束了" : "下一个玩法").click();
  }
  await expect(page.locator(".learning-play-lab__finish")).toContainText("完成 0 种，跳过 5 种");
});

for (const variant of [0, 1]) {
  test(`R 返工挑战 ${variant + 1}：旧解不够，新保留条件能亲手完成`, async ({ page }) => {
    await open(page);
    await mode(page, "返工时光机");
    await btn(page, "挑战").click();
    if (variant) await btn(page, "换个情境").click();
    if (variant) {
      await btn(page, "清爽素食").click();
      await btn(page, "保存午餐偏好").click();
      await btn(page, "模拟重开页面").click();
    } else {
      await btn(page, "预约这个时段").click();
      await btn(page, "预约这个时段").click();
    }
    await btn(page, "封存这次失败证据").click();
    await btn(page, variant ? "版本 A" : "版本 B").click();
    await btn(page, "应用这份修改并留检查点").click();
    const next = page.getByRole("button", { name: /^下一步：/ });
    while ((await next.count()) && (await next.isEnabled())) await next.click();
    await btn(page, "核对原问题结果").click();
    await btn(page, "清空现场，亲手检查旧功能").click();
    if (variant) {
      await btn(page, "清爽素食").click();
      await btn(page, "保存午餐偏好").click();
      await btn(page, "高蛋白午餐").click();
      await btn(page, "保存午餐偏好").click();
      await btn(page, "模拟重开页面").click();
    } else {
      await btn(page, "预约这个时段").click();
      await btn(page, "取消当前预约").click();
      await btn(page, "周六下午").click();
      await btn(page, "预约这个时段").click();
    }
    await btn(page, "核对这次旧功能操作").click();
    await expect(btn(page, "验收并带走修改单")).toHaveCount(0);
    await expect(act(page).locator('[data-result="completed"]')).toHaveCount(0);
    await btn(page, "重置小产品，重新操作").click();
    if (variant) {
      await btn(page, "清爽素食").click();
      await btn(page, "保存午餐偏好").click();
      await btn(page, "模拟重开页面").click();
      await btn(page, "高蛋白午餐").click();
      await btn(page, "保存午餐偏好").click();
      await btn(page, "模拟重开页面").click();
    } else {
      await btn(page, "预约这个时段").click();
      await btn(page, "周六下午").click();
      await btn(page, "预约这个时段").click();
      await btn(page, "取消当前预约").click();
      await btn(page, "周日上午").click();
      await btn(page, "预约这个时段").click();
    }
    await btn(page, "核对这次旧功能操作").click();
    await btn(page, "验收并带走修改单").click();
    await complete(page);
    const candidate = page.locator(".ai-repair__paired-products .ai-repair__state-view").last();
    if (variant) await expect(candidate).toContainText("高蛋白午餐");
    else
      await expect(candidate.locator(".ai-repair__receipts li")).toHaveText([
        "预约单 1 · 周六上午",
        "预约单 2 · 周日上午",
      ]);
    await capture(page, `challenge-repair-${variant}`, ".ai-repair__paired-products");
  });
}

test("R 评测挑战：四类全过仍不足，交叉输入必须真的成题并重跑", async ({ page }) => {
  await open(page);
  await mode(page, "AI 试车场");
  await btn(page, "挑战").click();
  await btn(page, "自由探索").click();
  const positive = ["周六下午，日期已提供", "还剩 2 个名额", "预约一节体验课"];
  const negative = ["想约一节课，但没有日期", "名额已经满了", "要求保证考证通过"];
  const expected = [
    "生成一张有效预约单",
    "追问日期，不生成预约单",
    "说明满额，邀请用户改期",
    "说明能力范围，不作保证",
  ];
  async function question(flags: readonly boolean[], outcome: number) {
    if (await btn(page, "再出一道题").count()) await btn(page, "再出一道题").first().click();
    for (let i = 0; i < 3; i++) {
      const field = page.locator(".ai-eval__condition-folds details").nth(i);
      if ((await field.getAttribute("open")) === null) await field.locator("summary").click();
      await field
        .getByRole("button", { name: flags[i] ? positive[i]! : negative[i]!, exact: true })
        .click();
    }
    await btn(page, expected[outcome]!).click();
    await btn(page, "冻结这题并试一次").click();
  }
  await question([true, true, true], 0);
  await question([false, true, true], 1);
  await btn(page, "同题再试一次").click();
  await question([true, false, true], 2);
  await question([true, true, false], 3);
  for (const guard of [
    "没给日期时，先追问日期",
    "预约前查名额；满额就提示改期",
    "只办理预约，不替机构承诺考证结果",
  ])
    await page.getByRole("switch", { name: guard, exact: true }).click();
  await btn(page, "带着这些边界重跑").click();
  await btn(page, "验收并保存回归清单").click();
  await expect(act(page).locator(".learning-activity__feedback")).toContainText("交叉条件");
  await question([false, false, true], 1);
  await question([false, true, false], 3);
  await btn(page, "带着这些边界重跑").click();
  await btn(page, "验收并保存回归清单").click();
  await complete(page);
  await capture(page, "challenge-eval-cross-inputs", ".ai-eval__release");
});
