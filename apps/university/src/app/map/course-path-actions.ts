import type { View, LessonRef } from "@pieai/university-core";
import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { PathOverlay } from "./world-model";

interface CoursePathActionsOptions {
  readonly setPathOverlay: Dispatch<SetStateAction<PathOverlay | null>>;
  readonly setView: (next: View) => void;
}

export function useCoursePathActions({ setPathOverlay, setView }: CoursePathActionsOptions) {
  const openUnitOverlay = useCallback((unitId: string, returnFocusTo: HTMLElement) => {
    setPathOverlay({ kind: "unit", unitId, returnFocusTo });
  }, []);
  const openCourseLesson = useCallback(
    (locator: LessonRef) => setView({ kind: "lesson", ...locator }),
    [setView],
  );
  const backToCourseMap = useCallback(() => setView({ kind: "world" }), [setView]);

  return { openUnitOverlay, openCourseLesson, backToCourseMap };
}
