/**
 * 「今天」, read off the shelf and the document.
 *
 * It used to read the delivery build's imported package directly, which is why
 * the panel went blank the moment the authoring build rendered it: `peekCourse`
 * answers from a published package, and the authoring build has none. Both
 * facts a learner needs here — which lesson is next, and which card is due —
 * are answerable from the shelf's shape plus the shared progress document, so
 * that is what this takes.
 */
import {
  lessonKeyOf,
  progressSourceOf,
  RECAP_CARD_ID,
  type CardProgress,
  type LessonRef,
  type ProgressPort,
} from "@pieai/university-core";
import type { ShelfStudy } from "@pieai/university-ui/content/port.js";
import type {
  CourseReviewCardLocator,
  LessonProgress,
  NextLesson,
  RecapReviewCardLocator,
} from "@pieai/university-ui/view/lesson-view.js";
import { lessonProgressOf } from "@pieai/university-ui/view/lesson-view.js";

/**
 * The revision a shelf lesson is on.
 *
 * Delivery has one immutable edition, while authoring has the live disk
 * revision. Both shelves carry that number so the shared progress document
 * asks the same version question in either mode.
 */
function revisionOf(studies: readonly ShelfStudy[], ref: LessonRef): number {
  const lesson = lessonAt(studies, ref);
  if (!lesson) throw new Error(`找不到这节课的版本：${ref.lessonId}`);
  return lesson.contentRevision;
}

function lessonAt(studies: readonly ShelfStudy[], ref: LessonRef) {
  return studies
    .find((study) => study.id === ref.studyId)
    ?.courses.find((course) => course.id === ref.courseId)
    ?.units.find((unit) => unit.id === ref.unitId)
    ?.lessons.find((lesson) => lesson.id === ref.lessonId);
}

export function nextLessonOf(
  studies: readonly ShelfStudy[],
  ref: LessonRef | null,
  progress: ProgressPort,
): NextLesson | null {
  if (!ref) return null;
  const study = studies.find((entry) => entry.id === ref.studyId);
  const course = study?.courses.find((entry) => entry.id === ref.courseId);
  const lesson = lessonAt(studies, ref);
  if (!study || !course || !lesson) return null;
  const contentRevision = lesson.contentRevision;
  const state = progress.lessonState(lessonKeyOf(ref));
  const completion = progressSourceOf(progress).completionOf(ref, {
    contentRevision,
    exerciseIds: lesson.exerciseIds,
    ...(lesson.exerciseIdsComplete === false ? { exerciseIdsComplete: false } : {}),
  });
  const lessonProgress: LessonProgress | null = lessonProgressOf(
    state,
    completion,
    contentRevision,
    lesson.exerciseIds.length,
  );
  return {
    ...ref,
    studyTitle: study.title,
    courseTitle: course.title,
    lessonTitle: lesson.title,
    contentRevision,
    progress: lessonProgress,
  };
}

/**
 * Where a due card lives, without its text.
 *
 * Course-card fronts are deliberately absent here: a card body is content,
 * and content comes through `ContentPort`. A recap front is the existing unit
 * capability sentence, so its locator carries that derived sentence directly;
 * both kinds still go through the same content port before they are shown.
 */
export function todayCardLocatorOf(
  studies: readonly ShelfStudy[],
  card: CardProgress,
): CourseReviewCardLocator | RecapReviewCardLocator | null {
  const cardId = card.cardKey.split("/").at(-1);
  const course = studies
    .find((study) => study.id === card.studyId)
    ?.courses.find((entry) => entry.id === card.courseId);
  const found = course?.units
    .flatMap((unit) => unit.lessons.map((lesson) => ({ unit, lesson })))
    .find(
      ({ unit, lesson }) =>
        lesson.id === card.lessonId && (card.kind !== "recap-card" || unit.id === card.unitId),
    );
  if (!cardId || !found) return null;
  if (card.kind === "recap-card") {
    if (cardId !== RECAP_CARD_ID) return null;
    return {
      kind: "recap-card",
      studyId: card.studyId,
      courseId: card.courseId,
      unitId: found.unit.id,
      lessonId: card.lessonId,
      cardId: RECAP_CARD_ID,
      front: found.unit.objective,
      contentRevision: revisionOf(studies, {
        studyId: card.studyId,
        courseId: card.courseId,
        unitId: found.unit.id,
        lessonId: card.lessonId,
      }),
    };
  }
  return {
    kind: "course-card",
    studyId: card.studyId,
    courseId: card.courseId,
    unitId: found.unit.id,
    lessonId: card.lessonId,
    cardId,
    front: "",
    contentRevision: revisionOf(studies, {
      studyId: card.studyId,
      courseId: card.courseId,
      unitId: found.unit.id,
      lessonId: card.lessonId,
    }),
  };
}
