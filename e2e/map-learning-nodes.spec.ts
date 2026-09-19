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
const segment = segments.find((item) => {
  const plan = planCheckpoint(
    packageLessons.filter((lesson) => item.lessonIds.includes(lesson.id)),
  );
  return plan.unavailable.length === 0 && plan.questions.length >= 3;
})!;

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

async function openNode(page: Page, kind: string, block: LearningSegment = segment) {
  const menu = page.locator(".map-node-menu");
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
  for (const locale of ["zh-CN", "en"] as const) {
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
      await expect(page.locator(".map-node-menu")).toBeVisible();
      await openNode(page, "challenge");
      await expect(page.locator('[data-map-node-flow="challenge"]')).toContainText(
        text("先学这一段", "Learn this section"),
      );
      await page.keyboard.press("Escape");

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
      expect(afterProof.proven).toHaveLength(segment.lessonIds.length);
      expect(afterProof.cards).toEqual([]);
      expect(afterProof.lessons).toEqual([]);
      expect(afterProof.xp).toBe(0);
      await page.keyboard.press("Escape");
      await expect(page.locator('[data-proved="true"]')).toHaveCount(segment.lessonIds.length * 2);

      await openNode(page, "challenge");
      const dialog = page.locator(".map-node-dialog");
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
  await page.goto(`${ONLINE_ORIGIN}${coursePathOf(course)}?lang=zh-CN`);
  await openNode(page, "checkpoint", segments[0]!);
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
  await expect(page.locator(".map-node-menu")).toBeVisible();
});
