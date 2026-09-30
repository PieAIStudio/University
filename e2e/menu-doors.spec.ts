import { mkdirSync } from "node:fs";
import { nativeExerciseAnswers } from "./harness/native-practice.js";
import { expect, test, type Page } from "./harness/learner-test.js";
import { LOCAL_ORIGIN, LOCAL_API_ORIGIN, ONLINE_ORIGIN } from "./ports.js";
import { CATALOGUE_ROLES, coursePathOf } from "./harness/catalogue.js";
import { watchConsole } from "./harness/console.js";
import { humanClick } from "./harness/click.js";
import { navigateMapBreadcrumb } from "./harness/map-actions.js";
import { emptyProgress, lessonKeyOf } from "../packages/core/src/progress/document.js";

const OUT = "SCRATCH/e2e/menu-doors";
const ROLE = CATALOGUE_ROLES.skipTest;
const DOORS = ["学习", "复习", "图鉴", "我"];
const PATHS = ["/", "/review", "/library", "/me"];
async function isolate(page: Page) {
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, (route) => {
    // Opening the author desk reads its feedback inbox. This navigation-only
    // fixture has no real messages; every write and other cloud call remains
    // blocked. Do not mask resource/JavaScript errors in the console watcher.
    const request = route.request();
    if (request.method() === "GET" && new URL(request.url()).pathname === "/rest/v1/feedback")
      return route.fulfill({ status: 200, json: [] });
    return route.fulfill({ status: 503, json: { message: "Isolated offline provider" } });
  });
  await page.route(/https:\/\/[^/]*posthog\.com\//, (route) => route.abort());
  await page.routeWebSocket(/supabase\.co/, (socket) => socket.close());
}
async function capture(page: Page, name: string) {
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    (await page.evaluate(() => innerWidth)) + 1,
  );
}
async function primary(page: Page, width: number) {
  if (width >= 768) {
    const mapRail = page.locator('.app-shell[data-map-rail-open="false"]');
    if (await mapRail.count()) await page.locator(".app-shell__collapse--rail").click();
  }
  const nav = page.locator(width < 768 ? ".tab-bar" : ".nav-rail__list");
  await expect(nav).toBeVisible();
  await expect(nav.locator("a")).toHaveCount(4);
  await expect(nav.locator("a")).toHaveText(DOORS);
  expect(
    await nav.locator("a").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href"))),
  ).toEqual(PATHS);
  for (const label of await nav
    .locator(width < 768 ? ".tab-bar__label" : ".nav-rail__label")
    .all()) {
    const bounds = await label.boundingBox();
    expect(bounds!.width).toBeGreaterThan(8);
    expect(bounds!.height).toBeGreaterThan(8);
  }
  return nav;
}
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus)
    await page.screenshot({ path: info.outputPath("menu-failure.png") }).catch(() => undefined);
});

