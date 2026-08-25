/**
 * This shell's answer to the shared progress questions.
 *
 * This file is a read model on top of the shared cloud-backed ProgressPort,
 * so a world map, an island or a settlement can ask the same questions the
 * authoring shell asks. `university.progress.v2` is only the browser cache and
 * offline outbox.
 *
 * Two losses live here, and they are named rather than papered over.
 *
 * The stored key is `studyId/courseId/lessonId`, so `completionOf` deliberately
 * ignores `ref.unitId`. Two lessons that reused a lesson id across units would
 * share one row of progress, and each would show the other's completion. That
 * holds today only because no course does it, and nothing in the import
 * currently forbids it.
 *
 * The shared document carries the read-confirmation fact separately from
 * exercise progress. A pre-migration row with progress 1 is treated as a
 * completed legacy record; new rows must carry both facts.
 */
import {
  NOT_STARTED,
  type LessonCompletion,
  type LessonRef,
  type ProgressSource,
} from "@pieai/university-core";

import { lessonKey, lessonState } from "./store";

export function progressSource(): ProgressSource {
  return {
    completionOf(ref: LessonRef): LessonCompletion {
      const state = lessonState(lessonKey(ref.studyId, ref.courseId, ref.lessonId));
      const readConfirmed =
        state.readConfirmed === true &&
        (state.readConfirmedRevision === undefined || state.readConfirmedRevision === 1);
      const legacyComplete = state.readConfirmed === undefined && state.progress >= 1;
      if (state.progress < 1 && !readConfirmed) return NOT_STARTED;
      return {
        exercisesPassed: state.progress >= 1,
        readConfirmed: readConfirmed || legacyComplete,
      };
    },
  };
}
