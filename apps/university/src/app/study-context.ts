import { type CourseProgress, type View } from "@pieai/university-core";
import type { ShelfStudy } from "@pieai/university-ui/content/port.js";
import type { LearnerNavigationFocus } from "@pieai/university-ui/navigation/StudySwitcher.js";
import { nextCourse } from "@pieai/university-world/Maps.js";
import type { CourseNode } from "@pieai/university-world/course.js";
import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";

interface StudyContextOptions {
  readonly courseProgress: (node: CourseNode) => number;
  readonly courseProgressForNode: (node: CourseNode) => CourseProgress | null;
  readonly focusedStudyId: string | null;
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
  nodes,
  setNavigationFocus,
  setView,
  studies,
  view,
}: StudyContextOptions) {
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
