import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { ONLINE_ORIGIN } from "../ports.js";
import { humanClick } from "./click.js";
import { TODAY_CTA, waitForMapReady } from "./online-learner.js";

type ShelfLesson = {
  readonly id: string;
  readonly title: string;
  readonly exerciseCount?: number;
  readonly evidenceLocators?: readonly string[];
};

type ShelfCourse = {
  readonly id: string;
  readonly title: string;
  readonly units: readonly {
    readonly id: string;
    readonly lessons: readonly ShelfLesson[];
  }[];
};

type ExperienceShelf = {
  readonly studies: readonly {
    readonly id: string;
    readonly title: string;
    readonly courses: readonly ShelfCourse[];
  }[];
};

type ShelfEntry = {
  readonly study: ExperienceShelf["studies"][number];
  readonly course: ShelfCourse;
  readonly unit: ShelfCourse["units"][number];
  readonly lesson: ShelfLesson;
};

export interface ExperienceFixture {
  readonly studyId: string;
  readonly studyTitle: string;
  readonly courseId: string;
  readonly courseTitle: string;
  readonly courseNextLessonTitle: string;
  readonly unitId: string;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly coursePath: string;
  readonly lessonPath: string;
}

const EXPERIENCE_FIXTURES = new WeakMap<Page, Promise<ExperienceFixture>>();

function hasShortEvidence(lesson: ShelfLesson): boolean {
  return (lesson.evidenceLocators ?? []).some((locator) => {
    const match = /:(\d+)(?:-(\d+))?$/u.exec(locator.trim());
    if (!match) return false;
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    return (
      Number.isInteger(start) && Number.isInteger(end) && end >= start && end - start + 1 <= 16
    );
  });
}

function hasSingleEvidence(lesson: ShelfLesson): boolean {
  const locators = lesson.evidenceLocators ?? [];
  return locators.length === 1;
}

function isCourseStart(entry: ShelfEntry): boolean {
  const firstUnit = entry.course.units[0];
  return firstUnit?.id === entry.unit.id && firstUnit.lessons[0]?.id === entry.lesson.id;
}

function nonEmptyShelfId(value: string, label: string): string {
  expect(value.trim().length, `${label} 不能为空`).toBeGreaterThan(0);
  return value;
}

async function readExperienceFixture(page: Page): Promise<ExperienceFixture> {
  const response = await page.request.get(`${ONLINE_ORIGIN}/content/shelf.json`);
  expect(response.ok(), `实际发布货架读取失败：HTTP ${response.status()}`).toBe(true);
  const shelf = (await response.json()) as ExperienceShelf;

  const entries: ShelfEntry[] = (shelf.studies ?? []).flatMap((study) =>
    (study.courses ?? []).flatMap((course) =>
      course.units.flatMap((unit) =>
        unit.lessons.map((lesson) => ({ study, course, unit, lesson })),
      ),
    ),
  );
  const eligible = (entry: (typeof entries)[number]) =>
    (entry.lesson.exerciseCount ?? 0) > 0 && hasShortEvidence(entry.lesson);
  // Prefer a released one-snippet lesson so the journey has one source entry
  // to exercise without making the fixture depend on a course or lesson id.
  // If that lesson is retired, the fallback still follows a complete lesson
  // from the shelf, and the course-start pass keeps the course page's own
  // "next lesson" contract available to N2.
  const selected =
    entries.find((entry) => eligible(entry) && hasSingleEvidence(entry.lesson)) ??
    entries.find((entry) => eligible(entry) && isCourseStart(entry)) ??
    entries.find(eligible);
  if (selected) {
    const studyId = nonEmptyShelfId(selected.study.id, "货架 study id");
    const courseId = nonEmptyShelfId(selected.course.id, "货架课程 id");
    const unitId = nonEmptyShelfId(selected.unit.id, "货架 unit id");
    const lessonId = nonEmptyShelfId(selected.lesson.id, "货架 lesson id");
    const courseNextLesson = selected.course.units.flatMap((unit) => unit.lessons)[0];
    expect(courseNextLesson?.title.trim().length, "货架课程下一节标题不能为空").toBeGreaterThan(0);
    expect(selected.course.title.trim().length, "货架课程标题不能为空").toBeGreaterThan(0);
    expect(selected.lesson.title.trim().length, "货架课文标题不能为空").toBeGreaterThan(0);

    const coursePath = `/${encodeURIComponent(studyId)}/${encodeURIComponent(courseId)}`;
    return {
      studyId,
      studyTitle: selected.study.title,
      courseId,
      courseTitle: selected.course.title,
      courseNextLessonTitle: courseNextLesson!.title,
      unitId,
      lessonId,
      lessonTitle: selected.lesson.title,
      coursePath,
      lessonPath: `${coursePath}/${encodeURIComponent(unitId)}/${encodeURIComponent(lessonId)}`,
    };
  }

  throw new Error("实际发布货架没有找到同时带练习和短源码证据的课文");
}

