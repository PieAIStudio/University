/**
 * Delivery's ContentPort: a published package, frozen on purpose.
 *
 * A customer sees a course only once it has been published (ADR-0002), so this
 * side has no revisions to track — one edition of every lesson, which is why
 * `contentRevision` is the constant 1 rather than a number off the wire.
 */
import { lessonKeyOf, type LessonRef } from "@pieai/university-core";
import type { CardBody, ContentPort, Shelf } from "@pieai/university-ui/content/port.js";
import type { CourseReviewCardLocator } from "@pieai/university-ui/view/lesson-view.js";

import { library, loadCourse, type Course } from "../../content/library";
import { assembleLessonView, ONLINE_CONTENT_REVISION } from "../../lesson/assemble-view";
import { progressPort } from "../../progress/store";

export function createOnlineContentPort(): ContentPort {
  const named = library.studies.map((study) => ({ id: study.studyId, title: study.title }));
  let shelfPromise: Promise<Shelf> | null = null;
  return {
    // The manifest is imported JSON: the catalogue is in the bundle, so the
    // capsule can name the series on the very first render.
    knownStudies: named,

    async studies() {
      return named;
    },

    async shelf(): Promise<Shelf> {
      shelfPromise ??= fetch("/content/shelf.json").then((response) => {
        if (!response.ok) throw new Error(`shelf: ${response.status}`);
        return response.json() as Promise<Shelf>;
      });
      return shelfPromise;
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

    /*
      No notes in a published package yet.

      Empty rather than absent, and deliberately so: the library draws the
      fifth collection either way, and a customer seeing 「还没有课堂笔记」 is
      being told the truth about a feature that exists. Making the tab
      conditional would have put the delivery build back where this whole round
      started — a surface one half of the product has and the other does not.
      The export pipeline that fills this in is item 11 of the queue.
    */
    async notes() {
      return [];
    },

    noteEvidenceBase(studyId: string, noteId: string) {
      return `/content/${encodeURIComponent(studyId)}/notes/${encodeURIComponent(noteId)}`;
    },
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
