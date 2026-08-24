import type { CardProgress, ProgressPort, RatingName } from "@pieai/university-core";
import type {
  LessonProgress,
  CourseReviewCardLocator,
  NextLesson,
  ReviewCardLocator,
  TodayCard,
} from "@pieai/university-ui/view/lesson-view.js";
import type { ReviewCardPort, VocabularyDueWord, VocabularyReviewPort } from "@pieai/university-ui";

import { library, peekCourse, type Course } from "../content/library";
import { LEXICON } from "../lesson/language";

const ONLINE_CONTENT_REVISION = 1;
const RATINGS: readonly RatingName[] = ["again", "hard", "good", "easy"];
const LEXICON_BY_SENSE = new Map(LEXICON.map((entry) => [entry.senseId, entry]));

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
  const state = progress.lessonState(`${ref.studyId}/${ref.courseId}/${ref.lessonId}`);
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

export function createOnlineReviewPort(progress: ProgressPort): ReviewCardPort {
  return {
    async reveal(card: ReviewCardLocator, input) {
      if (card.kind !== "course-card") throw new Error("在线端暂不支持这类复习卡");
      const course = peekCourse(card.studyId, card.courseId);
      const content = course && findCard(course, card);
      if (!content) throw new Error("复习卡内容尚未加载");
      const cardKey = cardKeyOf(card);
      const priorAttempts = progress
        .retrievalAttempts(cardKey)
        .slice(0, 3)
        .map((attempt) => ({
          answer: attempt.answer,
          revealedAt: attempt.revealedAt,
          contentRevision: attempt.contentRevision,
        }));
      const startedAt = input.startedAt ? Date.parse(input.startedAt) : Date.now();
      progress.recordRetrievalAttempt({
        commandId: input.commandId,
        cardKey,
        contentRevision: card.contentRevision,
        answer: input.answer,
        revealedAt: new Date().toISOString(),
        durationMs: Math.max(0, Date.now() - (Number.isFinite(startedAt) ? startedAt : Date.now())),
        usedHint: false,
      });
      return { back: content.card.back, priorAttempts };
    },
    async rate(card, rating) {
      if (card.kind !== "course-card") throw new Error("在线端暂不支持这类复习卡");
      progress.gradeCard(cardKeyOf(card), RATINGS[rating - 1]!);
      const next = progress.snapshot().cards[cardKeyOf(card)]?.dueAt;
      if (next === undefined) throw new Error("复习结果没有写入云端缓存");
      return { dueAt: new Date(next).toISOString() };
    },
  };
}

export function createOnlineVocabularyReviewPort(progress: ProgressPort): VocabularyReviewPort {
  return {
    async load() {
      const now = Date.now();
      const due: VocabularyDueWord[] = progress
        .vocabularyStates()
        .filter((state) => state.stage === "learning" && state.dueAt !== null)
        .filter((state) => Date.parse(state.dueAt!) <= now)
        .flatMap((state) => {
          const entry = LEXICON_BY_SENSE.get(state.senseId);
          return entry ? [{ senseId: state.senseId, stage: state.stage, entry }] : [];
        });
      return { due, reviewedToday: 0 };
    },
    async rate(senseId, rating) {
      progress.gradeWord(senseId, RATINGS[rating - 1]!);
    },
  };
}

function cardKeyOf(card: Extract<ReviewCardLocator, { readonly kind: "course-card" }>): string {
  return `${card.studyId}/${card.courseId}/${card.lessonId}/${card.cardId}`;
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
