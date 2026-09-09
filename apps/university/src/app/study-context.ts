import { type CourseProgress, type View } from "@pieai/university-core";
import type { ShelfStudy } from "@pieai/university-ui/content/port.js";
import type { LearnerNavigationFocus } from "@pieai/university-ui/navigation/StudySwitcher.js";
import { nextCourse } from "@pieai/university-world/Maps.js";
import type { CourseNode } from "@pieai/university-world/course.js";
import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { writeNavigationFocus } from "./navigation-focus.js";

interface StudyContextOptions {
  readonly courseProgress: (node: CourseNode) => number;
  readonly courseProgressForNode: (node: CourseNode) => CourseProgress | null;
  readonly focusedStudyId: string | null;
  readonly navigationFocus: LearnerNavigationFocus;
  readonly nodes: readonly CourseNode[] | null;
  readonly setNavigationFocus: Dispatch<SetStateAction<LearnerNavigationFocus>>;
  readonly setView: (next: View) => void;
  readonly studies: readonly ShelfStudy[];
  readonly view: View;
}

export function todayNodeForContext(
  nodes: readonly CourseNode[],
  view: View,
  focusedStudyId: string | null,
  courseProgress: (node: CourseNode) => number,
): CourseNode | null {
  if (view.kind === "course" || view.kind === "lesson" || view.kind === "settled") {
    return (
      nodes.find((node) => node.studyId === view.studyId && node.courseId === view.courseId) ?? null
    );
  }
  return focusedStudyId ? nextCourse(nodes, courseProgress, focusedStudyId) : null;
}

export function useStudyContext({
  courseProgress,
  courseProgressForNode,
  focusedStudyId,
  navigationFocus,
  nodes,
  setNavigationFocus,
  setView,
  studies,
  view,
}: StudyContextOptions) {
  // A direct course URL already owns the visible context. Remember that same
  // valid route in the existing navigation state before leaving it. Otherwise
  // returning to world/practice falls back to whichever course is recommended
  // globally — a bug that was masked while the flagship was also the default.
  const addressedStudyId =
    view.kind === "course" || view.kind === "lesson" || view.kind === "settled"
      ? (nodes?.find((node) => node.studyId === view.studyId && node.courseId === view.courseId)
          ?.studyId ?? null)
      : null;
  useEffect(() => {
    if (addressedStudyId) setNavigationFocus(addressedStudyId);
  }, [addressedStudyId, setNavigationFocus]);

  const addressed = view.kind === "course" || view.kind === "lesson" || view.kind === "settled";
  useEffect(() => {
    if (navigationFocus === undefined || nodes === null) return;
    if (
      typeof navigationFocus !== "string" ||
      !studies.some((study) => study.id === navigationFocus)
    ) {
      writeNavigationFocus(undefined);
      return;
    }
    // Don't overwrite a direct URL's new choice with the previous render's
    // stored route while its validated address is being adopted above.
    if (!addressed || addressedStudyId === navigationFocus) writeNavigationFocus(navigationFocus);
  }, [addressed, addressedStudyId, navigationFocus, nodes, studies]);

  const projectName = useMemo(
    () => studies.find((entry) => entry.id === focusedStudyId)?.title ?? "University",
    [focusedStudyId, studies],
  );

  /* The world asks for a study's next course; a course island asks for its
     own next lesson. Both answers come from the same progress projection. */
  const focusedTodayNode = useMemo(
    () => (nodes ? todayNodeForContext(nodes, view, focusedStudyId, courseProgress) : null),
    [nodes, view, courseProgress, focusedStudyId],
  );
  const focusedNextUpProgress = useMemo(
    () => (focusedTodayNode ? courseProgressForNode(focusedTodayNode) : null),
    [courseProgressForNode, focusedTodayNode],
  );

  const focusStudy = useCallback(
    (studyId: string) => {
      setNavigationFocus(studyId);
      if (view.kind === "course" || view.kind === "lesson" || view.kind === "settled") {
        setView({ kind: "world" });
      }
    },
    [view.kind, setView],
  );

  return { projectName, focusedTodayNode, focusedNextUpProgress, focusStudy };
}
