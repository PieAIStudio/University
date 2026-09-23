import { expect, test, type Page } from "@playwright/test";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  learningSegments,
  judgeCheckpointAnswer,
  planCheckpoint,
  localizeLearnerContent,
  type CheckpointLesson,
  type LearningSegment,
} from "../packages/core/dist/index.js";
import { SHIPPED_COURSES, coursePathOf } from "./harness/catalogue.js";
import { humanClick } from "./harness/click.js";
import { openMapRoutePage } from "./harness/map-actions.js";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";

// Exercise the actual shipped questions and native proof/review records.
// No pass, read event, flashcard or game result is injected into the browser.
const course = SHIPPED_COURSES.find(
  (item) => item.studyId === "ai-literacy" && item.id === "understanding-ai",
)!;
const units = course.units.map((unit) => ({
  id: unit.id,
  title: String(unit.packageUnit.title),
  lessons: unit.lessons,
}));
const segments = learningSegments({ units });
const packageLessons = course.units.flatMap((unit) =>
  unit.lessons.map((item) => item.packageLesson as unknown as CheckpointLesson),
);
const LOCALES = ["zh-CN", "en"] as const;
/**
 * A lesson can carry an assessable exercise in one language and not in another:
 * `ask-about-a-picture` and `name-the-result` have no assessable English one, so
 * four of this course's twelve blocks are not fully checkable in English. Pick a
 * block that every locale this spec drives can actually check, or the English run
 * meets "not assessed yet" on a block that was chosen from the Chinese content.
 */
const segment = segments.find((item) => {
  const lessons = packageLessons.filter((lesson) => item.lessonIds.includes(lesson.id));
  return LOCALES.every((locale) => {
    const plan = planCheckpoint(localizeLearnerContent(lessons, locale));
    return plan.unavailable.length === 0 && plan.questions.length >= 3;
  });
})!;

/**
 * Real shipped content, not a fixture: one lesson in the catalogue has no
 * assessable exercise. Search every course for it instead of assuming it sits
 * in this course's first segment, so the test keeps exercising the state and
 * not a particular table of contents.
 */
const unassessed = (() => {
  for (const item of SHIPPED_COURSES) {
    const lessons = item.units.flatMap((unit) =>
      unit.lessons.map((lesson) => lesson.packageLesson as unknown as CheckpointLesson),
    );
    const blocks = learningSegments({
      units: item.units.map((unit) => ({
        id: unit.id,
        title: String(unit.packageUnit.title),
        lessons: unit.lessons,
      })),
    });
    for (const block of blocks) {
      const plan = planCheckpoint(lessons.filter((lesson) => block.lessonIds.includes(lesson.id)));
      if (plan.unavailable.length > 0) return { course: item, segment: block };
    }
  }
  return null;
})();

function references(locale: "zh-CN" | "en") {
  const result = new Map<string, string>();
  for (const lessonId of segment.lessonIds) {
    const dir = join(
      "apps/local/studies",
      course.studyId,
      "courses",
      course.id,
      "units",
      segment.unitId,
      "lessons",
      lessonId,
      "exercises",
    );
    for (const id of readdirSync(dir)) {
      const revisions = join(dir, id, "revisions");
      const latest = readdirSync(revisions)
        .filter((value) => /^\d+$/.test(value))
        .sort((a, b) => Number(b) - Number(a))[0];
      if (!latest) continue;
      const raw = JSON.parse(readFileSync(join(revisions, latest, "exercise.json"), "utf8"));
      // Reference answers are author-only data. The public-content localizer
      // deliberately never copies expectedAnswer out of a locale variant.
      // Read the native fixture explicitly; otherwise the English test submits
      // the Chinese reference and incorrectly reports a product grading defect.
      const answer = raw.locales?.[locale]?.expectedAnswer ?? raw.expectedAnswer;
      if (answer) result.set(`${lessonId}/${id}`, answer);
    }
  }
  return result;
}

/**
 * The map carries no persistent chrome. The course panel — and with it this
 * menu — lives in the on-demand quick-actions palette, and Escape closes the
 * palette between flows, so every entry re-opens it the way a learner does.
 */
async function openOpportunities(page: Page) {
  // Scope the menu to the palette that is actually on screen; a bare page-wide
  // locator can settle on the copy inside a palette that is no longer shown.
  const palette = await openMapRoutePage(page);
  // The list sits behind the route disclosure, which starts closed so a collapsed
  // island keeps the way back to the map reachable at phone width.
  const route = palette.locator("details.picked__route");
  await expect(route).toBeVisible();
  if ((await route.getAttribute("open")) === null)
    await humanClick(page, route.locator(":scope > summary"), "展开学习路线");
  const menu = palette.locator(".map-node-menu");
  await expect(menu).toBeVisible();
  return menu;
}

