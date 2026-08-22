import { readCourseProgress } from "@pieai/university-core";

import type { Course } from "../content/library";
import { LessonScreen } from "../lesson/Lesson";
import { courseShapeOf, progressSource } from "../progress/source";
import { advanceLesson, dropCards, lessonKey } from "../progress/store";

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
  const flat = course.units.flatMap((entry) => entry.lessons);
  const index = flat.findIndex((entry) => entry.id === lesson.id);

  return (
    <main className="reader">
      <LessonScreen
        lesson={lesson}
        course={course}
        unitId={unit.id}
        courseTitle={course.title}
        unitTitle={unit.title}
        position={`${index + 1}/${flat.length}`}
        onFollowLink={onFollowLink}
        onBack={onBack}
        onPass={() => {
          const key = lessonKey(studyId, course.id, lesson.id);
          // Counted before the write, because that is the only moment the
          // previous number exists. Deriving it afterwards as `done - 1` was
          // wrong on a lesson finished twice: the count does not move, but the
          // subtraction invented a step and the settlement announced growth the
          // map had not made.
          const doneBefore = readCourseProgress(
            courseShapeOf(course, studyId),
            progressSource(),
          ).done;
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
        }}
      />
    </main>
  );
}