/**
 * Select one complete lesson journey from the delivery shelf, not from a
 * course id kept in the test source. The shelf is the release boundary: a
 * stale course is absent here by design, and the probe follows what is
 * actually available to a learner.
 */
export function getExperienceFixture(page: Page): Promise<ExperienceFixture> {
  const existing = EXPERIENCE_FIXTURES.get(page);
  if (existing) return existing;

  let pending: Promise<ExperienceFixture>;
  pending = readExperienceFixture(page).catch((reason: unknown) => {
    if (EXPERIENCE_FIXTURES.get(page) === pending) EXPERIENCE_FIXTURES.delete(page);
    throw reason;
  });
  EXPERIENCE_FIXTURES.set(page, pending);
  return pending;
}

export const EXPERIENCE_VIEWPORTS = [
  { id: "desktop", width: 1280, height: 640 },
  { id: "phone", width: 375, height: 812 },
] as const;

export const AXE_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
] as const;

const AXE_BASELINE_PATH = fileURLToPath(new URL("../axe-baseline.json", import.meta.url));
const VISIBLE_DIALOGS = 'dialog:visible, [role="dialog"]:visible, [role="alertdialog"]:visible';

export type ExperienceViewport = (typeof EXPERIENCE_VIEWPORTS)[number];

export interface ExperienceTarget {
  readonly id: string;
  readonly label: string;
  readonly locate: (page: Page) => Locator;
  readonly scrollToLessonBottom?: boolean;
  readonly prepare?: (page: Page) => Promise<void>;
}

export interface ExperienceRoute {
  readonly id: string;
  readonly label: string;
  readonly path: string | ((page: Page) => Promise<string>);
  readonly ready: (page: Page) => Promise<void>;
  readonly primary: ExperienceTarget | null;
  readonly coverage: readonly ExperienceTarget[];
  readonly returnToWorld: (page: Page) => Promise<void>;
  readonly noPrimaryReason?: string;
}

const WORLD_PRIMARY: ExperienceTarget = {
  id: "today-lesson",
  label: "今天这一课",
  locate: (page) => page.getByRole("button", { name: TODAY_CTA }).first(),
};

const LIBRARY_PRIMARY: ExperienceTarget = {
  id: "library-first-entry",
  label: "图鉴第一条概念",
  locate: (page) => page.locator(".term-index__hit:visible").first(),
};

const PRACTICE_PRIMARY: ExperienceTarget = {
  id: "practice-start",
  label: "开始一道判断",
  locate: (page) => page.getByRole("button", { name: "开始一道判断" }),
};

const PLANS_PRIMARY: ExperienceTarget = {
  id: "plans-purchase",
  label: "会员购买",
  /*
   * Structure, not wording. This probe used to look for a button named 购买
   * and went red the day the label became 先绑定邮箱 / 记录购买意向 / 先登录 —
   * a deliberate change, correctly made, that the probe reported as a defect.
   * A cross-screen invariant must survive copy edits or it trains you to
   * ignore it. What must hold is that the paid card carries a call to action.
   */
  locate: (page) => page.locator(".plan-card button.liquid-cta__button").first(),
};

/*
 * The cancellation reassurance is deliberately not a coverage target.
 *
 * It was one, pinned to the semantic hook rather than the wording, and it
 * passed — because the sentence used to render on every paid card. This suite
 * runs without an order channel, so the state it kept proving visible is
 * exactly the state the sentence must not appear in: nothing can be charged,
 * the CTA reads 记录购买意向, and a promise to stop billing has no referent.
 * The probe was holding the defect in place.
 *
 * Both directions now live in PlansScreen.test.tsx, which asserts the sentence
 * is present when the transport can create an order and absent when it cannot.
 * That is a stronger claim than a visibility check that only ever ran on one
 * side. See ledger 6a7233dd70ba; the remaining guard to write is the one that
 * makes purchaseAvailability itself require a cancellation path.
 */

const PROFILE_PRIMARY: ExperienceTarget = {
  id: "profile-sign-in",
  label: "账号登录",
  /*
   * /me has two legitimate shapes: with a backend configured it draws a real
   * sign-in form, and without one it draws a control explaining why. This
   * pins the configured shape on purpose. The site shipped for four days in
   * the other one — 云端账号还未配置, no way in, and therefore no way to pay —
   * and a probe that accepted both would have stayed green through all of it.
   */
  locate: (page) => page.locator('.account-panel form button[type="submit"]').first(),
};

