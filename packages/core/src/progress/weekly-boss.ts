/**
 * The weekly boss (V7 mechanic 8, decision R1): each week a big monster stands
 * at the edge of the island the learner studied most, and five questions on
 * what they studied drive it away for a purple chest.
 *
 * Two readings of the design had to be reconciled. The boss arrives on Monday,
 * and its questions come from what the learner studied that week — but on
 * Monday morning this week holds nothing yet. So "that week" is the seven days
 * up to now: on Monday it is last week's work, by Sunday it is this week's.
 * The boss's own identity is the Monday-start calendar week: beaten or not, it
 * leaves at the end of Sunday, and a beaten boss stays gone until Monday.
 *
 * The questions are the lessons' own exercises that grade deterministically,
 * picked with the skip test's machinery (skip-test.ts): no second bank, no
 * model call, and if fewer than five exist the boss does not come that week —
 * the pool is never padded with anything the learner has not finished. The
 * system never adapts difficulty (ADR-0010).
 */
import type { ProgressDocument } from "../ports/progress.js";
import { calendarDay, startOfWeek } from "./goals.js";
import {
  judgeSkipAnswer,
  pickSkipTest,
  skipTestCandidates,
  type SkipTestCandidate,
} from "./skip-test.js";

export const WEEKLY_BOSS_QUESTIONS = 5;
/** Like the skip test: nearly all right is right; two wrong is a retry, which costs nothing. */
export const WEEKLY_BOSS_ALLOWED_WRONG = 1;
const WINDOW_DAYS = 7;
const DAY = 86_400_000;

export interface FinishedLesson {
  readonly studyId: string;
  readonly courseId: string;
  readonly lessonId: string;
  readonly completedAt: number;
}

/** The boss's week: the Monday it arrived, `YYYY-MM-DD`, in the learner's own time. */
export const weeklyBossWeek = (now: number) => calendarDay(startOfWeek(now));

/** A beaten boss is written as an XP event under this id, so every device knows. */
export const weeklyBossWonEventId = (week: string) => `weekly-boss:${week}`;

/** Lessons finished in the seven days up to `now`, newest first. */
export function recentlyFinishedLessons(
  document: ProgressDocument,
  now: number,
): readonly FinishedLesson[] {
  const since = now - WINDOW_DAYS * DAY;
  const finished: FinishedLesson[] = [];
  for (const [key, lesson] of Object.entries(document.lessons)) {
    if (lesson.completedAt === null || lesson.completedAt < since || lesson.completedAt > now)
      continue;
    const [studyId, courseId, lessonId] = key.split("/");
    if (!studyId || !courseId || !lessonId) continue;
    finished.push({ studyId, courseId, lessonId, completedAt: lesson.completedAt });
  }
  return finished.sort((a, b) => b.completedAt - a.completedAt);
}

/**
 * Where the boss stands: the course with the most lessons finished in the
 * window, the most recently studied of those on a tie.
 */
export function weeklyBossIsland(
  finished: readonly FinishedLesson[],
): { readonly studyId: string; readonly courseId: string } | null {
  const counts = new Map<
    string,
    { studyId: string; courseId: string; count: number; last: number }
  >();
  for (const lesson of finished) {
    const key = `${lesson.studyId}/${lesson.courseId}`;
    const entry = counts.get(key) ?? { ...lesson, count: 0, last: 0 };
    entry.count += 1;
    entry.last = Math.max(entry.last, lesson.completedAt);
    counts.set(key, entry);
  }
  let best: { studyId: string; courseId: string; count: number; last: number } | null = null;
  for (const entry of counts.values())
    if (!best || entry.count > best.count || (entry.count === best.count && entry.last > best.last))
      best = entry;
  return best ? { studyId: best.studyId, courseId: best.courseId } : null;
}

export interface WeeklyBoss {
  readonly week: string;
  readonly island: { readonly studyId: string; readonly courseId: string };
  /** The end of Sunday: it leaves then, beaten or not. */
  readonly leavesAt: number;
  readonly beaten: boolean;
  /** Every question it may ask; `pickWeeklyBossQuestions` draws the five for one fight. */
  readonly pool: readonly SkipTestCandidate[];
}

/**
 * This week's boss, or null when there is none: nothing finished in the
 * window, or fewer than five questions that grade without a model.
 * `exercisesOf` reads the lesson's own exercises from the content port.
 */
export function weeklyBoss(
  document: ProgressDocument,
  now: number,
  exercisesOf: (
    lesson: FinishedLesson,
  ) => Parameters<typeof skipTestCandidates>[0][number]["exercises"],
): WeeklyBoss | null {
  const finished = recentlyFinishedLessons(document, now);
  const island = weeklyBossIsland(finished);
  if (!island) return null;
  const pool = skipTestCandidates(
    finished.map((lesson) => ({
      id: `${lesson.studyId}/${lesson.courseId}/${lesson.lessonId}`,
      exercises: exercisesOf(lesson),
    })),
  );
  if (pool.length < WEEKLY_BOSS_QUESTIONS) return null;
  const week = weeklyBossWeek(now);
  const monday = startOfWeek(now);
  const leaves = new Date(monday);
  leaves.setDate(leaves.getDate() + 7);
  return {
    week,
    island,
    leavesAt: leaves.getTime(),
    beaten: Object.hasOwn(document.xpEvents, weeklyBossWonEventId(week)),
    pool,
  };
}

/** Five questions for one fight, spread across as many lessons as possible. */
export function pickWeeklyBossQuestions(
  pool: readonly SkipTestCandidate[],
  pick?: (length: number) => number,
): readonly SkipTestCandidate[] {
  return pickSkipTest(pool, { size: WEEKLY_BOSS_QUESTIONS, ...(pick ? { pick } : {}) });
}

/** Whether the answers drive the boss away. Unanswered counts as wrong. */
export function weeklyBossBeaten(
  questions: readonly SkipTestCandidate[],
  answers: readonly string[],
): boolean {
  if (questions.length < WEEKLY_BOSS_QUESTIONS) return false;
  const wrong = questions.filter(
    (question, index) => judgeSkipAnswer(answers[index] ?? "", question.answerKey) !== "correct",
  ).length;
  return wrong <= WEEKLY_BOSS_ALLOWED_WRONG;
}
