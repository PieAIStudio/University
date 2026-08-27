import { XP_EXERCISE_FIRST_TRY, XP_READ_LESSON } from "@pieai/university-core";

import type { CourseView } from "../view/lesson-view.js";

export interface CoursePickStats {
  readonly lessons: number;
  readonly exercises: number;
  readonly maxXp: number;
  /** Absent when any lesson summary cannot count its evidence anchors. */
  readonly evidenceCount?: number;
}

/**
 * Fold the shelf's course summary into the numbers the picker can promise.
 *
 * The course package has no duration field. Do not estimate minutes from
 * `contentChars`: a reading-time guess in this card would be invented course
 * data, not a fact the learner can rely on.
 */
export function coursePickStatsOf(course: Pick<CourseView, "units">): CoursePickStats {
  const lessons = course.units.flatMap((unit) => unit.lessons);
  const lessonCount = lessons.length;
  const exerciseCount = lessons.reduce((sum, lesson) => sum + lesson.exerciseCount, 0);
  const evidenceCount = evidenceCountOf(lessons);

  return {
    lessons: lessonCount,
    exercises: exerciseCount,
    maxXp: lessonCount * XP_READ_LESSON + exerciseCount * XP_EXERCISE_FIRST_TRY,
    ...(evidenceCount === undefined ? {} : { evidenceCount }),
  };
}

function evidenceCountOf(
  lessons: readonly CourseView["units"][number]["lessons"][number][],
): number | undefined {
  let total = 0;
  for (const lesson of lessons) {
    const count = lesson.evidenceCount;
    // The authoring shelf omits this field because it does not send lesson
    // bodies. A partial sum would look precise while still being wrong.
    if (count === undefined) return undefined;
    total += count;
  }
  return total;
}
