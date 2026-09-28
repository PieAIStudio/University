import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CATALOGUE_ROLES, coursePathOf } from "./harness/catalogue.js";
import { passChestOpening } from "./harness/chest.js";
import { humanClick } from "./harness/click.js";
import { namedStep } from "./harness/step.js";
import { ONLINE_ORIGIN } from "./ports.js";

/**
 * V7 mechanic 8, the weekly boss (PLAN-V7-07 §2a), end to end: a learner who
 * finished a unit's lessons this week finds the boss on that island, takes its
 * five hearts with the lessons' own questions, and receives the chest it drops.
 *
 * The unit tests prove the rules — the window, the hearts, the flawless
 * upgrade. This proves the questions reach the browser, that each right answer
 * is written as a heart, and that the boss is gone for the week afterwards.
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
/** Captures for the report, not committed. */
const SHOTS = join(ROOT, "SCRATCH/e2e/weekly-boss");
const ROLE = CATALOGUE_ROLES.skipTest;
const STUDY = ROLE.study.id;
const COURSE = ROLE.course.id;

/** The reference answers, read off the authored exercises (see skip-test.spec.ts). */
function authoredAnswers(): ReadonlyMap<string, string> {
  const unitRoot = join(
    ROOT,
    "apps/local/studies",
    STUDY,
    "courses",
    COURSE,
    "units",
    ROLE.unit.id,
  );
  const answers = new Map<string, string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry === "exercise.json") {
        const record = JSON.parse(readFileSync(path, "utf8")) as {
          readonly prompt?: string;
          readonly expectedAnswer?: string;
        };
        if (record.prompt && record.expectedAnswer)
          answers.set(record.prompt, record.expectedAnswer);
      }
    }
  };
  walk(join(unitRoot, "lessons"));
  return answers;
}

/** Mark the unit's lessons finished today in the learner's own record, then reload. */
async function finishUnitToday(page: Page): Promise<void> {
  const keys = ROLE.unit.lessons.map((lesson) => `${STUDY}/${COURSE}/${lesson.id}`);
  await page.evaluate((lessonKeys) => {
    const key = "university.progress.v2";
    const document = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!document?.lessons) throw new Error("no guest progress document to write into");
    const now = Date.now();
    for (const [index, lessonKey] of lessonKeys.entries())
      document.lessons[lessonKey] = {
        progress: 1,
        completedAt: now - (lessonKeys.length - index) * 60_000,
        attempts: 1,
        readConfirmed: true,
        readConfirmedRevision: 1,
      };
    localStorage.setItem(key, JSON.stringify(document));
  }, keys);
}

test("the weekly boss stands on the island studied this week, and its last heart drops a chest", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const answers = authoredAnswers();
  mkdirSync(SHOTS, { recursive: true });
  const shot = (name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`) });
  const course = `${ONLINE_ORIGIN}${coursePathOf(ROLE.course)}`;

  await namedStep(page, "这周学完了一个单元", async () => {
    await page.goto(course, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("university.progress.v2") !== null), {
        timeout: 30_000,
      })
      .toBe(true);
    await finishUnitToday(page);
    await page.reload({ waitUntil: "domcontentloaded" });
  });

  const chip = page.locator('button[data-map-marker^="weekly-boss:"]');
  await namedStep(page, "岛上站着本周大怪，五颗心", async () => {
    await expect(chip).toBeVisible({ timeout: 60_000 });
    await expect(chip).toHaveAttribute("aria-label", /本周大怪.*5/);
    await page.waitForTimeout(1500);
    await shot("1-island");
    await humanClick(page, chip, "大怪头上的王冠");
    await expect(page.locator(".weekly-boss-fight__hearts")).toHaveAttribute("data-hearts", "5");
    await page.waitForTimeout(1500);
    await shot("2-intro");
    await humanClick(page, page.locator('[data-weekly-boss-action="fight"]'), "开打");
  });

  await namedStep(page, "五道题，每答对一道打掉一颗心", async () => {
    for (let heart = 5; heart > 0; heart -= 1) {
      const prompt = (await page.locator(".question-step__prompt").innerText()).trim();
      const expected = answers.get(prompt);
      expect(expected, `没有这道题的参考答案：${prompt}`).toBeTruthy();
      await page.locator(".question-step__answer").fill(expected!);
      if (heart === 5) await shot("3-question");
      await humanClick(
        page,
        page.locator('.weekly-boss-fight [data-question-action="submit"]'),
        "扔星星",
      );
      if (heart > 1) {
        await expect(page.locator(".weekly-boss-fight__hearts")).toHaveAttribute(
          "data-hearts",
          String(heart - 1),
        );
        if (heart === 5) {
          await page.waitForTimeout(900);
          await shot("4-hit");
        }
        await humanClick(page, page.locator('[data-weekly-boss-action="next"]'), "下一题");
      }
    }
    await expect(page.locator(".weekly-boss-fight")).toHaveCount(0, { timeout: 10_000 });
    await page.waitForTimeout(1200);
    await shot("5-last-heart");
    await expect(page.locator("[data-chest-stage]")).toBeVisible({ timeout: 20_000 });
    await shot("6-chest");
  });

  await passChestOpening(page);

  await namedStep(page, "心记进了学习记录，大怪这周不再来", async () => {
    const events = await page.evaluate(() => {
      const document = JSON.parse(localStorage.getItem("university.progress.v2") ?? "{}");
      return Object.keys(document.xpEvents ?? {}).filter((id) => id.startsWith("weekly-boss:"));
    });
    expect(events.filter((id) => id.includes(":hit:"))).toHaveLength(5);
    expect(events.filter((id) => !id.includes(":hit:"))).toHaveLength(1);
    await expect(chip).toHaveCount(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
    await expect(page.locator("button.label--icon.is-visible").first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(chip).toHaveCount(0);
  });
});
