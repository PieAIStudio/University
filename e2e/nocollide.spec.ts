import { expect, test, type Locator } from "./harness/learner-test.js";

import {
  assertVisibleAndHittableAtFivePoints,
  getExperienceFixture,
  openCoursePickEntry,
  type ExperienceViewport,
} from "./harness/experience.js";
import { ONLINE_ORIGIN } from "./ports.js";
import { scrollIntoView } from "./harness/click.js";

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

async function waitForFeedbackReturn(target: Locator, label: string): Promise<void> {
  const samples: { at: number; opacity: string; pointerEvents: string; scrolling: boolean }[] = [];
  // Lesson focus can scroll the page after the header appears. Feedback waits
  // 420ms after scrolling, then fades for 160ms: a blind 500ms sleep samples
  // that legitimate transition. Require its actual return within a bounded
  // interval; a permanently invisible or non-interactive control still fails.
  await expect
    .poll(
      async () => {
        const sample = await target.evaluate((node) => {
          const style = getComputedStyle(node);
          return {
            at: performance.now(),
            opacity: style.opacity,
            pointerEvents: style.pointerEvents,
            scrolling: node.classList.contains("is-away"),
          };
        });
        samples.push(sample);
        return !sample.scrolling && sample.opacity === "1" && sample.pointerEvents === "auto";
      },
      {
        timeout: 1500,
        intervals: [50, 100, 150],
        message: `${label}: scrolling ended but feedback did not return`,
      },
    )
    .toBe(true);
  await test.info().attach(`${label}-return`, {
    body: JSON.stringify(samples, null, 2),
    contentType: "application/json",
  });
}

test.describe("N nocollide · 四条体验回归", () => {
  test("N1 desktop · follow card 绕开展开的右栏", async ({ page }) => {
    const card = await openCoursePickEntry(page, DESKTOP);
    const rail = page.locator(".app-shell__aside");
    const cardBox = await boxOf(card, "课程卡");
    const railBox = await boxOf(rail, "当前对象右栏");

    expect(overlaps(cardBox, railBox), "课程卡落在展开的当前对象右栏下面").toBe(false);
    await assertVisibleAndHittableAtFivePoints(
      page,
      card.getByRole("button", { name: /^(进入|Enter) / }),
      "object entry / 进入",
    );
  });

  test("N2 desktop · course-island 右栏只说明当前课程而不重复学习入口", async ({ page }) => {
    const fixture = await getExperienceFixture(page);
    await page.goto(`${ONLINE_ORIGIN}${fixture.coursePath}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".stagewrap canvas")).toBeVisible({ timeout: 30_000 });

    await expect(page).toHaveURL(`${ONLINE_ORIGIN}${fixture.coursePath}`);
    await expect(page.locator(".map-shell__heading h2")).toHaveText(fixture.courseTitle);
    await expect(page.locator(".app-shell__aside .map-information")).toBeVisible();
    await expect(page.locator(".app-shell__aside button,.app-shell__aside a")).toHaveCount(0);
  });

  test("N3 phone · 提意见不盖账号目标或课文正文", async ({ page }) => {
    const fixture = await getExperienceFixture(page);
    await page.setViewportSize({ width: PHONE.width, height: PHONE.height });
    await page.goto(`${ONLINE_ORIGIN}/me`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".account-panel")).toBeVisible({ timeout: 30_000 });
    await page.locator('[data-me-door="help"]').click();
    const accountFeedback = page.locator("#profile-feedback-host button");
    await waitForFeedbackReturn(accountFeedback, "account-feedback");
    await assertVisibleAndHittableAtFivePoints(page, accountFeedback, "我 / 提意见");
    expect(await accountFeedback.evaluate((node) => getComputedStyle(node).position)).not.toBe(
      "fixed",
    );
    await expect(page.locator(".feedback-note__open--float")).toBeHidden();
    const accountForm = page.locator("details.account-panel__form");
    await expect(accountForm).toBeVisible();
    await expect(accountForm).not.toHaveAttribute("open");
    await accountForm.locator(":scope > summary").click();
    await expect(accountForm).toHaveAttribute("open", "");
    const password = accountForm.locator('input[type="password"]:visible');
    await expect(password, "在线账号回归必须渲染密码框").toBeVisible();
    const accountFeedbackBox = await boxOf(accountFeedback, "我 / 提意见");
    const accountTargetBox = await boxOf(password, "密码框");
    expect(overlaps(accountFeedbackBox, accountTargetBox), "提意见盖住密码框").toBe(false);

    // Attack the new readiness guard in the browser. Waiting for a fade must
    // never bless an invisible control, including the relocated V7 entry.
    const fault = await page.addStyleTag({
      content: "#profile-feedback-host button { opacity: 0 !important; }",
    });
    await expect(accountFeedback).toHaveCSS("opacity", "0");
    let rejected = false;
    try {
      await waitForFeedbackReturn(accountFeedback, "injected-hidden-feedback");
    } catch {
      rejected = true;
    } finally {
      await fault.evaluate((node) => node.remove());
    }
    expect(rejected, "the readiness guard must reject permanently hidden feedback").toBe(true);
    // Expanding the account form moved this inline entry below the viewport.
    // Scroll its real location into view; the strict five-point gate stays.
    await scrollIntoView(accountFeedback);
    await waitForFeedbackReturn(accountFeedback, "restored-feedback");
    await assertVisibleAndHittableAtFivePoints(page, accountFeedback, "恢复后 / 提意见");
    await accountFeedback.click();
    await expect(page.locator(".feedback-note__text")).toBeFocused();
    await page.locator(".feedback-note__text").fill("Synthetic unsent mobile feedback");
    await page.keyboard.press("Escape");
    await expect(accountFeedback).toBeFocused();

    await page.goto(`${ONLINE_ORIGIN}${fixture.lessonPath}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".lesson-reader__header")).toBeVisible({ timeout: 30_000 });
    // V7 moved the phone entry to Me: no invisible hit target or floating
    // pill may remain over the lesson. Walk its real replacement, too.
    await expect(page.locator(".feedback-note__open--float")).toBeHidden();
    await expect(page.locator(".feedback-note")).toHaveCount(0);
    await page.locator(".lesson-toolbar__close").click();
    await page.locator('.tab-bar a[href="/me"]').click();
    await page.locator('[data-me-door="help"]').click();
    await assertVisibleAndHittableAtFivePoints(page, accountFeedback, "课文返回我 / 提意见");
    await accountFeedback.click();
    await expect(page.locator(".feedback-note__text")).toBeFocused();
    await page.keyboard.press("Escape");
    await page.screenshot({ path: test.info().outputPath("phone-feedback-in-me.png") });
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
