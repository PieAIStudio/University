import { expect, test, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { LOCAL_ORIGIN, ONLINE_ORIGIN } from "./ports.js";

interface Lesson {
  id: string;
  contentRevision: number;
  locales?: Record<string, { title?: string; content?: string }>;
  assets: unknown[];
}

interface Course {
  id: string;
  units: Array<{ id: string; lessons: Lesson[] }>;
}

async function expectEnglishReader(reader: Locator): Promise<void> {
  expect(await reader.innerText(), "Untranslated English learner copy").not.toMatch(
    /[\u4e00-\u9fff]/u,
  );
}

// start-servers materializes content before test collection. W covers both
// languages, the first lesson's interaction and persistence, and the planet.
// This complementary sweep checks every lesson's English DOM in both modes.
// Unit-sized tests keep the timeout bounded without sampling away later units.
for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  for (const courseId of ["understanding-ai", "ai-for-real-life"]) {
    const { course } = JSON.parse(
      readFileSync(`apps/university/content/ai-literacy/${courseId}.json`, "utf8"),
    ) as { course: Course };

    for (const unit of course.units) {
      test(`X ${mode} ${courseId}/${unit.id}: every English lesson, source and image is readable`, async ({
        page,
      }, info) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        const pageErrors: string[] = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        const checked: Array<{ lesson: string; revision: number; images: number }> = [];

        for (const lesson of unit.lessons) {
          await test.step(lesson.id, async () => {
            const path = ["ai-literacy", courseId, unit.id, lesson.id]
              .map(encodeURIComponent)
              .join("/");
            await page.goto(`${origin}/${path}?lang=en`);
            const reader = page.locator(".lesson-reader");
            await expect(reader).toBeVisible();
            const title = lesson.locales?.en?.title;
            expect(title, `${lesson.id}: English content is required`).toBeTruthy();
            await expect(reader).toContainText(title!);
            await expect(reader.locator(".learning-activity").first()).toBeVisible();
            await expect(reader.locator(".exercise-panel").first()).toBeVisible();

            // Open native disclosures to inspect ALL rendered teaching/source
            // copy, not only the translated heading. This is a content audit,
            // not evidence of a human operating every disclosure; W tests that.
            await reader.locator("details").evaluateAll((nodes) => {
              for (const node of nodes) node.open = true;
            });
            await expectEnglishReader(reader);
            await expect(reader.locator("p > div")).toHaveCount(0);
            // Source event times and image ratios are facts, not inline
            // directives. A translated title can pass while :30 disappears.
            const authoredNumbers =
              lesson.locales?.en?.content?.match(/\b\d{1,2}:\d{1,2}\b/g) ?? [];
            for (const number of new Set(authoredNumbers)) {
              await expect(reader).toContainText(number);
            }

            const sourceLinks = reader.locator(".lesson-sources__list a");
            expect(await sourceLinks.count()).toBeGreaterThan(0);
            for (const link of await sourceLinks.all()) {
              await expect(link).toHaveAttribute("href", /^https:\/\//);
              await expect(link).toHaveAttribute("rel", /noreferrer/);
            }

            const images = reader.locator("figure img");
            if (lesson.assets.length > 0) expect(await images.count()).toBeGreaterThan(0);
            for (const image of await images.all()) {
              await image.scrollIntoViewIfNeeded();
              await expect(image).toHaveAttribute("alt", /\S/);
              expect(await image.getAttribute("alt")).not.toMatch(/[\u4e00-\u9fff]/u);
              await expect
                .poll(() =>
                  image.evaluate(
                    (element) =>
                      (element as HTMLImageElement).complete &&
                      (element as HTMLImageElement).naturalWidth > 0,
                  ),
                )
                .toBe(true);
            }
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth + 1,
              ),
              `${lesson.id}: the phone document must not overflow horizontally`,
            ).toBe(true);
            expect(pageErrors).toEqual([]);
            checked.push({
              lesson: lesson.id,
              revision: lesson.contentRevision,
              images: await images.count(),
            });
          });
        }

        await info.attach("every-lesson-checked", {
          body: JSON.stringify(checked, null, 2),
          contentType: "application/json",
        });
        await page.screenshot({ path: info.outputPath("last-lesson.png"), fullPage: true });
        expect(checked).toHaveLength(unit.lessons.length);
      });
    }
  }
}

test("X the English guard detects an untranslated passage, then passes after restoration", async ({
  page,
}, info) => {
  const { course } = JSON.parse(
    readFileSync("apps/university/content/ai-literacy/ai-for-real-life.json", "utf8"),
  ) as { course: Course };
  const unit = course.units.at(-1)!;
  const lesson = unit.lessons.at(-1)!;
  await page.goto(`${ONLINE_ORIGIN}/ai-literacy/${course.id}/${unit.id}/${lesson.id}?lang=en`);
  const reader = page.locator(".lesson-reader");
  await expect(reader).toBeVisible();
  await expectEnglishReader(reader);

  // Attack the actual rendered reader in this isolated test page. No lesson
  // package or immutable revision changes; the same guard must now reject it.
  await reader.evaluate((element) => {
    const untranslated = document.createElement("p");
    untranslated.dataset.englishGuardFault = "true";
    untranslated.textContent = "未翻译的课程说明";
    element.append(untranslated);
  });
  let failure = "";
  try {
    await expectEnglishReader(reader);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }
  expect(failure).toContain("Untranslated English learner copy");
  await info.attach("english-guard-attack", { body: failure, contentType: "text/plain" });
  await reader.locator('[data-english-guard-fault="true"]').evaluate((element) => element.remove());
  await expectEnglishReader(reader);
});