for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  for (const width of [1440, 390]) {
    test(`${mode} ${width}: the four doors connect map, review, library, Me and author-only settings without losing a destination`, async ({
      page,
    }) => {
      const errors = watchConsole(page);
      await isolate(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}${coursePathOf(ROLE.course)}?lang=zh-CN`);
      await primary(page, width);
      await noOverflow(page);
      await capture(page, `${mode}-${width}-map-doors`);
      if (width < 768) await expect(page.locator(".feedback-note__open--float")).toBeHidden();
      await navigateMapBreadcrumb(page, "/");
      if (width < 768) await page.locator(".app-shell__collapse--aside").click();
      await humanClick(
        page,
        page.locator("[data-find-course]"),
        "learning door to real course catalogue",
      );
      await expect(page).toHaveURL(/\/catalog(?:\?|$)/);
      await expect(page.locator(".catalog input")).toBeVisible();
      await capture(page, `${mode}-${width}-find-course`);
      await (await primary(page, width)).locator('a[href="/review"]').click();
      await expect(page.locator("[data-review-due]")).toHaveAttribute("data-review-due", "0");
      await expect(page.locator("[data-review-practice]")).toBeVisible();
      await page.locator("[data-review-practice-entry]").click();
      await expect(page.locator("[data-native-practice]")).toHaveAttribute(
        "data-practice-state",
        "empty",
      );
      await expect(page.locator(".question-step")).toHaveCount(0);
      await page.locator("[data-native-practice] button").filter({ hasText: "先休息一下" }).click();
      await expect(page).toHaveURL(/\/review(?:\?|$)/);
      await capture(page, `${mode}-${width}-review`);
      await (await primary(page, width)).locator('a[href="/library"]').click();
      await expect(page.locator("[data-album-count]")).toBeVisible();
      for (const [label, tab, ready] of [
        ["词义索引", "terms", ".term-index__results"],
        ["收藏", "favourites", ".terms > :last-child"],
        ["我的笔记", "notes", ".knowledge-notes"],
        ["防 AI 味儿", "flavour", ".term-index__results"],
        ["互动课件", "courseware", ".play-catalog"],
      ]) {
        await page
          .locator(".library-tabs")
          .getByRole("button", { name: label, exact: true })
          .click();
        await expect(page).toHaveURL(new RegExp(`/library/${tab}(?:\\?|$)`));
        await expect(page.locator(ready)).toBeVisible();
      }
      await expect(page.locator(".play-catalog [data-entry-id]")).toHaveCount(62);
      await expect(
        page.locator('.play-catalog a[href^="/play-lab"], .play-catalog__rationale'),
      ).toHaveCount(0);
      await expect(page.locator(".play-catalog")).not.toContainText("native:connect");
      await page.locator('[data-entry-id="native:ai-brief"]').click();
      await expect(page.locator(".learning-activity")).toHaveAttribute("data-activity", "ai-brief");
      await capture(page, `${mode}-${width}-courseware`);

      await (await primary(page, width)).locator('a[href="/me"]').click();
      await expect(page.locator('[data-me-door="growth"]')).toBeVisible();
      await expect(page.locator('[data-me-door="membership"]')).toBeVisible();
      await page.locator('[data-me-door="growth"]').click();
      await expect(page.locator(".badge-tile")).toHaveCount(17);
      await page.locator("[data-growth-goals] > summary").click();
      await expect(page.locator("[data-growth-goals] .quest")).toHaveCount(3);
      await (await primary(page, width)).locator('a[href="/me"]').click();
      await page.locator('[data-me-door="help"]').click();
      const feedback = page.locator("#profile-feedback-host button");
      await expect(feedback).toBeVisible();
      await feedback.click();
      await expect(page.locator(".feedback-note")).toBeVisible();
      await page.locator(".feedback-note__text").fill("Synthetic unsent feedback draft");
      await page.keyboard.press("Escape");
      await expect(page.locator(".feedback-note")).toHaveCount(0);
      await expect(feedback).toBeFocused();
      await feedback.click();
      await expect(page.locator(".feedback-note__text")).toHaveValue(
        "Synthetic unsent feedback draft",
      );
      await page.keyboard.press("Escape");
      await page.locator('[data-me-door="settings"]').click();
      const goal = page.locator("[data-daily-goal]");
      await expect(goal).toHaveAttribute("data-daily-goal", "1");
      await goal.getByRole("button", { name: "每天 2 关", exact: true }).click();
      await expect(goal).toHaveAttribute("data-daily-goal", "2");
      if (mode === "authoring") {
        await page.locator("[data-settings-lab] > summary").click();
        await expect(page.locator("[data-settings-lab] a")).toHaveCount(8);
        await expect(page.locator('[data-settings-lab] a[href="/studio/map"]')).toBeVisible();
        if (width >= 768) {
          // These are existing author tools, reached through their new home.
          for (const [path, ready] of [
            ["/avatar-lab", ".avatar-lab"],
            ["/play-lab", ".learning-play-lab"],
            ["/play-lab/ai", ".learning-play-lab"],
            ["/play-lab/primm", ".learning-play-lab"],
            ["/play-lab/toy-3d", ".arcade3d__standalone"],
            ["/play-lab/prop-finish", '[data-testid="prop-finish"]'],
            ["/studio/map", "[data-map-studio]"],
            ["/studio", ".studio-section"],
          ]) {
            const lab = page.locator("[data-settings-lab]");
            if ((await lab.getAttribute("open")) === null)
              await lab.locator(":scope > summary").click();
            await lab.locator(`a[href="${path}"]`).click();
            expect(new URL(page.url()).pathname).toBe(path);
            await expect(page.locator(ready)).toBeVisible();
            if (path === "/play-lab") {
              await page.locator('a[href="/play-lab/catalog"]').click();
              await expect(page.locator(".play-catalog [data-entry-id]")).toHaveCount(65);
              await expect(page.locator('.play-catalog [data-entry-id^="history:"]')).toHaveCount(
                3,
              );
              await page.goBack();
            }
            await page.goBack();
            await expect(page.locator("[data-daily-goal]")).toHaveAttribute("data-daily-goal", "2");
          }
        }
      } else await expect(page.locator("[data-settings-lab]")).toHaveCount(0);
      await noOverflow(page);
      await capture(page, `${mode}-${width}-settings`);
      await (await primary(page, width)).locator('a[href="/me"]').click();
      await expect(page.locator(".profile-screen h1")).toBeVisible();
      await expect(page.locator('[data-me-door="settings"]')).toBeVisible();
      await page.locator(".profile-screen h1").scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      await capture(page, `${mode}-${width}-me`);
      await page.locator('[data-me-door="settings"]').click();
      await expect(page.locator("[data-daily-goal]")).toHaveAttribute("data-daily-goal", "2");
      errors.assertClean();
    });
  }
}

test("phone: only medallion paint halves, the target stays 44px and selection restores full paint", async ({
  page,
}) => {
  await isolate(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${ONLINE_ORIGIN}${coursePathOf(ROLE.course)}?lang=zh-CN`);
  // A projected label retains a DOM rectangle while --placed=0 makes it
  // transparent/noninteractive. Choose a genuinely drawn, hittable label,
  // rather than mistaking Playwright's geometric :visible for scene readiness.
  await expect(page.locator("button.label--lesson-medallion.is-visible").first()).toBeVisible();
  const ready = await page.waitForFunction(() => {
    for (const node of document.querySelectorAll<HTMLElement>(
      'button.label--lesson-medallion[aria-pressed="false"]',
    )) {
      const box = node.getBoundingClientRect(),
        style = getComputedStyle(node);
      if (
        style.pointerEvents === "none" ||
        Number(style.opacity) < 0.99 ||
        box.y < 0 ||
        box.right > innerWidth ||
        box.bottom > innerHeight
      )
        continue;
      if (
        document
          .elementsFromPoint(box.x + box.width / 2, box.y + box.height / 2)
          .some((hit) => hit === node || node.contains(hit))
      )
        return node.dataset.mapMarker;
    }
    return null;
  });
  const id = await ready.jsonValue();
  expect(id).toBeTruthy();
  const selected = page.locator(`button.label--lesson-medallion[data-map-marker="${id}"]`);
  const measure = () =>
    selected.evaluate((node) => {
      const target = node.getBoundingClientRect(),
        paint = node.querySelector(".scene-label__icon-face")!.getBoundingClientRect();
      return { width: target.width, height: target.height, ratio: paint.width / target.width };
    });
  const small = await measure();
  expect(small.width).toBeGreaterThanOrEqual(44);
  expect(small.height).toBeGreaterThanOrEqual(44);
  expect(small.ratio).toBeCloseTo(0.5, 2);
  await humanClick(page, selected, "select the existing lesson medallion");
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await measure()).ratio).toBeCloseTo(1, 2);
  await expect(page.locator(".tab-bar a")).toHaveCount(4);
  await capture(page, "phone-selected-medallion-full");
});

