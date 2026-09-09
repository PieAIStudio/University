import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { humanClick } from "./harness/click.js";
import { LOCAL_ORIGIN, ONLINE_ORIGIN } from "./ports.js";

const EVIDENCE = resolve("SCRATCH/ai-play-lab/browser");
const MODES = ["原型对焦台", "上下文装箱", "Agent 驾驶舱", "AI 试车场", "返工时光机"];
const errorsByPage = new WeakMap<Page, string[]>();
const activity = (page: Page) => page.locator(".learning-activity");
const button = (page: Page, name: string | RegExp) =>
  page.getByRole("button", { name, exact: typeof name === "string" });
const failure = (page: Page) =>
  activity(page).locator('.learning-activity__feedback[data-passed="false"]');

test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(
    errorsByPage.get(page),
    "Teaching success must not hide an uncaught browser error",
  ).toEqual([]);
});

async function btnLevelPractice(page: Page) {
  await page.getByRole("button", { name: "进阶", exact: true }).click();
}

async function explore(page: Page) {
  const control = page.getByRole("button", { name: "自由探索", exact: true });
  if (await control.count()) await control.click();
}

async function openLab(page: Page, origin = ONLINE_ORIGIN) {
  await page.goto(`${origin}/play-lab/ai`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "挑战", exact: true }).click();
  await expect(activity(page)).toHaveAttribute("data-activity-id", /^ai-brief-walk:/);
  await expect(page.locator(".learning-activity__sandbox")).toContainText("预设 AI 案例");
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
  await page
    .getByRole("button", { name: name === "原型对焦台" ? "挑战" : "进阶", exact: true })
    .click();
  await explore(page);
}
async function completed(page: Page) {
  await expect(activity(page).locator('[data-result="completed"]')).toBeVisible();
  await expect(activity(page).locator(".learning-activity__handoff summary")).toHaveText(
    "带去真实项目",
  );
}
async function capture(
  page: Page,
  name: string,
  target: Locator = activity(page).getByRole("heading").first(),
) {
  mkdirSync(EVIDENCE, { recursive: true });
  await target.evaluate((node) => node.scrollIntoView({ block: "start", behavior: "instant" }));
  await page.screenshot({ path: resolve(EVIDENCE, `${name}.png`), animations: "disabled" });
}
async function briefContract(page: Page, labels: readonly string[]) {
  for (const label of labels) await humanClick(page, button(page, label), label);
}
async function finishBriefChange(page: Page, member = false) {
  await expect(page.locator('.ai-brief__request[data-revised="true"]')).toContainText("临时变更");
  await expect(activity(page).locator('[data-result="completed"]')).toHaveCount(0);
  await capture(
    page,
    `brief-client-change-${member ? "club" : "walk"}-${page.viewportSize()?.width}`,
    page.locator('.ai-brief__request[data-revised="true"]'),
  );
  await button(page, member ? "仅组织者可见" : "立即确认名额").click();
  await button(page, "验收这份任务单").click();
  await expect(failure(page)).toContainText("亲自试用");
  const preview = page.getByRole("region", { name: "试用解释 A" });
  if (member) {
    await preview.getByRole("button", { name: "报名本周活动", exact: true }).click();
    await preview.getByRole("button", { name: "以会员身份继续试用", exact: true }).click();
    await preview.getByRole("button", { name: "报名本周活动", exact: true }).click();
    await preview.getByRole("button", { name: "看看名单", exact: true }).click();
  } else {
    await button(page, "同样提交一次").click();
    await button(page, "同样查看名单").click();
  }
  await button(page, "验收这份任务单").click();
}

