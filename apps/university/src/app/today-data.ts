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
import { lessonKeyOf } from "@pieai/university-core";
import type { CardProgress, LessonRef, ProgressPort } from "@pieai/university-core";
import type { ShelfStudy } from "@pieai/university-ui/content/port.js";
import type {
  CourseReviewCardLocator,
  LessonProgress,
  NextLesson,
} from "@pieai/university-ui/view/lesson-view.js";

/**
 * The revision a shelf lesson is on.
 *
 * A published package is one snapshot, so the delivery build's shelf says 1
 * everywhere. The authoring build sends the real number, because a lesson on
 * disk is edited in place.
 */
function revisionOf(studies: readonly ShelfStudy[], ref: LessonRef): number {
  return lessonAt(studies, ref)?.contentRevision ?? 1;
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
  const lessonProgress: LessonProgress | null =
    state.progress === 0 && state.completedAt === null && state.readConfirmed !== true
      ? null
      : {
          contentRevision,
          status:
            state.progress >= 1 &&
            (state.readConfirmed === true || state.readConfirmed === undefined)
              ? "completed"
              : "in-progress",
          progress: state.progress,
          updatedAt: new Date(state.completedAt ?? Date.now()).toISOString(),
          readConfirmed: state.readConfirmed === true || state.progress >= 1,
        };
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
 * The scheduler stores three segments — study, course, lesson — and a card
 * needs four to be addressable, so the unit is found on the shelf. The front
 * is deliberately absent: a card body is content, and content comes through
 * `ContentPort`. The caller fetches it and fills it in.
 */
export function todayCardLocatorOf(
  studies: readonly ShelfStudy[],
  card: CardProgress,
): CourseReviewCardLocator | null {
  const cardId = card.cardKey.split("/").at(-1);
  const course = studies
    .find((study) => study.id === card.studyId)
    ?.courses.find((entry) => entry.id === card.courseId);
  const found = course?.units
    .flatMap((unit) => unit.lessons.map((lesson) => ({ unit, lesson })))
    .find(({ lesson }) => lesson.id === card.lessonId);
  if (!cardId || !found) return null;
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
