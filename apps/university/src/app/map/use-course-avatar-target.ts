import { useCallback, useEffect, useState } from "react";
import type { View } from "@pieai/university-core";
import type { LessonPlacement } from "@pieai/university-world/Maps.js";

interface CourseAvatarTarget {
  readonly studyId: string;
  readonly courseId: string;
  readonly lessonId: string | null;
  /** A learning node (gate, pennant or board) the avatar stands at instead of a lesson. */
  readonly nodeId: string | null;
}

/**
 * The course cell the learner last chose, retained through its settlement.
 * The avatar walks to it; leaving for the world or the planet forgets it.
 */
export function useCourseAvatarTarget(view: View) {
  const [target, setTarget] = useState<CourseAvatarTarget | null>(null);
  const rememberLesson = useCallback((lesson: LessonPlacement) => {
    setTarget({
      studyId: lesson.studyId,
      courseId: lesson.courseId,
      lessonId: lesson.lessonId,
      nodeId: null,
    });
  }, []);
  const rememberNode = useCallback(
    (nodeId: string) => {
      if (view.kind !== "course") return;
      setTarget({ studyId: view.studyId, courseId: view.courseId, lessonId: null, nodeId });
    },
    [view],
  );
  const forget = useCallback(() => setTarget(null), []);
  useEffect(() => {
    if (view.kind === "world" || view.kind === "planet") setTarget(null);
  }, [view.kind]);

  const onThisCourse =
    (view.kind === "course" || view.kind === "lesson" || view.kind === "settled") &&
    target?.studyId === view.studyId &&
    target.courseId === view.courseId;
  return {
    /** The lesson stone the avatar stands on in this course, if the learner chose one. */
    lessonId: onThisCourse ? target.lessonId : null,
    /** The learning node the avatar stands at; only the course map shows nodes. */
    nodeId: onThisCourse && view.kind === "course" ? target.nodeId : null,
    rememberLesson,
    rememberNode,
    forget,
  };
}