test.describe("Q AI product learning", () => {
  test.use({ viewport: { width: 1440, height: 1100 } });

  test("原型：约束不能替代验收，两个任务要求真实产品行为", async ({ page }) => {
    await openLab(page);
    const previewA = page.getByRole("region", { name: "试用解释 A" });
    const previewB = page.getByRole("region", { name: "试用解释 B" });
    await previewA.getByRole("button", { name: "申请参加", exact: true }).click();
    await expect(previewA).toContainText("名额已确认");
    await previewB.getByRole("button", { name: "申请参加", exact: true }).click();
    await expect(previewB).toContainText("停在登录页");
    await capture(page, "brief-divergent", page.locator(".ai-brief__preview-title"));
    await briefContract(page, ["访客可提交", "先等审核", "仅组织者可见"]);
    await button(page, "验收这份任务单").click();
    await expect(failure(page)).toContainText("还需要亲自试用");
    await expect(failure(page)).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: resolve(EVIDENCE, "brief-feedback-visible.png"),
      animations: "disabled",
    });
    await expect(activity(page).locator('[data-result="completed"]')).toHaveCount(0);
    await previewA.getByRole("button", { name: "申请参加", exact: true }).click();
    await previewA.getByRole("button", { name: "看看名单", exact: true }).click();
    await expect(previewA).toContainText("没有占用名额");
    await expect(previewA).toContainText("名单仅组织者可见");
    await button(page, "验收这份任务单").click();
    await finishBriefChange(page);
    await completed(page);
    await activity(page).locator(".learning-activity__handoff summary").click();
    await expect(activity(page).locator(".learning-activity__handoff pre")).toContainText(
      "审核前不占名额",
    );
    await capture(page, "brief-walk-handoff", activity(page).locator(".learning-activity__result"));
    await button(page, "换个情境").click();
    await explore(page);
    await expect(activity(page)).toHaveAttribute("data-activity-id", /^ai-brief-club:/);
    await briefContract(page, ["先登录", "立即确认名额", "展示报名昵称"]);
    await previewA.getByRole("button", { name: "看看名单", exact: true }).click();
    await expect(previewA).not.toContainText("小安、小禾");
    await previewA.getByRole("button", { name: "报名本周活动", exact: true }).click();
    await previewA.getByRole("button", { name: "以会员身份继续试用", exact: true }).click();
    await previewA.getByRole("button", { name: "报名本周活动", exact: true }).click();
    await button(page, "验收这份任务单").click();
    await expect(failure(page)).toContainText("谁能看见名单");
    await previewA.getByRole("button", { name: "看看名单", exact: true }).click();
    await expect(previewA).toContainText("新加入：小林");
    await button(page, "验收这份任务单").click();
    await finishBriefChange(page, true);
    await completed(page);
    await capture(
      page,
      "brief-club-complete",
      activity(page).locator(".learning-activity__result"),
    );
  });

  test("合集：原来五种保持可达，AI 连玩不会冒充课程进度", async ({ page }) => {
    await openLab(page);
    await page.getByRole("link", { name: "编程原理", exact: true }).click();
    await expect(activity(page)).toHaveAttribute("data-activity-id", /^connect-web:/);
    await page.getByRole("link", { name: "用 AI 做产品", exact: true }).click();
    await expect(activity(page)).toHaveAttribute("data-activity-id", /^ai-brief-walk:/);
    await button(page, "连玩五种").click();
    for (let index = 0; index < 5; index++) {
      await button(page, "先跳过").click();
      await expect(activity(page).locator(".learning-activity__handoff")).toHaveCount(0);
      await button(page, index === 4 ? "这一轮结束了" : "下一个玩法").click();
    }
    await expect(page.locator(".learning-play-lab__finish")).toContainText("完成 0 种，跳过 5 种");
    await page.reload();
    await expect(activity(page)).toHaveAttribute("data-activity-id", /^ai-brief-walk:/);
    await expect(page.locator(".learning-play-lab__session")).toContainText("本次发现 0 / 5");
  });
});

