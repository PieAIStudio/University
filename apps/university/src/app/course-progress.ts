import {
  courseShapeOf,
  readCourseProgress,
  type ProgressDocument,
  type ProgressSource,
  type View,
} from "@pieai/university-core";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";
import { nextCourse, placeCourse, type LessonPlacement } from "@pieai/university-world/Maps.js";
import { type CourseNode } from "@pieai/university-world/course.js";
import { worldCourse } from "@pieai/university-world/course-map.js";
import { useCallback, useMemo } from "react";

type CourseOf = (studyId: string, courseId: string) => CourseView | null;

interface CourseProgressOptions {
  readonly course: CourseView | null;
  readonly courseOf: CourseOf;
  readonly nodes: readonly CourseNode[] | null;
  readonly progress: ProgressDocument;
  readonly source: ProgressSource;
  readonly view: View;
}

export function useCourseProgress({
  course,
  courseOf,
  nodes,
  progress,
  source,
  view,
}: CourseProgressOptions) {
  const courseProgressForNode = useCallback(
    (node: CourseNode) => {
      const shape = courseOf(node.studyId, node.courseId);
      if (!shape) return null;
      return readCourseProgress(courseShapeOf(shape, node.studyId), source);
    },
    [courseOf, source, progress],
  );

  /** Lessons finished in one course, or 0 for a course not on the shelf yet. */
  const lessonsDone = useCallback(
    (node: CourseNode) => courseProgressForNode(node)?.done ?? 0,
    [courseProgressForNode],
  );

  // A fraction, not a flag. The world map now shows how far a course got, not
  // only whether it is finished, so a course two lessons in has to be able to
  // say so — that partly-built island is the whole reason to come back.
  const courseProgress = useCallback(
    (node: CourseNode) => {
      const current = courseProgressForNode(node);
      return current && current.total > 0 ? Math.min(1, current.done / current.total) : 0;
    },
    [courseProgressForNode],
  );

  /**
   * The course the learner is actually on, as a node rather than a coordinate.
   *
   * This was already computed and used only to aim the camera at it. Pointing a
   * camera at something is not the same as telling anyone about it: the first
   * frame of the product was four unexplained archipelagos and five equally
   * weighted buttons, and the one thing the app already knew — which course to
   * open — was the one thing it did not say.
   *
   * It is computed across every project on purpose, and it used to fall out of
   * the map for free because the map held every project. Now that the map holds
   * one, the two have to be separated: wandering into Buzz to have a look does
   * not stop a learner being three lessons from finishing TuringPact, and
   * 「今天」 should keep saying so.
   */
  const todayNode = useMemo(
    () => (nodes ? nextCourse(nodes, courseProgress) : null),
    [nodes, courseProgress],
  );

  /**
   * Same `{ done, total }` the course path header prints as 「还剩 N 关」.
   * Null only while the course JSON has not resolved this session — then
   * the card names the project and withholds the count rather than inventing a
   * second source.
   */
  const nextUpProgress = useMemo(() => {
    return todayNode ? courseProgressForNode(todayNode) : null;
  }, [todayNode, courseProgressForNode]);

  const lessons: readonly LessonPlacement[] = useMemo(() => {
    if (!course || (view.kind !== "course" && view.kind !== "lesson")) return [];
    // `worldCourse`, not the course itself: the scene needs ids, titles and how
    // long each lesson is, and has no business holding the prose.
    return placeCourse(view.studyId, worldCourse(course), source);
  }, [course, view, source, progress]);

  const viewedProgress = useMemo(() => {
    if (!course || (view.kind !== "course" && view.kind !== "lesson")) return null;
    return readCourseProgress(courseShapeOf(course, view.studyId), source);
  }, [course, view, source, progress]);

  return {
    lessonsDone,
    courseProgress,
    courseProgressForNode,
    lessons,
    viewedProgress,
    nextUpProgress,
    todayNode,
  };
}
