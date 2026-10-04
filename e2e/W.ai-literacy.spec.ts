import { expect, test } from "./harness/learner-test.js";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { E2E_RECOVERY_ROOT } from "./catalogue-paths.mjs";
// start-servers builds core before Playwright collects this root-level suite.
// The workspace root does not have the app's @pieai dependencies installed.
import { gradeDeterministically, type AnswerKey } from "../packages/core/dist/index.js";
import { ONLINE_ORIGIN as ONLINE } from "./ports.js";
import { catalogueStudyOf, coursePathOf, lessonPathOf } from "./harness/catalogue.js";
import { humanClick } from "./harness/click";
import { enterSelectedMapObject } from "./harness/map-actions.js";
import { enterExerciseAnswer, expectExerciseAnswer } from "./harness/exercise-input.js";

import { scrollIntoView } from "./harness/click.js";
interface Exercise {
  id: string;
  kind?: string;
  correctOptionId?: string;
  expectedAnswer?: string;
  answerKey?: AnswerKey;
  locales?: Record<string, { expectedAnswer?: string; answerKey?: AnswerKey }>;
}
interface Lesson {
  id: string;
  title: string;
  contentRevision: number;
  locales?: Record<string, { title?: string; content?: string }>;
  exercises: Exercise[];
  assets: unknown[];
  activities: unknown[];
  evidence: Array<{ sourceUrl?: string; provenance?: { supports: string; limitations: string } }>;
}
interface Course {
  id: string;
  units: Array<{ id: string; lessons: Lesson[] }>;
}

function hasStableAnswer(lesson: Lesson): boolean {
  const exercise = lesson.exercises[0];
  if (!exercise) return false;
  if (exercise.kind === "choice") return Boolean(exercise.correctOptionId);
  return Boolean(exercise.expectedAnswer && exercise.locales?.en?.expectedAnswer);
}
const literacy = catalogueStudyOf("ai-literacy");
const RECOVERY = join(E2E_RECOVERY_ROOT, literacy.id);
const index = JSON.parse(readFileSync(join(RECOVERY, "index.json"), "utf8")) as {
  courses: Array<{ courseId: string; file: string }>;
};
const courses = literacy.courses.map((course) => {
  const entry = index.courses.find((item) => item.courseId === course.id);
  if (!entry) {
    throw new Error(`e2e: missing recovery for ${literacy.id}/${course.id}`);
  }
  return {
    course,
    source: (JSON.parse(readFileSync(join(RECOVERY, entry.file), "utf8")) as { course: Course })
      .course,
    delivered: (course.packageBody as { course: Course }).course,
  };
});

