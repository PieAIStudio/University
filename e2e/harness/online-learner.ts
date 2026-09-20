import { expect, type Page } from "@playwright/test";

import { ONLINE_ORIGIN } from "../ports.js";
import { assertImagesStayInViewport, assertPanelIsPainted, assertVisibleText } from "./assert.js";
import { CATALOGUE_ROLES, coursePathOf, lessonPathOf } from "./catalogue.js";
import { humanClick } from "./click.js";
import { namedStep } from "./step.js";
import { enterSelectedMapObject } from "./map-actions.js";
import { PRIMARY_DOMAIN_ID } from "./domain-catalogue.js";
import { enterExerciseAnswer } from "./exercise-input.js";

const SETTLEMENT = CATALOGUE_ROLES.settlement;
const SETTLEMENT_LESSONS = SETTLEMENT.course.units.flatMap((unit) => unit.lessons);
export const SETTLEMENT_LESSON_COUNT = SETTLEMENT_LESSONS.length;

export const FIRST_STUDY_ID = SETTLEMENT.study.id;
export const FIRST_COURSE_ID = SETTLEMENT.course.id;
export const FIRST_LESSON_ID = SETTLEMENT.lesson.id;
export const FIRST_LESSON_TITLE = SETTLEMENT.lesson.title;
export const FIRST_COURSE_TITLE = SETTLEMENT.course.title;
export const FIRST_ANSWER: string = SETTLEMENT.answer;
export const COST_LINE = /读 \d+ 分钟 · \d+ 道题/;
export const SETTLEMENT_PROGRESS = new RegExp(`1\\s*/\\s*${SETTLEMENT_LESSON_COUNT}\\s*关`);
export const GAME_ROUTE_TITLE: string = SETTLEMENT.study.title;
/** Settlement routes are role-derived; specs never spell study/course/lesson ids. */
export const FIRST_COURSE_ROUTE = coursePathOf(SETTLEMENT.course);
export const FIRST_LESSON_ROUTE = lessonPathOf(SETTLEMENT.course, SETTLEMENT.lesson);

export async function openOnline(page: Page): Promise<void> {
  await page.goto(`${ONLINE_ORIGIN}/`, { waitUntil: "domcontentloaded" });
  await selectGameRoute(page);
}

export async function selectGameRoute(page: Page): Promise<void> {
  // The map no longer owns a second study switcher. Choose the actual domain
  // and enter its selected study beside the globe, with the same controls a
  // learner sees after opening /planet.
  const origin = new URL(page.url()).origin;
  await page.goto(`${origin}/planet`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
  await expect(page.locator('[data-map-surface="true"]:visible').first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("[data-planet-resources]")).toHaveCount(0, { timeout: 90_000 });
  const domain = page
    .locator(`button[data-domain-id=${JSON.stringify(PRIMARY_DOMAIN_ID)}]`)
    .first();
  await expect(domain).toBeVisible({ timeout: 30_000 });
  if ((await domain.getAttribute("aria-pressed")) !== "true") {
    await humanClick(page, domain, "choose the actual learning domain");
  }
  const study = page.locator("button[data-study-id]").filter({ hasText: GAME_ROUTE_TITLE });
  if (await study.count()) {
    const regions = page.locator(".planet-domain-label__actions details > summary");
    if (!(await study.first().isVisible())) await regions.click();
    await humanClick(page, study.first(), "choose the actual game-learning series");
  }
  await enterSelectedMapObject(page, `enter ${GAME_ROUTE_TITLE}`);
  await expect(page.locator(".stagewrap")).toBeVisible({ timeout: 30_000 });
}

/**
 * The 「今天」 panel's call to action, in both shells.
 *
 * It reads 「开始学习」 before you have opened the lesson and 「继续学习」 after,
 * so a test that pins one of them passes or fails on the fixture's progress
 * rather than on the product. It used to say 「开始第一节」 in the delivery shell
 * only, because that shell had its own copy of the panel; the panel is one
 * component now and this is its wording.
 */
export const TODAY_CTA = /开始学习|继续学习/;

export async function waitForMapReady(page: Page): Promise<void> {
  await namedStep(page, "等待地图铺好", async () => {
    await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
    await expect(page.locator('[data-map-surface="true"]:visible').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("button.label--course.is-visible").first()).toBeVisible({
      timeout: 60_000,
    });
  });
}

export async function startFirstLessonFromLanding(page: Page): Promise<void> {
  await namedStep(page, "从地图真实选择课程和第一节", async () => {
    const course = page.locator(
      `button.label--course.is-visible[data-map-marker=${JSON.stringify(FIRST_COURSE_ID)}]`,
    );
    await expect(course).toBeVisible({ timeout: 30_000 });
    await humanClick(page, course, "地图课程岛");
    await enterSelectedMapObject(page, "进入课程岛");
    await expect(page).toHaveURL(`${ONLINE_ORIGIN}${FIRST_COURSE_ROUTE}`);
    const firstLesson = page.getByRole("button", { name: "开始", exact: true }).first();
    await expect(firstLesson).toBeVisible({ timeout: 60_000 });
    await humanClick(page, firstLesson, "第一节 lesson 标记");
    await enterSelectedMapObject(page, "开始第一节");
    await expect(page).toHaveURL(`${ONLINE_ORIGIN}${FIRST_LESSON_ROUTE}`);
  });
}

export async function readAndAnswerFirstLesson(page: Page): Promise<void> {
  await namedStep(page, "课文出现", async () => {
    await assertVisibleText(page, FIRST_LESSON_TITLE);
    // This settlement test reads the actual explanation before confirming it.
    // The separate interaction suite proves guided rounds; opening their
    // alternative review route is not simulated interaction completion.
    const review = page.locator(".interaction-path__review");
    if ((await review.count()) > 0) {
      await humanClick(page, review.locator("summary").first(), "打开本节完整讲解");
      await expect(review).toHaveAttribute("open", "");
    }
    await assertImagesStayInViewport(page);
  });

  await namedStep(page, "滚到课文末尾的题", async () => {
    const quiz = page.locator(".exercise-panel").first();
    await expect(quiz).toBeVisible();
    await quiz.scrollIntoViewIfNeeded();
    await expect(quiz.locator("textarea, [data-exercise-option]").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /提交/ })).toBeVisible();
  });

  await namedStep(page, "答题并提交", async () => {
    await enterExerciseAnswer(page, page.locator(".exercise-panel").first(), FIRST_ANSWER);
    await humanClick(page, page.getByRole("button", { name: /提交/ }), "提交");
  });

  /*
    A lesson is finished by two acts, not one: the exercises pass, and you say
    you have read this revision.

    This step used not to exist, and the test still went green — because the
    settlement had a legacy branch that treated "this document has no
    readConfirmed field at all" as confirmed, which was true of every document
    written before the field existed. The shared progress document always
    writes the field now, so that branch is correctly dead and the button is
    the only way through. Clicking it is what a learner does.
  */
  await namedStep(page, "确认读完了这一版", async () => {
    const confirm = page.getByRole("button", { name: /^(我读完了|我学过这一版了)$/ });
    await expect(confirm).toBeVisible({ timeout: 20_000 });
    await confirm.scrollIntoViewIfNeeded();
    await humanClick(page, confirm, "明确确认学过当前版本");
  });
}

