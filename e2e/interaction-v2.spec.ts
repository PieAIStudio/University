import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { localizeActivity, type InteractionPathActivity } from "../packages/core/dist/index.js";
import { SHIPPED_COURSES, lessonPathOf, shippedDeterministicAnswer } from "./harness/catalogue.js";
import { enterExerciseAnswer, expectExerciseAnswer } from "./harness/exercise-input.js";
import { humanClick } from "./harness/click.js";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";

const samples = SHIPPED_COURSES.flatMap((course) =>
  course.units.flatMap((unit) =>
    unit.lessons.flatMap((lesson) => {
      const activity = (
        lesson.packageLesson.activities as InteractionPathActivity[] | undefined
      )?.find((a) => a.kind === "interaction-path" && a.pedagogyVersion === 2);
      return activity ? [{ course, lesson, activity }] : [];
    }),
  ),
);

async function setControls(page: Page, area: Locator, ids: readonly string[]) {
  for (const button of await area.locator("[data-control-id]").all()) {
    const id = (await button.getAttribute("data-control-id"))!;
    if (((await button.getAttribute("aria-pressed")) === "true") !== ids.includes(id))
      await humanClick(page, button, "change this specific experiment condition");
  }
}

test("stored V2 remains valid; the five revised pilot lessons now use PRIMM", () => {
  const primm = SHIPPED_COURSES.flatMap((course) =>
    course.units.flatMap((unit) => unit.lessons),
  ).filter((lesson) =>
    (lesson.packageLesson.activities as { kind: string }[] | undefined)?.some(
      (activity) => activity.kind === "primm",
    ),
  );
  expect(primm.map((lesson) => lesson.id)).toEqual([
    "ask-about-a-picture",
    "sound-words-and-meaning",
    "name-the-result",
    "edit-one-part",
    "answer-or-search",
  ]);
  // Detailed V2 DOM/rule tests remain beside InteractionPath. Runtime flow
  // coverage for these new immutable revisions is in primm.spec.ts.
  for (const { lesson, activity } of samples) {
    expect(activity.context?.introduction).toBeTruthy();
    expect(activity.materials?.some((m) => m.kind === "source-summary")).toBe(true);
    expect(activity.steps.at(-1)?.phase).toBe("transfer");
    expect(activity.steps.every((step) => Boolean(step.brief?.trim()))).toBe(true);
    expect((lesson.packageLesson.exercises as { kind: string }[])[0]?.kind).toBe("choice");
  }
});