for (const [name, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  test(`Q ${name} 手机：五个 AI 玩法可达，键盘能验证真实产品`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openLab(page, origin);
    for (const [index, label] of MODES.entries()) {
      await mode(page, label);
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
    await mode(page, "原型对焦台");
    await briefContract(page, ["访客可提交", "先等审核", "仅组织者可见"]);
    const preview = page.getByRole("region", { name: "试用解释 A" });
    await preview.getByRole("button", { name: "申请参加", exact: true }).focus();
    await page.keyboard.press("Enter");
    await preview.getByRole("button", { name: "看看名单", exact: true }).focus();
    await page.keyboard.press("Enter");
    await button(page, "验收这份任务单").focus();
    await page.keyboard.press("Enter");
    await finishBriefChange(page);
    await completed(page);
    await capture(
      page,
      `${name}-mobile-brief-complete`,
      activity(page).locator(".learning-activity__result"),
    );
  });
}

async function contextDocument(page: Page, title: string) {
  await page
    .getByRole("navigation", { name: "桌上的材料" })
    .getByRole("button", { name: new RegExp(title) })
    .click();
}
const counter = (page: Page) => page.getByRole("region", { name: "页面试营业", exact: true });
async function tryCustomers(page: Page) {
  for (const name of ["小安", "阿远", "小禾"])
    await counter(page)
      .getByRole("button", { name: new RegExp(`^${name}|^[123] ${name}`) })
      .click();
}
async function rebuildCounter(page: Page) {
  await counter(page).getByRole("button", { name: "用当前材料重新生成", exact: true }).click();
}
async function deliverCounter(page: Page) {
  await counter(page).getByRole("button", { name: "交付这版页面", exact: true }).click();
}

test("Q 上下文：新点子不能推翻签字约定，整份与摘录都可交付", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openLab(page);
  await mode(page, "上下文装箱");
  await tryCustomers(page);
  await deliverCounter(page);
  await expect(failure(page)).toContainText("冲突或缺口");
  await expect(page.locator(".play-ai-context__result")).toContainText("两种说法互相冲突");
  await counter(page)
    .getByRole("button", { name: /^小安/ })
    .click();
  await expect(counter(page)).toContainText("无法同时采用这几种说法");
  await capture(page, "context-conflict", counter(page));
  await contextDocument(page, "签字价目表");
  await button(page, "整份装入").click();
  await expect(page.locator(".play-ai-context__box")).toContainText("18 / 16");
  await contextDocument(page, "周末活动点子");
  await button(page, "移出整份").click();
  await deliverCounter(page);
  await expect(failure(page)).toContainText("重新生成");
  await rebuildCounter(page);
  await deliverCounter(page);
  await expect(failure(page)).toContainText("再请");
  await tryCustomers(page);
  await deliverCounter(page);
  await completed(page);
  await expect(page.locator(".play-ai-context__result")).toContainText("28 元");
  await capture(page, "context-cafe-complete", page.locator(".play-ai-context__result"));
  await button(page, "换个情境").click();
  await explore(page);
  await expect(activity(page)).toHaveAttribute("data-activity-id", /^ai-context-workshop:/);
  await contextDocument(page, "报名页定稿");
  await button(page, "移出整份").click();
  await page.getByRole("navigation", { name: "桌上的材料" }).getByRole("button").nth(3).click();
  await button(page, "移出整份").click();
  for (const title of ["报名页定稿", "场地使用合同", "报名问答摘录"]) {
    await contextDocument(page, title);
    await page
      .getByRole("region", { name: title, exact: true })
      .getByRole("switch", { name: "摘入第 1 段", exact: true })
      .click();
  }
  await expect(page.locator(".play-ai-context__box")).toContainText("已装 8 / 16 格");
  await rebuildCounter(page);
  await tryCustomers(page);
  await deliverCounter(page);
  await completed(page);
  await expect(page.locator(".play-ai-context__result")).toContainText("12");
  await capture(page, "context-workshop-complete", page.locator(".play-ai-context__result"));
});

async function grant(page: Page, tool: string, scope = "仅任务范围") {
  const detail = page
    .locator(".play-ai-agent__tool")
    .filter({ has: page.locator("summary").getByText(tool, { exact: true }) });
  if (!(await detail.getAttribute("open")) && (await detail.getAttribute("open")) !== "")
    await detail.locator(":scope > summary").click();
  await page
    .getByRole("group", { name: tool, exact: true })
    .getByRole("button", { name: scope, exact: true })
    .click();
}

