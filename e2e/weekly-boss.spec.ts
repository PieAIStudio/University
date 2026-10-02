import { expect, test, type Page } from "./harness/learner-test.js";
import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { E2E_STUDIES_ROOT } from "./catalogue-paths.mjs";
import { fileURLToPath } from "node:url";

import { CATALOGUE_ROLES, coursePathOf } from "./harness/catalogue.js";
import { passChestOpening } from "./harness/chest.js";
import { humanClick } from "./harness/click.js";
import { namedStep } from "./harness/step.js";
import { navigateMapBreadcrumb, runMapCommand } from "./harness/map-actions.js";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";

/**
 * V7 mechanic 8, the weekly boss (PLAN-V7-07 §2a), end to end: a learner who
 * finished a unit's lessons this week finds the boss on that island, takes its
 * five hearts with the lessons' own questions, and receives the chest it drops.
 *
 * The unit tests prove the rules — the window, the hearts, the flawless
 * upgrade. This proves the questions reach the browser, that each right answer
 * is written as a heart, and that the boss is gone for the week afterwards.
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
/** Captures for the report, not committed. */
const SHOTS = join(ROOT, "SCRATCH/e2e/weekly-boss");
const ROLE = CATALOGUE_ROLES.skipTest;
const STUDY = ROLE.study.id;
const COURSE = ROLE.course.id;

/** The reference answers, read off the authored exercises (see skip-test.spec.ts). */
function authoredAnswers(): ReadonlyMap<string, string> {
  const unitRoot = join(E2E_STUDIES_ROOT, STUDY, "courses", COURSE, "units", ROLE.unit.id);
  const answers = new Map<string, string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry === "exercise.json") {
        const record = JSON.parse(readFileSync(path, "utf8")) as {
          readonly prompt?: string;
          readonly expectedAnswer?: string;
        };
        if (record.prompt && record.expectedAnswer)
          answers.set(record.prompt, record.expectedAnswer);
      }
    }
  };
  walk(join(unitRoot, "lessons"));
  return answers;
}

/** Mark the unit's lessons finished today in the learner's own record, then reload. */
async function finishUnitToday(page: Page): Promise<void> {
  const keys = ROLE.unit.lessons.map((lesson) => `${STUDY}/${COURSE}/${lesson.id}`);
  await page.evaluate((lessonKeys) => {
    const key = "university.progress.v2";
    const document = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!document?.lessons) throw new Error("no guest progress document to write into");
    const now = Date.now();
    for (const [index, lessonKey] of lessonKeys.entries())
      document.lessons[lessonKey] = {
        progress: 1,
        completedAt: now - (lessonKeys.length - index) * 60_000,
        attempts: 1,
        readConfirmed: true,
        readConfirmedRevision: 1,
      };
    localStorage.setItem(key, JSON.stringify(document));
  }, keys);
}

