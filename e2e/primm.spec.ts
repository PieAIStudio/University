import { expect, test } from "@playwright/test";
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
import { humanClick } from "./harness/click.js";
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
// Version 3 lessons are one action per screen; earlier ones keep a screen per phase.
const classic = samples.flatMap((sample) =>
  sample.activity.experienceVersion === 3
    ? []
    : [
        {
          ...sample,
          activity: sample.activity as Exclude<PrimmActivity, { experienceVersion: 3 }>,
        },
      ],
);
const stepLessons = samples.flatMap((sample) =>
  sample.activity.experienceVersion === 3
    ? [{ ...sample, activity: sample.activity as PrimmStepsActivity }]
    : [],
);

test("PRIMM revisions use real materials and after-action teaching", () => {
  // The first unit is the Owner-reviewed pilot; later units hold lessons the
  // production line generated from outline entries nobody hand-tuned.
  const pilot = samples.filter((s) =>
    lessonPathOf(s.course, s.lesson).includes("/first-useful-step/"),
  );
  expect(pilot).toHaveLength(5);
  expect(samples.length).toBeGreaterThan(pilot.length);
  expect(stepLessons.length).toBeGreaterThan(0);
  for (const { lesson, activity } of classic) {
    // The teacher reconciles prediction and result only after an actual run.
    expect(activity.run.debrief, lesson.id).toBeTruthy();
    expect(activity.modify.debrief, lesson.id).toBeTruthy();
    expect(activity.method).toBe("PRIMM");
    expect(activity.experienceVersion).toBe(2);
    expect(activity.run.attachmentLabel).toBeTruthy();
    expect(activity.modify.workbench?.pieces.length).toBeGreaterThanOrEqual(2);
    expect(activity.make.artifactLabel).toBeTruthy();
    expect(activity.intro.situation).toBeTruthy();
    expect(activity.intro.need).toBeTruthy();
    for (const locale of ["zh-CN", "en"]) {
      const game = localizeActivity(activity, locale).investigate.game;
      if (game.kind !== "sort") continue;
      for (const first of game.cards)
        for (const second of game.cards) {
          if (first.id !== second.id && first.text.trim() === second.text.trim())
            expect(
              first.bucketId,
              "Identical visible cards cannot require different categories",
            ).toBe(second.bucketId);
        }
    }
    expect(lesson.packageLesson.exercises as { id: string; kind: string }[]).toMatchObject([
      { id: activity.make.exerciseId, kind: "explain" },
    ]);
  }
});

// The line converged on two investigations (sort, check-result) and none traced
// which words of a request produced which part of the result; the step lesson's
// match does. Counted across both versions, as a learner meets them in one course.
test("PRIMM investigations are not all one or two operations", () => {
  const kinds = new Set([
    ...classic.map((s) => s.activity.investigate.game.kind),
    ...stepLessons.flatMap((s) =>
      s.activity.steps.flatMap((step) => (step.phase === "investigate" ? [step.kind] : [])),
    ),
  ]);
  expect(kinds.size).toBeGreaterThanOrEqual(3);
});

test("a late photo never pushes a beginner's prediction away from the pointer", async ({
  page,
}) => {
  const sample = stepLessons.find(({ activity }) => activity.starter.operation === "vision")!;
  const assets = sample.lesson.packageLesson.assets as { id: string; url: string }[];
  const asset = assets.find((item) => item.id === sample.activity.starter.assetIds[0])!;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**${asset.url}`, async (route) => {
    await held;
    await route.continue();
  });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${ONLINE_ORIGIN}${lessonPathOf(sample.course, sample.lesson)}?lang=en`, {
      waitUntil: "domcontentloaded",
    });
    await humanClick(
      page,
      page.getByRole("button", { name: en["primm.steps.start"], exact: true }),
      "start before the photo arrives",
    );
    const target = page.locator(".primm-steps__option").last();
    await expect(target).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await target.scrollIntoViewIfNeeded();
    const before = (await target.boundingBox())!;
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
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
    await humanClick(page, target, "choose without a late photo moving the question");
    await expect(target).toHaveAttribute("aria-checked", "true");
  } finally {
    release();
  }
});

