import { useEffect, useRef } from "react";
import type { View } from "@pieai/university-core";
import { trackEvent, type AnalyticsEvent } from "../../analytics/productAnalytics";

/** The route event for a view, keyed so the same place is reported once per arrival. */
function routeEvent(view: View): { key: string; event: AnalyticsEvent } | null {
  if (view.kind === "course")
    return {
      key: `course:${view.studyId}/${view.courseId}`,
      event: { name: "course_opened", studyId: view.studyId, courseId: view.courseId },
    };
  if (view.kind === "lesson")
    return {
      key: `lesson:${view.studyId}/${view.courseId}/${view.lessonId}`,
      event: {
        name: "lesson_opened",
        studyId: view.studyId,
        courseId: view.courseId,
        lessonId: view.lessonId,
      },
    };
  if (view.kind === "settled")
    return {
      key: `settled:${view.studyId}/${view.courseId}/${view.lessonId}`,
      event: {
        name: "settlement_shown",
        studyId: view.studyId,
        courseId: view.courseId,
        lessonId: view.lessonId,
      },
    };
  if (view.kind === "plans") return { key: "plans", event: { name: "plans_opened" } };
  return null;
}

/** One event per arrival at a course, lesson, settlement or the plans page. */
export function useRouteAnalytics(view: View) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    const route = routeEvent(view);
    if (!route) {
      last.current = null;
      return;
    }
    if (route.key === last.current) return;
    last.current = route.key;
    trackEvent(route.event);
  }, [view]);
}

/** Due review cards were on screen: reported once until the queue empties again. */
export function useReviewDueAnalytics(dueCount: number, visible: boolean) {
  const reported = useRef(false);
  useEffect(() => {
    if (dueCount === 0) {
      reported.current = false;
      return;
    }
    if (!visible || reported.current) return;
    reported.current = true;
    trackEvent({ name: "review_due_opened", cardCount: dueCount });
  }, [dueCount, visible]);
}
