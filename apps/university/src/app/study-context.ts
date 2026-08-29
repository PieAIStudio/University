import { type CourseProgress, type View } from "@pieai/university-core";
import type { ShelfStudy } from "@pieai/university-ui/content/port.js";
import { nextCourse } from "@pieai/university-world/Maps.js";
import type { CourseNode } from "@pieai/university-world/course.js";
import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";

interface StudyContextOptions {
  readonly courseProgress: (node: CourseNode) => number;
  readonly courseProgressForNode: (node: CourseNode) => CourseProgress | null;
  readonly focusedStudyId: string | null;
  readonly nodes: readonly CourseNode[] | null;
  readonly setMapFocus: Dispatch<SetStateAction<string | null | undefined>>;
  readonly setView: (next: View) => void;
  readonly studies: readonly ShelfStudy[];
  readonly view: View;
}

export function useStudyContext({
  courseProgress,
  courseProgressForNode,
  focusedStudyId,
  nodes,
  setMapFocus,
  setView,
  studies,
  view,
}: StudyContextOptions) {
  const projectName = useMemo(
    () => studies.find((entry) => entry.id === focusedStudyId)?.title ?? "University",
    [focusedStudyId, studies],
  );

  /*
    `todayNode` is the account-wide recommendation used to choose the first
    project in a fresh session. Once the map has a focused project, the context
    panel must ask the same question inside that project; otherwise the map and
    the panel can truthfully answer two different places at once.
  */
  const focusedTodayNode = useMemo(
    () => (nodes && focusedStudyId ? nextCourse(nodes, courseProgress, focusedStudyId) : null),
    [nodes, courseProgress, focusedStudyId],
  );
  const focusedNextUpProgress = useMemo(
    () => (focusedTodayNode ? courseProgressForNode(focusedTodayNode) : null),
    [courseProgressForNode, focusedTodayNode],
  );

  const focusStudy = useCallback(
    (studyId: string) => {
      setMapFocus(studyId);
      if (view.kind === "course" || view.kind === "lesson" || view.kind === "settled") {
        setView({ kind: "world" });
      }
    },
    [view.kind, setView],
  );

  return { projectName, focusedTodayNode, focusedNextUpProgress, focusStudy };
}