/**
 * The challenge node plays 庭院拦截 (ADR-0011) once the learner's finished or
 * proved lessons — this block's and the nine before it — give two sorts. Which
 * lessons count as finished depends on the learner store the mode reads, and
 * in authoring that is the machine's own. The node says which game it opened
 * on its flow (`data-game`); the 2D matching game this spec checks is always
 * one visible tap away, and the 3D game has its own spec (courtyard-game).
 */
async function chooseMatchingGame(page: Page) {
  const flow = page.locator('[data-map-node-flow="challenge"]');
  await expect(flow).toBeVisible();
  if ((await flow.getAttribute("data-game")) !== "courtyard") return;
  await expect(page.getByTestId("game-intro")).toBeVisible({ timeout: 60_000 });
  await humanClick(page, page.getByTestId("game-plain"), "choose the 2D matching game");
  await expect(flow).not.toHaveAttribute("data-game", "courtyard");
}

async function openNode(page: Page, kind: string, block: LearningSegment = segment) {
  const menu = await openOpportunities(page);
  if ((await menu.getAttribute("open")) === null)
    await humanClick(page, menu.locator("summary"), "open map opportunities");
  await expect(menu.locator("select")).toBeVisible();
  await menu.locator("select").selectOption(block.id);
  await humanClick(page, menu.locator(`[data-learning-menu="${kind}"]`), `open ${kind}`);
  await expect(page.locator(".map-node-dialog")).toBeVisible();
  await expect(page.locator(`[data-map-node-flow="${kind}"]`)).toBeVisible();
}

async function progress(page: Page) {
  return page.evaluate(() => {
    const doc = JSON.parse(localStorage.getItem("university.progress.v2") ?? "{}");
    return {
      proven: Object.keys(doc.provenLessons ?? {}),
      cards: Object.keys(doc.cards ?? {}),
      lessons: Object.keys(doc.lessons ?? {}),
      xp: doc.totalXp ?? 0,
    };
  });
}