test("Q Agent：权限实际限制写入，误开范围能回退，全部拒绝不能交付", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openLab(page);
  await mode(page, "Agent 驾驶舱");
  await button(page, "退回这一步").click();
  await expect(page.locator(".play-ai-agent__feedback")).toContainText("任务仍需要这一步");
  await button(page, "按当前范围执行一步").click();
  await expect(page.locator(".play-ai-agent__feedback")).toContainText("文件读取器");
  await expect(page.locator(".play-ai-agent__feedback")).toContainText("触达不了");
  await grant(page, "文件读取器");
  await button(page, "按当前范围执行一步").click();
  await grant(page, "文本文件编辑器", "整个沙盒");
  await button(page, "按当前范围执行一步").click();
  await expect(page.locator(".play-ai-agent__file[data-damaged=true]")).toContainText(
    "原始记录已被删去",
  );
  await capture(page, "agent-overbroad-write", page.locator(".play-ai-agent__cockpit"));
  await button(page, "恢复到这个检查点").click();
  await expect(page.locator(".play-ai-agent__file[data-damaged=true]")).toHaveCount(0);
  await expect(
    page
      .getByRole("group", { name: "文本文件编辑器", exact: true })
      .getByRole("button", { name: "整个沙盒", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await grant(page, "文本文件编辑器");
  await button(page, "按当前范围执行一步").click();
  await expect(page.locator(".play-ai-agent__feedback")).toContainText("挡住了");
  await button(page, "退回这一步").click();
  await button(page, "按当前范围执行一步").click();
  await grant(page, "邀请预览器");
  await button(page, "按当前范围执行一步").click();
  await button(page, "验收沙盒里的工作").click();
  await completed(page);
  await capture(page, "agent-event-complete", page.locator(".play-ai-agent__workspace"));
  await button(page, "换个情境").click();
  await explore(page);
  await expect(activity(page)).toHaveAttribute("data-activity-id", /^ai-agent-recipe:/);
  for (const tool of ["材料读取器", "清单与文稿编辑器", "食谱预览器"]) await grant(page, tool);
  await button(page, "按当前范围执行一步").click();
  await button(page, "按当前范围执行一步").click();
  await button(page, "退回这一步").click();
  await button(page, "按当前范围执行一步").click();
  await button(page, "按当前范围执行一步").click();
  await button(page, "验收沙盒里的工作").click();
  await completed(page);
  await capture(page, "agent-recipe-complete", page.locator(".play-ai-agent__workspace"));
});

test("Q Agent 手机：推进在危险改写前停住，文件卡直接收回范围后继续", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLab(page);
  await mode(page, "Agent 驾驶舱");
  await grant(page, "文件读取器");
  await grant(page, "文本文件编辑器", "整个沙盒");
  await grant(page, "邀请预览器");
  await button(page, "推进到需要我判断处").click();
  await expect(page.locator(".play-ai-agent__feedback")).toContainText("已停住，还没有改动");
  await expect(page.locator(".play-ai-agent__file[data-damaged=true]")).toHaveCount(0);
  const protectedTarget = page.locator('.play-ai-agent__target-card[data-protected="true"]');
  await expect(protectedTarget.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  await capture(page, "mobile-agent-file-scope", protectedTarget);
  await protectedTarget.getByRole("switch").click();
  await expect(protectedTarget.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  await button(page, "推进到需要我判断处").click();
  await expect(page.locator(".play-ai-agent__feedback")).toContainText("停在材料带来的额外指令前");
  await expect(page.locator(".play-ai-agent__file[data-damaged=true]")).toHaveCount(0);
  await capture(page, "mobile-agent-decision-pause", page.locator(".play-ai-agent__feedback"));
  await button(page, "退回这一步").click();
  await button(page, "推进到需要我判断处").click();
  await expect(page.locator(".play-ai-agent__feedback")).toContainText("生成当前草稿的内部预览");
  await expect(button(page, "停在这里")).toHaveCount(0);
  await button(page, "验收沙盒里的工作").click();
  await expect(failure(page)).toContainText("仍可触达任务外文件");
  await grant(page, "文本文件编辑器");
  await button(page, "验收沙盒里的工作").click();
  await completed(page);
});

const EVAL_CASES = {
  schedule: {
    positive: ["周六下午，日期已提供", "还剩 2 个名额", "预约一节体验课"],
    negative: ["想约一节课，但没有日期", "名额已经满了", "要求保证考证通过"],
    outcomes: [
      "生成一张有效预约单",
      "追问日期，不生成预约单",
      "说明满额，邀请用户改期",
      "说明能力范围，不作保证",
    ],
    guards: [
      "没给日期时，先追问日期",
      "预约前查名额；满额就提示改期",
      "只办理预约，不替机构承诺考证结果",
    ],
  },
  shop: {
    positive: ["询问 A5 点阵本", "A5 点阵本还有 12 本", "查看款式与库存"],
    negative: ["只说想买「那个本子」", "A5 点阵本已售罄", "要求保证接触后不会过敏"],
    outcomes: [
      "给出型号与当前可购库存",
      "追问型号，暂不给库存结论",
      "如实说明售罄，不显示可购",
      "说明无医学证据，不作保证",
    ],
    guards: [
      "没有型号时，先询问要哪种商品",
      "查库存再推荐；售罄就如实说明",
      "只回答目录事实，不作医学保证",
    ],
  },
};
async function makeEvalQuestion(page: Page, topic: keyof typeof EVAL_CASES, type: number) {
  const fixture = EVAL_CASES[topic];
  const fresh = button(page, "再出一道题");
  if (await fresh.count()) await fresh.first().click();
  for (let index = 0; index < 3; index++) {
    const detail = page.locator(".ai-eval__condition-folds details").nth(index);
    if ((await detail.getAttribute("open")) === null) await detail.locator("summary").click();
    await detail
      .getByRole("button", {
        name: type - 1 === index ? fixture.negative[index]! : fixture.positive[index]!,
        exact: true,
      })
      .click();
  }
  await button(page, fixture.outcomes[type]!).click();
  await button(page, "冻结这题并试一次").click();
}
async function constructEvalSuite(page: Page, topic: keyof typeof EVAL_CASES) {
  for (let type = 0; type < 4; type++) {
    await makeEvalQuestion(page, topic, type);
    if ((topic === "schedule" && type === 1) || (topic === "shop" && type === 2)) {
      await button(page, "同题再试一次").click();
      if (topic === "shop") await button(page, "同题再试一次").click();
      await expect(page.locator(".ai-eval__discovery")).toContainText("前后结果却变了");
      await capture(page, `eval-${topic}-discovery`, page.locator(".ai-eval__response-ticket"));
    }
  }
  await expect(page.locator(".ai-eval__case-sheet > li")).toHaveCount(4);
}
async function evalCandidate(page: Page, name: string) {
  await page
    .locator(".ai-eval__candidate-switch")
    .getByRole("button", { name, exact: true })
    .click();
}

test("Q 评测：同题逐次揭示反差，收藏保留发现，编辑只失效对应证据", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openLab(page);
  await mode(page, "AI 试车场");
  await button(page, "冻结这题并试一次").click();
  await expect(page.getByText("请先选定一条可观察的验收结果。", { exact: true })).toBeVisible();
  await constructEvalSuite(page, "schedule");
  const sheet = page.locator(".ai-eval__case-sheet > li");
  await expect(sheet.nth(1)).toContainText("已观察 2 次，其中 1 次不符合约定");
  await sheet.last().getByRole("button", { name: "移除这条用例", exact: true }).click();
  await expect(page.locator(".ai-eval__experiment h4")).toBeFocused();
  await expect(sheet.nth(1)).toContainText("已观察 2 次，其中 1 次不符合约定");
  await makeEvalQuestion(page, "schedule", 3);
  await sheet.first().getByRole("button", { name: "把这题放回试验台" }).click();
  await button(page, "修改这条用例").click();
  await expect(sheet).toHaveCount(3);
  await button(page, "冻结这题并试一次").click();
  await expect(sheet).toHaveCount(4);
  await expect(sheet.first()).toContainText("已观察 2 次，其中 1 次不符合约定");
  await button(page, "带着这些边界重跑").click();
  await button(page, "验收并保存回归清单").click();
  await expect(failure(page)).toContainText("仍有不符合约定");
  await page.getByRole("switch", { name: EVAL_CASES.schedule.guards[0]!, exact: true }).click();
  await button(page, "验收并保存回归清单").click();
  await expect(failure(page)).toContainText("重跑");
  await button(page, "带着这些边界重跑").click();
  await evalCandidate(page, "方案乙");
  await expect(page.locator(".ai-eval__release").getByRole("status")).not.toContainText(
    "全部检查符合约定",
  );
  await evalCandidate(page, "方案甲");
  await expect(page.locator(".ai-eval__release").getByRole("status")).toContainText(
    "全部检查符合约定",
  );
  await expect(page.locator(".ai-eval__release .ai-eval__records")).toHaveCount(1);
  await button(page, "验收并保存回归清单").click();
  await completed(page);
  await capture(page, "eval-schedule-complete", page.locator(".ai-eval__release"));
});

test("Q 评测：第二情境第三次才变化，全部拒绝不能交付，完整检查可扶正另一方案", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openLab(page);
  await mode(page, "AI 试车场");
  await button(page, "换个情境").click();
  await explore(page);
  await constructEvalSuite(page, "shop");
  await evalCandidate(page, "方案丙");
  await button(page, "用这题试当前方案").click();
  for (const guard of EVAL_CASES.shop.guards)
    await page.getByRole("switch", { name: guard, exact: true }).click();
  await button(page, "带着这些边界重跑").click();
  await button(page, "验收并保存回归清单").click();
  await expect(failure(page)).toContainText("仍有不符合约定");
  await evalCandidate(page, "方案乙");
  await button(page, "带着这些边界重跑").click();
  await button(page, "验收并保存回归清单").click();
  await completed(page);
  await capture(page, "eval-shop-complete", page.locator(".ai-eval__release"));
});

async function applyRepair(page: Page, label: string) {
  await button(page, label).click();
  await button(page, "应用这份修改并留检查点").click();
}
async function replayRepairEvidence(page: Page) {
  await button(page, "重放已封存的失败步骤").click();
  await expect(page.locator(".ai-repair__time-caption")).toContainText("第 0 /");
  await expect(button(page, "核对原问题结果")).toBeDisabled();
  while (await button(page, "下一步").isEnabled()) await button(page, "下一步").click();
  await button(page, "核对原问题结果").click();
}
const repairedProduct = (page: Page) =>
  page.locator(".ai-repair__paired-products .ai-repair__state-view").last();
async function bookingRegression(page: Page, branch = false) {
  await button(page, "清空现场，亲手检查旧功能").click();
  await button(page, "预约这个时段").click();
  await button(page, "取消当前预约").click();
  await button(page, "周六下午").click();
  await button(page, "预约这个时段").click();
  if (branch) {
    await button(page, "上一步").click();
    await button(page, "上一步").click();
    await button(page, "从这一步试新操作").click();
    await expect(button(page, "核对这次旧功能操作")).toBeVisible();
    await button(page, "周六下午").click();
    await button(page, "预约这个时段").click();
  }
  await button(page, "核对这次旧功能操作").click();
}
async function preferenceRegression(page: Page) {
  await button(page, "清空现场，亲手检查旧功能").click();
  await button(page, "清爽素食").click();
  await button(page, "保存午餐偏好").click();
  await button(page, "家常午餐").click();
  await button(page, "保存午餐偏好").click();
  await button(page, "模拟重开页面").click();
  await button(page, "核对这次旧功能操作").click();
}

test("Q 返工：同一失败的修复不能牺牲改约，检查点保留分支现场", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openLab(page);
  await mode(page, "返工时光机");
  await button(page, "封存这次失败证据").click();
  await expect(page.locator(".ai-repair__live > .ai-quality__status")).toContainText("还没复现");
  await button(page, "预约这个时段").click();
  await button(page, "预约这个时段").click();
  await expect(page.locator(".ai-repair__receipts li")).toHaveCount(2);
  await button(page, "封存这次失败证据").click();
  await capture(page, "repair-duplicate-evidence", page.locator(".ai-repair__evidence"));
  await button(page, "版本 A").click();
  await capture(page, "repair-candidate-claims", page.locator(".ai-repair__patches"));
  await button(page, "应用这份修改并留检查点").click();
  await replayRepairEvidence(page);
  await expect(page.locator(".ai-repair__check").first()).toHaveAttribute("data-passed", "true");
  await bookingRegression(page);
  await expect(page.locator(".ai-repair__live > .ai-quality__status")).toContainText(
    "原本能做的事被破坏",
  );
  await capture(page, "repair-regression-side-effect", page.locator(".ai-repair__time-caption"));
  await button(page, "验收并带走修改单").click();
  await expect(failure(page)).toContainText("还需要");
  await page
    .locator(".ai-repair__timeline li")
    .first()
    .getByRole("button", { name: "恢复这个检查点" })
    .click();
  await expect(page.locator(".ai-repair__state-label")).toHaveText("原始版本");
  await expect(page.locator(".ai-repair__receipts li")).toHaveCount(2);
  await expect(page.locator(".ai-repair__check[data-passed=true]")).toHaveCount(0);
  await applyRepair(page, "版本 B");
  await button(page, "跳到首次不同").click();
  await expect(page.locator(".ai-repair__paired-products")).toHaveAttribute(
    "data-different",
    "true",
  );
  await capture(page, "repair-first-divergence", page.locator(".ai-repair__time-caption"));
  await button(page, "上一步").click();
  await button(page, "从这一步试新操作").click();
  await button(page, "取消当前预约").click();
  await expect(page.locator(".ai-repair__tapes li")).not.toHaveCount(0);
  await button(page, "验收并带走修改单").click();
  await expect(failure(page)).toContainText("还需要");
  await replayRepairEvidence(page);
  await bookingRegression(page, true);
  await button(page, "验收并带走修改单").click();
  await completed(page);
  await expect(repairedProduct(page).locator(".ai-repair__receipts li")).toHaveText([
    "预约单 1 · 周六下午",
  ]);
  await capture(page, "repair-booking-complete", page.locator(".ai-repair__verification"));
});

