import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { ONLINE_ORIGIN } from "./ports.js";
import { openMapQuickActions } from "./harness/map-actions.js";
async function openRoute(page: Page) {
  const palette = await openMapQuickActions(page);
  await palette.locator('[data-map-command="route"]').click();
}
import { namedStep } from "./harness/step.js";
import { CATALOGUE_ROLES, coursePathOf } from "./harness/catalogue.js";

/**
 * 「我会了」, end to end, in a real browser.
 *
 * The unit tests prove the arithmetic — which questions may be drawn, what a
 * sitting proves, and that a proof drops no card. What they cannot prove is
 * that the two entrances V5 §12 describes actually appear on a course island
 * and that the questions arriving on screen are the course's own, because the
 * answer key reaches the browser through a build step in one campus and a
 * server in the other, and either could quietly stop sending it.
 *
 * That is what this covers: the recommendation, the three questions, the
 * verdict, and the sentence that says a skipped unit is not a learned one.
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SHOTS = fileURLToPath(new URL("../SHOTS", import.meta.url));
const SKIP_TEST = CATALOGUE_ROLES.skipTest;
const STUDY = SKIP_TEST.study.id;
const COURSE = SKIP_TEST.course.id;
/** Five lessons, every one of them carrying a question tier one can settle. */
const UNIT = SKIP_TEST.unit.id;

/**
 * The reference answers, read off the same records the importer fingerprints.
 *
 * Not a second table of answers: this reads the authored exercise revisions, so
 * an author who rewrites a question rewrites this fixture with it. A hand-typed
 * list here would be exactly the parallel question bank 决定 B refuses.
 */
function authoredAnswers(): ReadonlyMap<string, string> {
  const unitRoot = join(ROOT, "apps/local/studies", STUDY, "courses", COURSE, "units", UNIT);
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
        if (record.prompt && record.expectedAnswer) {
          answers.set(record.prompt, record.expectedAnswer);
        }
      }
    }
  };
  walk(join(unitRoot, "lessons"));
  return answers;
}

async function openCourseIsland(page: Page): Promise<void> {
  await page.goto(`${ONLINE_ORIGIN}${coursePathOf(SKIP_TEST.course)}`, {
    waitUntil: "domcontentloaded",
  });
  await namedStep(page, "等待地图铺好", async () => {
    await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
    await openRoute(page);
    await expect(page.locator("aside.picked--left")).toBeVisible({ timeout: 30_000 });
  });
  await namedStep(page, "展开学习路线", async () => {
    await humanClick(page, page.locator("details.picked__route > summary"), "学习路线");
    await humanClick(
      page,
      page.locator("details.course-route-quiz > summary"),
      "先测测你的学习起点",
    );
  });
}

/** Answer all three self-report questions with the most experienced option. */
async function reportExperience(page: Page): Promise<void> {
  for (let index = 0; index < 3; index += 1) {
    const options = page.locator(".course-route-quiz__option");
    await expect(options).toHaveCount(3);
    await humanClick(page, options.nth(2), `自述第 ${index + 1} 题`);
  }
}

async function answerOneQuestion(page: Page, answers: ReadonlyMap<string, string>): Promise<void> {
  const prompt = (await page.locator(".skip-test__prompt").first().innerText()).trim();
  const expected = answers.get(prompt);
  expect(expected, `没有这道题的参考答案：${prompt}`).toBeTruthy();
  await page.locator(".skip-test__answer").first().fill(expected!);
  await humanClick(page, page.getByRole("button", { name: "交这一题" }).first(), "交这一题");
}

/**
 * Contrast of one element's text against what is actually behind it.
 *
 * Walks up for the first ancestor with a non-transparent background and
 * composites every translucent layer on the way back down, because this panel
 * stacks four of them and a rule read off the stylesheet would report the
 * colour the author typed rather than the colour the eye receives.
 */