const REVIEW_PRIMARY: ExperienceTarget = {
  id: "review-today-lesson",
  label: "复习页今天这一课",
  locate: (page) => page.getByRole("button", { name: TODAY_CTA }).first(),
};

const LESSON_COMPLETION: ExperienceTarget = {
  id: "lesson-completion",
  label: "课文阅读确认",
  /*
   * Structure, not wording. The control used to be named 完成本次更新 and is
   * now 我读完了 — same action, clearer promise. Pinning the label trained
   * the probe to treat a copy fix as a regression.
   */
  locate: (page) => page.locator("section.lesson-completion .liquid-cta__button").first(),
  scrollToLessonBottom: true,
};

const LESSON_ANSWER: ExperienceTarget = {
  id: "lesson-bottom-answer",
  label: "长课底部输入框",
  locate: (page) => page.getByRole("textbox", { name: "你的答案" }).first(),
  scrollToLessonBottom: true,
};

const LESSON_SUBMIT: ExperienceTarget = {
  id: "lesson-bottom-submit",
  label: "长课底部提交按钮",
  locate: (page) => page.getByRole("button", { name: "提交" }).first(),
  scrollToLessonBottom: true,
};

async function readyWorld(page: Page): Promise<void> {
  await waitForMapReady(page);
}

async function readyShellHeading(page: Page, name: string | RegExp): Promise<void> {
  await expect(page.getByRole("heading", { name })).toBeVisible({ timeout: 30_000 });
}

async function readyLibrary(page: Page): Promise<void> {
  await readyShellHeading(page, "概念图解");
  await expect(LIBRARY_PRIMARY.locate(page)).toBeVisible({ timeout: 30_000 });
}

async function readyPractice(page: Page): Promise<void> {
  await readyShellHeading(page, "今天适合练吗？");
  await expect(PRACTICE_PRIMARY.locate(page)).toBeVisible({ timeout: 30_000 });
}

async function readyPlans(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "会员", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await expect(PLANS_PRIMARY.locate(page)).toBeVisible({ timeout: 30_000 });
}

async function readyProfile(page: Page): Promise<void> {
  await expect(page.locator(".account-panel")).toBeVisible({ timeout: 30_000 });
  await expect(PROFILE_PRIMARY.locate(page)).toBeVisible({ timeout: 30_000 });
}

async function readyReview(page: Page): Promise<void> {
  await expect(page.locator(".review-page")).toBeVisible({ timeout: 30_000 });
  await expect(REVIEW_PRIMARY.locate(page)).toBeVisible({ timeout: 30_000 });
}

async function readyLesson(page: Page): Promise<void> {
  await expect(page.locator(".lesson-reader__header")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".lesson-next")).toBeVisible({ timeout: 30_000 });
}

async function returnFromShellRoute(page: Page, label: string): Promise<void> {
  const map = page.getByRole("link", { name: "学习" }).first();
  await expect(map, `${label} 没有可见的学习地图入口`).toBeVisible();
  await humanClick(page, map, `${label} 回到学习地图`);
  await expect(page).toHaveURL(`${ONLINE_ORIGIN}/`);
  await waitForMapReady(page);
}

async function returnFromLesson(page: Page): Promise<void> {
  const fixture = await getExperienceFixture(page);
  await humanClick(page, page.getByRole("button", { name: "离开课文" }), "课文离开");
  await expect(page).toHaveURL(new RegExp(`${fixture.coursePath.replaceAll("/", "\\/")}$`));
  const map = page.getByRole("button", { name: /回到 .*地图/ });
  await expect(map).toBeVisible({ timeout: 30_000 });
  await humanClick(page, map, "课程地图返回世界");
  await expect(page).toHaveURL(`${ONLINE_ORIGIN}/`);
  await waitForMapReady(page);
}

const SHELL_RETURN = (label: string) => (page: Page) => returnFromShellRoute(page, label);

