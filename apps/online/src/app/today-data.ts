import { lessonKeyOf } from "@pieai/university-core";
import type { CardProgress, ProgressPort } from "@pieai/university-core";
import type {
  LessonProgress,
  CourseReviewCardLocator,
  NextLesson,
  TodayCard,
} from "@pieai/university-ui/view/lesson-view.js";
import { library, peekCourse, type Course } from "../content/library";

const ONLINE_CONTENT_REVISION = 1;

export function nextLessonOf(
  ref: {
    readonly studyId: string;
    readonly courseId: string;
    readonly unitId: string;
    readonly lessonId: string;
  } | null,
  progress: ProgressPort,
): NextLesson | null {
  if (!ref) return null;
  const course = peekCourse(ref.studyId, ref.courseId);
  const study = library.studies.find((entry) => entry.studyId === ref.studyId);
  const unit = course?.units.find((entry) => entry.id === ref.unitId);
  const lesson = unit?.lessons.find((entry) => entry.id === ref.lessonId);
  if (!course || !study || !unit || !lesson) return null;
  const state = progress.lessonState(lessonKeyOf(ref));
  const lessonProgress: LessonProgress | null =
    state.progress === 0 && state.completedAt === null && state.readConfirmed !== true
      ? null
      : {
          contentRevision: ONLINE_CONTENT_REVISION,
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
    contentRevision: ONLINE_CONTENT_REVISION,
    progress: lessonProgress,
  };
}

export function todayCardOf(card: CardProgress): TodayCard | null {
  const course = peekCourse(card.studyId, card.courseId);
  const content = course && findCard(course, card);
  if (!content) return null;
  return {
    kind: "course-card",
    studyId: card.studyId,
    courseId: card.courseId,
    unitId: content.unitId,
    lessonId: card.lessonId,
    cardId: content.card.id,
    front: content.card.front,
    contentRevision: ONLINE_CONTENT_REVISION,
    dueAt: new Date(card.dueAt).toISOString(),
  };
}

function findCard(
  course: Course,
  card: CardProgress | CourseReviewCardLocator,
): {
  readonly unitId: string;
  readonly card: Course["units"][number]["lessons"][number]["cards"][number];
} | null {
  const cardId = "cardId" in card ? card.cardId : card.cardKey.split("/").pop();
  const lesson = course.units
    .flatMap((unit) => unit.lessons.map((item) => ({ unit, item })))
    .find(({ item }) => item.id === card.lessonId);
  const found = cardId ? lesson?.item.cards.find((item) => item.id === cardId) : undefined;
  return lesson && found ? { unitId: lesson.unit.id, card: found } : null;
}
