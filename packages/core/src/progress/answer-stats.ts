import type { ExerciseAttemptRecord, ProgressDocument } from "../ports/progress.js";
import type { LessonRef } from "./contract.js";

/** The answer facts an author can compare with one lesson's feedback. */
export interface LessonAnswerStats {
  /** Number of exercises in the current lesson snapshot. */
  readonly exerciseCount: number;
  /** Distinct exercises with at least one recorded answer. */
  readonly firstAttemptCount: number;
  /** Distinct exercises whose first recorded answer passed. */
  readonly firstPassCount: number;
  /** Null when there is no complete, graded first-answer set to divide. */
  readonly firstPassRate: number | null;
  /** Every recorded submission for this lesson revision, including retries. */
  readonly totalAttempts: number;
  /** First answers that exist but are still waiting for a host verdict. */
  readonly pendingFirstAttemptCount: number;
}

/**
 * Fold one lesson's exact current-revision attempt records into display facts.
 *
 * The progress document does not persist a `firstAttempt` flag. The first
 * answer is therefore the earliest record for each exercise, ordered by the
 * record's timestamp and then its command id for a deterministic tie-break.
 * A retry must increase `totalAttempts` without changing the first-pass result.
 *
 * An authoring host may have accepted an answer before it has written a
 * verdict. That answer is real coverage, but it is not a failed answer, so the
 * rate stays null until every first answer in the set is graded.
 */
export function answerStatsForAttempts(
  attempts: readonly ExerciseAttemptRecord[],
  exerciseCount: number,
): LessonAnswerStats {
  const byExercise = new Map<string, ExerciseAttemptRecord[]>();
  for (const attempt of attempts) {
    const group = byExercise.get(attempt.exerciseId);
    if (group) group.push(attempt);
    else byExercise.set(attempt.exerciseId, [attempt]);
  }

  const firstAttempts = [...byExercise.values()].map(
    (group) => [...group].sort(compareAttemptsAsc)[0]!,
  );
  const firstAttemptCount = firstAttempts.length;
  const firstPassCount = firstAttempts.filter(
    (attempt) => attempt.hostGrade?.passed === true,
  ).length;
  const pendingFirstAttemptCount = firstAttempts.filter(
    (attempt) => attempt.hostGrade == null,
  ).length;

  return {
    exerciseCount: nonNegativeInteger(exerciseCount),
    firstAttemptCount,
    firstPassCount,
    firstPassRate:
      firstAttemptCount > 0 && pendingFirstAttemptCount === 0
        ? firstPassCount / firstAttemptCount
        : null,
    totalAttempts: attempts.length,
    pendingFirstAttemptCount,
  };
}

/** Read only this author's current lesson revision from the progress document. */
export function answerStatsOf(
  document: Pick<ProgressDocument, "exerciseAttempts">,
  locator: LessonRef,
  contentRevision: number,
  exerciseCount: number,
): LessonAnswerStats {
  const attempts = Object.values(document.exerciseAttempts).filter(
    (attempt) =>
      attempt.contentRevision === contentRevision &&
      attempt.locator.studyId === locator.studyId &&
      attempt.locator.courseId === locator.courseId &&
      attempt.locator.unitId === locator.unitId &&
      attempt.locator.lessonId === locator.lessonId,
  );
  return answerStatsForAttempts(attempts, exerciseCount);
}

function compareAttemptsAsc(a: ExerciseAttemptRecord, b: ExerciseAttemptRecord): number {
  const aTime = Date.parse(a.occurredAt);
  const bTime = Date.parse(b.occurredAt);
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
    return aTime - bTime;
  }
  if (Number.isFinite(aTime) !== Number.isFinite(bTime)) return Number.isFinite(aTime) ? -1 : 1;
  return a.occurredAt.localeCompare(b.occurredAt) || a.commandId.localeCompare(b.commandId);
}

function nonNegativeInteger(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