for (const [mode, origin, width] of [
  ["delivery", ONLINE_ORIGIN, 1440],
  ["authoring", LOCAL_ORIGIN, 390],
] as const) {
  test(`${mode}: the weekly boss stands on the island studied this week, and its last heart drops a chest`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    // Calendar fixture only: the five answers still go through the actual game.
    await page.clock.setFixedTime(new Date("2026-09-29T12:00:00+08:00"));
    const answers = authoredAnswers();
    mkdirSync(SHOTS, { recursive: true });
    const shot = (name: string) => page.screenshot({ path: join(SHOTS, `${mode}-${name}.png`) });
    const course = `${origin}${coursePathOf(ROLE.course)}`;

    await namedStep(page, "这周学完了一个单元", async () => {
      await page.goto(course, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
      await expect
        .poll(() => page.evaluate(() => localStorage.getItem("university.progress.v2") !== null), {
          timeout: 30_000,
        })
        .toBe(true);
      await finishUnitToday(page);
      await page.reload({ waitUntil: "domcontentloaded" });
    });

    await expect(page.locator('button[data-map-marker^="weekly-boss:"]')).toBeVisible();
    // A fresh home document intentionally resumes the next lesson. The actual
    // ancestor breadcrumb asks for the archipelago and keeps this series.
    await navigateMapBreadcrumb(page, "/");
    const worldCrown = page.locator(`button[data-map-marker="${COURSE}"][data-weekly-boss="true"]`);
    await expect(worldCrown).toHaveCount(1);
    await expect(worldCrown.locator("[data-weekly-course-crown]")).toHaveCount(1);
    await shot("0-overview-crown");
    await page.goto(course);
    const chip = page.locator('button[data-map-marker^="weekly-boss:"]');
    await namedStep(page, "岛上站着本周大怪，五颗心", async () => {
      await expect(chip).toBeVisible({ timeout: 60_000 });
      await expect(chip).toHaveAttribute("aria-label", /本周大怪.*5/);
      // The learning camera follows the current stone. A shore visitor can be
      // off-screen on a phone: use the real overview command before selecting it.
      if (width === 390) await runMapCommand(page, "overview");
      await page.waitForTimeout(1500);
      await shot("1-island");
      if (width === 390) await runMapCommand(page, "weekly-boss");
      else await humanClick(page, chip, "大怪头上的王冠");
      await expect(page.locator(".weekly-boss-fight__hearts")).toHaveAttribute("data-hearts", "5");
      await page.waitForTimeout(1500);
      await shot("2-intro");
      await humanClick(page, page.locator('[data-weekly-boss-action="fight"]'), "开打");
    });

    await namedStep(page, "五道题，每答对一道打掉一颗心", async () => {
      for (let heart = 5; heart > 0; heart -= 1) {
        const prompt = (await page.locator(".question-step__prompt").innerText()).trim();
        const expected = answers.get(prompt);
        expect(expected, `没有这道题的参考答案：${prompt}`).toBeTruthy();
        await page.locator(".question-step__answer").fill(expected!);
        if (heart === 5) await shot("3-question");
        await humanClick(
          page,
          page.locator('.weekly-boss-fight [data-question-action="submit"]'),
          "扔星星",
        );
        if (heart > 1) {
          await expect(page.locator(".weekly-boss-fight__hearts")).toHaveAttribute(
            "data-hearts",
            String(heart - 1),
          );
          if (heart === 5) {
            await page.waitForTimeout(900);
            await shot("4-hit");
          }
          await humanClick(page, page.locator('[data-weekly-boss-action="next"]'), "下一题");
        }
      }
      await expect(page.locator(".weekly-boss-fight")).toHaveCount(0, { timeout: 10_000 });
      await page.waitForTimeout(1200);
      await shot("5-last-heart");
      await expect(page.locator("[data-chest-stage]")).toBeVisible({ timeout: 20_000 });
      await shot("6-chest");
    });

    await passChestOpening(page);

    await namedStep(page, "心记进了学习记录，大怪这周不再来", async () => {
      const events = await page.evaluate(() => {
        const document = JSON.parse(localStorage.getItem("university.progress.v2") ?? "{}");
        return Object.fromEntries(
          Object.entries(document.xpEvents ?? {}).filter(([id]) => id.startsWith("weekly-boss:")),
        );
      });
      const ids = Object.keys(events);
      expect(ids.filter((id) => id.includes(":hit:"))).toHaveLength(5);
      const wins = ids.filter((id) => /^weekly-boss:\d{4}-\d{2}-\d{2}$/.test(id));
      expect(wins).toHaveLength(1);
      expect(events[wins[0]!]).toBe(50);
      expect(events[`${wins[0]}:flawless`]).toBe(0);
      expect(ids.filter((id) => id.startsWith(`${wins[0]}:location:v1:`))).toHaveLength(1);
      expect(Object.values(events).reduce<number>((sum, amount) => sum + Number(amount), 0)).toBe(
        100,
      );
      await expect(chip).toHaveCount(0);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
      await expect(page.locator("button.label--icon.is-visible").first()).toBeVisible({
        timeout: 60_000,
      });
      await expect(chip).toHaveCount(0);
    });

    const crowns = () =>
      page.evaluate(() => {
        const mesh = (window as any).three?.scene.getObjectByName("weekly-crowns");
        return mesh
          ? {
              count: mesh.count,
              weeks: mesh.userData.weeklyCrownWeeks,
              triangles: mesh.geometry.getAttribute("position").count / 3,
            }
          : null;
      });
    await expect.poll(crowns).toEqual({ count: 1, weeks: ["2026-09-28"], triangles: 156 });
    if (width === 390) await runMapCommand(page, "overview");
    await shot("7-retained-crown");
    // The next week uses last week's real study pool. No victory is written by
    // advancing the calendar, visiting Growth, or simply drawing the next species.
    await page.clock.setFixedTime(new Date("2026-10-06T12:00:00+08:00"));
    await page.reload();
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute("data-map-marker", "weekly-boss:2026-10-05");
    if (width === 390) await runMapCommand(page, "overview");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const scene = (window as any).three?.scene;
          const boss = scene?.getObjectByName("course-monster-live-frog");
          return boss?.userData.weeklyBoss
            ? {
                height: boss.userData.bodyHeight,
                crown: Boolean(boss.getObjectByName("course-monster-live-crown")),
              }
            : null;
        }),
      )
      .toEqual({ height: 2.34, crown: true });
    await expect.poll(crowns).toEqual({ count: 1, weeks: ["2026-09-28"], triangles: 156 });
    await shot("8-next-week-frog");
    await humanClick(page, page.getByRole("link", { name: "我", exact: true }), "open Me");
    await humanClick(page, page.locator('[data-me-door="growth"]'), "open Growth");
    await expect(page.locator("[data-weekly-wins]")).toHaveAttribute("data-weekly-wins", "1");
    await humanClick(
      page,
      page.locator(".weekly-boss-records summary"),
      "read the permanent weekly record",
    );
    await expect(page.locator('[data-weekly-win="2026-09-28"]')).toContainText("五连中");
    await shot("9-growth-zh");
    await page.goto(`${origin}/league?lang=en`);
    await expect(page.locator(".weekly-boss-records")).toContainText("Your weekly crowns");
    await expect(page.locator("[data-weekly-wins]")).toHaveAttribute("data-weekly-wins", "1");
    await humanClick(
      page,
      page.locator(".weekly-boss-records summary"),
      "read every won week in English",
    );
    await expect(page.locator('[data-weekly-win="2026-09-28"]')).toContainText("Five in a row");
    await shot("10-growth-en");
    expect(errors).toEqual([]);
  });
}

