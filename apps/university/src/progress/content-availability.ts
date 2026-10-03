import { PERSONAL_STUDY_ID, type CardProgress } from "@pieai/university-core";
import type { ShelfStudy } from "@pieai/university-ui/content/port.js";

let current: readonly ShelfStudy[] = [];

/** The shared shelf supplies availability; the cloud document keeps history. */
export function registerReviewShelf(studies: readonly ShelfStudy[]) {
  current = studies;
}

export function isReviewCardAvailable(card: CardProgress): boolean {
  if (card.studyId === PERSONAL_STUDY_ID) return true;
  const study = current.find((entry) => entry.id === card.studyId);
  if (!study) return false;
  return study.courses.some(
    (course) =>
      course.id === card.courseId &&
      course.units.some((unit) => unit.lessons.some((lesson) => lesson.id === card.lessonId)),
  );
}
