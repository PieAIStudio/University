/**
 * What the scene is allowed to know about a course.
 *
 * SPEC-0003: a list of course nodes, a ProgressSource, a click handler. No
 * fetch, no localStorage, no SQLite, no `import.meta`. The delivery shell's
 * loaded package is a structural subtype of `Course` below; that richer type
 * stays in the shell because its assets and sections are `packages/ui` view
 * types, and `packages/core` already owns the on-disk `CourseManifest`.
 */

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
  readonly variant?: string | null;
  readonly exercises: readonly unknown[];
  readonly cards: readonly unknown[];
}

/** The fold into CourseShape lives in core. Re-exported so the scene keeps one import. */
export { courseShapeOf } from "@pieai/university-core";
