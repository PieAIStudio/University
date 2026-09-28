/**
 * The weekly boss (V7 mechanic 8, decision R1; rules decided 2026-09-28 in
 * PLAN-V7-07 §2a): each week a big monster stands at the edge of the island
 * the learner last studied on, with five hearts. Every right answer on what
 * they studied throws a star and takes a heart, and a heart taken stays taken
 * until the boss leaves; the last one opens a purple chest.
 *
 * Hearts are the pull in both directions. In the moment, each answer visibly
 * does something; across the week, a two-minute visit is never wasted, so
 * coming back to finish is cheap. A wrong answer costs nothing: the question
 * goes back into the pool and another round can start at once.
 *
 * Everything here derives from the progress document. A heart taken is an XP
 * event named for the question that took it, and the win is an XP event named
 * for the week, so every device agrees by the same set union that already
 * merges XP — no new field, no new table.
 *
 * The questions are the lessons' own exercises that grade deterministically,
 * picked with the skip test's machinery (skip-test.ts): no second bank, no
 * model call. If fewer than five exist the boss does not come — the pool is
 * never padded with anything the learner has not finished. The system never
 * adapts difficulty (ADR-0010).
 */
import type { ProgressDocument } from "../ports/progress.js";
import { calendarDay, startOfWeek } from "./goals.js";
import {
  judgeSkipAnswer,
  pickSkipTest,
  skipTestCandidates,
  type SkipTestCandidate,
  type SkipTestVerdict,
} from "./skip-test.js";

export const WEEKLY_BOSS_HEARTS = 5;
/** About what a card recalled after two or three days earns (xp.ts). */
export const WEEKLY_BOSS_HIT_XP = 10;
/** With the hearts, the boss is worth about three lessons: an appointment, not a grind. */
export const WEEKLY_BOSS_WIN_XP = 50;

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

const hitPrefix = (week: string) => `weekly-boss:${week}:hit:`;

/** One question's identity across rounds and devices. */
export const weeklyBossQuestionId = (question: SkipTestCandidate) =>
  `${question.lessonId}#${question.exerciseId}`;

/** A heart taken, written under the question that took it: the same one cannot take two. */
export const weeklyBossHitEventId = (week: string, question: SkipTestCandidate) =>
  `${hitPrefix(week)}${weeklyBossQuestionId(question)}`;

/**
 * Lessons finished since the Monday before this week's, newest first.
 *
 * The window's start is fixed for the week, so the pool only grows while the
 * boss stands: on Monday it holds last week's work, by Sunday two weeks'. A
 * sliding seven days would let a question that already took a heart age out
 * and leave the boss with hearts no question can reach.
 */
export function weeklyBossLessons(
  document: ProgressDocument,
  now: number,
): readonly FinishedLesson[] {
  const since = new Date(startOfWeek(now));
  since.setDate(since.getDate() - 7);
  const finished: FinishedLesson[] = [];
  for (const [key, lesson] of Object.entries(document.lessons)) {
    if (lesson.completedAt === null) continue;
    if (lesson.completedAt < since.getTime() || lesson.completedAt > now) continue;
    const [studyId, courseId, lessonId] = key.split("/");
    if (!studyId || !courseId || !lessonId) continue;
    finished.push({ studyId, courseId, lessonId, completedAt: lesson.completedAt });
  }
  return finished.sort((a, b) => b.completedAt - a.completedAt);
}

