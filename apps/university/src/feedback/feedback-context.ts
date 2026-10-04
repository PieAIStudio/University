import { useMemo } from "react";
import {
  lessonRefKey,
  type FeedbackContext,
  type LessonRef,
  type ProgressDocument,
  type View,
} from "@pieai/university-core";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";

type FeedbackContextSeed = Pick<
  FeedbackContext,
  "locator" | "contentRevision" | "exerciseAttemptCount" | "signedIn"
>;

/**
 * What a feedback note is about: the lesson on screen (or just settled), its
 * revision and how many tries this learner made at its exercises, so a report
 * names the version it was written against.
 */
export function useFeedbackContext(
  view: View,
  course: CourseView | null,
  progress: ProgressDocument,
  signedIn: boolean,
) {
  const locator: LessonRef | null =
    view.kind === "lesson" || view.kind === "settled"
      ? {
          studyId: view.studyId,
          courseId: view.courseId,
          unitId: view.unitId,
          lessonId: view.lessonId,
        }
      : null;
  const lesson = locator
    ? (course?.units
        .find((unit) => unit.id === locator.unitId)
        ?.lessons.find((item) => item.id === locator.lessonId) ?? null)
    : null;
  const context = useMemo<FeedbackContextSeed>(() => {
    const contentRevision = lesson?.contentRevision ?? null;
    const exerciseAttemptCount =
      locator && contentRevision !== null
        ? Object.values(progress.exerciseAttempts).filter(
            (attempt) =>
              lessonRefKey(attempt.locator) === lessonRefKey(locator) &&
              attempt.contentRevision === contentRevision,
          ).length
        : 0;
    return { locator, contentRevision, exerciseAttemptCount, signedIn };
  }, [signedIn, lesson, locator, progress.exerciseAttempts]);
  const surface: "account" | "lesson" | "default" =
    view.kind === "me" || view.kind === "auth-callback" || view.kind === "auth-reset"
      ? "account"
      : locator
        ? "lesson"
        : "default";
  return { context, lessonTitle: lesson?.title ?? null, surface };
}
