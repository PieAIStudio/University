/**
 * What the scene is allowed to know about a course.
 *
 * SPEC-0003: a list of course nodes, a ProgressSource, a click handler. No
 * fetch, no localStorage, no SQLite, no `import.meta`. The delivery shell's
 * loaded package is a structural subtype of `Course` below; that richer type
 * stays in the shell because its assets and sections are `packages/ui` view
 * types, and `packages/core` already owns the on-disk `CourseManifest`.
 */

/*
  Re-exported, not redefined. The scene needs course depth and so does the 2D
  catalogue — and the catalogue must not import the scene to get a pure fold,
  the same boundary `courseShapeOf` was moved for. This file held the original;
  `apps/university/src/content/library.ts` had grown a byte-identical second
  copy, kept in step by nobody in particular.
*/
import { depthsFromPrerequisites, type AuthoringFocus } from "@pieai/university-core";

export { depthsFromPrerequisites };

/**
 * A course as a node on the world map.
 *
 * Id, title, lesson count and prerequisites are the map. Study grouping,
 * depth and track travel with the node so the overlay does not keep a
 * second graph.
 */
export interface CourseNode {
  readonly courseId: string;
  readonly title: string;
  readonly lessons: number;
  readonly studyId: string;
  readonly studyTitle: string;
  depth: number;
  prerequisiteCourseIds: readonly string[];
  trackId: string | null;
}

/**
 * A loaded course as the path scene needs it.
 *
 * Units, lesson titles, body length and the counts that pick a kind icon.
 * Prose, evidence and assets are not this package's to own.
 */
export interface Course {
  readonly id: string;
  readonly units: readonly CourseUnit[];
}

export interface CourseUnit {
  readonly id: string;
  readonly title: string;
  readonly lessons: readonly CourseLesson[];
}

export interface CourseLesson {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly contentRevision: number;
  readonly exerciseIds: readonly string[];
  readonly exerciseIdsComplete?: boolean;
  readonly variant?: string | null;
  readonly exercises: readonly { readonly id: string }[];
  readonly cards: readonly unknown[];
}

/** The fold into CourseShape lives in core. Re-exported so the scene keeps one import. */
export { courseShapeOf } from "@pieai/university-core";

/**
 * The whole shelf, folded into the nodes the map places.
 *
 * Depth is computed per study rather than stored, for the reason above. The
 * input is structural — anything with a series id, a title and courses with
 * unit/lesson ids qualifies — so this package still knows nothing about where
 * a course came from, which is the only reason one function can serve a
 * published package and a directory on a disk.
 */
export function courseNodesOf(
  studies: readonly {
    readonly id: string;
    readonly title: string;
    readonly courses: readonly {
      readonly id: string;
      readonly title: string;
      readonly units: readonly { readonly lessons: readonly unknown[] }[];
      readonly prerequisiteCourseIds?: readonly string[];
      readonly trackId?: string | null;
    }[];
  }[],
): CourseNode[] {
  const nodes: CourseNode[] = [];
  for (const study of studies) {
    const depths = depthsFromPrerequisites(
      study.courses.map((course) => ({
        id: course.id,
        prerequisiteCourseIds: course.prerequisiteCourseIds ?? [],
      })),
    );
    for (const course of study.courses) {
      nodes.push({
        courseId: course.id,
        title: course.title,
        lessons: course.units.reduce((count, unit) => count + unit.lessons.length, 0),
        studyId: study.id,
        studyTitle: study.title,
        depth: depths.get(course.id) ?? 0,
        prerequisiteCourseIds: course.prerequisiteCourseIds ?? [],
        trackId: course.trackId ?? null,
      });
    }
  }
  return nodes;
}

/**
 * Whether this island sits outside the authoring shell's focus track.
 *
 * Null or empty authoring focus means nothing is dimmed: the learner shells
 * never pass one, and an authoring session with no pin is the whole campus.
 */
export function isFocusDimmed(
  node: { readonly studyId: string; readonly courseId: string },
  authoringFocus: AuthoringFocus | null | undefined,
): boolean {
  if (!authoringFocus || authoringFocus.courseIds.length === 0) return false;
  return (
    node.studyId !== authoringFocus.studyId || !authoringFocus.courseIds.includes(node.courseId)
  );
}

/**
 * What a study island says under its name.
 *
 * Before anything is finished, the course count orients a chooser. After,
 * the count of finished lessons is "where am I", not how much mountain is left.
 */
export function studySub(courses: number, done: number): string {
  return done > 0 ? `已学 ${done} 关` : `${courses} 门课`;
}
