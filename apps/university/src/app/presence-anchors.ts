import { useMemo } from "react";
import type { View } from "@pieai/university-core";
import { presenceViewKey } from "@pieai/university-ui/presence.js";
import type { CourseNode } from "@pieai/university-world/course.js";
import type { LessonPlacement } from "@pieai/university-world/Maps.js";
import type { WorldMap } from "@pieai/university-world/WorldMapCanvas.js";

interface PresenceAnchorsOptions {
  readonly view: View;
  /** The view the scene draws: a settled lesson reads as its lesson while its chest opens. */
  readonly sceneView: View;
  readonly lessons: readonly LessonPlacement[];
  readonly focusedTodayNode: CourseNode | null | undefined;
  readonly world: WorldMap | null;
}

/**
 * Where this learner is, as companions see it, and where companions can
 * stand on the scene: lesson stones on a course, islands on the world.
 */
export function usePresenceAnchors({
  view,
  sceneView,
  lessons,
  focusedTodayNode,
  world,
}: PresenceAnchorsOptions) {
  const viewKey = presenceViewKey(view);
  const location = useMemo(() => {
    if (view.kind === "lesson" || view.kind === "settled") {
      return { studyId: view.studyId, courseId: view.courseId, lessonId: view.lessonId };
    }
    if (view.kind === "course") {
      const live = lessons.find((lesson) => lesson.state === "live");
      return {
        studyId: view.studyId,
        courseId: view.courseId,
        lessonId: live?.lessonId ?? null,
      };
    }
    if (focusedTodayNode) {
      return {
        studyId: focusedTodayNode.studyId,
        courseId: focusedTodayNode.courseId,
        lessonId: null,
      };
    }
    return null;
  }, [view, lessons, focusedTodayNode]);
  const anchors = useMemo(() => {
    if (sceneView.kind === "course" || sceneView.kind === "lesson") {
      return lessons.map((lesson) => ({
        id: `lesson:${lesson.lessonId}`,
        position: lesson.position,
      }));
    }
    if (!world) return [];
    return world.placements.map((entry) => ({
      id: `course:${entry.node.studyId}/${entry.node.courseId}`,
      position: entry.position,
    }));
  }, [sceneView.kind, lessons, world]);
  const surface: "course" | "world" =
    sceneView.kind === "course" || sceneView.kind === "lesson" ? "course" : "world";
  return { viewKey, location, anchors, surface };
}
