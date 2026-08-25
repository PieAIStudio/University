/**
 * The 2D course directory's read model.
 *
 * Responsible: the same study → course → unit → lesson tree the world map
 * draws, plus the same prerequisite gates. Both surfaces read the content
 * port's structural shelf and this shell's progress source; this file does not
 * fetch, store, or invent a second graph.
 *
 * Not responsible: camera, islands, search, or a walking-scale fog of war.
 * A lesson more than a few steps ahead is still a lesson. Hiding it to make
 * the list prettier would be the opposite of why this page exists.
 */
import { depthsFromPrerequisites } from "@pieai/university-core";
import {
  courseShapeOf,
  isLessonComplete,
  readCourseProgress,
  type LessonRef,
  type ProgressSource,
} from "@pieai/university-core";
import type { Shelf } from "@pieai/university-ui/content/port.js";

import { library, type Course } from "../content/library";

export interface CatalogLesson {
  readonly id: string;
  readonly title: string;
  readonly variant: string | null;
  readonly state: "done" | "live" | "idle";
}

export interface CatalogUnit {
  readonly id: string;
  readonly title: string;
  readonly lessons: readonly CatalogLesson[];
}

export interface CatalogCourse {
  readonly id: string;
  readonly title: string;
  readonly depth: number;
  readonly prerequisiteCourseIds: readonly string[];
  readonly prerequisiteTitles: readonly string[];
  readonly state: "done" | "live" | "open" | "idle";
  readonly done: number;
  readonly total: number;
  readonly units: readonly CatalogUnit[];
}

export interface CatalogStudy {
  readonly id: string;
  readonly title: string;
  /**
   * True when every course in the study sits at depth 0. Buzz is the example:
   * five courses, no order between them, so they list as a row rather than a
   * climb. A study with several roots *and* a chain behind them is not flat.
   */
  readonly flat: boolean;
  readonly courses: readonly CatalogCourse[];
}

export interface CatalogListing {
  readonly studies: readonly CatalogStudy[];
  readonly totals: {
    readonly studies: number;
    readonly courses: number;
    readonly units: number;
    readonly lessons: number;
  };
  /** The one lesson the world would accent, or null if every lesson is done. */
  readonly nextLesson: LessonRef | null;
}

const courseKey = (studyId: string, courseId: string) => `${studyId}/${courseId}`;

interface CatalogCourseInput {
  readonly id: string;
  readonly title: string;
  readonly prerequisiteCourseIds?: readonly string[];
  readonly units: readonly {
    readonly id: string;
    readonly title: string;
    readonly lessons: readonly {
      readonly id: string;
      readonly title: string;
      readonly variant?: string | null;
      readonly contentRevision: number;
      readonly exerciseIds?: readonly string[];
      readonly exercises?: readonly { readonly id: string }[];
      readonly exerciseIdsComplete?: boolean;
    }[];
  }[];
}

interface CatalogStudyInput {
  readonly id: string;
  readonly title: string;
  readonly courses: readonly CatalogCourseInput[];
}

interface DraftedCourse {
  readonly studyId: string;
  readonly libraryIndex: number;
  readonly id: string;
  readonly title: string;
  readonly depth: number;
  readonly prerequisiteCourseIds: readonly string[];
  readonly prerequisiteTitles: readonly string[];
  readonly done: number;
  readonly total: number;
  readonly complete: boolean;
  readonly summaryLessons: number;
  readonly units: readonly CatalogUnit[];
  readonly state: Exclude<CatalogCourse["state"], "live">;
}

/**
 * Fold the shelf projection, the imported library's ordering, and this shell's
 * progress into one directory.
 *
 * Course order inside a study is library order, stably sorted by depth so a
 * fourteen-layer chain reads as a climb. Same-depth neighbours keep the order
 * the author wrote. Units and lessons are never reordered.
 *
 * Course gates copy the world map's rule, not its file: a course is open when
 * every in-study prerequisite is complete, and exactly one open course is
 * live — the shallowest, ties broken on lesson count so a one-lesson preface
 * does not outrank the spine it introduces.
 */
export function assembleCatalogListing(
  packaged: ReadonlyMap<string, Course>,
  source: ProgressSource,
  catalog = library,
): CatalogListing {
  return assembleCatalogListingFromStudies(
    catalog.studies.map((study) => ({
      id: study.studyId,
      title: study.title,
      courses: study.courses.map((summary) => {
        const course = packaged.get(courseKey(study.studyId, summary.courseId));
        if (!course) {
          throw new Error(`catalog missing package ${study.studyId}/${summary.courseId}`);
        }
        return course;
      }),
    })),
    source,
  );
}

/** Build the same directory from the structural shelf without loading packages. */
export function assembleCatalogListingFromShelf(
  shelf: Shelf,
  source: ProgressSource,
): CatalogListing {
  return assembleCatalogListingFromStudies(shelf.studies, source);
}

