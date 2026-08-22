import { expect, type Page } from "@playwright/test";

import { ONLINE_ORIGIN } from "../ports.js";
import { assertImagesStayInViewport, assertPanelIsPainted, assertVisibleText } from "./assert.js";
import { humanClick } from "./click.js";
import { namedStep } from "./step.js";

export const FIRST_LESSON_TITLE = "会使用 App 和会开发 App，差在哪儿？";
export const FIRST_COURSE_TITLE = "《在开始之前：App、代码、和你》";
export const FIRST_ANSWER = "图灵密约";
export const COST_LINE = /读 \d+ 分钟 · \d+ 道题/;
export const SETTLEMENT_PROGRESS = /1\s*\/\s*41\s*关/;

export async function openOnline(page: Page): Promise<void> {
  await page.goto(`${ONLINE_ORIGIN}/`, { waitUntil: "domcontentloaded" });
}

export async function waitForMapReady(page: Page): Promise<void> {
  await namedStep(page, "等待地图铺好", async () => {
    await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
    await expect(page.getByRole("button", { name: /开始第一节/ })).toBeVisible({ timeout: 30_000 });
  });
}

export async function startFirstLessonFromLanding(page: Page): Promise<void> {
  await namedStep(page, "点「开始第一节」", async () => {
    await humanClick(page, page.getByRole("button", { name: /开始第一节/ }).first(), "开始第一节");
  });
}

export async function openLiveNode(page: Page): Promise<void> {
  await namedStep(page, "关卡路径出现", async () => {
    await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 60_000 });
    await assertVisibleText(page, FIRST_COURSE_TITLE);
    await expect(page.locator("button.label.is-visible", { hasText: /^开始$/ })).toBeVisible({
      timeout: 30_000,
    });
    // Flight still moves the camera after the label first appears.
    await page.waitForTimeout(800);
  });

  const hud = page.locator(".picked, .nextup").first();
  const stage = page.locator(".stagewrap").first();
  if (await hud.isVisible().catch(() => false)) {
    await namedStep(page, "课程头不是灰砖", async () => {
      await assertPanelIsPainted(page, hud, stage, "课程头/下一课卡");
    });
  }

  await namedStep(page, "点路径上的当前节点", async () => {
    const node = page.locator("button.label.is-visible", { hasText: /^开始$/ }).first();
    const dialog = page.getByRole("dialog");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await humanClick(page, node, "路径节点「开始」");
      try {
        await dialog.waitFor({ state: "visible", timeout: 2_000 });
        return;
      } catch {
        // Camera may still be flying; the box we clicked is no longer the stone.
      }
    }
    await dialog.waitFor({ state: "visible", timeout: 5_000 });
  });
}

export async function confirmNodeCardAndStart(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog");
  await namedStep(page, "节点卡带着读分钟和题数", async () => {
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(FIRST_LESSON_TITLE);
    await expect(dialog).toContainText(COST_LINE);
    await assertPanelIsPainted(page, dialog.locator(".path-card").or(dialog), page.locator(".stagewrap"), "节点卡");
  });

  await namedStep(page, "点节点卡上的「开始」", async () => {
    await humanClick(page, dialog.getByRole("button", { name: /^开始/ }), "节点卡开始");
  });
}

export async function readAndAnswerFirstLesson(page: Page): Promise<void> {
  await namedStep(page, "课文出现", async () => {
    await assertVisibleText(page, FIRST_LESSON_TITLE);
    await assertVisibleText(page, "会使用 App");
    await assertImagesStayInViewport(page);
  });

  await namedStep(page, "滚到课文末尾的题", async () => {
    const quiz = page.locator(".quiz");
    await expect(quiz).toBeVisible();
    await quiz.scrollIntoViewIfNeeded();
    await expect(page.getByPlaceholder("用你自己的话写")).toBeVisible();
    await expect(page.getByRole("button", { name: "提交" })).toBeVisible();
  });

  await namedStep(page, "答题并提交", async () => {
    await page.getByPlaceholder("用你自己的话写").fill(FIRST_ANSWER);
    await humanClick(page, page.getByRole("button", { name: "提交" }), "提交");
    const appeal = page.getByRole("button", { name: "我觉得我对了" });
    const settled = page.getByText("读完了。");
    const outcome = await Promise.race([
      settled.waitFor({ timeout: 12_000 }).then(() => "settled" as const),
      appeal.waitFor({ timeout: 12_000 }).then(() => "appeal" as const),
    ]).catch(() => "none" as const);
    if (outcome === "appeal") {
      await humanClick(page, appeal, "我觉得我对了");
    }
  });
}

export async function waitForSettlementProgress(page: Page): Promise<void> {
  await namedStep(page, "结算页进度不是 0", async () => {
    await expect(page.getByText("读完了。")).toBeVisible({ timeout: 20_000 });
    // The bar animates from the old value. Reading too early catches "0 / 41 关".
    await expect(page.getByText(SETTLEMENT_PROGRESS)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/0\s*\/\s*41\s*关/)).toHaveCount(0);
    await page.waitForTimeout(700);
    await expect(page.getByText(SETTLEMENT_PROGRESS)).toBeVisible();
    await assertImagesStayInViewport(page);
  });
}

/**
 * New learner, first lesson, through to settlement. Shared by the phone and
 * desktop journeys so the two widths cannot drift apart.
 */
export async function walkFirstOnlineLesson(page: Page): Promise<void> {
  await openOnline(page);
  await waitForMapReady(page);
  await assertImagesStayInViewport(page);

  const landingHud = page.locator(".nextup");
  if (await landingHud.isVisible().catch(() => false)) {
    await namedStep(page, "落地页下一课卡不是灰砖", async () => {
      await assertPanelIsPainted(page, landingHud, page.locator(".stagewrap"), "落地页 .nextup");
    });
  }

  await startFirstLessonFromLanding(page);
  await openLiveNode(page);
  await confirmNodeCardAndStart(page);
  await readAndAnswerFirstLesson(page);
  await waitForSettlementProgress(page);
}

/** Same person, next morning: due dates pulled into the past, then one load. */
export async function makeDroppedCardsDue(page: Page): Promise<number> {
  const count = await page.evaluate(() => {
    const key = "university.progress.v2";
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("没有进度可改：localStorage 里没有 university.progress.v2");
    const data = JSON.parse(raw) as { cards?: Record<string, { dueAt: number }> };
    const cards = Object.values(data.cards ?? {});
    if (cards.length === 0) throw new Error("刚学完的课没有掉落卡片");
    const dueAt = Date.now() - 1000;
    for (const card of cards) card.dueAt = dueAt;
    localStorage.setItem(key, JSON.stringify(data));
    return cards.length;
  });
  return count;
}
