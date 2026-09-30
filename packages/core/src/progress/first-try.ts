/**
 * "Right the first time", read from the attempt log.
 *
 * Two things ask it: the chest (all first-try correct in the lesson just
 * finished goes up a tier) and the badge wall (一次全对: any finished lesson
 * where that happened). Both read the same first attempts, so both live here.
 */
import type { ExerciseAttemptRecord, ProgressDocument } from "../ports/progress.js";
import { lessonRefKey, type LessonRef } from "./contract.js";
import { lessonKeyOf } from "./document.js";

interface FirstAttempt {
  readonly at: string;
  readonly full: boolean;
}

const fullMarks = (attempt: ExerciseAttemptRecord) =>
  attempt.maxScore > 0 && attempt.score >= attempt.maxScore;

/** Each lesson's earliest attempt per exercise, keyed by `lessonRefKey`. */
function firstAttemptsByLesson(
  document: ProgressDocument,
): Map<string, { locator: LessonRef; first: Map<string, FirstAttempt> }> {
  const lessons = new Map<string, { locator: LessonRef; first: Map<string, FirstAttempt> }>();
  for (const attempt of Object.values(document.exerciseAttempts)) {
    if (attempt.purpose === "practice") continue;
    const key = lessonRefKey(attempt.locator);
    let lesson = lessons.get(key);
    if (!lesson) {
      lesson = { locator: attempt.locator, first: new Map() };
      lessons.set(key, lesson);
    }
    const seen = lesson.first.get(attempt.exerciseId);
    if (seen && seen.at <= attempt.occurredAt) continue;
    lesson.first.set(attempt.exerciseId, { at: attempt.occurredAt, full: fullMarks(attempt) });
  }
  return lessons;
}

const everyFirstFull = (first: ReadonlyMap<string, FirstAttempt>) =>
  first.size > 0 && [...first.values()].every((entry) => entry.full);

/**
 * Whether every exercise of the lesson was answered correctly the first time.
 * A lesson with no exercise has nothing to be right about and never upgrades.
 */
export function allFirstTry(document: ProgressDocument, locator: LessonRef): boolean {
  const lesson = firstAttemptsByLesson(document).get(lessonRefKey(locator));
  return lesson ? everyFirstFull(lesson.first) : false;
}

/** Finished lessons whose every exercise was right on the first attempt. */
export function perfectLessons(document: ProgressDocument): number {
  let count = 0;
  for (const { locator, first } of firstAttemptsByLesson(document).values()) {
    const lesson = document.lessons[lessonKeyOf(locator)];
    if (
      lesson &&
      lesson.completedAt !== null &&
      lesson.readConfirmed !== false &&
      everyFirstFull(first)
    )
      count += 1;
  }
  return count;
}
