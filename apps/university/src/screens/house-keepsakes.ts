import {
  earnedKeepsakes,
  isLessonComplete,
  progressSourceOf,
  type ProgressDocument,
} from "@pieai/university-core";
import type { HouseKeepsake } from "@pieai/university-ui";
import type { Shelf } from "@pieai/university-ui/content/port.js";
import { progressPort } from "../progress/store.js";

/** What the record says this learner holds, across every course on the shelf. */
export function keepsakesOf(shelf: Shelf | null, progress: ProgressDocument): HouseKeepsake[] {
  if (!shelf) return [];
  const source = progressSourceOf(progressPort);
  return shelf.studies.flatMap((study) =>
    study.courses.flatMap((course) =>
      earnedKeepsakes(
        { studyId: study.id, id: course.id, units: course.units },
        {
          complete: (unitId, lessonId) => {
            const lesson = course.units
              .find((unit) => unit.id === unitId)
              ?.lessons.find((item) => item.id === lessonId);
            return (
              lesson !== undefined &&
              isLessonComplete(
                source.completionOf(
                  { studyId: study.id, courseId: course.id, unitId, lessonId },
                  lesson,
                ),
              )
            );
          },
          hasEvent: (id) => Object.hasOwn(progress.xpEvents, id),
        },
      ).map((keepsake) => ({
        keepsake,
        unitTitle: course.units.find((unit) => unit.id === keepsake.unitId)?.title ?? "",
        courseTitle: course.title,
      })),
    ),
  );
}
