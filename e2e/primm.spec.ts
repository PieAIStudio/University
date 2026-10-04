import { expect, test, type Page } from "./harness/learner-test.js";
import AxeBuilder from "@axe-core/playwright";
import {
  joinPrimmPieces,
  localizeActivity,
  primmRequestPrompt,
  type PrimmActivity,
  type PrimmStepsActivity,
} from "../packages/core/dist/index.js";
import { messages as zh } from "../packages/ui/src/i18n/catalogs/primm.zh-CN.js";
import { messages as en } from "../packages/ui/src/i18n/catalogs/primm.en.js";
import { SHIPPED_COURSES, lessonPathOf } from "./harness/catalogue.js";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";
import { humanClick, scrollIntoView } from "./harness/click.js";
import { enterSelectedMapObject } from "./harness/map-actions.js";

const samples = SHIPPED_COURSES.flatMap((course) =>
  course.units.flatMap((unit) =>
    unit.lessons.flatMap((lesson) => {
      const activity = (lesson.packageLesson.activities as PrimmActivity[] | undefined)?.find(
        (a) => a.kind === "primm",
      );
      return activity ? [{ course, lesson, activity }] : [];
    }),
  ),
);
// Current PRIMM lessons show one action per screen.
const stepLessons = samples.flatMap((sample) =>
  sample.activity.experienceVersion === 3
    ? [{ ...sample, activity: sample.activity as PrimmStepsActivity }]
    : [],
);

test("PRIMM revisions use real materials and after-action teaching", () => {
  expect(stepLessons.length).toBeGreaterThan(0);
  for (const { lesson, activity } of stepLessons) {
    expect(activity.method).toBe("PRIMM");
    expect(activity.experienceVersion).toBe(3);
    expect(activity.steps.length).toBeGreaterThanOrEqual(8);
    expect(activity.intro.situation).toBeTruthy();
    expect(activity.intro.need).toBeTruthy();
    expect(lesson.packageLesson.exercises as { id: string; kind: string }[]).toMatchObject([
      { id: activity.make.exerciseId, kind: "explain" },
    ]);
  }
});

test("PRIMM investigations keep more than one authored action", () => {
  const kinds = new Set(
    stepLessons.flatMap((s) =>
      s.activity.steps.flatMap((step) => (step.phase === "investigate" ? [step.kind] : [])),
    ),
  );
  expect(kinds.size).toBeGreaterThanOrEqual(3);
});