export interface WeeklyBoss {
  readonly week: string;
  /** Where the learner last finished a lesson: where they will next open the map. */
  readonly island: { readonly studyId: string; readonly courseId: string };
  /** The end of Sunday: it leaves then, beaten or not. */
  readonly leavesAt: number;
  readonly beaten: boolean;
  /** Hearts still standing; 0 once beaten. */
  readonly hearts: number;
  /** The questions that have not taken a heart yet; a round draws from these. */
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
  const finished = weeklyBossLessons(document, now);
  const last = finished[0];
  if (!last) return null;
  const all = skipTestCandidates(
    finished.map((lesson) => ({
      id: `${lesson.studyId}/${lesson.courseId}/${lesson.lessonId}`,
      exercises: exercisesOf(lesson),
    })),
  );
  if (all.length < WEEKLY_BOSS_HEARTS) return null;
  const week = weeklyBossWeek(now);
  const hit = new Set(
    Object.keys(document.xpEvents)
      .filter((id) => id.startsWith(hitPrefix(week)))
      .map((id) => id.slice(hitPrefix(week).length)),
  );
  const beaten = Object.hasOwn(document.xpEvents, weeklyBossWonEventId(week));
  const leaves = new Date(startOfWeek(now));
  leaves.setDate(leaves.getDate() + 7);
  return {
    week,
    island: { studyId: last.studyId, courseId: last.courseId },
    leavesAt: leaves.getTime(),
    beaten,
    hearts: beaten ? 0 : Math.max(0, WEEKLY_BOSS_HEARTS - hit.size),
    pool: all.filter((question) => !hit.has(weeklyBossQuestionId(question))),
  };
}

/** Whole days left before the boss leaves, counting today: 1 on Sunday. */
export function weeklyBossDaysLeft(boss: WeeklyBoss, now: number): number {
  return Math.max(1, Math.ceil((boss.leavesAt - now) / 86_400_000));
}

export interface WeeklyBossRound {
  readonly week: string;
  readonly questions: readonly SkipTestCandidate[];
  readonly verdicts: readonly Exclude<SkipTestVerdict, "unanswered">[];
  /** Hearts standing when the round began. */
  readonly hearts: number;
}

/**
 * One round: as many questions as the boss has hearts, spread across as many
 * lessons as possible. Two devices taking hearts offline can leave a boss at
 * none without the win written; one question then finishes it.
 */
export function startWeeklyBossRound(
  boss: WeeklyBoss,
  pick?: (length: number) => number,
): WeeklyBossRound {
  const size = Math.max(1, boss.hearts);
  return {
    week: boss.week,
    questions: pickSkipTest(boss.pool, { size, ...(pick ? { pick } : {}) }),
    verdicts: [],
    hearts: boss.hearts,
  };
}

export interface WeeklyBossAnswer {
  readonly round: WeeklyBossRound;
  /** `unanswered` changes nothing: the card asks for an answer instead. */
  readonly verdict: SkipTestVerdict;
  /** The XP event to write for a heart taken, or null. */
  readonly hitEventId: string | null;
}

export function answerWeeklyBoss(round: WeeklyBossRound, answer: string): WeeklyBossAnswer {
  const question = round.questions[round.verdicts.length];
  if (!question) return { round, verdict: "unanswered", hitEventId: null };
  const verdict = judgeSkipAnswer(answer, question.answerKey);
  if (verdict === "unanswered") return { round, verdict, hitEventId: null };
  return {
    round: { ...round, verdicts: [...round.verdicts, verdict] },
    verdict,
    hitEventId: verdict === "correct" ? weeklyBossHitEventId(round.week, question) : null,
  };
}

const hits = (round: WeeklyBossRound) =>
  round.verdicts.filter((verdict) => verdict === "correct").length;

export const weeklyBossHeartsLeft = (round: WeeklyBossRound) =>
  Math.max(0, round.hearts - hits(round));

export const weeklyBossRoundOver = (round: WeeklyBossRound) =>
  round.verdicts.length >= round.questions.length;

/** The last heart fell in this round. */
export const weeklyBossRoundWon = (round: WeeklyBossRound) =>
  hits(round) >= Math.max(1, round.hearts);

/**
 * All five hearts in one round without a miss. The only thing at stake in a
 * fight, and it is a bigger chest: the first-try upgrade every chest has.
 */
export const weeklyBossFlawless = (round: WeeklyBossRound) =>
  round.hearts === WEEKLY_BOSS_HEARTS &&
  weeklyBossRoundWon(round) &&
  round.verdicts.every((verdict) => verdict === "correct");
