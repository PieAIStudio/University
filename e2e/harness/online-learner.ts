import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

import { ONLINE_ORIGIN } from "../ports.js";
import { assertImagesStayInViewport, assertPanelIsPainted, assertVisibleText } from "./assert.js";
import { humanClick } from "./click.js";
import { namedStep } from "./step.js";

/*
  The settlement fixture, addressed by id and read out of the shipped package.

  It used to be four string literals copied from `turing-pact`'s opening course,
  and when that package was locked on 2026-09-12 every spec importing this file
  failed at module load — not on an assertion, on `.title` of `undefined`, so
  Playwright could not even collect them. Ids are the stable half of a lesson
  and its prose is the half an author rewrites, so the ids are written here and
  every piece of display text is looked up.

  The answer is the one thing that cannot be derived: `import-courses` strips
  answer keys out of the package and leaves a fingerprint, which is the point.
  "会动手的" is what this exercise's prompt asks the learner to choose between.
*/
const FIXTURE = {
  studyId: "browser-ai",
  courseId: "run-a-real-project-with-ai",
  lessonId: "chat-ai-versus-doing-ai",
  answer: "会动手的",
} as const;

interface PackagedLesson {
  readonly id: string;
  readonly title: string;
}
interface PackagedCourse {
  readonly id: string;
  readonly title: string;
  readonly units: readonly { readonly lessons: readonly PackagedLesson[] }[];
}

const catalogue = JSON.parse(
  readFileSync("apps/university/src/content/imported.json", "utf8"),
) as { readonly studies: readonly { readonly studyId: string; readonly title: string }[] };

const study = catalogue.studies.find((entry) => entry.studyId === FIXTURE.studyId);
if (!study) {
  throw new Error(
    `e2e fixture: study ${FIXTURE.studyId} is not in the shipped catalogue. ` +
      `Shipped: ${catalogue.studies.map((entry) => entry.studyId).join(", ") || "(none)"}. ` +
      `Point FIXTURE at a shipped study, or unlock this one.`,
  );
}

const packaged = JSON.parse(
  readFileSync(
    `apps/university/content/${FIXTURE.studyId}/${FIXTURE.courseId}.json`,
    "utf8",
  ),
) as { readonly course?: PackagedCourse } & Partial<PackagedCourse>;
const course = (packaged.course ?? packaged) as PackagedCourse;
const lessons = course.units.flatMap((unit) => unit.lessons);
const firstLesson = lessons.find((lesson) => lesson.id === FIXTURE.lessonId);
if (!firstLesson) {
  throw new Error(
    `e2e fixture: lesson ${FIXTURE.lessonId} is not in ${FIXTURE.courseId}. ` +
      `Lessons: ${lessons.map((lesson) => lesson.id).join(", ")}.`,
  );
}

export const FIRST_LESSON_TITLE = firstLesson.title;
export const FIRST_COURSE_TITLE = course.title;
export const FIRST_ANSWER: string = FIXTURE.answer;
export const COST_LINE = /读 \d+ 分钟 · \d+ 道题/;
export const SETTLEMENT_PROGRESS = new RegExp(`1\\s*/\\s*${lessons.length}\\s*关`);
export const GAME_ROUTE_TITLE: string = study.title;
/** The settlement course's own route, so a spec never spells the ids again. */
export const FIRST_COURSE_ROUTE = `/${FIXTURE.studyId}/${FIXTURE.courseId}`;

export async function openOnline(page: Page): Promise<void> {
  await page.goto(`${ONLINE_ORIGIN}/`, { waitUntil: "domcontentloaded" });
  await selectGameRoute(page);
}

export async function selectGameRoute(page: Page): Promise<void> {
  // The default can legitimately change when a new domain opens. This
  // settlement fixture chooses its real, deterministically graded course
  // through the same visible series picker a learner uses, without seeding
  // navigation/progress or pretending it is still the global default.
  await waitForMapReady(page);
  const picker = page.locator(".study-switcher__trigger");
  await humanClick(page, picker, "choose the actual game-learning route");
  await humanClick(
    page,
    page.getByRole("option").filter({ hasText: GAME_ROUTE_TITLE }),
    "select the flagship course fixture",
  );
  await expect(picker).toHaveAttribute("aria-label", `当前系列 ${GAME_ROUTE_TITLE}`);
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
    await expect(page.getByRole("button", { name: TODAY_CTA }).first()).toBeVisible({
      timeout: 30_000,
    });
  });
}

export async function startFirstLessonFromLanding(page: Page): Promise<void> {
  await namedStep(page, "点今天的那一课", async () => {
    await humanClick(page, page.getByRole("button", { name: TODAY_CTA }).first(), "今天这一课");
  });
}

export async function readAndAnswerFirstLesson(page: Page): Promise<void> {
  await namedStep(page, "课文出现", async () => {
    await assertVisibleText(page, FIRST_LESSON_TITLE);
    await assertImagesStayInViewport(page);
  });

  await namedStep(page, "滚到课文末尾的题", async () => {
    const quiz = page.locator(".exercise-panel").first();
    await expect(quiz).toBeVisible();
    await quiz.scrollIntoViewIfNeeded();
    await expect(page.getByPlaceholder(/用自己的话/)).toBeVisible();
    await expect(page.getByRole("button", { name: /提交/ })).toBeVisible();
  });

  await namedStep(page, "答题并提交", async () => {
    await page.getByPlaceholder(/用自己的话/).fill(FIRST_ANSWER);
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
    const confirm = page.getByRole("button", { name: /^我读完了$/ });
    await expect(confirm).toBeVisible({ timeout: 20_000 });
    await confirm.scrollIntoViewIfNeeded();
    await humanClick(page, confirm, "我读完了");
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

/** Same person, next morning: due dates pulled into the past, then one load. */
/**
 * Rewind the dropped cards so the review queue behaves as it will tomorrow.
 *
 * The reload at the end is load-bearing. The progress port keeps its state in
 * memory and writes through to `localStorage`, so editing storage underneath a
 * running page changes nothing a screen can see — and a `goto` that only
 * changes the hash does not reload the document. This helper looked like it
 * worked for as long as new cards were due immediately: the review screen had
 * cards either way, so nobody found out that the simulation was a no-op.
 */
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
  await page.reload({ waitUntil: "domcontentloaded" });
  return count;
}