export async function waitForSettlementProgress(page: Page): Promise<void> {
  await namedStep(page, "结算页进度不是 0", async () => {
    const outcome = await page.waitForFunction(
      () => {
        if (document.querySelector(".loading-trivia")) return "trivia";
        if ((document.body.innerText ?? "").includes("读完了")) return "done";
        return false;
      },
      undefined,
      { timeout: 20_000 },
    );
    const value = await outcome.jsonValue();
    if (value !== "done") {
      throw new Error("读完一节后先闪了一张加载词条。结算不该再出现概念卡。");
    }
    await expect(page.getByText("读完了。")).toBeVisible({ timeout: 20_000 });
    // The bar animates from the old value. Reading too early catches "0 / 41 关".
    await expect(page.getByText(SETTLEMENT_PROGRESS)).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(new RegExp(`0\\s*/\\s*${SETTLEMENT_LESSON_COUNT}\\s*关`)),
    ).toHaveCount(0);
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
  const trivia = page.locator(".loading-trivia");
  if (await trivia.isVisible().catch(() => false)) {
    await expect(trivia).toContainText("点一座岛，开始学");
    await expect(trivia).not.toContainText("对着真实项目学");
    await expect(trivia).not.toContainText("地图铺开时，看一条概念");
  }
  await waitForMapReady(page);
  await assertImagesStayInViewport(page);

  const landingHud = page.locator(".nextup");
  if (await landingHud.isVisible().catch(() => false)) {
    await namedStep(page, "落地页下一课卡不是灰砖", async () => {
      await assertPanelIsPainted(page, landingHud, page.locator(".stagewrap"), "落地页 .nextup");
    });
  }

  /*
    Straight into the lesson. 「今天」 names a lesson and its button opens that
    lesson, at both widths — the phone card used to name a course and open the
    course path instead, so this walk had to detour through the path and the
    node card, and the detour only existed at one width.

    The path and the node card are still tested: F walks in through the map,
    which is the other way in and the one they belong to.
  */
  await startFirstLessonFromLanding(page);
  await readAndAnswerFirstLesson(page);
  await waitForSettlementProgress(page);
}

/**
 * Same fresh-context learner, next morning. Advance the browser's date, not
 * the cards' FSRS schedules. Date-only emulation leaves UI timers running.
 *
 * The value event may already have adopted guest progress into an anonymous
 * account and cleared the guest cache. Reading only the old guest key races
 * that legitimate transition. This helper is for B's isolated, single-learner
 * context: exactly one nonempty progress cache must exist. Never guess among
 * several accounts, inspect auth storage, or manufacture missing cards.
 * Reload then makes the normal review selector evaluate the genuine schedule
 * at the simulated return time, including when a cloud merge happens later.
 */
export async function makeDroppedCardsDue(page: Page): Promise<number> {
  const schedule = await page.evaluate(() => {
    const key = "university.progress.v2";
    const schedules = Object.keys(localStorage)
      .filter((name) => name === key || name.startsWith(`${key}.account.`))
      .map((name) => {
        const data = JSON.parse(localStorage.getItem(name) ?? "null") as {
          cards?: Record<string, { dueAt: unknown }>;
        } | null;
        return Object.values(data?.cards ?? {});
      })
      .filter((cards) => cards.length > 0);
    if (schedules.length === 0) throw new Error("刚学完的课没有掉落卡片");
    if (schedules.length !== 1) throw new Error("复习模拟需要唯一的学习者缓存，不能猜测账号");
    const cards = schedules[0]!;
    const dates = cards.map((card) => {
      if (typeof card.dueAt !== "number" || !Number.isFinite(card.dueAt)) {
        throw new Error("复习卡的到期时间无效，不能伪造日程");
      }
      return card.dueAt;
    });
    return { count: cards.length, returnAt: Math.max(Date.now() + 86_400_000, ...dates) + 1000 };
  });
  await page.clock.setFixedTime(schedule.returnAt);
  await page.reload({ waitUntil: "domcontentloaded" });
  return schedule.count;
}