export const EXPERIENCE_ROUTES: readonly ExperienceRoute[] = [
  {
    id: "world",
    label: "世界地图",
    path: "/",
    ready: readyWorld,
    primary: WORLD_PRIMARY,
    coverage: [WORLD_PRIMARY],
    returnToWorld: async (page) => {
      await expect(page).toHaveURL(`${ONLINE_ORIGIN}/`);
    },
  },
  {
    id: "library",
    label: "图鉴",
    path: "/library",
    ready: readyLibrary,
    primary: LIBRARY_PRIMARY,
    coverage: [LIBRARY_PRIMARY],
    returnToWorld: SHELL_RETURN("图鉴"),
  },
  {
    id: "practice",
    label: "练习",
    path: "/practice",
    ready: readyPractice,
    primary: PRACTICE_PRIMARY,
    coverage: [PRACTICE_PRIMARY],
    returnToWorld: SHELL_RETURN("练习"),
  },
  {
    id: "league",
    label: "排行榜",
    path: "/league",
    ready: (page) => readyShellHeading(page, "排行榜"),
    primary: null,
    coverage: [],
    returnToWorld: SHELL_RETURN("排行榜"),
    noPrimaryReason: "当前排行榜只有个人段位和说明，没有需要学习者立即执行的主 CTA。",
  },
  {
    id: "quests",
    label: "任务",
    path: "/quests",
    ready: (page) => readyShellHeading(page, "今天"),
    primary: null,
    coverage: [],
    returnToWorld: SHELL_RETURN("任务"),
    noPrimaryReason: "当前任务页只有每日状态列表，没有需要学习者立即执行的主 CTA。",
  },
  {
    id: "plans",
    label: "会员",
    path: "/plans",
    ready: readyPlans,
    primary: PLANS_PRIMARY,
    coverage: [PLANS_PRIMARY],
    returnToWorld: SHELL_RETURN("会员"),
  },
  {
    id: "me",
    label: "个人档案",
    path: "/me",
    ready: readyProfile,
    primary: PROFILE_PRIMARY,
    coverage: [PROFILE_PRIMARY],
    returnToWorld: SHELL_RETURN("个人档案"),
  },
  {
    id: "review",
    label: "复习",
    path: "/review",
    ready: readyReview,
    primary: REVIEW_PRIMARY,
    coverage: [REVIEW_PRIMARY],
    returnToWorld: SHELL_RETURN("复习"),
  },
  {
    id: "lesson",
    label: "课文",
    path: (page) => getExperienceFixture(page).then((fixture) => fixture.lessonPath),
    ready: readyLesson,
    primary: LESSON_COMPLETION,
    coverage: [LESSON_COMPLETION, LESSON_ANSWER, LESSON_SUBMIT],
    returnToWorld: returnFromLesson,
  },
] as const;

type AxeBaselineEntry = {
  readonly key: string;
  readonly route: string;
  readonly viewport: string;
  readonly id: string;
  readonly impact: string | null;
  readonly target: string;
  readonly description: string;
};

type AxeBaseline = {
  readonly version: 1;
  readonly tags: readonly string[];
  readonly violations: readonly AxeBaselineEntry[];
};

export type AxeFinding = AxeBaselineEntry;

function readAxeBaseline(): AxeBaseline {
  return JSON.parse(readFileSync(AXE_BASELINE_PATH, "utf8")) as AxeBaseline;
}

function axeTargetText(target: string | readonly string[]): string {
  return typeof target === "string" ? target : target.join(" ");
}

function stableAxeTarget(target: string): string {
  // Evidence selectors contain lesson-owned paths, line ranges, occurrence
  // numbers, and React's generated ids. Those identify the cited source, not
  // a different UI control. Keep the semantic element and its failing role so
  // a lesson revision cannot turn the same known contrast issue into a false
  // "new" violation merely by changing its evidence list.
  if (target.includes(".evidence-inline-source__path")) {
    return "<evidence-source> > .evidence-inline-source__path";
  }
  if (target.includes(".evidence-inline-source__commit > code")) {
    return "<evidence-source> > .evidence-inline-source__commit > code";
  }
  if (target.includes(".evidence-inline-source__error")) {
    return `<evidence-source> > ${target.slice(target.indexOf(".evidence-inline-source__error"))}`;
  }
  if (
    target.includes("button[data-evidence-trigger-id") ||
    target.includes("button[data-evidence-index") ||
    target.endsWith(".evidence-inline-source__open")
  ) {
    return "<evidence-source-trigger>";
  }
  return target;
}

function axeFindingKey(route: string, viewport: string, id: string, target: string): string {
  return `${route}|${viewport}|${id}|${stableAxeTarget(target)}`;
}

