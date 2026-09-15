import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// start-servers builds core before Playwright collects this root-level suite.
// The workspace root does not have the app's @pieai dependencies installed.
import { gradeDeterministically, type AnswerKey } from "../packages/core/dist/index.js";
import { ONLINE_ORIGIN as ONLINE } from "./ports.js";
import { humanClick } from "./harness/click";

interface Exercise {
  id: string;
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
const RECOVERY = "apps/local/course-proposals/recovery/ai-literacy";
const index = JSON.parse(readFileSync(join(RECOVERY, "index.json"), "utf8")) as {
  courses: Array<{ courseId: string; file: string }>;
};
const courses = index.courses.map((entry) => ({
  source: (JSON.parse(readFileSync(join(RECOVERY, entry.file), "utf8")) as { course: Course })
    .course,
  delivered: (
    JSON.parse(
      readFileSync(`apps/university/content/ai-literacy/${entry.courseId}.json`, "utf8"),
    ) as { course: Course }
  ).course,
}));

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
        expect(published.activities.length).toBeGreaterThan(0);
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
              locale === "en" ? exercise.locales?.en?.expectedAnswer : exercise.expectedAnswer;
            const key = locale === "en" ? output.locales?.en?.answerKey : output.answerKey;
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
    for (const { source } of courses) {
      test(`W2 ${source.id} ${locale} ${width}: read, inspect source, answer, reload`, async ({
        page,
      }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const unit = source.units[0]!;
        const lesson = unit.lessons[0]!;
        await page.goto(
          `${ONLINE}/ai-literacy/${source.id}/${unit.id}/${lesson.id}?lang=${locale}`,
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
        await expect(reader.locator(".learning-activity").first()).toBeVisible();
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
        const images = reader.locator(".lesson-media--figure img");
        if (lesson.assets.length > 0) expect(await images.count()).toBeGreaterThan(0);
        for (const image of await images.all()) {
          await image.scrollIntoViewIfNeeded();
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
          locale === "en" ? exercise.locales!.en!.expectedAnswer! : exercise.expectedAnswer!;
        const panel = reader.locator(".exercise-panel").first();
        const input = panel.locator("textarea");
        await input.fill(answer);
        await humanClick(
          page,
          panel.locator(".exercise-actions button").first(),
          "submit a real answer",
        );
        await expect(panel).toContainText(locale === "en" ? "Passed" : "通过");
        await page.reload();
        await expect(page.locator(".exercise-panel textarea").first()).toHaveValue(answer);
        await page.locator(".exercise-panel").first().scrollIntoViewIfNeeded();
        expect(errors).toEqual([]);
        await page.screenshot({ path: info.outputPath("answer-restored.png"), fullPage: true });
      });
    }
  }
}

test("W3 real source media stays readable in night mode and the contrast guard rejects a regression", async ({
  page,
}, info) => {
  const course = courses.find(({ source }) => source.id === "understanding-ai")!.source;
  const unit = course.units[0]!;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto(`${ONLINE}/ai-literacy/${course.id}/${unit.id}/${unit.lessons[0]!.id}?lang=en`);
  await expect(page.locator("html")).toHaveAttribute("data-game-ui-theme", "night");
  const media = page.locator(".lesson-media").first();
  await expect(media).toBeVisible();
  await media.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      media
        .locator("img")
        .evaluate(
          (image) =>
            (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
        ),
    )
    .toBe(true);
  const caption = media.locator("figcaption");
  await caption.scrollIntoViewIfNeeded();
  const originalColors = await media.evaluate((element) => ({
    background: getComputedStyle(element.querySelector("figcaption")!).backgroundColor,
    color: getComputedStyle(element.querySelector(".lesson-media__caption")!).color,
  }));
  await expect(media).toContainText("Source image");
  const scan = () =>
    new AxeBuilder({ page }).include(".lesson-media").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect((await scan()).violations).toEqual([]);
  // Reproduce the measured unreadable caption pair in this isolated test page.
  // This is an assertion attack, not a screenshot claimed to be an old release.
  const fault = await page.addStyleTag({
    content:
      ".lesson-media, .lesson-media figcaption { background: #746d64 !important; } .lesson-media figcaption, .lesson-media__caption { color: #786250 !important; }",
  });
  await caption.scrollIntoViewIfNeeded();
  await expect(media.locator(".lesson-media__caption")).toHaveCSS("color", "rgb(120, 98, 80)");
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
  await expect(media.locator(".lesson-media__caption")).toHaveCSS("color", originalColors.color);
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
  await expect(page.locator('button[data-study-id="ai-literacy"]')).toBeVisible();
  await humanClick(page, page.locator(".planet-page__enter"), "open the real curriculum");
  for (const { source } of courses) {
    await expect(
      page.locator(`button.label--course[data-map-marker="${source.id}"]`),
    ).toBeVisible();
  }
  await humanClick(
    page,
    page.locator('button.label--course[data-map-marker="understanding-ai"]'),
    "choose understanding AI",
  );
  await humanClick(
    page,
    page.getByRole("button", { name: "Enter this course", exact: true }),
    "enter understanding AI",
  );
  await expect(page).toHaveURL(/\/ai-literacy\/understanding-ai(?:\?|$)/);
  await page.screenshot({ path: info.outputPath("beginner-course-island.png"), fullPage: true });
});
