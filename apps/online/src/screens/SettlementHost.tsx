import { useSyncExternalStore } from "react";
import { readCourseProgress } from "@pieai/university-core";

import type { Course } from "../content/library";
import { Settlement } from "../lesson/Settlement";
import { courseShapeOf, progressSource } from "../progress/source";
import { snapshot, subscribe } from "../progress/store";
import { settlementSize } from "../world/Maps";

/**
 * Reads the reward out of real state rather than being handed it.
 *
 * The settlement runs after `advanceLesson` and `dropCards` have already
 * committed, so everything it reports is what the store actually holds. A
 * screen that took its numbers as props from the thing that produced them
 * could congratulate a learner for a card that failed to save.
 */
export function SettlementHost({
  course,
  grewFrom,
  studyId,
  unitId,
  lessonId,
  onMap,
  onNext,
}: {
  course: Course;
  grewFrom: { key: string; doneBefore: number } | null;
  studyId: string;
  unitId: string;
  lessonId: string;
  onMap: () => void;
  onNext: (unitId: string, lessonId: string) => void;
}) {
  const progress = useSyncExternalStore(subscribe, snapshot);
  const unit = course.units.find((entry) => entry.id === unitId) ?? course.units[0]!;
  const lesson = unit.lessons.find((entry) => entry.id === lessonId) ?? unit.lessons[0]!;
  const flat = course.units.flatMap((entry) =>
    entry.lessons.map((item) => ({ unitId: entry.id, lesson: item })),
  );
  const index = flat.findIndex((entry) => entry.lesson.id === lesson.id);
  // The button is "the lesson after this one", not the world's accent.
  // `readCourseProgress().next` is the first unfinished lesson in reading
  // order; using it here would send a learner who skipped ahead back to the
  // gap they left, which is the map's job and not this screen's.
  const next = flat[index + 1] ?? null;

  const prefix = `${studyId}/${course.id}/`;
  const { done: doneAfter, total: lessons } = readCourseProgress(
    courseShapeOf(course, studyId),
    progressSource(),
  );

  const dropped = lesson.cards
    .map((card) => ({ card, state: progress.cards[`${prefix}${lesson.id}/${card.id}`] }))
    .flatMap((entry) => (entry.state ? [{ card: entry.card, dueAt: entry.state.dueAt }] : []));

  // Both counts go through the map's own measurement, so the sentence about the
  // island can only say what the island did. With no observed "before" — a
  // reload, a shared link — they are equal and the screen says nothing.
  const doneBefore =
    grewFrom?.key === `${studyId}/${course.id}/${lesson.id}` ? grewFrom.doneBefore : doneAfter;
  const grown = (done: number) =>
    lessons > 0 ? settlementSize(studyId, course.id, lessons, done / lessons).built : 0;

  return (
    <Settlement
      lessonTitle={lesson.title}
      courseTitle={course.title}
      dropped={dropped}
      builtBefore={grown(doneBefore)}
      builtAfter={grown(doneAfter)}
      doneAfter={doneAfter}
      lessons={lessons}
      streakDays={progress.streak.days}
      nextTitle={next?.lesson.title ?? null}
      onNext={next ? () => onNext(next.unitId, next.lesson.id) : null}
      onMap={onMap}
    />
  );
}
