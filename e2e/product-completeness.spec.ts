import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ONLINE_ORIGIN } from "./ports.js";
import { humanClick } from "./harness/click.js";
import { CATALOGUE_ROLES, SHIPPED_COURSES, lessonPathOf } from "./harness/catalogue.js";
import { enterExerciseAnswer, expectExerciseAnswer } from "./harness/exercise-input.js";

const RECOVERY_ANSWER =
  "手机先把当前的脸算成一串特征数字，再和设置解锁时保存的那串比较，差得够少就通过，不是把两张照片逐张对比。";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
]) {
  test.describe(`T product completeness ${viewport.width}`, () => {
    test.use({
      viewport,
      hasTouch: viewport.width < 768,
      isMobile: viewport.width < 768,
      storageState: { cookies: [], origins: [] },
    });

    test("T1 fresh welcome is optional, first action reachable, draft reload and determined feedback are honest", async ({
      page,
    }) => {
      await page.goto(ONLINE_ORIGIN, { waitUntil: "domcontentloaded" });
      const welcome = page.locator("[data-welcome]");
      const start = page.locator("[data-welcome-start]");
      await expect(welcome).toBeVisible();
      await expect(start).toBeEnabled();
      const box = await start.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      await humanClick(page, start, "first real lesson");
      await expect(page.locator(".lesson-reader")).toBeVisible();
      /*
        The welcome leads wherever Today points, and that opening is now a PRIMM
        lesson with its own reader and no shared exercise panel. The draft and
        determined-feedback contract below belongs to the deterministic exercise
        this test already takes its answer from, so walk to that lesson by its
        catalogue role instead of assuming the welcome lands on it. The welcome's
        own promise — optional, reachable, leads to a real reader — is asserted
        above and keeps its meaning.
      */
      await page.goto(
        `${ONLINE_ORIGIN}${lessonPathOf(CATALOGUE_ROLES.settlement.course, CATALOGUE_ROLES.settlement.lesson)}`,
        { waitUntil: "domcontentloaded" },
      );
      await expect(page.locator(".lesson-reader")).toBeVisible();
      const lessonUrl = page.url();
      const exercise = page.locator(".exercise-panel").first();
      const options = exercise.locator("[data-exercise-option]");
      const choice = (await options.count()) > 0;
      const choiceId = choice
        ? await options.evaluateAll(
            (nodes, correct) =>
              nodes
                .map((n) => n.getAttribute("data-exercise-option")!)
                .find((id) => id !== correct)!,
            CATALOGUE_ROLES.settlement.answer,
          )
        : null;
      const draft = choiceId ?? RECOVERY_ANSWER;
      await enterExerciseAnswer(page, exercise, draft);
      const progress = page.locator(".lesson-toolbar__progress");
      if (await page.locator('[data-activity="interaction-path"]').count()) {
        // Typing an independent answer is not completing a guided round.
        // V5 names this progress by rounds, not by collapsed prose sections.
        await expect(progress).toContainText(/^互动\s+0\s*\/\s*[1-9]\d*$/u);
        await expect(progress.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
      } else {
        await expect(progress).toContainText(/阅读\s*\d+\/\d+\s*段/u);
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await expectExerciseAnswer(exercise, draft);
      await humanClick(
        page,
        exercise.getByRole("button", { name: /^提交$/ }),
        "submit recovered answer",
      );
      /*
       * The release shelf now starts with a strict two-choice exercise. This
       * preserved draft is intentionally from the retired open explanation;
       * it must be rejected as a definite mismatch, not presented as an
       * undecided semantic answer. Open-ended exercises still own the
       * undecided contract in the grading tests and reader UI.
       */
      await expect(exercise).toContainText("当场判定 · 未通过");
      await expect(exercise).not.toContainText(/暂时无法判断|还不能.*判断|无法可靠判断/u);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expectExerciseAnswer(exercise, draft);
      await expect(exercise).toContainText("当场判定 · 未通过");
      await expect(exercise).not.toContainText(/暂时无法判断|还不能.*判断|无法可靠判断/u);
      // Keep typed-draft recovery coverage too: upgrading the first lesson's
      // input is not permission to stop exercising a real text question.
      if (choice) {
        const textEntry = SHIPPED_COURSES.flatMap((course) =>
          course.units.flatMap((unit) => unit.lessons.map((lesson) => ({ course, lesson }))),
        ).find(
          ({ lesson }) =>
            (lesson.packageLesson.exercises as { kind: string }[])[0]?.kind === "short-answer",
        )!;
        await page.goto(`${ONLINE_ORIGIN}${lessonPathOf(textEntry.course, textEntry.lesson)}`);
        const textPanel = page.locator(".exercise-panel").first();
        await enterExerciseAnswer(page, textPanel, RECOVERY_ANSWER);
        await page.reload();
        await expectExerciseAnswer(textPanel, RECOVERY_ANSWER);
      }
      await page.goto(ONLINE_ORIGIN, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-welcome]")).toHaveCount(0);
      const fresh = await page.context().browser()!.newContext({ viewport, locale: "zh-CN" });
      try {
        const linked = await fresh.newPage();
        await linked.goto(lessonUrl, { waitUntil: "domcontentloaded" });
        await expect(linked.locator(".lesson-reader")).toBeVisible();
        await expect(linked.locator("[data-welcome]")).toHaveCount(0);
      } finally {
        await fresh.close();
      }
    });

    test("T2 searchable catalog preserves published context and quests lead to actual learning", async ({
      page,
    }) => {
      await page.goto(`${ONLINE_ORIGIN}/catalog`, { waitUntil: "domcontentloaded" });
      const search = page.getByRole("searchbox");
      await expect(page.locator(".catalog")).toContainText("从这里开始");
      await expect(page.locator(".catalog")).not.toContainText("正在学");
      await search.fill("完全没有这样的一门课qxyz");
      await expect(page.locator(".catalog")).toContainText("没有找到这个内容");
      await humanClick(page, page.getByRole("button", { name: "清空搜索" }), "reset catalog");
      await expect(search).toHaveValue("");
      const title = (await page.locator(".catalog__lesson-title").first().textContent())?.trim();
      expect(title).toBeTruthy();
      await search.fill(title!);
      await expect(page.locator(".catalog__search-results a").first()).toBeVisible();
      await humanClick(page, page.locator(".catalog__search-results a").first(), "search result");
      await expect(page.locator(".lesson-reader")).toBeVisible();
      await page.goto(`${ONLINE_ORIGIN}/quests`, { waitUntil: "domcontentloaded" });
      const action = page.locator('[data-quest-action="lesson"]');
      await expect(action).toHaveAttribute("href", /\/.+\/.+\/.+\/.+/u);
      await humanClick(page, action, "start real quest");
      await expect(page.locator(".lesson-reader")).toBeVisible();
    });

    test("T3 unavailable billing explains the boundary before login and keeps currency choices honest", async ({
      page,
    }) => {
      await page.goto(`${ONLINE_ORIGIN}/plans`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("会员尚未开售", { exact: true })).toHaveCount(0);
      await expect(page.locator(".plan-card--featured")).toContainText("$149.00");
      await humanClick(
        page,
        page.getByRole("button", { name: "按月", exact: true }),
        "monthly offer",
      );
      await expect(page.locator(".plan-card--featured")).toContainText("$19.00");
      await humanClick(
        page,
        page.getByRole("button", { name: "升级会员", exact: true }),
        "safe purchase attempt",
      );
      await expect(page.getByRole("alert")).toContainText("本次未扣款");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "升级会员", exact: true })).toBeEnabled();
    });
  });
}

test.describe("T accessibility and recovery", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    storageState: { cookies: [], origins: [] },
  });
  test("T4 keyboard skip is usable with reduced motion and is remembered", async ({ page }) => {
    await page.goto(ONLINE_ORIGIN, { waitUntil: "domcontentloaded" });
    const close = page.getByRole("button", { name: "关闭欢迎，先看地图", exact: true });
    await expect(close).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await close.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-welcome]")).toHaveCount(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-welcome]")).toHaveCount(0);
    await expect(page.locator("button.label--course.is-visible").first()).toBeVisible();
    await expect(page.locator('[data-map-entry="true"]')).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
