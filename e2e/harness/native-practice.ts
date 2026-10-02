/** Native published questions with explicitly synthetic, migrated completion.
 * This never seeds a new answer verdict or grants a real account progress.
 * Expected answers come from the existing private authoring fixture sources;
 * the product still receives only compiled fingerprints. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { CATALOGUE_ROLES } from "./catalogue.js";
import { E2E_STUDIES_ROOT } from "../catalogue-paths.mjs";
import { emptyProgress, lessonKeyOf } from "../../packages/core/src/progress/document.js";
import { judgeSkipAnswer, skipTestCandidates } from "../../packages/core/src/progress/skip-test.js";
import type { LessonRef } from "../../packages/core/src/progress/contract.js";

export function nativeExerciseAnswers(locator: LessonRef): Map<string, string> {
  const answers = new Map<string, string>();
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name === "exercise.json") {
        const exercise = JSON.parse(readFileSync(path, "utf8"));
        if (typeof exercise.prompt === "string" && typeof exercise.expectedAnswer === "string")
          answers.set(exercise.prompt.trim(), exercise.expectedAnswer);
      }
    }
  };
  walk(
    join(
      E2E_STUDIES_ROOT,
      locator.studyId,
      "courses",
      locator.courseId,
      "units",
      locator.unitId,
      "lessons",
      locator.lessonId,
    ),
  );
  return answers;
}

export async function prepareNativePractice(page: Page, count = 3) {
  const document = emptyProgress();
  const answers = new Map<string, string>();
  const sourceIds: string[] = [];
  const role = CATALOGUE_ROLES.skipTest;
  for (const unit of role.course.units) {
    for (const lesson of unit.lessons) {
      const locator = {
        studyId: role.study.id,
        courseId: role.course.id,
        unitId: unit.id,
        lessonId: lesson.id,
      };
      const questions = skipTestCandidates([
        { id: lesson.id, exercises: (lesson.packageLesson as any).exercises },
      ]);
      if (!questions.length) continue;
      const native = nativeExerciseAnswers(locator);
      if (
        questions.some(
          (question) =>
            !native.has(question.prompt.trim()) ||
            judgeSkipAnswer(native.get(question.prompt.trim())!, question.answerKey) !== "correct",
        )
      )
        continue;
      document.lessons[lessonKeyOf(locator)] = {
        progress: 1,
        completedAt: Date.now() - 10_000,
        attempts: 1,
      };
      sourceIds.push(
        `${locator.studyId}/${locator.courseId}/${locator.unitId}/${locator.lessonId}`,
      );
      for (const question of questions)
        answers.set(question.prompt.trim(), native.get(question.prompt.trim())!);
      if (answers.size >= count) break;
    }
    if (answers.size >= count) break;
  }
  expect(answers.size, "real native practice fixture questions").toBeGreaterThanOrEqual(count);
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, (route) =>
    route.fulfill({ status: 503, json: { message: "Isolated offline provider" } }),
  );
  await page.routeWebSocket(/supabase\.co/, (socket) => socket.close());
  await page.route(/https:\/\/[^/]*posthog\.com\//, (route) => route.abort());
  await page.addInitScript((record) => {
    localStorage.setItem("university.progress.v2", JSON.stringify(record));
    localStorage.setItem("university.welcome.v1", "acknowledged");
    Math.random = () => 0;
  }, document);
  return { answers, sourceIds };
}

export async function answerNativePractice(page: Page, answers: ReadonlyMap<string, string>) {
  const prompt = (
    await page.locator("[data-native-practice] .question-step__prompt").innerText()
  ).trim();
  const answer = answers.get(prompt);
  expect(answer, `fixture answer for ${prompt}`).toBeTruthy();
  const input = page.locator("[data-native-practice] textarea");
  if (await input.count()) await input.fill(answer!);
  else {
    const choices = page.locator("[data-native-practice] [role=radio]");
    let selected = false;
    for (const choice of await choices.all()) {
      const label = (await choice.innerText()).trim();
      if (label === answer || (await choice.getAttribute("data-choice-id")) === answer) {
        await choice.click();
        selected = true;
        break;
      }
    }
    expect(selected, "expected native choice exists").toBe(true);
  }
  await page.locator('[data-native-practice] [data-question-action="submit"]').click();
  await expect(page.locator("[data-practice-verdict]")).toHaveAttribute(
    "data-practice-verdict",
    "correct",
  );
}
