import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  assertVisibleAndHittableAtFivePoints,
  EXPERIENCE_ROUTES,
  getExperienceFixture,
  openCoursePickDialog,
  openExperienceRoute,
  type ExperienceViewport,
} from "./harness/experience.js";
import { humanClick } from "./harness/click.js";
import { ONLINE_ORIGIN } from "./ports.js";
import { waitForMapReady } from "./harness/online-learner.js";

type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

const DESKTOP: ExperienceViewport = { id: "desktop", width: 1280, height: 640 };
const PHONE: ExperienceViewport = { id: "phone", width: 375, height: 812 };

function overlaps(left: Box, right: Box): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

async function boxOf(target: Locator, label: string): Promise<Box> {
  const box = await target.boundingBox();
  if (!box) throw new Error(`${label} 没有屏幕矩形`);
  return box;
}

async function realClick(target: Locator, label: string): Promise<void> {
  await humanClick(target.page(), target, label);
  await target.page().waitForTimeout(350);
}

test.describe("N nocollide · 四条体验回归", () => {
  test("N1 desktop · follow card 绕开展开的右栏", async ({ page }) => {
    const card = await openCoursePickDialog(page, DESKTOP);
    const rail = page.locator(".app-shell__aside");
    const cardBox = await boxOf(card, "课程卡");
    const railBox = await boxOf(rail, "今天右栏");

    expect(overlaps(cardBox, railBox), "课程卡落在展开的今天右栏下面").toBe(false);
    await assertVisibleAndHittableAtFivePoints(
      page,
      card.getByRole("button", { name: /进入这门课/ }),
      "follow card / 进入这门课",
    );
  });

  test("N2 desktop · course-island 右栏只说当前课程的下一节", async ({ page }) => {
    const fixture = await getExperienceFixture(page);
    const world = EXPERIENCE_ROUTES.find((route) => route.id === "world");
    if (!world) throw new Error("缺少世界地图路由");
    await openExperienceRoute(page, world, DESKTOP);
    await waitForMapReady(page);

    await realClick(page.locator("button.study-switcher__trigger").first(), "打开系列选择");
    await realClick(
      page.locator("button.study-switcher__option", { hasText: fixture.studyTitle }).first(),
      `切到 ${fixture.studyTitle}`,
    );
    await realClick(
      page.getByRole("button", { name: fixture.courseTitle, exact: true }).first(),
      "选发布货架课程岛",
    );
    await expect(page.getByRole("button", { name: /进入这门课/ }).first()).toBeVisible({
      timeout: 15_000,
    });
    await realClick(page.getByRole("button", { name: /进入这门课/ }).first(), "进入当前课程");

    await expect(page).toHaveURL(`${ONLINE_ORIGIN}${fixture.coursePath}`);
    await expect(page.locator("button.study-switcher__trigger").first()).toHaveText(
      new RegExp(fixture.studyTitle),
    );
    await expect(page.locator(".app-shell__aside h2")).toHaveText(fixture.courseNextLessonTitle);
    await expect(page.locator(".app-shell__aside")).toContainText(fixture.courseTitle);
  });

  test("N3 phone · 提意见不盖账号目标或课文正文", async ({ page }) => {
    const fixture = await getExperienceFixture(page);
    await page.setViewportSize({ width: PHONE.width, height: PHONE.height });
    await page.goto(`${ONLINE_ORIGIN}/me`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".account-panel")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);

    const accountFeedback = page.locator(".feedback-note__open--float:visible");
    await assertVisibleAndHittableAtFivePoints(page, accountFeedback, "个人档案 / 提意见浮钮");
    const accountFeedbackBox = await boxOf(accountFeedback, "个人档案 / 提意见浮钮");
    const password = page.locator('input[name="password"]:visible').first();
    await expect(password, "在线账号回归必须渲染密码框").toBeVisible();
    const accountTargetBox = await boxOf(password, "密码框");
    expect(overlaps(accountFeedbackBox, accountTargetBox), "提意见浮钮盖住密码框").toBe(false);

    await page.goto(`${ONLINE_ORIGIN}${fixture.lessonPath}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".lesson-reader__header")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);

    const lessonFeedback = page.locator(".feedback-note__open--float:visible");
    await assertVisibleAndHittableAtFivePoints(page, lessonFeedback, "课文 / 提意见浮钮");
    const lessonFeedbackBox = await boxOf(lessonFeedback, "课文 / 提意见浮钮");
    const coveredBlocks = await page.evaluate((feedback) => {
      const selectors = [
        ".lesson-main > :not(.lesson-reader__header) p",
        ".lesson-main > :not(.lesson-reader__header) h1",
        ".lesson-main > :not(.lesson-reader__header) h2",
        ".lesson-main > :not(.lesson-reader__header) h3",
        ".lesson-main > :not(.lesson-reader__header) h4",
        ".lesson-main > :not(.lesson-reader__header) li",
        ".lesson-main > :not(.lesson-reader__header) strong",
      ];
      const isVisible = (element: Element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          box.width > 0 &&
          box.height > 0 &&
          box.bottom > 0 &&
          box.top < innerHeight &&
          element.textContent?.trim()
        );
      };
      return [...document.querySelectorAll(selectors.join(","))]
        .filter(isVisible)
        .map((element) => {
          const box = element.getBoundingClientRect();
          return {
            text: element.textContent?.trim().slice(0, 80) ?? "",
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          };
        })
        .filter(
          (box) =>
            box.x < feedback.x + feedback.width &&
            box.x + box.width > feedback.x &&
            box.y < feedback.y + feedback.height &&
            box.y + box.height > feedback.y,
        );
    }, lessonFeedbackBox);
    expect(coveredBlocks, "提意见浮钮盖住课文文字").toEqual([]);
  });

  test("N4 phone · lesson toolbar 工具单行且没有悬空标签", async ({ page }) => {
    const fixture = await getExperienceFixture(page);
    await page.setViewportSize({ width: PHONE.width, height: PHONE.height });
    await page.goto(`${ONLINE_ORIGIN}${fixture.lessonPath}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".lesson-toolbar")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);

    const layout = await page.evaluate(() => {
      const tools = document.querySelector<HTMLElement>(".lesson-toolbar__tools");
      const label = document.querySelector<HTMLElement>(".lesson-toolbar__label");
      if (!tools || !label) throw new Error("lesson toolbar 的工具或标签缺失");
      const box = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
        };
      };
      return {
        label: box(label),
        tools: box(tools),
        controls: [...tools.children].map(box).filter((rect) => rect.width > 0 && rect.height > 0),
        options: [...tools.querySelectorAll(".game-ui-segmented-option")].map(box),
      };
    });

    expect(layout.label.width, "手机上仍显示悬空的讲解层级标签").toBe(0);
    const rows = layout.controls.map((rect) => rect.y + rect.height / 2);
    expect(Math.max(...rows) - Math.min(...rows), "手机工具控件被挤成多行").toBeLessThanOrEqual(1);
    expect(
      layout.controls.every((rect) => rect.x >= layout.tools.x && rect.right <= layout.tools.right),
      "手机工具控件溢出 lesson toolbar",
    ).toBe(true);
    expect(
      layout.options.every((rect) => rect.width >= 44),
      "标准/详细触控宽度低于 44px",
    ).toBe(true);

    const controls = page.locator(".lesson-toolbar__tools button:visible");
    for (let index = 0; index < (await controls.count()); index += 1) {
      await assertVisibleAndHittableAtFivePoints(
        page,
        controls.nth(index),
        `课文工具 ${index + 1}`,
      );
    }
  });
});
