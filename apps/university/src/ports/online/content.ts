/**
 * Delivery's ContentPort: a published package, frozen on purpose.
 *
 * A customer sees a course only once it has been published (ADR-0002), so this
 * side has no revisions to track — one edition of every lesson, which is why
 * `contentRevision` is the constant 1 rather than a number off the wire.
 */
import { lessonKeyOf, type LessonRef } from "@pieai/university-core";
import type { CardBody, ContentPort, Shelf } from "@pieai/university-ui/content/port.js";
import type { CourseReviewCardLocator, CourseView } from "@pieai/university-ui/view/lesson-view.js";

import {
  evidenceCount,
  evidenceLocatorsIn,
  unlockEntryCount,
} from "@pieai/university-ui/path/path-stats.js";

import { library, loadCourse, peekCourse, type Course } from "../../content/library";
import { assembleLessonView, ONLINE_CONTENT_REVISION } from "../../lesson/assemble-view";
import { progressPort } from "../../progress/store";

export function createOnlineContentPort(): ContentPort {
  const named = library.studies.map((study) => ({ id: study.studyId, title: study.title }));
  return {
    // The manifest is imported JSON: the catalogue is in the bundle, so the
    // capsule can name the series on the very first render.
    knownStudies: named,

    async studies() {
      return named;
    },

    async shelf(): Promise<Shelf> {
      /*
        Every package, once. This is not a new cost: the world map has always
        had to load them all to compute the prerequisite graph, and
        `loadCourse` keeps one promise per course for the session.
      */
      const studies = await Promise.all(
        library.studies.map(async (study) => ({
          id: study.studyId,
          title: study.title,
          courses: await Promise.all(
            study.courses.map(async (summary) =>
              shelfCourse(await loadCourse(study.studyId, summary.courseId), study.defaultCourseId),
            ),
          ),
        })),
      );
      return { studies };
    },

    async lesson(locator: LessonRef) {
      const course = await loadCourse(locator.studyId, locator.courseId);
      const unit = course.units.find((entry) => entry.id === locator.unitId);
      const lesson = unit?.lessons.find((entry) => entry.id === locator.lessonId);
      if (!unit || !lesson) throw new Error("这节课不在这门课里");
      return assembleLessonView({
        course,
        lesson,
        studyId: locator.studyId,
        unitId: unit.id,
        // `lessonKeyOf`, not `lessonRefKey`: the document keys a lesson
        // without its unit, and the two are not interchangeable.
        progress: progressPort.lessonState(lessonKeyOf(locator)),
      });
    },

    async card(card: CourseReviewCardLocator) {
      const course = await loadCourse(card.studyId, card.courseId);
      const found = findCard(course, card);
      if (!found) throw new Error("复习卡内容尚未加载");
      return {
        front: found.front,
        back: found.back,
        contentRevision: ONLINE_CONTENT_REVISION,
      } satisfies CardBody;
    },
  };
}

/** A course this session already fetched, folded into the shared shape. */
export function peekShelfCourse(studyId: string, courseId: string): CourseView | undefined {
  const course = peekCourse(studyId, courseId);
  return course ? shelfCourse(course, null) : undefined;
}

/**
 * A published package as the shelf holds it.
 *
 * `contentChars` is the prose length rather than the prose: it sizes the stone
 * on the course island, and the shelf has no business carrying 3.8 MB of text
 * to answer a question about geometry. `progress` is always null — the shared
 * document answers that, and a second answer here is how one campus ends up
 * drawing a stone the other does not.
 */
function shelfCourse(course: Course, defaultCourseId: string | null): CourseView {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    audience: course.audience,
    objectives: course.objectives,
    status: "active",
    isDefault: course.id === defaultCourseId,
    prerequisiteCourseIds: course.prerequisiteCourseIds,
    trackId: course.trackId,
    units: course.units.map((unit) => ({
      id: unit.id,
      title: unit.title,
      objective: unit.objective,
      status: "active",
      lessons: unit.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        status: "active",
        contentRevision: ONLINE_CONTENT_REVISION,
        cardCount: lesson.cards.length,
        exerciseCount: lesson.exercises.length,
        contentChars: lesson.content.length,
        /*
          Counted here, once, rather than by handing the prose to a card. This
          build has the package in memory; the authoring build has a summary
          and sends none of these, so its cards say nothing about citations
          instead of saying zero.
        */
        evidenceCount: evidenceCount(lesson.content),
        unlockCount: unlockEntryCount(lesson.content),
        evidenceLocators: evidenceLocatorsIn(lesson.content),
        progress: null,
      })),
    })),
  };
}

function findCard(
  course: Course,
  card: CourseReviewCardLocator,
): Course["units"][number]["lessons"][number]["cards"][number] | undefined {
  return course.units
    .flatMap((unit) => unit.lessons)
    .find((lesson) => lesson.id === card.lessonId)
    ?.cards.find((entry) => entry.id === card.cardId);
}
