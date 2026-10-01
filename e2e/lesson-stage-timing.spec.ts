import { expect, test } from "./harness/learner-test.js";
import { SHIPPED_COURSES, lessonPathOf } from "./harness/catalogue.js";
import { ONLINE_ORIGIN } from "./ports.js";

/**
 * V7 amendment one: a lesson's stage loads with its opening, and whether it
 * loads fast is read from frame timing, never from a screenshot. Measured on a
 * phone-sized page with the CPU slowed four times as a stand-in for a
 * mid-range phone. Timing lane only: a shared machine cannot promise a budget.
 */
/*
 * Measured 2026-10-01 on this machine under other agents' load: ready 4.9–5.8 s
 * from navigation (the whole app's boot, the lesson, the stage chunk and the
 * avatar), then a frame p95 of 18–18.6 ms. The budgets catch a stage that
 * doubles its load or drops under 30 frames a second, not a busy machine.
 */
const READY_BUDGET_MS = 9_000;
const FRAME_P95_BUDGET_MS = 34;

const stepLesson = SHIPPED_COURSES.flatMap((course) =>
  course.units.flatMap((unit) =>
    unit.lessons.flatMap((lesson) =>
      (
        lesson.packageLesson.activities as
          | { kind: string; experienceVersion?: number }[]
          | undefined
      )?.some((activity) => activity.kind === "primm" && activity.experienceVersion === 3)
        ? [{ course, lesson }]
        : [],
    ),
  ),
)[0]!;

test("a lesson's stage is ready and steady on a slowed phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const opened = Date.now();
  await page.goto(
    `${ONLINE_ORIGIN}${lessonPathOf(stepLesson.course, stepLesson.lesson)}?lang=zh-CN`,
  );
  const stage = page.locator('.primm-steps__stage [data-lesson-stage="ready"]');
  await stage.waitFor({ timeout: 90_000 });
  const readyMs = Date.now() - opened;
  // Steady frames after the stage is up: rAF intervals over two seconds.
  const frames = await page.evaluate(async () => {
    const gaps: number[] = [];
    let last = performance.now();
    const end = last + 2000;
    while (performance.now() < end) {
      await new Promise(requestAnimationFrame);
      const now = performance.now();
      gaps.push(now - last);
      last = now;
    }
    gaps.sort((a, b) => a - b);
    return { count: gaps.length, p95: gaps[Math.floor(gaps.length * 0.95)] ?? Infinity };
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const measured = `ready ${readyMs} ms; frame p95 ${frames.p95.toFixed(1)} ms over ${frames.count} frames`;
  test.info().annotations.push({ type: "measured", description: measured });
  console.log(`lesson stage: ${measured}`);
  expect(readyMs).toBeLessThan(READY_BUDGET_MS);
  expect(frames.p95).toBeLessThan(FRAME_P95_BUDGET_MS);
});