for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const)
  for (const locale of ["zh-CN", "en"] as const)
    for (const { course, lesson, activity: raw } of classic) {
      test(`PRIMM ${mode} ${locale} ${lesson.id}: linear phases, actual input seam, game, repair and one ending`, async ({
        page,
      }, info) => {
        const a = localizeActivity(raw, locale),
          dict = locale === "en" ? en : zh;
        const text = (key: keyof typeof zh, label = "") => dict[key].replace("{{label}}", label);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.emulateMedia({
          reducedMotion: "reduce",
          colorScheme: locale === "en" ? "light" : "dark",
        });
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        const runs: { phase: string; prompt: string; commandId: string }[] = [];
        let grades = 0;
        // These are explicit contract-test responses, not evidence of live AI use.
        // Real model/source/audio runs are captured separately in primm-five/live-*.
        await page.route("http://127.0.0.1:23151/**", async (route) => {
          const request = route.request(),
            headers = {
              "Access-Control-Allow-Origin": origin,
              "Access-Control-Allow-Headers": "content-type,x-university-primm",
              "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            };
          if (request.method() === "OPTIONS") {
            await route.fulfill({ status: 204, headers });
            return;
          }
          const body = request.postDataJSON();
          if (request.url().endsWith("/run")) {
            runs.push(body);
            await route.fulfill({
              status: 200,
              headers,
              json: {
                kind: "live",
                text: `Contract test output for ${body.phase}: ${body.prompt}`,
                prompt: body.prompt,
                requestId: crypto.randomUUID(),
                model: "explicit-browser-test-fixture",
                createdAt: new Date().toISOString(),
                sourceIds: a.sources.map((s) => s.id),
              },
            });
            return;
          }
          if (request.url().endsWith("/grade")) {
            grades++;
            const work = JSON.parse(body.answer);
            expect(work.request.phase).toBe("make");
            expect(work.request.prompt).toBe("My independent request");
            const passed = work.finalWork === "Revised independent work";
            await route.fulfill({
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
            return;
          }
          await route.fulfill({
            status: 404,
            headers,
            json: { kind: "error", code: "unavailable" },
          });
        });
        await page.goto(`${origin}${lessonPathOf(course, lesson)}?lang=${locale}`);
        const area = page.locator(".primm");
        const click = async (key: keyof typeof zh) =>
          humanClick(page, area.getByRole("button", { name: text(key), exact: true }), key);
        const stage = async (name: string) => {
          await expect(area).toHaveAttribute("data-primm-stage", name);
          await expect(
            page.locator(
              ".exercise-panel,.lesson-skip-to-questions,.interaction-path__receipt,.interaction-path__review,.lesson-completion,.lesson-next-step",
            ),
          ).toHaveCount(0);
          await expect(page.locator(".learning-save-state")).toHaveCount(0);
          // A tall text-bearing diagram must stay inside its reserved frame,
          // not paint through the request editor or its attribution below.
          const containment = await area.locator(".primm__image-frame").evaluateAll((frames) =>
            frames.map((frame) => {
              const box = frame.getBoundingClientRect();
              const image = frame.querySelector("img")!.getBoundingClientRect();
              const caption = frame
                .parentElement!.querySelector("figcaption")
                ?.getBoundingClientRect();
              return (
                image.bottom <= box.bottom + 1 &&
                image.top >= box.top - 1 &&
                (!caption || caption.top >= box.bottom - 1)
              );
            }),
          );
          expect(containment.every(Boolean)).toBe(true);
        };
        await stage("predict");
        if (a.starter.operation === "transcribe") {
          const audio = area.locator("audio");
          await expect(audio).toBeVisible();
          await expect
            .poll(() =>
              audio.evaluate(
                (node) =>
                  Number.isFinite(node.duration) && node.duration > 0 && node.readyState >= 2,
              ),
            )
            .toBe(true);
        }
        await expect(area).toContainText(a.intro.situation);
        await expect(area).toContainText(a.starter.prompt);
        await humanClick(
          page,
          area.getByRole("button", { name: a.predict.options.at(-1)!.label, exact: true }),
          "any prediction may proceed",
        );
        await click("primm.next");
        await stage("run");
        expect(runs).toHaveLength(0);
        await expect(
          area.getByRole("button", { name: text("primm.sendPrepared"), exact: true }),
        ).toBeDisabled();
        await humanClick(
          page,
          area.getByRole("button", { name: a.run.attachmentLabel!, exact: true }),
          "attach the exact prepared input",
        );
        await expect(area.locator('[data-primm-operation="attach-and-send"]')).toBeVisible();
        await click("primm.sendPrepared");
        await expect(
          area.getByRole("button", { name: text("primm.retry"), exact: true }),
        ).toBeEnabled();
        expect(runs[0]?.prompt).toBe(a.starter.prompt);
        await expect(area.locator(".primm__debrief")).toHaveText(a.run.debrief!);
        await click("primm.next");
        await stage("investigate");
        // The explanation names what the learner found, so it waits for the operation.
        await expect(area).not.toContainText(a.investigate.explanation);
        const g = a.investigate.game,
          game = area.locator("[data-primm-game]");
        await expect(game).toHaveAttribute("data-primm-game", g.kind);
        if (g.kind === "inspect-image") {
          await expect(game.locator(".primm-inspect__hotspot").first()).toBeEnabled();
          // A large whole-image target must not steal the real pointer from
          // either object. Keyboard-only activation would miss this regression.
          for (let index = 0; index < 2; index++) {
            const target = game.locator(".primm-inspect__hotspot").nth(index);
            await humanClick(page, target, "inspect the actual photo object");
            await expect(target).toHaveAttribute("aria-pressed", "true");
          }
          await game.locator(".primm-inspect__hotspot").first().focus();
          await page.keyboard.press("Enter");
          await expect(game.locator(".primm-inspect__zoom")).toBeVisible();
          const ratio = await game.locator(".primm-inspect__zoom img").evaluate((node) => {
            const image = node as HTMLImageElement,
              box = image.getBoundingClientRect();
            return {
              rendered: box.width / box.height,
              original: image.naturalWidth / image.naturalHeight,
            };
          });
          expect(ratio.rendered).toBeCloseTo(ratio.original, 2);
          await game.locator("textarea").fill("A detail worth asking about");
        } else if (g.kind === "sort") {
          for (const [index, card] of g.cards.entries()) {
            const pick = game.getByRole("button", { name: card.text, exact: true }),
              bucket = game.getByRole("button", {
                name: g.buckets.find((b) => b.id === card.bucketId)!.label,
                exact: true,
              });
            // The last card is placed with the keyboard alone.
            if (index === g.cards.length - 1) {
              await pick.focus();
              await page.keyboard.press("Enter");
              await bucket.focus();
              await page.keyboard.press("Space");
            } else {
              await humanClick(page, pick, "select card");
              await humanClick(page, bucket, "place card");
            }
          }
        } else if (g.kind === "layout") {
          await humanClick(
            page,
            game.getByRole("button", {
              name: text("primm.moveDown", g.items[0]!.label),
              exact: true,
            }),
            "reorder source fact",
          );
          await humanClick(
            page,
            game.getByRole("button", { name: g.formats.at(-1)!.label, exact: true }),
            "change layout",
          );
          await expect(
            game.getByRole("region", { name: text("primm.preview"), exact: true }).locator("li"),
          ).toHaveCount(g.items.length);
        } else if (g.kind === "edit") {
          await humanClick(
            page,
            game.getByRole("button", {
              name: g.sentences.find((s) => s.id === g.targetId)!.text,
              exact: true,
            }),
            "select actual draft sentence",
          );
          await game.locator("textarea").fill("Revised sentence");
          await expect(game.locator(".primm__comparison")).toContainText("Revised sentence");
          await expect(game.locator(".primm__changed-sentence")).toHaveCount(2);
        } else if (g.kind === "check-result") {
          for (const [index, item] of g.items.entries()) {
            const choice = text(index === 0 ? "primm.check.missing" : "primm.check.kept"),
              judge = game.getByRole("button", {
                name: `${item.label}${locale === "en" ? ": " : "："}${choice}`,
                exact: true,
              });
            // The last item is judged with the keyboard alone.
            if (index === g.items.length - 1) {
              await judge.focus();
              await page.keyboard.press("Enter");
            } else await humanClick(page, judge, "judge the actual result against the material");
            await expect(
              game.locator(`[data-check-item="${item.id}"] [role="status"]`),
            ).toContainText(item.expected);
          }
        } else {
          for (const card of g.cards)
            await humanClick(
              page,
              game.getByRole("button", {
                name: text(card.relevant ? "primm.collect" : "primm.reject", card.label),
                exact: true,
              }),
              "collect only matching record",
            );
          await expect(
            game.getByRole("region", { name: text("primm.notes"), exact: true }).locator("li"),
          ).toHaveCount(g.cards.filter((c) => c.relevant).length);
        }
        await expect(area.locator(".primm__debrief")).toContainText(a.investigate.explanation);
        await page.screenshot({ path: info.outputPath("investigation.png") });
        await click("primm.next");
        await stage("modify");
        await expect(area.locator('[data-primm-operation="build-request"]')).toBeVisible();
        await expect(area.locator("textarea")).toHaveValue(a.starter.prompt);
        const piece = a.modify.workbench!.pieces[0]!;
        await humanClick(
          page,
          area.getByRole("button", { name: text("primm.addPiece", piece.label), exact: true }),
          "add a requirement to the actual request",
        );
        await humanClick(
          page,
          area.getByRole("button", { name: text("primm.moveUp", piece.label), exact: true }),
          "reorder a requirement",
        );
        await humanClick(
          page,
          area.getByRole("button", { name: text("primm.removePiece", piece.label), exact: true }),
          "remove a requirement rather than choosing a whole answer",
        );
        await area.locator("textarea").fill("My changed request");
        // Real browser reload must recover this work without entering Make early.
        await page.reload();
        await stage("modify");
        await expect(area.locator("textarea")).toHaveValue("My changed request");
        await click("primm.runChanged");
        await expect(
          area.getByRole("button", { name: text("primm.retry"), exact: true }),
        ).toBeEnabled();
        expect(runs.at(-1)?.prompt).toBe("My changed request");
        await expect(area.locator(".primm__debrief")).toHaveText(a.modify.debrief!);
        await click("primm.next");
        await stage("make");
        await expect(area.locator("textarea")).toHaveValue("");
        await area.locator("textarea").fill("My independent request");
        await click("primm.makeDraft");
        await expect(area.locator("[data-final-work]")).toBeVisible();
        await expect(area.locator('[data-primm-operation="make-artifact"]')).toBeVisible();
        await click("primm.evaluate");
        await expect(area).toContainText(text("primm.fail"));
        await expect(
          area.getByRole("button", { name: text("primm.finish"), exact: true }),
        ).toHaveCount(0);
        await area.locator("[data-final-work]").fill("Revised independent work");
        await click("primm.evaluate");
        await expect(area).toContainText(text("primm.pass"));
        await click("primm.finish");
        await stage("finish");
        const progress = page.getByRole("progressbar");
        await expect(progress).toHaveAttribute(
          "aria-valuenow",
          (await progress.getAttribute("aria-valuemax"))!,
        );
        await expect(area).toContainText("Revised independent work");
        const axe = await new AxeBuilder({ page }).include(".primm").analyze();
        expect(axe.violations).toEqual([]);
        await click("primm.complete");
        await expect(page).toHaveURL(new RegExp(`/${course.studyId}/${course.id}(?:\\?|$)`));
        expect(grades).toBe(2);
        expect(runs.map((r) => r.phase)).toEqual(["run", "modify", "make"]);
        expect(errors).toEqual([]);
      });
    }

/** Version 3: every step is one screen and one action, driven from the payload. */
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
        // answer repeats its request, so the terms a find step looks for are there.
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
                text: `${locale === "en" ? "Contract answer." : "契约测试回答。"}\n${body.prompt}`,
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
              if (step.phase === "run") {
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
                  await humanClick(
                    page,
                    area.locator(".primm-steps__buckets button", { hasText: bucket.label }),
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
              await humanClick(
                page,
                button(dict["primm.evaluate"]),
                "ask again after repairing it",
              );
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
