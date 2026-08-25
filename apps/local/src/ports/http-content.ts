/**
 * The authoring campus's ContentPort: the loopback server that reads the disk.
 *
 * What was saved a second ago is on screen now, which is the whole reason this
 * campus exists. Behaviour is the contract: changing a path or a field here is
 * changing what 4317 has always answered, and that is a product change.
 */
import { isSafeId, type LessonRef } from "@pieai/university-core";
import { cardContentPath, lessonPath, readJson } from "@pieai/university-ui/api/client.js";
import type { CardBody, ContentPort } from "@pieai/university-ui/content/port.js";
import type { CourseReviewCardLocator, LessonView } from "@pieai/university-ui/view/lesson-view.js";

/**
 * Ids reach a path join on the far side of this fetch.
 *
 * The address parser deliberately does not enforce a shape — a published id is
 * authored upstream and this side does not get to assume it is a slug. The
 * adapter that turns one into a filesystem question does, because that is where
 * `..` stops being a strange name and becomes a directory traversal.
 */
function guard(locator: LessonRef): void {
  const unsafe = [locator.studyId, locator.courseId, locator.unitId, locator.lessonId].find(
    (id) => !isSafeId(id),
  );
  if (unsafe !== undefined) throw new Error(`这节课的地址不对：${unsafe}`);
}

export function createHttpContentPort(): ContentPort {
  return {
    async lesson(locator, options) {
      guard(locator);
      return readJson<LessonView>(
        await fetch(lessonPath(locator), options?.signal ? { signal: options.signal } : {}),
      );
    },

    async card(card: CourseReviewCardLocator) {
      guard(card);
      return readJson<CardBody>(await fetch(cardContentPath(card)));
    },
  };
}
