/**
 * The read model every map, island and settlement asks its questions of.
 *
 * It sits on the shared cloud-backed `ProgressPort`, so both shells get the
 * same answers from the same document. It lived in the delivery shell and
 * nowhere else, which is part of why the authoring shell had no course view at
 * all: the screen needs a `ProgressSource` to decide which stone is live, and
 * the only one in the repository was in an app the other app cannot import.
 *
 * Two losses live here, and they are named rather than papered over.
 *
 * The stored key is `studyId/courseId/lessonId`, so `completionOf` deliberately
 * ignores `ref.unitId`. Two lessons that reused a lesson id across units would
 * share one row of progress, and each would show the other's completion. The
 * document cannot defend itself after that projection; the course producer
 * and recovery/delivery input gate therefore reject the duplicate before it
 * reaches this read model.
 *
 * The document carries the read-confirmation fact separately from exercise
 * progress. A pre-migration row with progress 1 is treated as a completed
 * legacy record; new rows must carry both facts.
 */
import {
  NOT_STARTED,
  type LessonProgressSnapshot,
  type LessonCompletion,
  type LessonRef,
  type ProgressSource,
} from "./contract.js";
import type { ProgressPort } from "../ports/progress.js";
import { lessonKeyOf } from "./document.js";

export function progressSourceOf(port: ProgressPort): ProgressSource {
  return {
    completionOf(ref: LessonRef, lesson?: LessonProgressSnapshot): LessonCompletion {
      if (!lesson) {
        throw new Error("progressSourceOf requires the current lesson snapshot");
      }
      const state = port.lessonState(lessonKeyOf(ref));
      const exercisesPassed =
        lesson.exerciseIdsComplete !== false &&
        lesson.exerciseIds.every(
          (exerciseId) =>
            port.latestExerciseAttempt(ref, exerciseId, lesson.contentRevision)?.hostGrade
              ?.passed === true,
        );
      const readConfirmed =
        state.readConfirmed === true &&
        (state.readConfirmedRevision === undefined ||
          state.readConfirmedRevision === lesson.contentRevision);
      const legacyComplete = state.readConfirmed === undefined && state.progress >= 1;
      if (!exercisesPassed && !readConfirmed && !legacyComplete) return NOT_STARTED;
      return {
        exercisesPassed: exercisesPassed || legacyComplete,
        readConfirmed: readConfirmed || legacyComplete,
      };
    },
  };
}
