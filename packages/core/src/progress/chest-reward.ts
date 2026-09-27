/**
 * What one lesson's chest holds (V7 station 4), read from the progress
 * document rather than composed for effect. Every number on the opening is a
 * difference between the document before the lesson and after it, so the chest
 * can only announce what the learner's record already says; a number the record
 * does not support is simply absent.
 */
import type { ProgressDocument } from "../ports/progress.js";
import type { LessonRef } from "./contract.js";
import { allFirstTry } from "./first-try.js";
import { badgesFor, calendarDay, type Badge } from "./goals.js";
import { levelOf } from "./level.js";

export { allFirstTry } from "./first-try.js";

/** The part of the document the chest compares against, taken as the lesson opens. */
export interface ChestBaseline {
  readonly totalXp: number;
  readonly earnedBadgeIds: readonly string[];
}

export function chestBaseline(
  document: ProgressDocument,
  coursesFinished = 0,
  pathsFinished = 0,
): ChestBaseline {
  return {
    totalXp: document.totalXp,
    earnedBadgeIds: badgesFor(document, coursesFinished, pathsFinished)
      .filter((badge) => badge.earned)
      .map((badge) => badge.id),
  };
}

export interface ChestReward {
  readonly xp: number;
  readonly levelBefore: number;
  readonly levelAfter: number;
  /** Review cards this lesson dropped. */
  readonly reviewCards: number;
  /** Knowledge cards this lesson lit (concepts the lesson names). */
  readonly knowledgeCards: number;
  /** The streak day this lesson counts toward. */
  readonly streakDay: number;
  /** Badges earned by this lesson; the largest moment, shown last. */
  readonly badges: readonly Badge[];
  /** Every exercise right on its first attempt: the chest goes up a tier. */
  readonly allFirstTry: boolean;
}

export function chestReward({
  baseline,
  after,
  locator,
  reviewCards,
  knowledgeCards,
  coursesFinished = 0,
  pathsFinished = 0,
}: {
  readonly baseline: ChestBaseline;
  readonly after: ProgressDocument;
  readonly locator: LessonRef;
  readonly reviewCards: number;
  readonly knowledgeCards: number;
  readonly coursesFinished?: number;
  readonly pathsFinished?: number;
}): ChestReward {
  const earnedBefore = new Set(baseline.earnedBadgeIds);
  return {
    xp: Math.max(0, after.totalXp - baseline.totalXp),
    levelBefore: levelOf(baseline.totalXp).level,
    levelAfter: levelOf(after.totalXp).level,
    reviewCards,
    knowledgeCards,
    streakDay: after.streak.days,
    badges: badgesFor(after, coursesFinished, pathsFinished).filter(
      (badge) => badge.earned && !earnedBefore.has(badge.id),
    ),
    allFirstTry: allFirstTry(after, locator),
  };
}

/**
 * The day's first lesson doubles its XP (V7: 「今日首箱 ×2」). Returns the bonus
 * to add through `addXp`, or null when today's has already been given. The
 * event is named after the learner's local day, so two devices finishing
 * lessons on the same day still give one bonus between them.
 */
export function dailyFirstBonus(
  document: ProgressDocument,
  now: number,
  lessonXp: number,
): { readonly eventId: string; readonly amount: number } | null {
  const eventId = `daily-first:${calendarDay(now)}`;
  if (Object.hasOwn(document.xpEvents, eventId) || !(lessonXp > 0)) return null;
  return { eventId, amount: Math.round(lessonXp) };
}
