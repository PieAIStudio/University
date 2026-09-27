/**
 * What one lesson's chest holds (V7 station 4), read from the progress
 * document rather than composed for effect. Every number on the opening is a
 * difference between the document before the lesson and after it, so the chest
 * can only announce what the learner's record already says; a number the record
 * does not support is simply absent.
 */
import type { ProgressDocument } from "../ports/progress.js";
import type { LessonRef } from "./contract.js";
import { badgesFor, type Badge } from "./goals.js";
import { levelOf } from "./level.js";

/** The part of the document the chest compares against, taken as the lesson opens. */
export interface ChestBaseline {
  readonly totalXp: number;
  readonly earnedBadgeIds: readonly string[];
}

export function chestBaseline(document: ProgressDocument, coursesFinished = 0): ChestBaseline {
  return {
    totalXp: document.totalXp,
    earnedBadgeIds: badgesFor(document, coursesFinished)
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

/**
 * Whether every exercise of the lesson was answered correctly the first time.
 * A lesson with no exercise has nothing to be right about and never upgrades.
 */
export function allFirstTry(document: ProgressDocument, locator: LessonRef): boolean {
  const first = new Map<string, { at: string; full: boolean }>();
  for (const attempt of Object.values(document.exerciseAttempts)) {
    const at = attempt.locator;
    if (
      at.studyId !== locator.studyId ||
      at.courseId !== locator.courseId ||
      at.unitId !== locator.unitId ||
      at.lessonId !== locator.lessonId
    )
      continue;
    const seen = first.get(attempt.exerciseId);
    if (seen && seen.at <= attempt.occurredAt) continue;
    first.set(attempt.exerciseId, {
      at: attempt.occurredAt,
      full: attempt.maxScore > 0 && attempt.score >= attempt.maxScore,
    });
  }
  return first.size > 0 && [...first.values()].every((entry) => entry.full);
}

export function chestReward({
  baseline,
  after,
  locator,
  reviewCards,
  knowledgeCards,
  coursesFinished = 0,
}: {
  readonly baseline: ChestBaseline;
  readonly after: ProgressDocument;
  readonly locator: LessonRef;
  readonly reviewCards: number;
  readonly knowledgeCards: number;
  readonly coursesFinished?: number;
}): ChestReward {
  const earnedBefore = new Set(baseline.earnedBadgeIds);
  return {
    xp: Math.max(0, after.totalXp - baseline.totalXp),
    levelBefore: levelOf(baseline.totalXp).level,
    levelAfter: levelOf(after.totalXp).level,
    reviewCards,
    knowledgeCards,
    streakDay: after.streak.days,
    badges: badgesFor(after, coursesFinished).filter(
      (badge) => badge.earned && !earnedBefore.has(badge.id),
    ),
    allFirstTry: allFirstTry(after, locator),
  };
}