async function latePhotoShift(page: Page, removeReservation = false) {
  // Prefer a real shipped photo lesson. Its absence is not permission to skip
  // an existing renderer guard: retain the shared fixture in an isolated page.
  const sample = removeReservation
    ? undefined
    : stepLessons.find(({ activity }) => activity.starter.operation === "vision");
  const assetUrl = sample
    ? (sample.lesson.packageLesson.assets as { id: string; url: string }[]).find(
        (item) => item.id === sample.activity.starter.assetIds[0],
      )!.url
    : "/e2e-fixtures/primm-layout-image.svg";
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**${assetUrl}`, async (route) => {
    await held;
    if (sample) await route.continue();
    else
      await route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="600"><rect width="240" height="600" fill="gray"/></svg>',
      });
  });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      `${ONLINE_ORIGIN}${sample ? lessonPathOf(sample.course, sample.lesson) : "/e2e-fixtures/primm-photo-layout.html"}?lang=en`,
      { waitUntil: "domcontentloaded" },
    );
    if (!sample) await expect(page.locator("[data-synthetic-photo-layout]")).toBeVisible();
    if (removeReservation)
      await page.addStyleTag({
        content:
          ".primm-steps__thumb { aspect-ratio: auto !important; } .primm-steps__thumb img { block-size: auto !important; }",
      });
    await humanClick(
      page,
      page.getByRole("button", { name: en["primm.steps.start"], exact: true }),
      "start before the photo arrives",
    );
    const target = page.locator(".primm-steps__option").last();
    await expect(target).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await scrollIntoView(target);
    const before = (await target.boundingBox())!;
    const step = page.locator(".primm-steps__step");
    const stepBefore = (await step.boundingBox())!;
    release();
    await expect
      .poll(() =>
        page
          .locator(".primm-steps__thumb img")
          .evaluate(
            (node) =>
              (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0,
          ),
      )
      .toBe(true);
    const after = (await target.boundingBox())!;
    const stepAfter = (await step.boundingBox())!;
    await humanClick(page, target, "choose without a late photo moving the question");
    await expect(target).toHaveAttribute("aria-checked", "true");
    return {
      viewport: Math.abs(after.y - before.y),
      // Browser scroll anchoring cannot disguise a real layout shift.
      withinStep: Math.abs(after.y - stepAfter.y - (before.y - stepBefore.y)),
    };
  } finally {
    release();
  }
}

test("a late photo never pushes a beginner's prediction away from the pointer", async ({
  page,
}) => {
  const shift = await latePhotoShift(page);
  expect(shift.viewport).toBeLessThanOrEqual(1);
  expect(shift.withinStep).toBeLessThanOrEqual(1);
});

test("the late-photo guard detects removal of the reserved image frame", async ({ page }) => {
  const shift = await latePhotoShift(page, true);
  expect(shift.withinStep).toBeGreaterThan(1);
});

for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const)
  for (const locale of ["zh-CN", "en"] as const)
    for (const { course, lesson, activity: raw } of stepLessons) {
      test(`PRIMM steps ${mode} ${locale} ${lesson.id}: one action per screen, teacher after it, one ending`, async ({
        page,
      }, info) => {
        const a = localizeActivity(raw, locale) as PrimmStepsActivity,
          dict = locale === "en" ? en : zh;
        await page.setViewportSize({ width: 390, height: 844 });
        await page.emulateMedia({
          reducedMotion: "reduce",
          colorScheme: locale === "en" ? "light" : "dark",
        });
        // Demonstrations are covered by their own interaction; here they would cover the controls.
        await page.addInitScript(() =>
          localStorage.setItem(
            "university.primm.coach",
            JSON.stringify(["send", "match", "sort", "build"]),
          ),
        );
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        const runs: { phase: string; prompt: string }[] = [];
        let grades = 0;
        // Explicit contract-test responses, not evidence of live AI use. Each
        // answer repeats its request and names what the lesson's find steps look
        // for, so a find step has a sentence to tap.
        const sought = a.steps.flatMap((step) => (step.kind === "find" ? step.terms : []));
        await page.route("http://127.0.0.1:23151/**", async (route) => {
          const request = route.request(),
            headers = {
              "Access-Control-Allow-Origin": origin,
              "Access-Control-Allow-Headers": "content-type,x-university-primm",
              "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            };
          if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
          const body = request.postDataJSON();
          if (request.url().endsWith("/run")) {
            runs.push(body);
            return route.fulfill({
              status: 200,
              headers,
              json: {
                kind: "live",
                text: [
                  locale === "en" ? "Contract answer." : "契约测试回答。",
                  body.prompt,
                  ...sought,
                ]
                  .filter(Boolean)
                  .join("\n"),
                prompt: body.prompt,
                requestId: crypto.randomUUID(),
                model: "explicit-browser-test-fixture",
                createdAt: new Date().toISOString(),
                sourceIds: [],
              },
            });
          }
          if (request.url().endsWith("/grade")) {
            grades++;
            const work = JSON.parse(body.answer);
            expect(work.request.phase).toBe("make");
            const passed = work.finalWork === "Revised independent work";
            return route.fulfill({
              status: 200,
              headers,
              json: {
                correct: false,
                attemptCount: grades,
                score: passed ? 1 : 0,
                maxScore: 1,
                awaitingHostGrade: false,
                hostGrade: {
                  outcome: passed ? "pass" : "fail",
                  passed,
                  evaluation: "Explicit test feedback",
                  extensions: [],
                  host: "browser-contract-test",
                  learnerAnswer: body.answer,
                  occurredAt: new Date().toISOString(),
                },
              },
            });
          }
          return route.fulfill({
            status: 404,
            headers,
            json: { kind: "error", code: "unavailable" },
          });
        });
        const lessonPath = lessonPathOf(course, lesson);
        if (locale === "zh-CN" && lesson.id === stepLessons[0]!.lesson.id) {
          // The first step lesson also covers the real map entry in both modes.
          await page.goto(`${origin}${lessonPath.split("/").slice(0, 3).join("/")}?lang=${locale}`);
          await humanClick(
            page,
            page.locator(`button.label--lesson[data-map-marker=${JSON.stringify(lesson.id)}]`),
            "choose the lesson on the course map",
          );
          await enterSelectedMapObject(page, "enter the lesson from the map");
          await expect(page).toHaveURL(new RegExp(lessonPath));
        } else await page.goto(`${origin}${lessonPath}?lang=${locale}`);
        const area = page.locator(".primm-steps");
        const button = (name: string) => area.getByRole("button", { name, exact: true });
        const bar = area.locator(".primm-steps__bottom");
        const next = () =>
          humanClick(page, bar.getByRole("button"), "continue after the teacher's line");
        const heading = area.locator("h2");
        await expect(area).toContainText(a.goal!);
        await humanClick(page, button(dict["primm.steps.start"]), "start the lesson");
        const chosen: Record<string, string> = {};
        const requestText = (id: string) =>
          id === "chosen"
            ? primmRequestPrompt(a, chosen.request ?? "starter")!
            : id === "built"
              ? chosen.built!
              : primmRequestPrompt(a, id)!;
        for (const [index, step] of a.steps.entries()) {
          await expect(heading).toHaveText(step.title);
          await expect(area).toHaveAttribute("data-primm-stage", step.phase);
          const lineAfter = "after" in step && step.after ? step.after : undefined;
          if (lineAfter) await expect(bar).not.toContainText(lineAfter);
          switch (step.kind) {
            case "choose": {
              const option = step.answerId
                ? step.options.find((o) => o.id === step.answerId)!
                : (step.options[1] ?? step.options[0]!);
              if (option.requestId) chosen.request = option.requestId;
              // Choose with the keyboard: focus the option, press Enter.
              await area.getByRole("radio", { name: option.label, exact: true }).focus();
              await page.keyboard.press("Enter");
              await expect(
                area.getByRole("radio", { name: option.label, exact: true }),
              ).toHaveAttribute("aria-checked", "true");
              await humanClick(page, bar.getByRole("button"), "commit the choice");
              break;
            }
            case "send": {
              const prompt = requestText(step.request);
              const attach = area.locator(".primm-steps__attach");
              const composer = area.locator(".primm-steps__composer");
              if (!a.starter.assetIds.length) {
                // A text material is already in the chat, named in the photo's place.
                await expect(composer.locator(".primm-steps__file")).toHaveText(
                  step.attachmentLabel!,
                );
              } else if (step.phase === "run") {
                // A real pointer drag into the chat.
                const from = (await attach.boundingBox())!;
                const to = (await composer.boundingBox())!;
                await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
                await page.mouse.down();
                await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
                await page.mouse.up();
              } else {
                await attach.focus();
                await page.keyboard.press("Enter");
              }
              await expect(composer).toHaveClass(/is-filled/);
              await humanClick(page, button(dict["primm.steps.send"]), "send the prepared request");
              await expect(area.locator(".primm-steps__bubble.is-ai")).toBeVisible();
              expect(runs.at(-1)).toMatchObject({ phase: step.phase, prompt });
              break;
            }
            case "find": {
              const term = step.terms[0]!;
              await humanClick(
                page,
                area.locator(".primm-steps__sentence", { hasText: term }).first(),
                "tap the sentence with the term",
              );
              await expect(bar).toContainText(step.found);
              break;
            }
            case "match": {
              await expect(area.locator(".primm-steps__answer")).toHaveCount(
                step.requestIds.length,
              );
              for (const id of step.requestIds) {
                await humanClick(
                  page,
                  area.locator(`.primm-steps__answer[data-answer="${id}"]`),
                  "pick an answer",
                );
                await humanClick(
                  page,
                  area.locator(`.primm-steps__zone[data-question="${id}"]`),
                  "place it under its question",
                );
              }
              await expect(bar).toContainText(step.after);
              break;
            }
            case "sort": {
              for (const [n, card] of step.cards.entries()) {
                const bucket = step.buckets.find((b) => b.id === card.bucketId)!;
                if (n === 0 && step.buckets.length === 2) {
                  // The first card is sorted with the arrow keys alone.
                  await area.locator(".primm-steps__buckets button").first().focus();
                  await page.keyboard.press(
                    bucket.id === step.buckets[0]!.id ? "ArrowRight" : "ArrowLeft",
                  );
                } else
                  // By the bucket, not its label: one label can contain another.
                  await humanClick(
                    page,
                    area.locator(`.primm-steps__buckets button[data-bucket="${bucket.id}"]`),
                    "sort the card",
                  );
              }
              await expect(bar).toContainText(step.after);
              break;
            }
            case "point": {
              const miss = step.regions.find((r) => r.id !== step.targetId);
              if (miss) {
                await humanClick(
                  page,
                  area.getByRole("button", { name: miss.label, exact: true }),
                  "a wrong place first",
                );
                await expect(area.locator(".primm-steps__toast")).toHaveText(step.miss);
              }
              await humanClick(
                page,
                area.getByRole("button", {
                  name: step.regions.find((r) => r.id === step.targetId)!.label,
                  exact: true,
                }),
                "the place that settles it",
              );
              await expect(bar).toContainText(step.after);
              break;
            }
            case "build": {
              const answer = step.answers[0]!;
              for (const id of answer)
                await humanClick(
                  page,
                  area.locator(".primm-steps__tiles button", {
                    hasText: step.pieces.find((p) => p.id === id)!.text,
                  }),
                  "place a piece",
                );
              chosen.built = joinPrimmPieces(
                answer.map((id) => step.pieces.find((p) => p.id === id)!.text),
              );
              await humanClick(page, bar.getByRole("button"), "check the built request");
              await expect(bar).toContainText(step.after);
              // A real reload resumes on this step, with its work kept.
              await page.reload();
              await expect(heading).toHaveText(step.title);
              await expect(area.locator(".primm-steps__line button")).toHaveCount(answer.length);
              break;
            }
            case "make": {
              await expect(bar.getByRole("button")).toBeDisabled();
              await area.locator("textarea").first().fill("My independent request");
              await humanClick(page, button(dict["primm.steps.send"]), "run my own request");
              await expect(area.locator("[data-final-work]")).toBeVisible();
              expect(runs.at(-1)).toMatchObject({
                phase: "make",
                prompt: "My independent request",
              });
              await humanClick(page, button(dict["primm.evaluate"]), "ask for a verdict");
              await expect(area).toContainText(dict["primm.fail"]);
              await area.locator("[data-final-work]").fill("Revised independent work");
              // A visible verdict is not the same as the evaluator being
              // ready again. The real pointer helper does not wait for native
              // disabled state; never dispatch this press while it is inert.
              await expect(button(dict["primm.evaluate"])).toBeEnabled();
              await expect(area.locator("[data-final-work]")).toHaveValue(
                "Revised independent work",
              );
              await humanClick(
                page,
                button(dict["primm.evaluate"]),
                "ask again after repairing it",
              );
              await expect.poll(() => grades).toBe(2);
              await expect(bar).toContainText(dict["primm.pass"]);
              break;
            }
          }
          if (lineAfter && step.kind === "send") await expect(bar).toContainText(lineAfter);
          await page.screenshot({ path: info.outputPath(`${index + 1}-${step.id}.png`) });
          await expect(bar.getByRole("button")).toBeEnabled();
          await next();
          if (index === a.steps.length - 1) await expect(heading).toHaveText(a.finish.title);
        }
        await expect(area).toContainText("Revised independent work");
        await page.screenshot({ path: info.outputPath("finish.png"), fullPage: true });
        const axe = await new AxeBuilder({ page }).include(".primm-steps").analyze();
        expect(axe.violations).toEqual([]);
        await humanClick(page, button(dict["primm.complete"]), "complete the lesson");
        await expect(page).toHaveURL(new RegExp(`/${course.studyId}/${course.id}(?:\\?|$)`));
        expect(grades).toBe(2);
        expect(errors).toEqual([]);
      });
    }