for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const)
  for (const locale of ["zh-CN", "en"] as const)
    for (const sample of samples) {
      test(`V2 ${mode} ${locale} ${sample.lesson.id}: real material, current conditions, correction, independent assessment`, async ({
        page,
      }, info) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.emulateMedia({
          reducedMotion: "reduce",
          colorScheme: locale === "en" ? "light" : "dark",
        });
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        const activity = localizeActivity(sample.activity, locale);
        const english = locale === "en";
        const labels = english
          ? {
              confirm: "Confirm and reveal",
              retry: "Revise this choice",
              next: "Next round",
              finish: "Keep my artifact",
              method: "Review the method",
              independent: "Start independent exercise",
            }
          : {
              confirm: "确认，看看结果",
              retry: "修改这次选择",
              next: "下一轮",
              finish: "带走我的作品",
              method: "回顾这次的方法",
              independent: "开始独立练习",
            };
        await page.goto(`${origin}${lessonPathOf(sample.course, sample.lesson)}?lang=${locale}`);
        const area = page.locator(".interaction-path");
        await expect(area).toBeVisible();
        const context = area.locator(".path-materials__context").first();
        await expect(context).toContainText(activity.context!.introduction);
        expect(await context.evaluate((n) => n.closest("details") === null)).toBe(true);
        await expect(context).toContainText(activity.context!.task);
        if (activity.assetId) {
          await expect(area.locator(".interaction-path__image img")).toBeVisible();
          await expect
            .poll(() =>
              area
                .locator(".interaction-path__image img")
                .evaluate((n) => (n as HTMLImageElement).naturalWidth),
            )
            .toBeGreaterThan(0);
          await expect(area.locator(".interaction-path__image figcaption")).toContainText("NASA");
        }
        await page.screenshot({ path: info.outputPath("real-material-entry.png") });
        for (const [index, step] of activity.steps.entries()) {
          await expect(area).toHaveAttribute("data-step-id", step.id);
          const bridge = area.locator(".interaction-path__bridge");
          await expect(bridge).toHaveText(step.brief!);
          expect(await bridge.evaluate((node) => node.closest("details") === null)).toBe(true);
          const question = area.locator(".interaction-path__task h2");
          await expect(question).toHaveAttribute(
            "aria-describedby",
            (await bridge.getAttribute("id"))!,
          );
          expect(
            await question.evaluate((node) => {
              const bridge = document.getElementById(node.getAttribute("aria-describedby")!);
              return Boolean(
                bridge && bridge.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
              );
            }),
          ).toBe(true);
          await expect(
            area.getByRole("heading", { name: step.question, exact: true }),
          ).toBeVisible();
          for (const id of step.materialIds ?? []) {
            const material = activity.materials!.find((m) => m.id === id)!;
            await expect(area.locator(`[data-material-id="${id}"]`)).toContainText(material.text);
          }
          if (step.kind === "experiment") {
            await expect(area.locator(".path-experiment__note")).toHaveText(step.simulationNote);
            // Exhaust all combinations, not merely the one path the author intended.
            for (const condition of step.cases) {
              await setControls(page, area, condition.selectedControlIds);
              await expect(area.locator(".path-experiment__preview")).toContainText(condition.text);
              await expect(area.locator(".interaction-path__feedback")).toHaveCount(0);
            }
            const bad = step.cases.find((c) => !c.accepted)!;
            const good = step.cases.find((c) => c.accepted)!;
            await setControls(page, area, bad.selectedControlIds);
            await humanClick(
              page,
              area.getByRole("button", { name: labels.confirm, exact: true }),
              "check a failing current condition",
            );
            await expect(area.locator('[data-passed="false"]')).toContainText(bad.feedback);
            await setControls(page, area, good.selectedControlIds);
            await humanClick(
              page,
              area.getByRole("button", { name: labels.confirm, exact: true }),
              "check the repaired current condition",
            );
            await expect(area.locator('[data-passed="true"]')).toContainText(good.feedback);
            await setControls(page, area, bad.selectedControlIds);
            await expect(area.locator('[data-passed="true"]')).toHaveCount(0);
            await expect(area.getByRole("button", { name: labels.next, exact: true })).toHaveCount(
              0,
            );
            await page.screenshot({
              path: info.outputPath(`experiment-${index}-changed-not-certified.png`),
            });
            await setControls(page, area, good.selectedControlIds);
          } else if (step.kind === "assemble") {
            const required = new Set(
              step.constraints.filter((c) => c.kind === "include").flatMap((c) => c.pieceIds),
            );
            for (const piece of step.pieces) {
              const button = area.locator(`[data-piece="${piece.id}"]`);
              const selected = (await button.getAttribute("aria-pressed")) === "true";
              if (selected !== required.has(piece.id))
                await humanClick(page, button, "assemble the requested clauses");
            }
          } else {
            const correct =
              step.kind === "decision" ? step.correctOptionId : step.correctSentenceId;
            if (index === 0) {
              const wrong = area
                .locator(`[data-choice-id]:not([data-choice-id="${correct}"])`)
                .first();
              await humanClick(page, wrong, "make a wrong initial prediction");
              await humanClick(
                page,
                area.getByRole("button", { name: labels.confirm, exact: true }),
                "reveal prediction feedback",
              );
              await expect(area.locator('[data-passed="false"]')).toBeVisible();
              await expect(area.locator(".interaction-path__feedback")).not.toContainText(
                step.explanation,
              );
              const selectedText = area.locator('[data-selected="true"] .path-choice__label');
              const unselectedText = area
                .locator('[data-selected="false"] .path-choice__label')
                .first();
              const readableColor = await unselectedText.evaluate(
                (node) => getComputedStyle(node).color,
              );
              // Feedback can mount before the selected button's foreground
              // reaches its reading state. Keep the exact colour requirement,
              // using the same observable-state wait as the successful path.
              await expect
                .poll(() => selectedText.evaluate((node) => getComputedStyle(node).color))
                .toBe(readableColor);
              await humanClick(
                page,
                area.getByRole("button", { name: labels.retry, exact: true }),
                "correct after explanation",
              );
            }
            await humanClick(
              page,
              area.locator(`[data-choice-id="${correct}"]`),
              "make the supported judgment",
            );
          }
          await humanClick(
            page,
            area.getByRole("button", { name: labels.confirm, exact: true }),
            "submit this actual step",
          );
          await expect(area.locator('[data-passed="true"]')).toBeVisible();
          await expect(area.locator(".interaction-path__feedback")).toContainText(step.explanation);
          if (step.kind === "decision" || step.kind === "evidence") {
            const referenceColor = await area
              .locator('[data-selected="false"] .path-choice__label')
              .first()
              .evaluate((node) => getComputedStyle(node).color);
            await expect
              .poll(() =>
                area
                  .locator('[data-selected="true"] .path-choice__label')
                  .evaluate((node) => getComputedStyle(node).color),
              )
              .toBe(referenceColor);
          }
          const final = index === activity.steps.length - 1;
          await humanClick(
            page,
            area.getByRole("button", {
              name: final
                ? step.kind === "assemble" || step.kind === "experiment"
                  ? labels.finish
                  : labels.method
                : labels.next,
              exact: true,
            }),
            "continue to the next instructional responsibility",
          );
        }
        await expect(area.locator('[data-result="completed"]')).toBeVisible();
        const settledTitle = await area.locator('[data-result="completed"] h2').boundingBox();
        const toolbar = await page.locator(".lesson-toolbar").boundingBox();
        expect(settledTitle!.y).toBeGreaterThanOrEqual(toolbar!.y + toolbar!.height);
        if (activity.steps.at(-1)?.kind !== "assemble") {
          await expect(area.locator(".path-artifact")).toHaveCount(0);
          await expect(area.locator(".interaction-path__recap")).toBeVisible();
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        if (english) expect(await area.innerText()).not.toMatch(/[\u4e00-\u9fff]/u);
        expect(
          (
            await new AxeBuilder({ page })
              .include(".interaction-path")
              .withTags(["wcag2a", "wcag2aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.screenshot({
          path: info.outputPath("method-or-actual-artifact.png"),
          fullPage: true,
        });
        await humanClick(
          page,
          area.getByRole("button", { name: labels.independent, exact: true }),
          "move to the separate independent question",
        );
        const exercise = page.locator(".exercise-panel").first();
        await expect(exercise.locator("textarea")).toHaveCount(0);
        const correct = shippedDeterministicAnswer(sample.course, sample.lesson);
        if (mode === "delivery") {
          await expect(exercise.locator('[data-exercise-option][aria-pressed="true"]')).toHaveCount(
            0,
          );
          const wrong = (await exercise
            .locator(`[data-exercise-option]:not([data-exercise-option="${correct}"])`)
            .first()
            .getAttribute("data-exercise-option"))!;
          await enterExerciseAnswer(page, exercise, wrong);
          await humanClick(
            page,
            exercise.locator(".exercise-actions button").first(),
            "grade the wrong independent choice",
          );
          await expect(exercise.locator(".host-grade--fail")).toBeVisible();
          await enterExerciseAnswer(page, exercise, correct);
          await humanClick(
            page,
            exercise.locator(".exercise-actions button").first(),
            "grade the independent correction",
          );
          await expect(exercise.locator(".host-grade--pass")).toBeVisible();
          // A correct exercise still does not pretend the learner confirmed this revision.
          await expect(
            page
              .locator(".lesson-completion button")
              .filter({ hasText: english ? /studied|read/i : /我学过|我读完/ })
              .first(),
          ).toBeVisible();
          await page.reload();
          await expectExerciseAnswer(page.locator(".exercise-panel").first(), correct);
        }
        expect(errors).toEqual([]);
      });
    }