function assembleCatalogListingFromStudies(
  studies: readonly CatalogStudyInput[],
  source: ProgressSource,
): CatalogListing {
  const drafted: DraftedCourse[] = [];

  for (const study of studies) {
    const packages = study.courses.map((course) => ({ course }));
    const depths = depthsFromPrerequisites(
      packages.map((entry) => ({
        id: entry.course.id,
        prerequisiteCourseIds: entry.course.prerequisiteCourseIds ?? [],
      })),
    );
    const titleById = new Map(packages.map((entry) => [entry.course.id, entry.course.title]));

    const inStudy: DraftedCourse[] = packages.map(({ course }, libraryIndex) => {
      const progress = readCourseProgress(courseShapeOf(course, study.id), source);
      return {
        studyId: study.id,
        libraryIndex,
        id: course.id,
        title: course.title,
        depth: depths.get(course.id) ?? 0,
        prerequisiteCourseIds: course.prerequisiteCourseIds ?? [],
        prerequisiteTitles: (course.prerequisiteCourseIds ?? []).map(
          (id) => titleById.get(id) ?? id,
        ),
        done: progress.done,
        total: progress.total,
        complete: progress.complete,
        summaryLessons: course.units.reduce((sum, unit) => sum + unit.lessons.length, 0),
        units: unitsOf(study.id, course, source),
        state: "idle",
      };
    });

    for (const entry of inStudy) {
      const unlocked = entry.prerequisiteCourseIds.every((id) => {
        const peer = inStudy.find((candidate) => candidate.id === id);
        return peer?.complete === true;
      });
      drafted.push({
        ...entry,
        state: entry.complete ? "done" : unlocked ? "open" : "idle",
      });
    }
  }

  const live = drafted
    .filter((entry) => entry.state === "open")
    .sort(
      (left, right) => left.depth - right.depth || right.summaryLessons - left.summaryLessons,
    )[0];

  const studyListings = studies.map((study) => {
    const own = drafted
      .filter((entry) => entry.studyId === study.id)
      .sort((left, right) => left.depth - right.depth || left.libraryIndex - right.libraryIndex)
      .map((entry) => toCatalogCourse(entry, live));
    return {
      id: study.id,
      title: study.title,
      flat: own.length > 1 && own.every((course) => course.depth === 0),
      courses: own,
    };
  });

  let units = 0;
  let lessons = 0;
  let courses = 0;
  for (const study of studyListings) {
    courses += study.courses.length;
    for (const course of study.courses) {
      units += course.units.length;
      for (const unit of course.units) lessons += unit.lessons.length;
    }
  }

  return {
    studies: studyListings,
    totals: { studies: studyListings.length, courses, units, lessons },
    nextLesson: nextLessonOf(studyListings, live ?? null),
  };
}

function unitsOf(
  studyId: string,
  course: CatalogCourseInput,
  source: ProgressSource,
): readonly CatalogUnit[] {
  return course.units.map((unit) => ({
    id: unit.id,
    title: unit.title,
    lessons: unit.lessons.map((lesson) => {
      const done = isLessonComplete(
        source.completionOf(
          {
            studyId,
            courseId: course.id,
            unitId: unit.id,
            lessonId: lesson.id,
          },
          {
            contentRevision: lesson.contentRevision,
            exerciseIds:
              lesson.exerciseIds ?? lesson.exercises?.map((exercise) => exercise.id) ?? [],
            ...(lesson.exerciseIdsComplete === false ? { exerciseIdsComplete: false } : {}),
          },
        ),
      );
      return {
        id: lesson.id,
        title: lesson.title,
        variant: lesson.variant ?? null,
        state: done ? ("done" as const) : ("idle" as const),
      };
    }),
  }));
}

function toCatalogCourse(entry: DraftedCourse, live: DraftedCourse | undefined): CatalogCourse {
  const isLive = live?.studyId === entry.studyId && live.id === entry.id;
  return {
    id: entry.id,
    title: entry.title,
    depth: entry.depth,
    prerequisiteCourseIds: entry.prerequisiteCourseIds,
    prerequisiteTitles: entry.prerequisiteTitles,
    state: isLive ? "live" : entry.state,
    done: entry.done,
    total: entry.total,
    units: isLive ? markLiveLesson(entry.units) : entry.units,
  };
}

function markLiveLesson(units: readonly CatalogUnit[]): readonly CatalogUnit[] {
  let marked = false;
  return units.map((unit) => ({
    ...unit,
    lessons: unit.lessons.map((lesson) => {
      if (marked || lesson.state === "done") return lesson;
      marked = true;
      return { ...lesson, state: "live" as const };
    }),
  }));
}

function nextLessonOf(
  studies: readonly CatalogStudy[],
  live: DraftedCourse | null,
): LessonRef | null {
  if (!live) return null;
  const course = studies
    .find((study) => study.id === live.studyId)
    ?.courses.find((entry) => entry.id === live.id);
  if (!course) return null;
  for (const unit of course.units) {
    const lesson = unit.lessons.find((entry) => entry.state === "live");
    if (lesson) {
      return {
        studyId: live.studyId,
        courseId: live.id,
        unitId: unit.id,
        lessonId: lesson.id,
      };
    }
  }
  return null;
}