test("Q 返工：保存提示不算证据，锁死偏好不能当修好", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openLab(page);
  await mode(page, "返工时光机");
  await button(page, "换个情境").click();
  await explore(page);
  await button(page, "清爽素食").click();
  await button(page, "保存午餐偏好").click();
  await button(page, "封存这次失败证据").click();
  await expect(page.locator(".ai-repair__evidence")).toHaveCount(0);
  await button(page, "模拟重开页面").click();
  await button(page, "封存这次失败证据").click();
  await applyRepair(page, "版本 B");
  await replayRepairEvidence(page);
  await preferenceRegression(page);
  await expect(page.locator(".ai-repair__live > .ai-quality__status")).toContainText(
    "原本能做的事被破坏",
  );
  await applyRepair(page, "版本 A");
  await replayRepairEvidence(page);
  await expect(repairedProduct(page)).toContainText("当前显示：清爽素食");
  await expect(repairedProduct(page)).toContainText("已从保存的数据载入当前偏好");
  await preferenceRegression(page);
  await button(page, "验收并带走修改单").click();
  await completed(page);
  await expect(repairedProduct(page)).toContainText("当前显示：家常午餐");
  await expect(repairedProduct(page)).toContainText("已从保存的数据载入当前偏好");
  await expect(repairedProduct(page)).not.toContainText("尚未提交");
  await capture(page, "repair-preference-complete", repairedProduct(page));
});

