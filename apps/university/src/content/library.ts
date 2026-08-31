/**
 * What this product knows about courses, and how little of it it invents.
 *
 * Everything here is read from files an import produced. No lesson prose, card,
 * exercise or evidence anchor is written in this repository — the parity
 * contract makes that the authoring side's job, and the moment a default or a
 * fallback here starts filling something in, the two halves have begun to
 * drift.
 *
 * The delivery shelf is a generated structural projection: the map, picker,
 * planet and 2D directory fetch `shelf.json` rather than paying for every
 * lesson package. Full course JSON remains an on-demand resource for a lesson
 * or review card, where its prose and answer content are actually needed.
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
import type { LessonAssetView, LessonSectionView } from "@pieai/university-ui";
import type { CourseNode } from "@pieai/university-world/course.js";

type LessonAsset = LessonAssetView;

export interface RepositoryEvidenceAnchor {
  readonly kind: string;
  readonly sourceCommit: string;
  readonly sourcePath: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly note?: string;
  /** Content-addressed snippet written at import; absent when no checkout baked it. */
  readonly snippetUrl?: string;
}

/**
 * A citation on a public authority page. 通用课 has no repository to point at,
 * so its claims are anchored in the documents anyone can already open.
 */
interface UrlEvidenceAnchor {
  readonly kind: string;
  readonly sourceUrl: string;
  readonly sourceTitle: string;
  readonly sourceAuthority: string;
  readonly note?: string;
}

export type EvidenceAnchor = RepositoryEvidenceAnchor | UrlEvidenceAnchor;

export function isRepositoryAnchor(anchor: EvidenceAnchor): anchor is RepositoryEvidenceAnchor {
  return "sourcePath" in anchor;
}

interface Card {
  readonly id: string;
  readonly kind: string;
  readonly front: string;
  readonly back: string;
  readonly tags?: readonly string[];
}

interface Exercise {
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
  readonly contentRevision: number;
  readonly variant?: string | null;
  readonly sections?: readonly LessonSectionView[];
  readonly evidence: readonly EvidenceAnchor[];
  readonly assets: readonly LessonAsset[];
  readonly cards: readonly Card[];
  readonly exercises: readonly Exercise[];
}

interface Unit {
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
    })
    .catch((reason: unknown) => {
      // A failed package is recoverable. Holding the rejected Promise here
      // would make the reader's visible retry press the same failure forever.
      cache.delete(key);
      throw reason;
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
 * render — this is the synchronous answer for a callback that cannot wait.
 *
 * It used to say `loadGraph` had already paid for those fetches. `loadGraph`
 * is gone: the generated shelf replaced the 52-package walk and left the
 * function exported with no callers.
 */
export function peekCourse(studyId: string, courseId: string): Course | undefined {
  return resolved.get(`${studyId}/${courseId}`);
}

/** Defined in `@pieai/university-world`. The map's input contract. */
export type { CourseNode };
