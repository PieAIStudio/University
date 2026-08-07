import { GameBadge, GameProgress } from "@pieai/swimmer-ui-kit";

import type { CourseView, LessonLocator } from "../view/lesson-view.js";
import { progressLabel } from "../view/lesson-view.js";

export function CourseSection({
  studyId,
  course,
  onOpenLesson,
}: {
  readonly studyId: string;
  readonly course: CourseView;
  readonly onOpenLesson: (locator: LessonLocator) => void;
}) {
  const lessons = course.units.flatMap((unit) => unit.lessons);
  // Progress counts only against the revision the lesson is on now, matching
  // the per-lesson badge and the server's choice of next lesson. Counting an
  // old completion would call a course finished while it still has work in it.
  const completed = lessons.filter(
    (lesson) =>
      lesson.progress?.status === "completed" &&
      lesson.progress.contentRevision === lesson.contentRevision,
  ).length;
  const titleId = `course-title-${course.id}`;
  return (
    <section className="formal-course" aria-labelledby={titleId}>
      <header className="formal-course__header">
        <div>
          <p className="eyebrow">FORMAL CURRICULUM</p>
          <h2 id={titleId}>正式课程 · {course.title}</h2>
          <p>{course.description}</p>
        </div>
        <GameBadge tone="success">
          {completed === lessons.length ? "已学完" : "课程已发布"}
        </GameBadge>
      </header>
      {/* A bar with no number is decoration. "14%" is technically the same fact
          as "3 / 21 节", but only one of them tells you how many evenings are
          left — and lessons are the unit this progress is actually counted in. */}
      <GameProgress
        className="course-progress"
        value={completed}
        max={Math.max(lessons.length, 1)}
        label="课程完成度"
        tone={completed === lessons.length ? "success" : "accent"}
        valueLabel={`${completed} / ${lessons.length} 节`}
      />
      {/*
        Collapsed by default, and native <details> so it needs no script and
        works with a screen reader for free. These lines are written for someone
        who has finished the course; to someone opening it they are a wall of
        terms they came here precisely because they do not know yet. Shown
        unbidden that reads as "you are not ready for this".
      */}
      <details className="course-objectives">
        <summary>
          <span className="eyebrow">LEARNING OUTCOMES</span>
          <span>学完能做到的 {course.objectives.length} 件事</span>
        </summary>
        <ul>
          {course.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
      </details>
      <div className="unit-list">
        {course.units.map((unit, unitIndex) => (
          <section className="unit-card" key={unit.id}>
            <div className="unit-card__number">{String(unitIndex + 1).padStart(2, "0")}</div>
            <div className="unit-card__body">
              <p className="eyebrow">UNIT</p>
              <h3>{unit.title}</h3>
              <p>{unit.objective}</p>
              <div className="lesson-list">
                {unit.lessons.map((lesson) => (
                  <button
                    type="button"
                    className="lesson-row"
                    key={lesson.id}
                    onClick={() =>
                      onOpenLesson({
                        studyId,
                        courseId: course.id,
                        unitId: unit.id,
                        lessonId: lesson.id,
                      })
                    }
                  >
                    <span>
                      <strong>{lesson.title}</strong>
                      <small>
                        {lesson.exerciseCount} 道练习 · {lesson.cardCount} 张卡片
                      </small>
                    </span>
                    <GameBadge
                      tone={
                        lesson.progress?.status === "completed" &&
                        lesson.progress.contentRevision === lesson.contentRevision
                          ? "success"
                          : "neutral"
                      }
                    >
                      {progressLabel(lesson.progress, lesson.contentRevision)}
                    </GameBadge>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