test("W1 both beginner paths preserve every real-source lesson and both answer keys", () => {
  expect(courses.map((item) => item.source.id).sort()).toEqual([
    "ai-for-real-life",
    "understanding-ai",
  ]);
  for (const { source, delivered } of courses) {
    expect(source.units.length).toBeGreaterThanOrEqual(5);
    expect(source.units.flatMap((unit) => unit.lessons).length).toBeGreaterThanOrEqual(30);
    expect(delivered.units.map((unit) => unit.id)).toEqual(source.units.map((unit) => unit.id));
    for (const unit of source.units) {
      const publicUnit = delivered.units.find((item) => item.id === unit.id)!;
      expect(publicUnit.lessons.map((lesson) => lesson.id)).toEqual(
        unit.lessons.map((lesson) => lesson.id),
      );
      for (const lesson of unit.lessons) {
        const published = publicUnit.lessons.find((item) => item.id === lesson.id)!;
        expect(published.contentRevision).toBe(lesson.contentRevision);
        expect(published.locales?.en?.content).toBeTruthy();
        // R3 retires lessons whose only activities were the removed engines.
        // Their lesson prose/evidence/exercises remain published, while the
        // activity list is legitimately empty. Retained activities still have
        // to be one of the V3/native readers.
        const activities = published.activities ?? [];
        expect(
          activities.every((activity) =>
            ["connect", "sort", "tune", "primm"].includes(
              (activity as { kind?: string }).kind ?? "",
            ),
          ),
        ).toBe(true);
        expect(published.evidence.length).toBeGreaterThan(0);
        for (const evidence of published.evidence) {
          expect(evidence.sourceUrl).toMatch(/^https:\/\//);
          expect(evidence.provenance?.supports).toBeTruthy();
          expect(evidence.provenance?.limitations).toBeTruthy();
        }
        for (const exercise of lesson.exercises) {
          const output = published.exercises.find((item) => item.id === exercise.id)!;
          expect(output.expectedAnswer).toBeUndefined();
          expect(output.locales?.en?.expectedAnswer).toBeUndefined();
          for (const locale of ["zh-CN", "en"]) {
            const answer =
              exercise.kind === "choice"
                ? exercise.correctOptionId
                : locale === "en"
                  ? exercise.locales?.en?.expectedAnswer
                  : exercise.expectedAnswer;
            expect(output.correctOptionId).toBeUndefined();
            const key = locale === "en" ? output.locales?.en?.answerKey : output.answerKey;
            if (exercise.kind === "explain") {
              // An `explain` exercise is open by design — the eight of them belong
              // to the eight PRIMM lessons and are graded by the tutor, not by a
              // stored string. So the thing worth guarding is the opposite: it must
              // not ship a key, because a key here would be a published answer.
              expect(answer, `${lesson.id}/${locale}`).toBeFalsy();
              expect(key, `${lesson.id}/${locale}`).toBeFalsy();
              continue;
            }
            expect(answer, `${lesson.id}/${locale}`).toBeTruthy();
            expect(gradeDeterministically(answer!, key).outcome, `${lesson.id}/${locale}`).toBe(
              "pass",
            );
            expect(gradeDeterministically("not the answer: 987654321", key).outcome).not.toBe(
              "pass",
            );
          }
        }
      }
    }
  }
});

for (const locale of ["en", "zh-CN"] as const) {
  for (const width of [390, 1440]) {
    for (const { course, source } of courses) {
      test(`W2 ${source.id} ${locale} ${width}: read, inspect source, answer, reload`, async ({
        page,
      }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        // The classic reader's end-to-end path: read, inspect the source, answer,
        // reload. A PRIMM lesson draws none of that chrome — it has its own step
        // reader, its own ending and its own spec — so this walks the first
        // lesson of the course that the classic reader actually renders.
        const classic = source.units.flatMap((item) =>
          item.lessons
            .filter(
              (entry) =>
                !(entry.activities as { kind: string }[] | undefined)?.some(
                  (activity) => activity.kind === "primm",
                ),
            )
            .map((entry) => ({ unit: item, lesson: entry })),
        );
        const first = classic.find(({ lesson }) => hasStableAnswer(lesson));
        expect(first, `${source.id}: every lesson uses a non-classic reader`).toBeTruthy();
        const unit = first!.unit;
        const lesson = first!.lesson;
        await page.goto(
          `${ONLINE}${lessonPathOf(course, { unitId: unit.id, id: lesson.id })}?lang=${locale}`,
        );
        const reader = page.locator(".lesson-reader");
        await expect(reader).toBeVisible();
        await expect(reader).toContainText(
          locale === "en" ? lesson.locales!.en!.title! : lesson.title,
        );
        await page.screenshot({ path: info.outputPath("lesson-entry.png"), fullPage: true });
        if (locale === "en") {
          // Check rendered content rather than merely the translated source package.
          const labels = await page
            .getByRole("navigation", { name: "Current location" })
            .innerText();
          expect(labels).not.toMatch(/[\u4e00-\u9fff]/);
          for (const text of await reader.locator("figure").allTextContents())
            expect(text).not.toMatch(/[\u4e00-\u9fff]/);
          for (const alt of await reader
            .locator("figure img")
            .evaluateAll((images) => images.map((image) => image.getAttribute("alt") ?? "")))
            expect(alt).not.toMatch(/[\u4e00-\u9fff]/);
          await expect(
            page.getByRole("region", { name: "Next lesson", exact: true }),
          ).not.toContainText(/[\u4e00-\u9fff]/);
        }
        if (lesson.activities?.length) {
          await expect(reader.locator(".learning-activity").first()).toBeVisible();
        }
        const disclosure = reader.locator(".lesson-sources__details summary").first();
        await humanClick(page, disclosure, "source support and limitations");
        await expect(reader.locator(".lesson-sources__provenance").first()).toBeVisible();
        await page.screenshot({ path: info.outputPath("source-details.png"), fullPage: true });
        const sourceLink = reader.locator(".lesson-sources__list a").first();
        await expect(sourceLink).toHaveAttribute("href", /^https:\/\//);
        await expect(sourceLink).toHaveAttribute("rel", /noreferrer/);
        if (locale === "en") expect(await reader.innerText()).not.toMatch(/[\u4e00-\u9fff]/u);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        ).toBe(true);
        const images = reader.locator(
          ".lesson-media--figure img, .primm-steps__point img, figure img",
        );
        if (lesson.assets.length > 0) expect(await images.count()).toBeGreaterThan(0);
        for (const image of await images.all()) {
          await scrollIntoView(image);
          await expect(image).toHaveAttribute("alt", /\S/);
          await expect
            .poll(() =>
              image.evaluate(
                (node) =>
                  (node as HTMLImageElement).complete &&
                  (node as HTMLImageElement).naturalWidth > 0,
              ),
            )
            .toBe(true);
        }
        if (locale === "en" && width === 390 && lesson.assets.length > 0) {
          const scan = await new AxeBuilder({ page })
            .include(".lesson-reader")
            .withTags(["wcag2a", "wcag2aa"])
            .analyze();
          await info.attach("learner-accessibility", {
            body: JSON.stringify(scan.violations, null, 2),
            contentType: "application/json",
          });
          expect(scan.violations).toEqual([]);
        }
        await page.screenshot({ path: info.outputPath("lesson-sources.png"), fullPage: true });
        const exercise = lesson.exercises[0]!;
        const answer =
          exercise.kind === "choice"
            ? exercise.correctOptionId!
            : locale === "en"
              ? exercise.locales!.en!.expectedAnswer!
              : exercise.expectedAnswer!;
        const panel = reader.locator(".exercise-panel").first();
        await enterExerciseAnswer(page, panel, answer);
        await humanClick(
          page,
          panel.locator(".exercise-actions button").first(),
          "submit a real answer",
        );
        await expect(panel).toContainText(locale === "en" ? "Passed" : "通过");
        await page.reload();
        await expectExerciseAnswer(page.locator(".exercise-panel").first(), answer);
        await scrollIntoView(page.locator(".exercise-panel").first());
        expect(errors).toEqual([]);
        await page.screenshot({ path: info.outputPath("answer-restored.png"), fullPage: true });
      });
    }
  }
}

test("W3 real source media stays readable in night mode and the contrast guard rejects a regression", async ({
  page,
}, info) => {
  const target = literacy.courses
    .flatMap((course) =>
      course.units.flatMap((unit) => unit.lessons.map((lesson) => ({ course, lesson }))),
    )
    .find(
      ({ lesson }) =>
        !lesson.packageLesson.activities?.some((activity) => activity.kind === "primm") &&
        lesson.packageLesson.assets.length > 0 &&
        lesson.packageLesson.content.includes(":::figure") &&
        lesson.packageLesson.content.includes("NASA"),
    );
  expect(target, "没有带真实图片素材的普通课").toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto(`${ONLINE}${lessonPathOf(target!.course, target!.lesson)}?lang=en`);
  await expect(page.locator("html")).toHaveAttribute("data-game-ui-theme", "night");
  await expect(page.locator(".lesson-reader")).toBeVisible();
  const media = page.locator(".lesson-media").first();
  await expect(media).toBeVisible();
  const image = media.locator("img").first();
  await scrollIntoView(image);
  await expect
    .poll(() =>
      image.evaluate(
        (node) =>
          (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0,
      ),
    )
    .toBe(true);
  const caption = media.locator("figcaption");
  await expect(caption).toBeVisible();
  await scrollIntoView(caption);
  await expect(media).toContainText("NASA");
  const originalColors = await caption.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }));
  const scan = () =>
    new AxeBuilder({ page }).include(".lesson-media").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect((await scan()).violations).toEqual([]);
  const fault = await page.addStyleTag({
    content:
      ".lesson-media figcaption { background: #746d64 !important; color: #786250 !important; }",
  });
  await expect(caption).toHaveCSS("color", "rgb(120, 98, 80)");
  await expect(caption).toHaveCSS("background-color", "rgb(116, 109, 100)");
  const attacked = await scan();
  await info.attach("contrast-guard-attack", {
    body: JSON.stringify(
      { violations: attacked.violations, incomplete: attacked.incomplete },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(attacked.violations.some((item) => item.id === "color-contrast")).toBe(true);
  await fault.evaluate((element) => element.remove());
  await expect(caption).toHaveCSS("background-color", originalColors.background);
  await expect(caption).toHaveCSS("color", originalColors.color);
  expect((await scan()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("source-media-night.png"), fullPage: true });
});

test("W4 the AI foundations planet opens the real beginner courses", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${ONLINE}/planet?lang=en`);
  await humanClick(
    page,
    page.locator('button[data-domain-id="ai-foundations"]'),
    "choose AI foundations",
  );
  await expect(page.locator('button[data-map-entry="true"]')).toHaveAccessibleName(/^Enter /);
  await expect(page.locator(`button[data-study-id="${literacy.id}"]`)).toHaveCount(0);
  await enterSelectedMapObject(page, "open the real curriculum");
  for (const { source } of courses) {
    await expect(
      page.locator(`button.label--course[data-map-marker="${source.id}"]`),
    ).toBeVisible();
  }
  const intro = literacy.courses[0]!;
  await humanClick(
    page,
    page.locator(`button.label--course[data-map-marker="${intro.id}"]`),
    "choose understanding AI",
  );
  await enterSelectedMapObject(page, "enter understanding AI");
  await expect(page).toHaveURL(new RegExp(`${coursePathOf(intro)}(?:\\?|$)`));
  await page.screenshot({ path: info.outputPath("beginner-course-island.png"), fullPage: true });
});
