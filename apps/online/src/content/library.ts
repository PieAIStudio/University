/**
 * What this product knows about courses, and how little of it it invents.
 *
 * Everything here is read from files an import produced. No lesson prose, card,
 * exercise or evidence anchor is written in this repository — the parity
 * contract makes that the authoring side's job, and the moment a default or a
 * fallback here starts filling something in, the two halves have begun to
 * drift.
 *
 * Courses load one at a time. The library is 52 courses and 3.8 MB of lesson
 * JSON after assets are lifted out at import; loading all of it to draw a map
 * that only needs titles and counts would be paying the whole download to
 * answer "where am I".
 */
import imported from "./imported.json";

/**
 * The asset shape is not this product's to define.
 *
 * It is the authoring side's, and it now lives in the shared package, so both
 * shells describe the same picture with the same words. The import pipeline
 * spreads the upstream asset and only swaps its inline base64 for a `url`,
 * which means everything the reader needs — id, kind, mime, alt — was always
 * there; only this repository's type was a stub.
 */
import type { AnswerKey } from "@pieai/university-core";
import type { LessonAssetView } from "@pieai/university-ui";

export type LessonAsset = LessonAssetView;

export interface EvidenceAnchor {
  readonly kind: string;
  readonly sourceCommit: string;
  readonly sourcePath: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly note?: string;
  /** Content-addressed snippet written at import; absent when no checkout baked it. */
  readonly snippetUrl?: string;
}

export interface Card {
  readonly id: string;
  readonly kind: string;
  readonly front: string;
  readonly back: string;
  readonly tags?: readonly string[];
}

export interface Exercise {
  readonly id: string;
  readonly kind: string;
  readonly title?: string;
  readonly prompt: string;
  readonly answerKey?: AnswerKey;
}

export interface Lesson {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly variant?: string | null;
  readonly evidence: readonly EvidenceAnchor[];
  readonly assets: readonly LessonAsset[];
  readonly cards: readonly Card[];
  readonly exercises: readonly Exercise[];
}

export interface Unit {
  readonly id: string;
  readonly title: string;
  readonly objective: string;
  readonly lessons: readonly Lesson[];
}

export interface Course {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly audience: string;
  readonly objectives: readonly string[];
  readonly prerequisiteCourseIds: readonly string[];
  readonly trackId: string | null;
  readonly units: readonly Unit[];
}

interface LibraryCourse {
  readonly courseId: string;
  readonly title: string;
  readonly sha256: string;
  readonly packageBytes: number;
  readonly servedBytes: number;
  readonly lessons: number;
}

interface LibraryStudy {
  readonly studyId: string;
  readonly title: string;
  readonly defaultCourseId: string | null;
  readonly courses: readonly LibraryCourse[];
}

export const library = imported as {
  readonly importedAt: string;
  readonly studies: readonly LibraryStudy[];
};

export const hasContent = library.studies.length > 0;

const cache = new Map<string, Promise<Course>>();
const resolved = new Map<string, Course>();

/** One course, fetched once, kept for the session. */
export function loadCourse(studyId: string, courseId: string): Promise<Course> {
  const key = `${studyId}/${courseId}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const pending = fetch(`/content/${studyId}/${courseId}.json`)
    .then((response) => {
      if (!response.ok) throw new Error(`${key}: ${response.status}`);
      return response.json();
    })
    .then((pkg: { course: Course }) => {
      resolved.set(key, pkg.course);
      return pkg.course;
    });
  cache.set(key, pending);
  return pending;
}

/**
 * A course this session has already fetched, or undefined if it has not
 * resolved yet.
 *
 * The world map asks the progress contract how far each island got, and that
 * question needs the course's units and lesson ids on the same tick as the
 * render. `loadGraph` has already paid for those fetches; this is the
 * synchronous answer for a callback that cannot wait.
 */
export function peekCourse(studyId: string, courseId: string): Course | undefined {
  return resolved.get(`${studyId}/${courseId}`);
}

export interface CourseNode extends LibraryCourse {
  readonly studyId: string;
  readonly studyTitle: string;
  /** Distance from a root along prerequisites, computed over this study. */
  depth: number;
  prerequisiteCourseIds: readonly string[];
  trackId: string | null;
}

/**
 * Distance from a root along prerequisites, computed over one study.
 *
 * Depth is a property of the set, not of a course: adding one prerequisite
 * upstream moves everything behind it. Storing it on the package would be this
 * repository keeping a second copy of the course structure, which is the drift
 * the parity contract exists to prevent — so both the world map and the 2D
 * directory derive it with this function.
 *
 * A prerequisite the schema cannot express across studies reads as a root
 * rather than as an error.
 */
export function depthsFromPrerequisites(
  courses: readonly {
    readonly id: string;
    readonly prerequisiteCourseIds: readonly string[];
  }[],
): Map<string, number> {
  const byId = new Map(courses.map((course) => [course.id, course]));
  const depths = new Map<string, number>();
  const visiting = new Set<string>();
  const walk = (id: string): number => {
    const known = depths.get(id);
    if (known !== undefined) return known;
    const course = byId.get(id);
    if (!course || visiting.has(id)) return 0;
    visiting.add(id);
    const depth = course.prerequisiteCourseIds.length
      ? Math.max(...course.prerequisiteCourseIds.map(walk)) + 1
      : 0;
    visiting.delete(id);
    depths.set(id, depth);
    return depth;
  };
  for (const course of courses) walk(course.id);
  return depths;
}

/**
 * The map's nodes, with depth computed rather than stored.
 *
 * Prerequisites are not in the tracked manifest, so this needs the courses
 * themselves. It is the one place that pays for loading them all, and it is
 * called once.
 */
export async function loadGraph(): Promise<readonly CourseNode[]> {
  const nodes: CourseNode[] = [];
  for (const study of library.studies) {
    const courses = await Promise.all(
      study.courses.map((summary) => loadCourse(study.studyId, summary.courseId)),
    );
    const byId = new Map(courses.map((course) => [course.id, course]));
    const depths = depthsFromPrerequisites(courses);
    for (const summary of study.courses) {
      const course = byId.get(summary.courseId);
      nodes.push({
        ...summary,
        studyId: study.studyId,
        studyTitle: study.title,
        depth: depths.get(summary.courseId) ?? 0,
        prerequisiteCourseIds: course?.prerequisiteCourseIds ?? [],
        trackId: course?.trackId ?? null,
      });
    }
  }
  return nodes;
}