test("synthetic twelve-week history caps the scene, loads four species and releases owned crown resources", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  const course = `${ONLINE_ORIGIN}${coursePathOf(ROLE.course)}`;
  mkdirSync(SHOTS, { recursive: true });
  for (const [index, species] of ["boss", "frog", "crab", "yeti"].entries()) {
    await page.clock.setFixedTime(new Date(2026, 8, 29 + index * 7, 12));
    await page.goto(course);
    await expect(page.locator(".loading-trivia")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("university.progress.v2") !== null))
      .toBe(true);
    await finishUnitToday(page);
    if (index === 0)
      await page.evaluate(
        ({ study, courseId, lesson }) => {
          const key = "university.progress.v2",
            record = JSON.parse(localStorage.getItem(key)!);
          for (let n = 1; n <= 12; n++) {
            const week = new Date(Date.UTC(2026, 8, 28 - n * 7)).toISOString().slice(0, 10);
            record.xpEvents[`weekly-boss:${week}`] = 50;
            record.xpEvents[
              `weekly-boss:${week}:location:v1:${[study, courseId, lesson].map(encodeURIComponent).join("/")}`
            ] = 0;
          }
          localStorage.setItem(key, JSON.stringify(record));
        },
        { study: STUDY, courseId: COURSE, lesson: ROLE.unit.lessons[0]!.id },
      );
    await page.reload();
    const chip = page.locator('button[data-map-marker^="weekly-boss:"]');
    await expect(chip).toBeVisible();
    // A nearby ordinary guard may use the same species/name. Inspect the
    // exact weekly identity rather than getObjectByName's first same-kind rig.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const matches: { species: string; crown: boolean }[] = [];
          (window as any).three?.scene.traverse((node: any) => {
            if (node.userData.weeklyBoss === true)
              matches.push({
                species: node.userData.species,
                crown: Boolean(node.getObjectByName("course-monster-live-crown")),
              });
          });
          return matches;
        }),
      )
      .toEqual([{ species, crown: true }]);
    await humanClick(page, chip, `inspect the crowned ${species}`);
    await expect(page.locator(".weekly-boss-fight")).toBeVisible();
    await page.screenshot({ path: join(SHOTS, `synthetic-model-${species}.png`) });
    await humanClick(
      page,
      page.getByRole("button", { name: "先不打", exact: true }),
      "leave without changing this week's reward",
    );
  }
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).three?.scene.getObjectByName("weekly-crowns")?.count ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  const count = await page.evaluate(() => {
    const mesh = (window as any).three.scene.getObjectByName("weekly-crowns");
    const disposed = { mesh: 0, geometry: 0, material: 0 };
    (window as any).__weeklyCrownDisposal = disposed;
    mesh.addEventListener("dispose", () => disposed.mesh++);
    mesh.geometry.addEventListener("dispose", () => disposed.geometry++);
    mesh.material.addEventListener("dispose", () => disposed.material++);
    return mesh.count;
  });
  expect(count).toBeLessThanOrEqual(8);
  // An ordinary Me link can start a whole new document, which destroys our
  // observation context too. The real ancestor button instead retains the same
  // renderer while removing the course, proving actual resource disposal.
  await navigateMapBreadcrumb(page, "/");
  await expect
    .poll(() => page.evaluate(() => (window as any).__weeklyCrownDisposal))
    .toEqual({ mesh: 1, geometry: 1, material: 1 });
  await humanClick(page, page.getByRole("link", { name: "我", exact: true }), "open Me");
  await humanClick(page, page.locator('[data-me-door="growth"]'), "read all twelve weeks");
  await expect(page.locator("[data-weekly-wins]")).toHaveAttribute("data-weekly-wins", "12");
  await humanClick(page, page.locator(".weekly-boss-records summary"), "show all recorded wins");
  await expect(page.locator("[data-weekly-win]")).toHaveCount(12);
  await page.screenshot({ path: join(SHOTS, "synthetic-twelve-weeks.png"), fullPage: true });
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      surface: "synthetic history / actual renderer disposal",
      visibleCrowns: count,
      retainedWins: 12,
      ownedResourcesDisposed: true,
    }),
  );
});
