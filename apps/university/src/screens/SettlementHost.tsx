import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  courseShapeOf,
  getConceptEntry,
  isLessonComplete,
  progressSourceOf,
  readCourseProgress,
  type LessonRef,
} from "@pieai/university-core";
import { ReviewReminderPrompt, unlockedConceptIds } from "@pieai/university-ui";
import { pathLessonOf, pathUnitOf } from "@pieai/university-ui/path/from-course-view.js";
import { RecapPrompt } from "@pieai/university-ui/review/RecapPrompt.js";
import type { CourseView, LessonView } from "@pieai/university-ui/view/lesson-view.js";
import { settlementSize } from "@pieai/university-world/Maps.js";

import { Settlement, type SettledCard } from "../lesson/Settlement";
import { contentPort, reviewReminderPort } from "../ports/index";
import { progressPort, snapshot, subscribe } from "../progress/store";

/**
 * Reads the reward out of real state rather than being handed it.
 *
 * The settlement runs after the lesson has been banked and its cards dropped,
 * so everything it reports is what the document actually holds. A screen that
 * took its numbers as props from the thing that produced them could
 * congratulate a learner for a card that failed to save.
 */
export function SettlementHost({
  course,
  locator,
  grewFrom,
  reviewReminderDismissedFor,
  onDismissReviewReminder,
  onMap,
  onNext,
  onIncomplete,
}: {
  readonly course: CourseView;
  readonly locator: LessonRef;
  readonly grewFrom: { readonly key: string; readonly doneBefore: number } | null;
  readonly reviewReminderDismissedFor?: string | null;
  readonly onDismissReviewReminder?: (key: string) => void;
  readonly onMap: () => void;
  readonly onNext: (unitId: string, lessonId: string) => void;
  readonly onIncomplete: () => void;
}) {
  const progress = useSyncExternalStore(subscribe, snapshot);
  const source = useMemo(() => progressSourceOf(progressPort), []);
  const [lesson, setLesson] = useState<LessonView | null>(null);
  /*
    Both sides of the cards that just dropped. The front travels on the lesson
    view; the back is a card body, which only `ContentPort` knows how to fetch —
    and this screen is reached in both builds now, so it may not read a package
    directly.
  */
  const [backs, setBacks] = useState<ReadonlyMap<string, string>>(() => new Map());
  const unit = course.units.find((entry) => entry.id === locator.unitId);
  const summary = unit?.lessons.find((entry) => entry.id === locator.lessonId);
  const completed =
    unit != null && summary != null && isLessonComplete(source.completionOf(locator, summary));

  useEffect(() => {
    if (!completed) onIncomplete();
  }, [completed, onIncomplete]);

  useEffect(() => {
    let alive = true;
    void contentPort.lesson(locator).then(async (view) => {
      if (!alive) return;
      setLesson(view);
      const bodies = await Promise.all(
        view.lesson.cards.map(async (card) => {
          try {
            const body = await contentPort.card({
              kind: "course-card",
              ...locator,
              cardId: card.id,
              front: card.front,
              contentRevision: card.contentRevision,
            });
            return [card.id, body.back ?? ""] as const;
          } catch {
            // A card whose body cannot be read still dropped; showing its
            // question without its answer is better than showing neither.
            return [card.id, ""] as const;
          }
        }),
      );
      if (alive) setBacks(new Map(bodies));
    });
    return () => {
      alive = false;
    };
  }, [locator.studyId, locator.courseId, locator.unitId, locator.lessonId]);

  if (!completed || !unit || !summary || !lesson) return null;

  const flat = course.units.flatMap((entry) =>
    entry.lessons.map((item) => ({ unit: entry, lesson: item })),
  );
  const index = flat.findIndex((entry) => entry.lesson.id === summary.id);
  // The button is "the lesson after this one", not the world's accent.
  // `readCourseProgress().next` is the first unfinished lesson in reading
  // order; using it here would send a learner who skipped ahead back to the
  // gap they left, which is the map's job and not this screen's.
  const next = flat[index + 1] ?? null;

  const prefix = `${locator.studyId}/${course.id}/`;
  const { done: doneAfter, total: lessons } = readCourseProgress(
    courseShapeOf(course, locator.studyId),
    source,
  );

  const dropped = lesson.lesson.cards
    .map((card) => ({ card, state: progress.cards[`${prefix}${summary.id}/${card.id}`] }))
    .flatMap((entry) =>
      entry.state
        ? [
            {
              card: {
                id: entry.card.id,
                front: entry.card.front,
                back: backs.get(entry.card.id) ?? "",
              } satisfies SettledCard,
              dueAt: entry.state.dueAt,
            },
          ]
        : [],
    );

  const tomorrowDueCount = progressPort.dueTomorrow();
  const reminderKey = `${locator.studyId}/${course.id}/${summary.id}`;
  const reminderEligible = grewFrom?.key === reminderKey;

  // Both counts go through the map's own measurement, so the sentence about the
  // island can only say what the island did. With no observed "before" — a
  // reload, a shared link — they are equal and the screen says nothing.
  const doneBefore =
    grewFrom?.key === `${locator.studyId}/${course.id}/${summary.id}`
      ? grewFrom.doneBefore
      : doneAfter;
  const grown = (done: number) =>
    lessons > 0 ? settlementSize(locator.studyId, course.id, lessons, done / lessons).built : 0;

  const unlocked = unlockedConceptIds(lesson.lesson.content).flatMap((id) => {
    const entry = getConceptEntry(id);
    return entry ? [{ id: entry.head.id, zh: entry.head.zh, tagline: entry.head.tagline }] : [];
  });

  return (
    <Settlement
      lessonTitle={summary.title}
      courseTitle={course.title}
      dropped={dropped}
      builtBefore={grown(doneBefore)}
      builtAfter={grown(doneAfter)}
      doneBefore={doneBefore}
      doneAfter={doneAfter}
      lessons={lessons}
      streakDays={progress.streak.days}
      unlocked={unlocked}
      recap={
        <RecapPrompt
          locator={locator}
          unitObjective={unit.objective}
          contentRevision={lesson.lesson.contentRevision}
          progress={progressPort}
        />
      }
      tomorrowDueCount={tomorrowDueCount}
      reviewReminder={
        tomorrowDueCount > 0 && reviewReminderPort ? (
          <ReviewReminderPrompt
            dueTomorrow={tomorrowDueCount}
            eligible={reminderEligible}
            eventKey={reminderKey}
            dismissed={reviewReminderDismissedFor === reminderKey}
            onDismiss={() => onDismissReviewReminder?.(reminderKey)}
            reminders={reviewReminderPort}
          />
        ) : null
      }
      nextLesson={next ? pathLessonOf(next.lesson) : null}
      nextUnit={next ? pathUnitOf(next.unit) : null}
      onNext={next ? () => onNext(next.unit.id, next.lesson.id) : null}
      onStartUnit={
        next
          ? () => {
              const first = next.unit.lessons[0];
              if (!first) return;
              onNext(next.unit.id, first.id);
            }
          : null
      }
      onMap={onMap}
    />
  );
}
