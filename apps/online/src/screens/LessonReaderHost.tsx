/**
 * The screen the product's advantage lives on.
 *
 * Everything else here exists in every learning app. A paragraph of explanation
 * sitting next to the exact commit and line range in a shipping private
 * repository does not. This host does not render that paragraph — it wires the
 * shared reader to this shell's ports. A second Markdown pipeline would be
 * drift with a schedule.
 *
 * The one permitted difference is where the grade comes from, and that sits
 * behind GradingPort.
 */
import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { courseShapeOf, readCourseProgress } from "@pieai/university-core";
import { LessonReader } from "@pieai/university-ui/lesson/LessonReader.js";
import { lessonNeighbours } from "@pieai/university-ui/lesson/LessonNav.js";
import { playSound, SoundToggle } from "@pieai/university-ui/sound/index.js";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";

import type { Course } from "../content/library";
import { assembleLessonView } from "../lesson/assemble-view";
import { createOnlineGradingPort } from "../ports/online-grading";
import { createOnlineReaderPort } from "../ports/online-reader";
import { progressSource } from "../progress/source";
import {
  advanceLesson,
  dropCards,
  lessonKey,
  lessonState,
  progressPort,
  snapshot,
  subscribe,
} from "../progress/store";

export function LessonReaderHost({
  course,
  studyId,
  unitId,
  lessonId,
  onBack,
  onSettled,
  onFollowLink,
}: {
  course: Course;
  studyId: string;
  unitId: string;
  lessonId: string;
  onBack: () => void;
  onSettled: (doneBefore: number) => void;
  onFollowLink: (target: {
    readonly courseId: string;
    readonly unitId: string;
    readonly lessonId: string;
  }) => void;
}) {
  const unit = course.units.find((entry) => entry.id === unitId) ?? course.units[0]!;
  const lesson = unit.lessons.find((entry) => entry.id === lessonId) ?? unit.lessons[0]!;
  const locator = useMemo(
    () => ({
      studyId,
      courseId: course.id,
      unitId: unit.id,
      lessonId: lesson.id,
    }),
    [studyId, course.id, unit.id, lesson.id],
  );

  const progress = useSyncExternalStore(subscribe, snapshot);
  const view = useMemo(
    () =>
      assembleLessonView({
        course,
        lesson,
        studyId,
        unitId: unit.id,
        progress: lessonState(lessonKey(studyId, course.id, lesson.id)),
      }),
    [course, lesson, studyId, unit.id, progress],
  );

  const neighbours = useMemo(
    () => lessonNeighbours([courseViewOf(course, studyId)], locator),
    [course, studyId, locator],
  );

  const settledFor = useRef<string | null>(null);
  const finish = useCallback(() => {
    const key = lessonKey(studyId, course.id, lesson.id);
    if (settledFor.current === key) return;
    settledFor.current = key;
    // Counted before the write, because that is the only moment the
    // previous number exists. Deriving it afterwards as `done - 1` was
    // wrong on a lesson finished twice: the count does not move, but the
    // subtraction invented a step and the settlement announced growth the
    // map had not made.
    const doneBefore = readCourseProgress(courseShapeOf(course, studyId), progressSource()).done;
    advanceLesson(key, 1);
    // The drop is the reason to come back tomorrow, so it happens the
    // moment the lesson is passed rather than on some later screen.
    dropCards(
      studyId,
      course.id,
      lesson.id,
      lesson.cards.map((card) => card.id),
    );
    // The reward is the point of the loop, so it gets its own screen
    // rather than a line of green text under a text box.
    onSettled(doneBefore);
  }, [studyId, course, lesson, onSettled]);

  const reader = useMemo(
    () =>
      createOnlineReaderPort({
        progress: progressPort,
        lesson,
        onComplete: () => finish(),
      }),
    [lesson, finish],
  );
  const grading = useMemo(
    () =>
      createOnlineGradingPort({
        lesson,
        onPass: () => finish(),
      }),
    [lesson, finish],
  );

  return (
    <main className="reader">
      <LessonReader
        locator={locator}
        view={view}
        reader={reader}
        grading={grading}
        requestToken=""
        onLearningChanged={async () => undefined}
        neighbours={neighbours}
        onOpenLesson={(next) =>
          onFollowLink({
            courseId: next.courseId,
            unitId: next.unitId,
            lessonId: next.lessonId,
          })
        }
        onBackToCourse={() => {
          playSound("nav.back");
          onBack();
        }}
        onFollowLink={(target) =>
          onFollowLink({
            courseId: target.courseId,
            unitId: target.unitId,
            lessonId: target.lessonId,
          })
        }
        toolbarExtras={<SoundToggle />}
      />
    </main>
  );
}

function courseViewOf(course: Course, studyId: string): CourseView {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    audience: course.audience,
    objectives: course.objectives,
    status: "active",
    isDefault: true,
    units: course.units.map((entry) => ({
      id: entry.id,
      title: entry.title,
      objective: entry.objective,
      status: "active",
      lessons: entry.lessons.map((item) => ({
        id: item.id,
        title: item.title,
        status: "active",
        contentRevision: 1,
        cardCount: item.cards.length,
        exerciseCount: item.exercises.length,
        progress:
          lessonState(lessonKey(studyId, course.id, item.id)).progress >= 1
            ? {
                contentRevision: 1,
                status: "completed" as const,
                progress: 1,
                updatedAt: new Date().toISOString(),
                readConfirmed: true,
              }
            : null,
      })),
    })),
  };
}