for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const)
  for (const locale of LOCALES) {
    test(`map nodes ${mode} ${locale}: coverage checkpoint, optional game, pause and restored progress`, async ({
      page,
    }, info) => {
      await page.setViewportSize(
        locale === "en" ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`${origin}${coursePathOf(course)}?lang=${locale}`);
      const zh = locale === "zh-CN";
      const text = (a: string, b: string) => (zh ? a : b);
      await openOpportunities(page);
      await openNode(page, "challenge");
      await chooseMatchingGame(page);
      await expect(page.locator('[data-map-node-flow="challenge"]')).toContainText(
        text("先学这一段", "Learn this section"),
      );
      await page.keyboard.press("Escape");

      /*
        Baseline, not zero.

        The authoring mode hydrates this document from the machine's own
        learner store, and anything that has read a lesson there — a person, or
        another spec earlier in the same suite — is already in it. Asserting
        emptiness made this test a report on the machine rather than on the
        product: it passed one 40-minute push run and failed the next, in both
        authoring locales, listing eight lessons that a sibling spec had read
        twenty minutes earlier.

        What this test owns is the delta a coverage checkpoint makes, and that
        delta is the whole claim: proving a segment grants proof, and grants
        nothing else — no practice cards, no lesson progress, no XP.
      */
      const beforeProof = await progress(page);

      await openNode(page, "checkpoint");
      await humanClick(
        page,
        page
          .locator(".map-node-dialog button")
          .filter({ hasText: text("开始检查", "Start check") }),
        "begin coverage check",
      );
      const plan = planCheckpoint(
        localizeLearnerContent(
          packageLessons.filter((lesson) => segment.lessonIds.includes(lesson.id)),
          locale,
        ),
      );
      const answers = references(locale);
      for (const question of plan.questions) {
        const answer = answers.get(`${question.lessonId}/${question.exerciseId}`);
        expect(answer, question.prompt).toBeTruthy();
        expect(judgeCheckpointAnswer(answer!, question.answerKey), question.prompt).toBe("correct");
        await expect(page.locator(".map-node-dialog h3")).toHaveText(question.prompt);
        if (question.options) {
          await humanClick(
            page,
            page.locator(".map-node-dialog .exercise-choice button").filter({ hasText: answer! }),
            "select a native checkpoint option",
          );
        } else {
          await page.locator(".map-node-dialog textarea").fill(answer!);
        }
        await humanClick(
          page,
          page.locator('.map-node-dialog [data-map-node-flow="checkpoint"] > button').last(),
          "submit actual reference answer",
        );
      }
      await expect(page.locator('[data-map-node-flow="checkpoint"]')).toContainText(
        text("这一段检查通过", "passed"),
      );
      const afterProof = await progress(page);
      expect(afterProof.proven.filter((id) => !beforeProof.proven.includes(id))).toHaveLength(
        segment.lessonIds.length,
      );
      expect(afterProof.cards).toEqual(beforeProof.cards);
      expect(afterProof.lessons).toEqual(beforeProof.lessons);
      expect(afterProof.xp).toBe(beforeProof.xp);
      await page.keyboard.press("Escape");
      // Every lesson of the block reads as proved. Not `× 2`: a lesson can carry
      // both a kind icon and a label, but the live stone deliberately has no
      // duplicate icon (SPRITE_WINDOW in packages/world/src/labels/path-overlay.ts),
      // so counting nodes measures which lesson is live rather than what is proved.
      await expect
        .poll(async () =>
          (
            await page
              .locator('[data-proved="true"]')
              .evaluateAll((elements) => [
                ...new Set(
                  elements.map((element) =>
                    (element.getAttribute("data-map-marker") ?? "").replace(/^kind:/, ""),
                  ),
                ),
              ])
          ).sort(),
        )
        .toEqual([...segment.lessonIds].sort());

      await openNode(page, "challenge");
      const dialog = page.locator(".map-node-dialog");
      await chooseMatchingGame(page);
      await humanClick(
        page,
        dialog.getByRole("button", { name: text("慢慢玩，不计时", "No timer"), exact: true }),
        "untimed option",
      );
      await humanClick(
        page,
        dialog.getByRole("button", { name: text("开始配对", "Start matching"), exact: true }),
        "start game",
      );
      const fronts = page.locator("[data-match-front]");
      const ids = await fronts.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-match-front")!),
      );
      expect(ids.length).toBeGreaterThanOrEqual(2);
      await humanClick(page, fronts.first(), "choose a prompt");
      await humanClick(
        page,
        page.locator(`[data-match-back="${ids[1]}"]`),
        "make one deliberate mismatch",
      );
      await expect(dialog.locator('[role="status"]')).toBeVisible();
      await humanClick(page, fronts.first(), "select same prompt again");
      await humanClick(
        page,
        page.locator(`[data-match-back="${ids[0]}"]`),
        "match its actual answer",
      );
      await expect(fronts.first()).toBeDisabled();
      await page.keyboard.press("Escape");
      await page.reload();
      await openNode(page, "challenge");
      await chooseMatchingGame(page);
      await expect(page.locator("[data-match-front]")).toHaveCount(0);
      await humanClick(
        page,
        dialog.getByRole("button", { name: text("接着玩", "Resume"), exact: true }),
        "resume saved board",
      );
      await expect(page.locator(`[data-match-front="${ids[0]}"]`)).toBeDisabled();
      expect(await progress(page)).toEqual(afterProof);
      mkdirSync(".devspace-visual/map-learning-nodes/regression", { recursive: true });
      await page.screenshot({
        path: `.devspace-visual/map-learning-nodes/regression/${mode}-${locale}-game.png`,
        fullPage: true,
      });
      const geometry = await dialog.boundingBox();
      expect(geometry!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      expect(geometry!.x).toBeGreaterThanOrEqual(0);
      await info.attach("proof-stays-separate-from-practice", {
        body: JSON.stringify(afterProof),
        contentType: "application/json",
      });
    });
  }

test("map checkpoint names unassessed practical lessons instead of skipping them", async ({
  page,
}) => {
  expect(unassessed, "没有任何已发布课节缺少可判定练习：这条检查已失去守护对象").toBeTruthy();
  await page.goto(`${ONLINE_ORIGIN}${coursePathOf(unassessed!.course)}?lang=zh-CN`);
  await openNode(page, "checkpoint", unassessed!.segment);
  await expect(page.locator('[data-map-node-flow="checkpoint"]')).toContainText(
    "现在不能用简短答题来跳过",
  );
  await expect(page.getByRole("button", { name: "开始检查", exact: true })).toHaveCount(0);
  expect((await progress(page)).proven).toEqual([]);
});

test("personal node without a configured generator is explicit and leaves the normal course usable", async ({
  page,
}) => {
  await page.goto(`${ONLINE_ORIGIN}${coursePathOf(course)}?lang=zh-CN`);
  await openNode(page, "personal", segments[0]!);
  await expect(page.locator(".map-node-dialog")).toContainText("个人课生成服务还没有连接");
  await expect(page.getByRole("button", { name: "生成我的小课", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  // Escape closes the palette along with the dialog, so "still usable" is that
  // the course map is intact and the opportunity list reopens — not that a menu
  // stays pinned to a map that deliberately carries no persistent chrome.
  await expect(page.locator('[data-map-surface="true"]:visible').first()).toBeVisible();
  await openOpportunities(page);
});
