/**
 * This shell's answer to the shared progress questions.
 *
 * Storage stays where it is — one SQLite file per study, rows keyed by
 * `courseId/unitId/lessonId`. This file is a read model on top of that store,
 * so a world map, an island or a settlement can ask the same questions the
 * delivery shell answers from a different store.
 *
 * studyId is not part of the row key, and putting it there would be a mistake
 * rather than a completion. It selects which SQLite file to open, the same way
 * `getStudyPaths()` already does: one study, one learner database. A row inside
 * that file cannot belong to a different study, because a different study is a
 * different file. Folding studyId into the lesson key would ask a database that
 * already belongs to one study whether the row belongs to another, and two
 * studies that reused a course id would then share one progress row inside
 * whichever file happened to be opened first.
 *
 * The two completion flags are independent here, which is why the contract has
 * both. `exercisesPassed` is the exercise-attempt log; `readConfirmed` is a row
 * in `lesson_completion_event`. Do not set them equal. A learner who skipped to
 * the quiz and passed has not confirmed they read the lesson.
 */
import {
  NOT_STARTED,
  type LessonCompletion,
  type LessonRef,
  type ProgressSource,
} from "@pieai/university-core";

import { exerciseContentKey, lessonContentKey, type LearningStore } from "./types.js";

/**
 * The current questions of a lesson, taken from the files, not from the store.
 *
 * The store keys attempts per exercise. "Every gradable exercise has a passing
 * attempt" is a claim about the current list, and that list lives beside the
 * prose. A shared surface only hands over a `LessonRef`; the caller that can
 * already read the lesson supplies the rest.
 */
export interface LessonExerciseSnapshot {
  readonly contentRevision: number;
  readonly exerciseIds: readonly string[];
}

export function progressSource(input: {
  readonly getStore: (studyId: string) => LearningStore | null;
  readonly lessonOf: (ref: LessonRef) => LessonExerciseSnapshot | null;
}): ProgressSource {
  return {
    completionOf(ref: LessonRef): LessonCompletion {
      const store = input.getStore(ref.studyId);
      if (!store) return NOT_STARTED;
      const current = input.lessonOf(ref);
      if (!current) return NOT_STARTED;

      const identity = {
        courseId: ref.courseId,
        unitId: ref.unitId,
        lessonId: ref.lessonId,
      };
      const exercisesPassed = current.exerciseIds.every((exerciseId) =>
        store.hasCorrectExerciseAttempt(
          exerciseContentKey({ ...identity, exerciseId }),
          current.contentRevision,
        ),
      );
      const readConfirmed = store.hasLessonCompletion(
        lessonContentKey(identity),
        current.contentRevision,
      );
      if (!exercisesPassed && !readConfirmed) return NOT_STARTED;
      return { exercisesPassed, readConfirmed };
    },
  };
}