async function contrastOf(page: Page, selector: string): Promise<number> {
  return page.evaluate((target) => {
    const node = document.querySelector(target);
    if (!node) throw new Error(`no element for ${target}`);
    const parse = (value: string): readonly number[] => (value.match(/[\d.]+/g) ?? []).map(Number);
    const over = (top: readonly number[], bottom: readonly number[]): readonly number[] => {
      const alpha = top[3] ?? 1;
      return [0, 1, 2].map((i) => (top[i] ?? 0) * alpha + (bottom[i] ?? 0) * (1 - alpha));
    };
    const layers: (readonly number[])[] = [];
    for (let element: Element | null = node; element; element = element.parentElement) {
      const colour = parse(getComputedStyle(element).backgroundColor);
      if ((colour[3] ?? 1) === 0) continue;
      layers.push(colour);
      if ((colour[3] ?? 1) === 1) break;
    }
    let background: readonly number[] = layers.pop() ?? [255, 255, 255, 1];
    while (layers.length > 0) background = over(layers.pop()!, background);
    const text = over(parse(getComputedStyle(node).color), background);
    const luminance = (rgb: readonly number[]) =>
      0.2126 * channel(rgb[0] ?? 0) + 0.7152 * channel(rgb[1] ?? 0) + 0.0722 * channel(rgb[2] ?? 0);
    function channel(value: number): number {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }
    const a = luminance(text);
    const b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, selector);
}

test.describe("跳级：自述只缩小范围，做对题才跳过", () => {
  test("recommends units, tests them with the course's own questions, and says what a pass is not", async ({
    page,
  }) => {
    mkdirSync(SHOTS, { recursive: true });
    const console_ = watchConsole(page);
    const answers = authoredAnswers();
    expect(answers.size).toBeGreaterThanOrEqual(3);

    await openCourseIsland(page);

    /*
      V5 §12 决定 C, on the way past. This course lists 「把这个抠图应用改成你的」
      as a prerequisite and a fresh profile has finished nothing, so the island
      is one the map draws unlit — and the sentence is what a dimmed island
      cannot say on its own.

      The door is asserted open in the same breath. A notice that named the
      course and took the route quiz away would be a lock with better manners.
    */
    await namedStep(page, "灰是信息，锁是权力", async () => {
      const assumes = page.locator(".picked--left .picked__assumes");
      await expect(assumes).toContainText("这门课假定你已经做过");
      await expect(assumes).toContainText(SKIP_TEST.prerequisiteCourse.title);
      await expect(assumes).toContainText("没做过也拦不住你");
      await expect(
        page.getByRole("button", { name: new RegExp(`去：${SKIP_TEST.prerequisiteCourse.title}`) }),
      ).toBeVisible();
      // Everything below it still works: this is the same panel either way.
      await expect(page.locator("details.course-route-quiz")).toBeVisible();
      await expect(page.locator(".unit-strip__list")).toBeVisible();
    });

    /*
      决定 D's entrance, checked before the recommender's: 「每个单元入口都有一个
      『我会了』。」 It is not a consequence of having answered the opening
      questions — a learner who never opens the recommender, or who comes back a
      year later, reaches the same test from the unit card.
    */
    await namedStep(page, "单元入口自己就有「我会了」", async () => {
      await humanClick(page, page.locator(".unit-strip__list"), "先看这一单元讲什么");
      const card = page.locator(".unit-card");
      await expect(card).toBeVisible();
      await expect(card.getByRole("button", { name: "我会了" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(card).toHaveCount(0);
      // The full unit preview is modal; closing it returns to the map, where
      // the on-demand route still retains the learner's disclosure/input state.
      await openRoute(page);
    });

    await reportExperience(page);

    await namedStep(page, "自述只给出建议，不解锁", async () => {
      await expect(page.locator(".course-route-quiz__result")).toContainText(
        "看起来你可以跳过前面",
      );
      await expect(page.locator(".course-route-quiz__result")).toContainText(
        "回答这几个问题本身不会跳过任何一节课",
      );
      /*
        决定 A, checked where it would actually be printed: the result branch.
        These three names were this component's headline until the rework.
      */
      const result = await page.locator(".course-route-quiz__result").innerText();
      for (const label of ["从零开始", "有一点基础", "有开发经验"]) {
        expect(result).not.toContain(label);
      }
    });
    // In context, not element-cropped: this panel is translucent, so a crop
    // composites it over white and reports colours the product never shows.
    await page.screenshot({ path: join(SHOTS, "skip-test-recommendation.png") });

    await namedStep(page, "做这一单元自己的三道题", async () => {
      await humanClick(page, page.getByRole("button", { name: "我会了" }).first(), "我会了");
      for (let index = 0; index < 3; index += 1) {
        await expect(page.locator(".skip-test__progress").first()).toContainText(
          `第 ${index + 1} / 3 题`,
        );
        await answerOneQuestion(page, answers);
      }
    });

    await namedStep(page, "全对之后，说清楚这不算学过", async () => {
      const settled = page.locator(".skip-test--settled").first();
      await expect(settled).toContainText("三道全对");
      await expect(settled).toContainText("跳过不等于学过");
      await expect(settled).toContainText("复习卡不会进你的复习队列");
    });
    await page.screenshot({ path: join(SHOTS, "skip-test-passed.png") });

    /*
      The sentence 决定 E owes the learner, measured rather than admired.

      This panel's older rules are a dark palette written before the campus had
      two themes, so the copy beside this one renders as pale mint on pale green
      in the light campus. New copy that quietly joined it would be a promise
      nobody can read — which is the same as no promise. 4.5:1 is the floor
      `check-contrast.mjs` holds the rest of the product to; this one is
      measured in the browser because its background is four translucent layers
      deep and only a real composite knows what it came out as.
    */
    await namedStep(page, "这一面板上的字都要真的读得清", async () => {
      /*
        Every line on the panel, not only the new ones. Checking just the skip
        test's own copy would have gone green with the sentence beside it — the
        recommendation itself — still at 3.2:1, which is the gate not looking at
        what it guards.
      */
      for (const selector of [
        ".skip-test__note",
        ".skip-test__verdict",
        ".course-route-quiz__result h4",
        ".course-route-quiz__reason",
        ".course-route-quiz__note",
        ".course-route-quiz__result-label",
        ".course-route-quiz__unit-name",
        ".course-route-quiz__summary-meta",
      ]) {
        expect(await contrastOf(page, selector), `${selector} 的对比度`).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    });

    await namedStep(page, "证明过的单元没有往复习队列里放卡片", async () => {
      const stored = await page.evaluate(() => {
        const raw = window.localStorage.getItem("university.progress.v2");
        const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        return {
          proven: Object.keys((parsed.provenLessons as object) ?? {}),
          cards: Object.keys((parsed.cards as object) ?? {}),
          lessons: Object.keys((parsed.lessons as object) ?? {}),
        };
      });
      expect(stored.proven.length).toBe(5);
      /*
        V5 §12 决定 E, asserted as the negative fact. A card here would be a
        card that comes back in three weeks quoting prose nobody has read.
      */
      expect(stored.cards).toEqual([]);
      expect(stored.lessons).toEqual([]);
    });

    console_.assertClean();
  });
});

/*
  The same panel in the night campus.

  The literals this sheet used to carry were a dark palette, so the light
  campus was the broken one and the tokens that fixed it could just as easily
  have broken the dark. Contrast is measured on both, and the numbers come from
  a real composite in each theme rather than from reading the stylesheet twice.
*/
test.describe("跳级面板：深色校园", () => {
  test.use({ colorScheme: "dark" });

  test("stays legible when the campus is dark", async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true });
    await openCourseIsland(page);
    await reportExperience(page);
    await expect(page.locator(".course-route-quiz__result")).toContainText("看起来你可以跳过前面");
    await humanClick(page, page.getByRole("button", { name: "我会了" }).first(), "我会了");
    await expect(page.locator(".skip-test__prompt").first()).toBeVisible();

    await namedStep(page, "深色下也读得清", async () => {
      for (const selector of [
        ".skip-test__prompt",
        ".skip-test__label",
        ".course-route-quiz__result h4",
        ".course-route-quiz__reason",
        ".course-route-quiz__note",
        ".course-route-quiz__summary-meta",
      ]) {
        expect(await contrastOf(page, selector), `${selector} 的对比度`).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    });
    await page.screenshot({ path: join(SHOTS, "skip-test-dark.png") });
  });
});
