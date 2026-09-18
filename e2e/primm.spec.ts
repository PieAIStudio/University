import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { localizeActivity, type PrimmActivity } from "../packages/core/dist/index.js";
import { messages as zh } from "../packages/ui/src/i18n/catalogs/primm.zh-CN.js";
import { messages as en } from "../packages/ui/src/i18n/catalogs/primm.en.js";
import { SHIPPED_CATALOGUE, SHIPPED_COURSES, lessonPathOf } from "./harness/catalogue.js";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";
import { humanClick } from "./harness/click.js";

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

test("five PRIMM revisions use real materials and five different investigation operations", () => {
  expect(samples).toHaveLength(5);
  expect(new Set(samples.map((s) => s.activity.investigate.game.kind)).size).toBe(5);
  for (const { lesson, activity } of samples) {
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

test("a late photo never pushes a beginner's prediction away from the pointer", async ({
  page,
}) => {
  const sample = samples.find(({ activity }) => activity.starter.operation === "vision")!;
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
    const target = page.locator(".primm fieldset button").last();
    await expect(target).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await target.scrollIntoViewIfNeeded();
    const before = (await target.boundingBox())!;
    release();
    await expect
      .poll(() =>
        page
          .locator(".primm__asset img")
          .evaluate((node) => node.complete && node.naturalWidth > 0),
      )
      .toBe(true);
    const after = (await target.boundingBox())!;
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
    await humanClick(page, target, "choose without a late photo moving the question");
    await expect(target).toHaveAttribute("aria-pressed", "true");
  } finally {
    release();
  }
});

for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const)
  for (const locale of ["zh-CN", "en"] as const)
    for (const { course, lesson, activity: raw } of samples) {
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
        if (lesson.id === samples[0]!.lesson.id && locale === "zh-CN") {
          // The first pilot also covers the real Today entry in both modes;
          // its completion still uses all five actual browser interactions.
          await page.goto(`${origin}/?lang=${locale}`);
          const picker = page.locator(".study-switcher__trigger");
          await humanClick(page, picker, "choose the PRIMM series");
          const study = SHIPPED_CATALOGUE.find((item) => item.id === course.studyId)!;
          await humanClick(
            page,
            page.getByRole("option").filter({ hasText: study.title }),
            "choose the actual pilot course series",
          );
          await humanClick(
            page,
            page.getByRole("button", { name: /开始学习|继续学习/ }).first(),
            "start the actual lesson recommended by Today",
          );
          await expect(page).toHaveURL(new RegExp(lessonPathOf(course, lesson)));
        } else {
          await page.goto(`${origin}${lessonPathOf(course, lesson)}?lang=${locale}`);
        }
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
        await click("primm.next");
        await stage("investigate");
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
          for (const card of g.cards) {
            await humanClick(
              page,
              game.getByRole("button", { name: card.text, exact: true }),
              "select card",
            );
            await humanClick(
              page,
              game.getByRole("button", {
                name: g.buckets.find((b) => b.id === card.bucketId)!.label,
                exact: true,
              }),
              "place card",
            );
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
