import {
  earnedKeepsakes,
  type HouseState,
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

let arrival: string | null = null;

/** A chest's keepsake is on its way in: the house lights it once. */
export function arriveAt(id: string): void {
  arrival = id;
}

export function takeArrival(): string | null {
  const id = arrival;
  arrival = null;
  return id;
}

// A string, not the object: accountData() returns a fresh copy on every call,
// and a snapshot that is never equal to itself re-renders forever.
export const readHouse = () => JSON.stringify(progressPort.accountData().preferences.house ?? null);

export function saveHouse(next: HouseState): void {
  const preferences = progressPort.accountData().preferences;
  progressPort.setAccountPreferences({
    ...preferences,
    house: next,
    updatedAt: { ...preferences.updatedAt, house: new Date().toISOString() },
  });
}

export function localDay(time = Date.now()): string {
  const day = new Date(time);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}