test("Q 宽屏内的 390px 课文栏：五个 AI 玩法按组件宽度排版", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openLab(page);
  for (const [index, label] of MODES.entries()) {
    await mode(page, label);
    await activity(page).evaluate((node) => {
      (node as HTMLElement).style.inlineSize = "390px";
    });
    const dimensions = await activity(page).evaluate((node) => ({
      client: node.clientWidth,
      scroll: node.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
    await capture(page, `embedded-${index}`);
  }
});

test.describe("Q 连续手机试玩证据", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("五种 AI 学习动作在手机完成，中段操作与结果可读", async ({ page }) => {
    await openLab(page);
    await briefContract(page, ["访客可提交", "先等审核", "仅组织者可见"]);
    const preview = page.getByRole("region", { name: "试用解释 A" });
    await preview.getByRole("button", { name: "申请参加", exact: true }).tap();
    await preview.getByRole("button", { name: "看看名单", exact: true }).tap();
    await capture(page, "mobile-working-brief", page.locator(".ai-brief__preview-title"));
    await button(page, "验收这份任务单").tap();
    await finishBriefChange(page);
    await completed(page);
    await button(page, "下一个玩法").tap();
    await btnLevelPractice(page);
    await explore(page);
    await expect(activity(page).getByRole("heading", { level: 2 })).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: resolve(EVIDENCE, "mobile-next-context-visible.png"),
      animations: "disabled",
    });

    await tryCustomers(page);
    await counter(page)
      .getByRole("button", { name: /^小安/ })
      .tap();
    await capture(page, "mobile-working-context", counter(page));
    await contextDocument(page, "周末活动点子");
    await button(page, "移出整份").tap();
    await contextDocument(page, "签字价目表");
    await button(page, "整份装入").tap();
    await rebuildCounter(page);
    await tryCustomers(page);
    await deliverCounter(page);
    await completed(page);
    await capture(page, "mobile-context-result", page.locator(".play-ai-context__result"));
    await button(page, "下一个玩法").tap();
    await btnLevelPractice(page);
    await explore(page);
    await expect(activity(page).getByRole("heading", { level: 2 })).toBeInViewport({ ratio: 1 });

    await grant(page, "文件读取器");
    await button(page, "按当前范围执行一步").tap();
    await grant(page, "文本文件编辑器");
    await button(page, "按当前范围执行一步").tap();
    await capture(page, "mobile-working-agent", page.locator(".play-ai-agent__action"));
    await button(page, "退回这一步").tap();
    await button(page, "按当前范围执行一步").tap();
    await grant(page, "邀请预览器");
    await button(page, "按当前范围执行一步").tap();
    await button(page, "验收沙盒里的工作").tap();
    await completed(page);
    await capture(page, "mobile-agent-result", page.locator(".play-ai-agent__workspace"));
    await button(page, "下一个玩法").tap();
    await btnLevelPractice(page);
    await explore(page);

    await constructEvalSuite(page, "schedule");
    await page
      .locator(".ai-eval__case-sheet > li")
      .nth(1)
      .getByRole("button", { name: "把这题放回试验台" })
      .tap();
    await capture(page, "mobile-working-eval", page.locator(".ai-eval__response-ticket"));
    await page.getByRole("switch", { name: EVAL_CASES.schedule.guards[0]!, exact: true }).tap();
    await button(page, "带着这些边界重跑").tap();
    await button(page, "验收并保存回归清单").tap();
    await completed(page);
    await button(page, "下一个玩法").tap();
    await btnLevelPractice(page);
    await explore(page);

    await button(page, "预约这个时段").tap();
    await button(page, "预约这个时段").tap();
    await capture(page, "mobile-working-repair", page.locator(".ai-repair__state-view"));
    await button(page, "封存这次失败证据").tap();
    await applyRepair(page, "版本 B");
    await replayRepairEvidence(page);
    await bookingRegression(page);
    await button(page, "验收并带走修改单").tap();
    await completed(page);
    await capture(
      page,
      "mobile-repair-result",
      activity(page).locator(".learning-activity__result"),
    );
    await expect(page.locator(".learning-play-lab__session")).toContainText("本次发现 5 / 5");
  });
});
