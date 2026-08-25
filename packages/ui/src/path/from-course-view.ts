/**
 * A course's shape, as the path cards read it.
 *
 * One fold, used by the island's node card, the unit sheet and the settlement's
 * next-step card. The alternative — each screen building its own — is how the
 * settlement came to print a different cost line from the card that had just
 * sold the same lesson.
 */
import type { CourseView, UnitView } from "../view/lesson-view.js";
import type { PathLesson, PathUnit } from "./path-stats.js";

type LessonSummaryOf = CourseView["units"][number]["lessons"][number];

export function pathLessonOf(lesson: LessonSummaryOf): PathLesson {
  return {
    title: lesson.title,
    contentChars: lesson.contentChars,
    exerciseCount: lesson.exerciseCount,
    // Null, not zero: a build whose shelf cannot count citations says nothing
    // about them rather than claiming there are none.
    evidenceCount: lesson.evidenceCount ?? null,
    unlockCount: lesson.unlockCount ?? null,
    ...(lesson.evidenceLocators ? { evidenceLocators: lesson.evidenceLocators } : {}),
  };
}

export function pathUnitOf(unit: UnitView): PathUnit {
  return {
    title: unit.title,
    objective: unit.objective,
    lessons: unit.lessons.map(pathLessonOf),
  };
}
