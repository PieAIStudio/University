import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { localizeActivity, type InteractionPathActivity } from "../packages/core/dist/index.js";
import { LOCAL_ORIGIN, ONLINE_ORIGIN } from "./ports.js";
import { humanClick } from "./harness/click";
import { SHIPPED_COURSES, lessonPathOf } from "./harness/catalogue.js";

const samples = SHIPPED_COURSES.flatMap((course) =>
  course.units.flatMap((unit) =>
    unit.lessons.flatMap((lesson) => {
      const activities = lesson.packageLesson.activities as
        | readonly InteractionPathActivity[]
        | undefined;
      const activity = activities?.find((item) => item.kind === "interaction-path");
      return activity
        ? [{ path: lessonPathOf(course, lesson), lessonId: lesson.id, activity }]
        : [];
    }),
  ),
);

test("interaction samples are three real lessons in the normal course package", () => {
  expect(samples).toHaveLength(3);
  for (const { activity } of samples) {
    expect(activity.steps).toHaveLength(4);
    expect(activity.steps.some((step) => step.kind === "evidence")).toBe(true);
    expect(activity.steps.some((step) => step.kind === "assemble")).toBe(true);
    expect(activity.steps.at(-1)?.kind).toBe("assemble");
  }
});

for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  for (const locale of ["zh-CN", "en"] as const) {
    for (const sample of samples) {
      test(`interaction ${mode} ${locale} ${sample.lessonId}: actual rounds, correction, artifact and independent handoff`, async ({
        page,
      }, info) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const activity = localizeActivity(sample.activity, locale);
        await page.goto(`${origin}${sample.path}?lang=${locale}`);
        const path = page.locator(".interaction-path");
        await expect(path).toBeVisible();
        await expect(page.locator(".interaction-path__review")).not.toHaveAttribute("open", "");
        const firstChoice = path.locator(".interaction-path__choices button").first();
        await expect(firstChoice).toBeInViewport();
        await page.screenshot({ path: info.outputPath("entry.png") });

        const labels =
          locale === "en"
            ? {
                confirm: "Confirm and reveal",
                retry: "Revise this choice",
                next: "Next round",
                finish: "Keep my artifact",
                independent: "Start independent exercise",
              }
            : {
                confirm: "确认，看看结果",
                retry: "修改这次选择",
                next: "下一轮",
                finish: "带走我的作品",
                independent: "开始独立练习",
              };
        for (const [index, step] of activity.steps.entries()) {
          await expect(
            path.getByRole("heading", { name: step.question, exact: true }),
          ).toBeVisible();
          if (step.kind === "assemble") {
            const required = new Set(
              step.constraints
                .filter((rule) => rule.kind === "include")
                .flatMap((rule) => rule.pieceIds),
            );
            const unwanted = step.pieces.find((piece) => !required.has(piece.id))!;
            await expect(path.locator(".interaction-path__assembly li")).toHaveCount(
              step.initialPieceIds.length,
            );
            if (!step.initialPieceIds.includes(unwanted.id)) {
              await humanClick(
                page,
                path.getByRole("button", { name: unwanted.label, exact: true }),
                "try one unsuitable clause",
              );
            }
            await humanClick(
              page,
              path.getByRole("button", { name: labels.confirm, exact: true }),
              "inspect actual semantic feedback",
            );
            await expect(path.locator('[data-passed="false"]')).toBeVisible();
            await expect(
              path.getByRole("button", { name: labels.retry, exact: true }),
            ).toBeInViewport();
            await humanClick(
              page,
              path.getByRole("button", { name: labels.retry, exact: true }),
              "revise the clause selection",
            );
            for (const id of new Set([...step.initialPieceIds, unwanted.id])) {
              if (required.has(id)) continue;
              const piece = step.pieces.find((item) => item.id === id)!;
              await humanClick(
                page,
                path.getByRole("button", {
                  name: `${locale === "en" ? "Remove: " : "移除："}${piece.label}`,
                  exact: true,
                }),
                "remove only an unsupported clause",
              );
            }
            // The sample's clauses are order-independent. A noncanonical order must pass.
            for (const piece of [...step.pieces]
              .reverse()
              .filter((item) => required.has(item.id) && !step.initialPieceIds.includes(item.id))) {
              await humanClick(
                page,
                path.getByRole("button", { name: piece.label, exact: true }),
                "add a useful clause",
              );
            }
          } else {
            if (step.kind === "evidence" && step.task === "unsupported") {
              await expect(path.locator(".interaction-path__reference")).toContainText(
                step.material.reference!.text,
              );
            }
            const choices = step.kind === "decision" ? step.options : step.material.sentences;
            const correct =
              step.kind === "decision" ? step.correctOptionId : step.correctSentenceId;
            if (index === 0) {
              const wrong = choices.find((item) => item.id !== correct)!;
              const wrongButton = path.getByRole("button", { name: wrong.label, exact: true });
              await wrongButton.focus();
              await page.keyboard.press("Space");
              await humanClick(
                page,
                path.getByRole("button", { name: labels.confirm, exact: true }),
                "submit the first prediction",
              );
              await expect(path.locator('[data-passed="false"]')).toBeVisible();
              await page.screenshot({ path: info.outputPath("first-feedback.png") });
              await humanClick(
                page,
                path.getByRole("button", { name: labels.retry, exact: true }),
                "correct without losing first-attempt evidence",
              );
            }
            await humanClick(
              page,
              path.getByRole("button", {
                name: choices.find((item) => item.id === correct)!.label,
                exact: true,
              }),
              "choose the supported response",
            );
          }
          await page.screenshot({ path: info.outputPath(`round-${index + 1}.png`) });
          await humanClick(
            page,
            path.getByRole("button", { name: labels.confirm, exact: true }),
            "check this round",
          );
          await expect(path.locator('[data-passed="true"]')).toBeVisible();
          await humanClick(
            page,
            path.getByRole("button", {
              name: index === activity.steps.length - 1 ? labels.finish : labels.next,
              exact: true,
            }),
            "advance after feedback",
          );
        }
        await expect(path.locator('[data-result="completed"]')).toBeVisible();
        await expect(path.locator(".interaction-path__artifact")).not.toBeEmpty();
        await expect(page.locator(".exercise-panel textarea").first()).toHaveValue("");
        await humanClick(
          page,
          path.locator(".interaction-path__receipt > summary"),
          "inspect honest attempt history",
        );
        await expect(path.locator(".interaction-path__receipt")).toContainText(
          locale === "en" ? "After help or feedback" : "已看提示或反馈",
        );
        if (locale === "en") expect(await path.innerText()).not.toMatch(/[\u4e00-\u9fff]/u);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        const scan = await new AxeBuilder({ page })
          .include(".interaction-path")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();
        expect(scan.violations).toEqual([]);
        await page.screenshot({ path: info.outputPath("artifact.png"), fullPage: true });
        await humanClick(
          page,
          path.getByRole("button", { name: labels.independent, exact: true }),
          "start the separate independent exercise",
        );
        await expect(page.locator(".exercise-panel textarea").first()).toBeFocused();
        expect(errors).toEqual([]);
      });
    }
  }
}