export async function auditAxeBaseline(
  page: Page,
  route: ExperienceRoute,
  viewport: ExperienceViewport,
): Promise<{ readonly current: readonly AxeFinding[]; readonly stale: readonly AxeFinding[] }> {
  const result = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();
  const current = result.violations.flatMap((violation) =>
    violation.nodes.map((node) => {
      const target = axeTargetText(node.target[0] ?? "<unknown>");
      return {
        key: axeFindingKey(route.id, viewport.id, violation.id, target),
        route: route.id,
        viewport: viewport.id,
        id: violation.id,
        impact: violation.impact ?? null,
        target,
        description: `${violation.help}: ${violation.description}`.replace(/\s+/gu, " ").trim(),
      };
    }),
  );
  const baseline = readAxeBaseline();
  expect(baseline.tags).toEqual(expect.arrayContaining([...AXE_TAGS]));
  const scopedBaseline = baseline.violations.filter(
    (entry) => entry.route === route.id && entry.viewport === viewport.id,
  );
  const known = new Set(
    scopedBaseline.map((entry) => axeFindingKey(route.id, viewport.id, entry.id, entry.target)),
  );
  const fresh = current.filter((entry) => !known.has(entry.key));
  const stale = scopedBaseline.filter(
    (entry) =>
      !current.some(
        (item) => item.key === axeFindingKey(route.id, viewport.id, entry.id, entry.target),
      ),
  );

  expect(
    current.length,
    `axe baseline 只能缩小：${route.id}/${viewport.id} 当前 ${current.length} 项，baseline 有 ${scopedBaseline.length} 项。`,
  ).toBeLessThanOrEqual(scopedBaseline.length);
  expect(
    fresh,
    `发现新的 axe 违规（${route.id}/${viewport.id}）：\n${fresh
      .map(
        (entry) =>
          `${entry.id} [${entry.impact ?? "unknown"}] ${entry.target} — ${entry.description}`,
      )
      .join("\n")}`,
  ).toEqual([]);

  return { current, stale };
}

/*
  Empty, and it should stay that way as long as it can. It held two entries on
  2026-08-31 — /practice's primary CTA at 40px tall, and the floating 提意见
  pill 38.5px from its centre. Both were retired by fixes rather than by
  argument: `min-height: 44px` on `.liquid-cta__button`, and moving the pill to
  the bottom-right on phones, away from the corner every primary action uses.

  An exemption that outlives its defect is a hole in the probe, so a row here
  has to be removed the moment its fix lands, not left as documentation.
*/
export const TOUCH_TARGET_EXEMPTIONS: readonly {
  readonly id: string;
  readonly routeId: string;
  readonly selector: string;
  readonly reason: string;
}[] = [];

export async function openExperienceRoute(
  page: Page,
  route: ExperienceRoute,
  viewport: ExperienceViewport,
): Promise<void> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const path = typeof route.path === "function" ? await route.path(page) : route.path;
  await page.goto(`${ONLINE_ORIGIN}${path}`, { waitUntil: "domcontentloaded" });
  await route.ready(page);
}

export async function openCoursePage(page: Page, viewport: ExperienceViewport): Promise<void> {
  const fixture = await getExperienceFixture(page);
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${ONLINE_ORIGIN}${fixture.coursePath}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".picked--left")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("button.label").first()).toBeVisible({ timeout: 60_000 });
}

