import type { ExerciseAttemptRecord, ProgressDocument } from "../ports/progress.js";
import { lessonRefKey, type LessonRef } from "./contract.js";

export interface Mistake {
  readonly locator: LessonRef;
  readonly exerciseId: string;
  readonly contentRevision: number;
  readonly wrongAnswer: string;
  readonly wrongAt: string;
  readonly wrongCount: number;
  readonly corrected: boolean;
  readonly correctedAt?: string;
}

/**
 * Fold the shared exercise-attempt log into one row per exercise revision.
 *
 * A submission that is waiting for a host verdict is deliberately neither a
 * pass nor a mistake. Treating every score of zero as a mistake would make the
 * authoring shell show a wrong answer before its host had judged it.
 *
 * The document has no separate content catalogue, so the newest revision known
 * in the attempt log is the revision this pure read model can identify. The UI
 * still checks that revision against the current ContentPort response before it
 * renders the question.
 */
export function mistakesOf(document: ProgressDocument): readonly Mistake[] {
  const byExercise = new Map<string, ExerciseAttemptRecord[]>();

  for (const attempt of Object.values(document.exerciseAttempts)) {
    const key = `${lessonRefKey(attempt.locator)}\u0000${attempt.exerciseId}`;
    const group = byExercise.get(key);
    if (group) group.push(attempt);
    else byExercise.set(key, [attempt]);
  }

  const mistakes: Mistake[] = [];
  for (const attempts of byExercise.values()) {
    const contentRevision = Math.max(...attempts.map((attempt) => attempt.contentRevision));
    const currentAttempts = attempts.filter(
      (attempt) => attempt.contentRevision === contentRevision,
    );
    const wrong = currentAttempts.filter((attempt) => attempt.hostGrade?.passed === false);
    if (wrong.length === 0) continue;

    const latestWrong = [...wrong].sort(compareAttemptsDesc)[0]!;
    const corrected = [...currentAttempts]
      .filter(
        (attempt) =>
          attempt.hostGrade?.passed === true && compareAttemptsDesc(attempt, latestWrong) < 0,
      )
      .sort(compareAttemptsDesc)[0];

    mistakes.push({
      locator: { ...latestWrong.locator },
      exerciseId: latestWrong.exerciseId,
      contentRevision,
      wrongAnswer: latestWrong.answer,
      wrongAt: latestWrong.occurredAt,
      wrongCount: wrong.length,
      corrected: corrected !== undefined,
      ...(corrected ? { correctedAt: corrected.occurredAt } : {}),
    });
  }

  return mistakes.sort((a, b) => {
    if (a.corrected !== b.corrected) return a.corrected ? 1 : -1;
    return compareTimesDesc(a.wrongAt, b.wrongAt);
  });
}

function compareAttemptsDesc(a: ExerciseAttemptRecord, b: ExerciseAttemptRecord): number {
  return compareTimesDesc(a.occurredAt, b.occurredAt) || b.commandId.localeCompare(a.commandId);
}

function compareTimesDesc(a: string, b: string): number {
  const aTime = Date.parse(a);
  const bTime = Date.parse(b);
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
    return bTime - aTime;
  }
  return b.localeCompare(a);
}