test("872px: the narrow non-map rail still spells out each of the four doors", async ({ page }) => {
  await isolate(page);
  await page.setViewportSize({ width: 872, height: 900 });
  await page.goto(`${ONLINE_ORIGIN}/review?lang=zh-CN`);
  await primary(page, 872);
  await noOverflow(page);
  await capture(page, "delivery-tablet-labels");
});

test("phone: an empty planet offers explicit, withdrawable contact intent without claiming an email subscription", async ({
  page,
}) => {
  await isolate(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${ONLINE_ORIGIN}/planet?lang=zh-CN`);
  await page.locator('button[data-domain-id="ai-media"]').click();
  const info = page.locator(".app-shell__collapse--aside");
  if (await info.count()) await info.click();
  const interest = page.locator('[data-domain-interest="ai-media"]');
  await expect(interest).toBeVisible();
  await interest.getByRole("button", { name: "开放时告诉我" }).click();
  const submit = interest.getByRole("button", { name: "记录我的意向" });
  await interest.locator('input[type="email"]').fill("synthetic@example.test");
  await expect(submit).toBeDisabled();
  await interest.getByRole("switch").click();
  await submit.click();
  await expect(interest.getByRole("status")).toContainText("目前不会发送");
  await interest.getByRole("button", { name: "撤回联系意向" }).click();
  await expect(interest.locator('input[type="email"]')).toHaveValue("");
  await expect(interest.getByRole("status")).toContainText("意向已撤回");
  await capture(page, "phone-coming-soon-contact");
});

/** Real source questions, synthetic completed history. No live learner row
 * or paid grading service is touched, and no second expected-answer table. */
function practiceSeed() {
  const document = emptyProgress();
  const lesson = ROLE.unit.lessons[0]!;
  const locator = {
    studyId: ROLE.study.id,
    courseId: ROLE.course.id,
    unitId: ROLE.unit.id,
    lessonId: lesson.id,
  };
  const data = lesson.packageLesson as {
    contentRevision: number;
    exercises: { id: string; prompt: string }[];
  };
  const now = Date.now();
  document.lessons[lessonKeyOf(locator)] = {
    progress: 1,
    completedAt: now - 5000,
    attempts: 1,
    readConfirmed: true,
    readConfirmedRevision: data.contentRevision,
  };
  for (const exercise of data.exercises)
    document.exerciseAttempts[`seed:${exercise.id}`] = {
      commandId: `seed:${exercise.id}`,
      locator,
      exerciseId: exercise.id,
      // The published projection binds its exercises to the lesson edition.
      // Raw package exercises have no independent revision field.
      contentRevision: data.contentRevision,
      answer: "Synthetic prior completion",
      score: 1,
      maxScore: 1,
      occurredAt: new Date(now - 5000).toISOString(),
      hostGrade: {
        passed: true,
        outcome: "pass",
        evaluation: "",
        extensions: [],
        host: "synthetic-history",
        learnerAnswer: null,
        occurredAt: new Date(now - 5000).toISOString(),
      },
    };
  const first = data.exercises[0]!;
  document.exerciseAttempts["seed:mistake"] = {
    ...document.exerciseAttempts[`seed:${first.id}`]!,
    purpose: "practice",
    commandId: "seed:mistake",
    answer: "Unrelated",
    score: 0,
    occurredAt: new Date(now - 1000).toISOString(),
    hostGrade: {
      passed: false,
      outcome: "fail",
      evaluation: "",
      extensions: [],
      host: "synthetic-history",
      learnerAnswer: null,
      occurredAt: new Date(now - 1000).toISOString(),
    },
  };
  const answers = nativeExerciseAnswers(locator);
  return { document, locator, first, answers };
}
for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const)
  for (const historyKind of ["migrated", "confirmed"] as const)
    test(`${mode}: a ${historyKind} learner practises the completed native level, mistake first, without changing completion`, async ({
      page,
    }) => {
      await isolate(page);
      const seed = practiceSeed();
      if (mode === "authoring") {
        // This transport exposes the exercise's source revision. Do not pretend
        // the package's lesson edition is the source exercise's own version.
        const { studyId, courseId, unitId, lessonId } = seed.locator;
        const response = await page.request.get(
          `${LOCAL_API_ORIGIN}/api/studies/${studyId}/courses/${courseId}/units/${unitId}/lessons/${lessonId}`,
        );
        expect(response.ok()).toBe(true);
        const body = await response.json();
        const exercise = body.lesson.exercises.find(
          (entry: { id: string }) => entry.id === seed.first.id,
        );
        expect(Number.isSafeInteger(exercise?.contentRevision)).toBe(true);
        seed.document.exerciseAttempts["seed:mistake"] = {
          ...seed.document.exerciseAttempts["seed:mistake"]!,
          contentRevision: exercise.contentRevision,
        };
      }
      // This fixture is a migrated learner: completion predates separate read
      // confirmations. Keep that supported legacy shape instead of inventing a
      // modern official pass whose lesson-edition number is the exercise's own
      // source revision. Modern confirmation/proof exclusion is tested in core.
      if (historyKind === "migrated") {
        seed.document.lessons[lessonKeyOf(seed.locator)] = {
          progress: 1,
          completedAt: seed.document.lessons[lessonKeyOf(seed.locator)]!.completedAt,
          attempts: 1,
        };
        for (const key of Object.keys(seed.document.exerciseAttempts)) {
          if (key !== "seed:mistake") delete seed.document.exerciseAttempts[key];
        }
      }
      // Confirmed history deliberately keeps the published lesson edition in
      // the official verdict. Native practice must prioritise its own loaded
      // exercise revision, not let that larger number conceal a real mistake.
      await page.addInitScript(
        (document) => localStorage.setItem("university.progress.v2", JSON.stringify(document)),
        seed.document,
      );
      await page.goto(`${origin}/practice?lang=zh-CN`);
      await expect(page.locator("[data-native-practice]")).toHaveAttribute(
        "data-practice-state",
        "asking",
      );
      await expect(page.locator("[data-practice-priority]")).toBeVisible();
      const prompt = (await page.locator(".question-step__prompt").innerText()).trim();
      expect(prompt).toBe(seed.first.prompt);
      const expected = seed.answers.get(prompt);
      expect(expected).toBeTruthy();
      const baseline = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("university.progress.v2")!),
      );
      await page.locator("textarea").fill(expected!);
      await page.getByRole("button", { name: "交这一题", exact: true }).click();
      await expect(page.locator("[data-practice-verdict]")).toHaveAttribute(
        "data-practice-verdict",
        "correct",
      );
      const saved = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("university.progress.v2")!),
      );
      expect(saved.lessons).toEqual(baseline.lessons);
      expect(saved.totalXp).toBe(baseline.totalXp);
      expect(saved.xpEvents).toEqual(baseline.xpEvents);
      expect(
        Object.values(saved.exerciseAttempts).filter((entry: any) => entry.purpose === "practice"),
      ).toHaveLength(2);
      await capture(page, `${mode}-${historyKind}-synthetic-history-native-practice`);
    });
