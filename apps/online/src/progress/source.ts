/**
 * This shell's answer to the shared progress questions.
 *
 * Storage stays where it is — `university.progress.v2` and the three-part
 * lesson key in `store.ts`. This file is a read model on top of that store,
 * so a world map, an island or a settlement can ask the same questions the
 * authoring shell will answer from a different store.
 *
 * Two losses live here, and they are named rather than papered over.
 *
 * The stored key is `studyId/courseId/lessonId`, so `completionOf` deliberately
 * ignores `ref.unitId`. Two lessons that reused a lesson id across units would
 * share one row of progress, and each would show the other's completion. That
 * holds today only because no course does it, and nothing in the import
 * currently forbids it.
 *
 * This shell also has no separate read-confirmation signal. A lesson is
 * written complete once, when the exercises pass, so `readConfirmed` is
 * currently set equal to `exercisesPassed`. That is a known gap, not a claim
 * that answering is reading, and it is the place a real read-confirm will be
 * wired. Do not invent that feature here.
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
      if (state.progress < 1) return NOT_STARTED;
      return { exercisesPassed: true, readConfirmed: true };
    },
  };
}