export async function openCoursePickDialog(
  page: Page,
  viewport: ExperienceViewport,
): Promise<Locator> {
  await openExperienceRoute(page, EXPERIENCE_ROUTES[0]!, viewport);
  const label = page.locator("button.label.label--course.is-visible").first();
  await expect(label).toBeVisible({ timeout: 30_000 });
  await humanClick(page, label, "地图课程岛");
  const dialog = page.locator('.picked--follow[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

export async function openCourseNodeDialog(
  page: Page,
  viewport: ExperienceViewport,
): Promise<Locator> {
  await openCoursePage(page, viewport);
  const start = page.locator("button.label", { hasText: /^开始$/ }).first();
  await expect(start).toBeVisible({ timeout: 60_000 });
  await humanClick(page, start, "课程路径第一关");
  const dialog = page.locator('.path-card[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

export async function openCourseUnitDialog(
  page: Page,
  viewport: ExperienceViewport,
): Promise<Locator> {
  await openCoursePage(page, viewport);
  const trigger = page.getByRole("button", { name: "先看这一单元讲什么" });
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await humanClick(page, trigger, "课程单元说明");
  const dialog = page.locator('.path-card[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

export async function openAccountDialog(
  page: Page,
  viewport: ExperienceViewport,
): Promise<Locator> {
  const route = EXPERIENCE_ROUTES.find((candidate) => candidate.id === "me")!;
  await openExperienceRoute(page, route, viewport);
  const trigger = PROFILE_PRIMARY.locate(page);
  await trigger.scrollIntoViewIfNeeded();
  await humanClick(page, trigger, "账号说明");
  const dialog = page.locator(VISIBLE_DIALOGS).last();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

export async function openPlansDialog(page: Page, viewport: ExperienceViewport): Promise<Locator> {
  const route = EXPERIENCE_ROUTES.find((candidate) => candidate.id === "plans")!;
  await openExperienceRoute(page, route, viewport);
  const trigger = PLANS_PRIMARY.locate(page);
  await trigger.scrollIntoViewIfNeeded();
  await humanClick(page, trigger, "会员购买");
  const dialog = page.locator(VISIBLE_DIALOGS).last();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

export async function openLibraryDialog(
  page: Page,
  viewport: ExperienceViewport,
): Promise<Locator> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${ONLINE_ORIGIN}/library/terms`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "词义索引" })).toBeVisible({ timeout: 30_000 });
  const term = page.locator(".term-index__hit:visible").first();
  await expect(term).toBeVisible({ timeout: 30_000 });
  await humanClick(page, term, "图鉴第一条词义");
  const dialog = page.locator(VISIBLE_DIALOGS).last();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

export async function openFeedbackDialog(
  page: Page,
  viewport: ExperienceViewport,
): Promise<Locator> {
  await openExperienceRoute(page, EXPERIENCE_ROUTES[0]!, viewport);
  const trigger = page.locator('button[aria-haspopup="dialog"]:visible', { hasText: "提意见" });
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await humanClick(page, trigger, "提意见");
  const dialog = page.locator(VISIBLE_DIALOGS).last();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

export async function openLessonSourceDialog(
  page: Page,
  viewport: ExperienceViewport,
): Promise<Locator> {
  const route = EXPERIENCE_ROUTES.find((candidate) => candidate.id === "lesson")!;
  await openExperienceRoute(page, route, viewport);
  const trigger = page.locator(".evidence-inline-source__open:visible").first();
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await humanClick(page, trigger, "看完整文件");
  const dialog = page.locator(VISIBLE_DIALOGS).last();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

export async function openLessonLayerDialog(
  page: Page,
  viewport: ExperienceViewport,
): Promise<Locator> {
  const route = EXPERIENCE_ROUTES.find((candidate) => candidate.id === "lesson")!;
  await openExperienceRoute(page, route, viewport);
  const trigger = page.locator("[data-parity-control='lesson-layer-coverage']");
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await expect(trigger).toBeEnabled({ timeout: 15_000 });
  await humanClick(page, trigger, "项目分层入口");
  const dialog = page.locator(VISIBLE_DIALOGS).last();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

export async function openWordDialog(page: Page, viewport: ExperienceViewport): Promise<Locator> {
  const route = EXPERIENCE_ROUTES.find((candidate) => candidate.id === "lesson")!;
  await openExperienceRoute(page, route, viewport);
  const trigger = page.locator(".word-anchor__trigger:visible").first();
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await humanClick(page, trigger, "正文词义");
  const dialog = page.locator(VISIBLE_DIALOGS).last();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

export async function closeVisibleDialog(
  page: Page,
  dialog: Locator,
  label: string,
): Promise<"control" | "escape"> {
  const dialogs = page.locator(VISIBLE_DIALOGS);
  const beforeCount = await dialogs.count();
  if (beforeCount === 0) throw new Error(`${label}: 没有可见 dialog`);

  const controls = dialog.locator('button, [role="button"], a[href]');
  const exitIndex = await controls.evaluateAll((elements) => {
    const controlName = (element: Element) =>
      (
        element.getAttribute("aria-label") ??
        element.getAttribute("title") ??
        element.textContent ??
        ""
      )
        .replace(/\s+/gu, " ")
        .trim();
    const looksLikeExit = (element: Element) =>
      /(关闭|收起|返回|回到|离开|取消|知道了|退出)/u.test(controlName(element));
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number.parseFloat(style.opacity) > 0 &&
        box.width >= 44 &&
        box.height >= 44
      );
    };
    return elements.findIndex((element) => looksLikeExit(element) && visible(element));
  });

  if (exitIndex >= 0) {
    const control = controls.nth(exitIndex);
    try {
      await assertVisibleAndHittableAtFivePoints(page, control, `${label}关闭控件`);
      await humanClick(page, control, `${label}关闭控件`);
      await expect.poll(() => dialogs.count(), { timeout: 1_000 }).toBeLessThan(beforeCount);
      return "control";
    } catch {
      // Esc is an equally valid exit path. Keep checking it when a visible
      // control exists but does not complete the dismissal.
    }
  }

  await page.keyboard.press("Escape");
  await expect.poll(() => dialogs.count(), { timeout: 1_000 }).toBeLessThan(beforeCount);
  return "escape";
}

export async function scrollLessonToBottom(page: Page): Promise<void> {
  const reader = page.locator("main.reader").first();
  await expect(reader).toBeVisible();
  await reader.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect
    .poll(() =>
      reader.evaluate((node) => node.scrollTop >= node.scrollHeight - node.clientHeight - 1),
    )
    .toBe(true);
}

export async function prepareCoverageTarget(
  page: Page,
  target: ExperienceTarget,
): Promise<Locator> {
  if (target.prepare) await target.prepare(page);
  if (target.scrollToLessonBottom) await scrollLessonToBottom(page);
  const locator = target.locate(page);
  await expect(locator, `${target.label} 不在 DOM 中`).toHaveCount(1);
  await locator.scrollIntoViewIfNeeded();
  return locator;
}

export function elementSelector(element: Element | null): string {
  if (!element) return "<空>";
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const classes =
    typeof (element as HTMLElement).className === "string"
      ? (element as HTMLElement).className
          .trim()
          .split(/\s+/u)
          .filter(Boolean)
          .slice(0, 4)
          .map((name) => `.${name}`)
          .join("")
      : "";
  return `${tag}${id}${classes}`;
}

export type HitTestExpectation = "target" | "pass-through";

export async function assertVisibleAndHittableAtFivePoints(
  page: Page,
  target: Locator,
  label: string,
  options: { readonly hitTest?: HitTestExpectation } = {},
): Promise<void> {
  const count = await target.count();
  if (count === 0) throw new Error(`${label}: DOM 中找不到元素`);
  const handle = await target.first().elementHandle();
  if (!handle) throw new Error(`${label}: 找不到元素句柄`);
  const box = await target.boundingBox();
  if (!box) {
    await handle.dispose();
    throw new Error(`${label}: 没有屏幕矩形`);
  }

  // Twelve pixels keeps the sample inside the visible corner of the product's
  // pill-shaped controls. Eight pixels was still outside a 70px-high pill and
  // reported its parent <li> as a false overlay.
  const inset = Math.max(2, Math.min(12, box.width / 4, box.height / 4));
  const points = [
    { name: "中心", x: box.x + box.width / 2, y: box.y + box.height / 2 },
    { name: "左上", x: box.x + inset, y: box.y + inset },
    { name: "右上", x: box.x + box.width - inset, y: box.y + inset },
    { name: "左下", x: box.x + inset, y: box.y + box.height - inset },
    { name: "右下", x: box.x + box.width - inset, y: box.y + box.height - inset },
  ];

  const hitTest = options.hitTest ?? "target";
  const inspection = await page.evaluate(
    ({ node, points, hitTest }) => {
      const selector = (element: Element | null) => {
        if (!element) return "<空>";
        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : "";
        const className = (element as HTMLElement).className;
        const classes =
          typeof className === "string"
            ? className
                .trim()
                .split(/\s+/u)
                .filter(Boolean)
                .slice(0, 4)
                .map((name) => `.${name}`)
                .join("")
            : "";
        return `${tag}${id}${classes}`;
      };

      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const opacity = Number.parseFloat(style.opacity);
      const painted =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.visibility !== "collapse" &&
        opacity > 0 &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < innerWidth &&
        rect.top < innerHeight;

      return {
        target: selector(node),
        painted,
        display: style.display,
        visibility: style.visibility,
        opacity,
        pointerEvents: style.pointerEvents,
        hits: points.map((point) => {
          const hit = document.elementFromPoint(point.x, point.y);
          const isTarget = Boolean(hit && (hit === node || node.contains(hit)));
          return { point: point.name, isTarget, hit: selector(hit) };
        }),
        hitTest,
      };
    },
    { node: handle, points, hitTest },
  );
  await handle.dispose();

  if (!inspection.painted) {
    throw new Error(
      `${label}: 在 DOM 中但不可见（display=${inspection.display}, ` +
        `visibility=${inspection.visibility}, opacity=${inspection.opacity}, ` +
        `pointer-events=${inspection.pointerEvents}）`,
    );
  }

  const blocked = inspection.hits.filter((hit) =>
    hitTest === "target" ? !hit.isTarget : hit.isTarget,
  );
  if (blocked.length > 0) {
    const expectation = hitTest === "target" ? "被遮挡" : "没有透传点击";
    throw new Error(
      `${label}: ${expectation}（target=${inspection.target}）\n` +
        blocked.map((hit) => `  · ${hit.point}: ${hit.hit}`).join("\n"),
    );
  }

  if (hitTest === "pass-through" && inspection.pointerEvents !== "none") {
    throw new Error(`${label}: 可见提示必须 pointer-events:none，不能抢走地图点击`);
  }
}

export async function touchTargetViolations(
  page: Page,
  routeId: string,
): Promise<
  readonly {
    readonly routeId: string;
    readonly target: string;
    readonly label: string;
    readonly width: number;
    readonly height: number;
    readonly nearestCenterDistance: number;
  }[]
> {
  return page.evaluate((currentRouteId) => {
    const selector = 'button, a, input, textarea, select, [role="button"], [tabindex]';
    const visible = (node: Element) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number.parseFloat(style.opacity) > 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const label = (node: Element) =>
      (node.getAttribute("aria-label") ?? node.getAttribute("title") ?? node.textContent ?? "")
        .replace(/\s+/gu, " ")
        .trim()
        .slice(0, 100);
    const nodes = [...document.querySelectorAll(selector)].filter(visible);
    const rects = nodes.map((node) => node.getBoundingClientRect());
    return nodes.flatMap((node, index) => {
      const rect = rects[index]!;
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const nearestCenterDistance = Math.min(
        ...rects
          .map((other, otherIndex) =>
            otherIndex === index
              ? Number.POSITIVE_INFINITY
              : Math.hypot(
                  center.x - (other.left + other.width / 2),
                  center.y - (other.top + other.height / 2),
                ),
          )
          .filter(Number.isFinite),
      );
      if ((rect.width >= 44 && rect.height >= 44) || nearestCenterDistance >= 44) return [];
      return [
        {
          routeId: currentRouteId,
          target: `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${
            typeof (node as HTMLElement).className === "string"
              ? (node as HTMLElement).className
                  .trim()
                  .split(/\s+/u)
                  .filter(Boolean)
                  .slice(0, 4)
                  .map((name) => `.${name}`)
                  .join("")
              : ""
          }`,
          label: label(node),
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
          nearestCenterDistance: Math.round(nearestCenterDistance * 10) / 10,
        },
      ];
    });
  }, routeId);
}

export async function clickAndMeasureResponse(
  page: Page,
  target: ExperienceTarget,
): Promise<{
  readonly urlChanged: boolean;
  readonly domChanged: boolean;
  readonly elapsedMs: number;
}> {
  if (target.prepare) await target.prepare(page);
  const locator = target.locate(page);
  await expect(locator, `${target.label} 不在 DOM 中`).toHaveCount(1);
  await locator.scrollIntoViewIfNeeded();
  await assertVisibleAndHittableAtFivePoints(page, locator, target.label);
  const beforeUrl = page.url();
  let navigationAt: number | null = null;
  const onNavigate = () => {
    navigationAt ??= Date.now();
  };
  page.on("framenavigated", onNavigate);
  await page.evaluate(() => {
    const key = "__experienceCtaMutation";
    const state: {
      clickedAt: number | null;
      respondedAt: number | null;
      urlChangedAt: number | null;
    } = {
      clickedAt: null,
      respondedAt: null,
      urlChangedAt: null,
    };
    const markResponse = () => {
      if (state.clickedAt !== null) state.respondedAt ??= performance.now();
    };
    const observer = new MutationObserver(() => {
      markResponse();
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    document.addEventListener(
      "click",
      () => {
        state.clickedAt ??= performance.now();
      },
      { capture: true, once: true },
    );
    for (const method of ["pushState", "replaceState"] as const) {
      const original = history[method];
      history[method] = function (...args) {
        if (state.clickedAt !== null) {
          state.urlChangedAt ??= performance.now();
          markResponse();
        }
        return original.apply(this, args);
      };
    }
    Object.assign(window, { [key]: { state, observer } });
  });
  let clickStarted = Date.now();
  try {
    await humanClick(page, locator, target.label, {
      beforePress: () => {
        clickStarted = Date.now();
      },
    });
  } finally {
    page.off("framenavigated", onNavigate);
  }
  const remaining = Math.max(0, 300 - (Date.now() - clickStarted));
  if (remaining > 0) await page.waitForTimeout(remaining);
  const state = await page
    .evaluate(() => {
      const entry = (
        window as unknown as {
          __experienceCtaMutation?: {
            state: {
              clickedAt: number | null;
              respondedAt: number | null;
              urlChangedAt: number | null;
            };
            observer: MutationObserver;
          };
        }
      ).__experienceCtaMutation;
      entry?.observer.disconnect();
      return entry?.state ?? { clickedAt: null, respondedAt: null, urlChangedAt: null };
    })
    .catch(() => ({ clickedAt: null, respondedAt: null }));
  const urlChanged = page.url() !== beforeUrl;
  const responseElapsed = navigationAt
    ? navigationAt - clickStarted
    : state.clickedAt !== null && state.respondedAt !== null
      ? state.respondedAt - state.clickedAt
      : null;
  const elapsedMs = responseElapsed === null ? 301 : Math.max(0, Math.round(responseElapsed));
  return { urlChanged, domChanged: state.respondedAt !== null, elapsedMs };
}
