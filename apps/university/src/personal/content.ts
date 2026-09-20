import { activeLocale } from "@pieai/university-ui/i18n.js";
import {
  lessonKeyOf,
  localizeLearnerContent,
  progressSourceOf,
  type ProgressPort,
} from "@pieai/university-core";
import type { ContentPort, CardBody, MistakeExercise } from "@pieai/university-ui/content/port.js";
import { lessonProgressOf, type LessonView } from "@pieai/university-ui/view/lesson-view.js";
import {
  PERSONAL_STUDY_ID,
  PERSONAL_UNIT_ID,
  PERSONAL_LESSON_ID,
  personalAccountScope,
  personalContentId,
  readPersonalJson,
} from "./api.js";

/** Private content is resolved by native identity, not added to the public shelf.
 * The same port is used by the reader, today's review and mistake history. */
export function createPersonalContentPort(base: ContentPort, progress: ProgressPort): ContentPort {
  return {
    ...base,
    async lesson(locator, options) {
      if (locator.studyId !== PERSONAL_STUDY_ID) return base.lesson(locator, options);
      if (locator.unitId !== PERSONAL_UNIT_ID || locator.lessonId !== PERSONAL_LESSON_ID)
        throw new Error("Invalid personal lesson identity");
      const body = await readPersonalJson<LessonView>(
        `/lesson/${personalContentId(locator.courseId)}`,
        personalAccountScope(),
        { signal: options?.signal },
      );
      const view = localizeLearnerContent(body, activeLocale());
      const completion = progressSourceOf(progress).completionOf(locator, {
        contentRevision: view.lesson.contentRevision,
        exerciseIds: view.lesson.exercises.map((exercise) => exercise.id),
      });
      // The native lesson body is immutable; grades belong to the learner's
      // shared progress document. Reproject them on every read so reopening a
      // passed Make does not turn it into “undecided” or ask the AI to regrade.
      return {
        ...view,
        lesson: {
          ...view.lesson,
          progress: lessonProgressOf(
            progress.lessonState(lessonKeyOf(locator)),
            completion,
            view.lesson.contentRevision,
            view.lesson.exercises.length,
          ),
          exercises: view.lesson.exercises.map((exercise) => {
            const attempt = progress.latestExerciseAttempt(
              locator,
              exercise.id,
              exercise.contentRevision,
            );
            return {
              ...exercise,
              hostGrade: attempt?.hostGrade ?? null,
              latestSubmission: attempt
                ? { answer: attempt.answer, occurredAt: attempt.occurredAt }
                : null,
            };
          }),
        },
      };
    },
    async card(card) {
      if (card.studyId !== PERSONAL_STUDY_ID) return base.card(card);
      if (
        card.kind !== "course-card" ||
        card.unitId !== PERSONAL_UNIT_ID ||
        card.lessonId !== PERSONAL_LESSON_ID
      )
        throw new Error("Invalid personal card identity");
      const body = await readPersonalJson<CardBody>(
        `/card/${personalContentId(card.courseId)}?cardId=${encodeURIComponent(card.cardId)}`,
        personalAccountScope(),
      );
      return localizeLearnerContent(body, activeLocale());
    },
    async exercise(locator, exerciseId) {
      if (locator.studyId !== PERSONAL_STUDY_ID) return base.exercise(locator, exerciseId);
      const body = await readPersonalJson<MistakeExercise>(
        `/exercise/${personalContentId(locator.courseId)}?exerciseId=${encodeURIComponent(exerciseId)}`,
        personalAccountScope(),
      );
      return localizeLearnerContent(body, activeLocale());
    },
  };
}
