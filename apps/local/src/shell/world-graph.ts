/**
 * Fold the authoring shelf into the scene's CourseNode list.
 *
 * The study endpoint already spreads the course manifest, so prerequisites
 * and track ride along even though `CourseView` does not name them. Reading
 * them here is cheaper than a second graph endpoint, and it keeps the map
 * on the same payload the 2D catalog already paid for.
 */
import { isCurrentLessonCompleted } from "@pieai/university-ui/view/lesson-view.js";
import type { CourseView, StudySummary, StudyView } from "@pieai/university-ui/view/lesson-view.js";
import { depthsFromPrerequisites, type CourseNode } from "@pieai/university-world/course.js";

interface CourseGraphFields {
  readonly prerequisiteCourseIds?: readonly string[];
  readonly trackId?: string | null;
}

function graphOf(course: CourseView): {
  readonly prerequisiteCourseIds: readonly string[];
  readonly trackId: string | null;
} {
  const extra = course as CourseView & CourseGraphFields;
  return {
    prerequisiteCourseIds: extra.prerequisiteCourseIds ?? [],
    trackId: extra.trackId ?? null,
  };
}

export function courseProgressOf(course: CourseView): number {
  const lessons = course.units.flatMap((unit) => unit.lessons);
  if (lessons.length === 0) return 0;
  const done = lessons.filter((lesson) =>
    isCurrentLessonCompleted(lesson.progress, lesson.contentRevision),
  ).length;
  return Math.min(1, done / lessons.length);
}

export function lessonsDoneOf(course: CourseView): number {
  return course.units
    .flatMap((unit) => unit.lessons)
    .filter((lesson) => isCurrentLessonCompleted(lesson.progress, lesson.contentRevision)).length;
}

export function resumeOf(
  course: CourseView,
): { readonly unitId: string; readonly lessonId: string } | null {
  const lessons = course.units.flatMap((unit) =>
    unit.lessons.map((lesson) => ({ unitId: unit.id, lesson })),
  );
  const resume = lessons.find(
    (entry) => !isCurrentLessonCompleted(entry.lesson.progress, entry.lesson.contentRevision),
  );
  const entry = resume ?? lessons[0];
  return entry ? { unitId: entry.unitId, lessonId: entry.lesson.id } : null;
}

export function courseNodesFromCatalog(
  summaries: readonly StudySummary[],
  views: ReadonlyMap<string, StudyView>,
): CourseNode[] {
  const nodes: CourseNode[] = [];
  for (const summary of summaries) {
    const view = views.get(summary.id);
    if (!view) continue;
    const depths = depthsFromPrerequisites(
      view.courses.map((course) => ({
        id: course.id,
        prerequisiteCourseIds: graphOf(course).prerequisiteCourseIds,
      })),
    );
    for (const course of view.courses) {
      const graph = graphOf(course);
      nodes.push({
        courseId: course.id,
        title: course.title,
        lessons: course.units.reduce((count, unit) => count + unit.lessons.length, 0),
        studyId: summary.id,
        studyTitle: summary.title,
        depth: depths.get(course.id) ?? 0,
        prerequisiteCourseIds: graph.prerequisiteCourseIds,
        trackId: graph.trackId,
      });
    }
  }
  return nodes;
}
