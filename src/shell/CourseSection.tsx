import { useState } from "react";

import { GameBadge, GameProgress } from "@pieai/swimmer-ui-kit";

import type { CourseView, LessonLocator } from "../view/lesson-view.js";
import { isCurrentLessonCompleted, progressLabel } from "../view/lesson-view.js";

export function CourseSection({
  studyId,
  course,
  onOpenLesson,
  openWhenNothingInProgress = false,
}: {
  readonly studyId: string;
  readonly course: CourseView;
  readonly onOpenLesson: (locator: LessonLocator) => void;
  /** Set on one course so a shelf with no started course still shows a shape. */
  readonly openWhenNothingInProgress?: boolean;
}) {
  const lessons = course.units.flatMap((unit) => unit.lessons);
  // Progress counts only against the revision the lesson is on now, matching
  // the per-lesson badge and the server's choice of next lesson. Counting an
  // old completion would call a course finished while it still has work in it.
  const completed = lessons.filter((lesson) =>
    isCurrentLessonCompleted(lesson.progress, lesson.contentRevision),
  ).length;
  const titleId = `course-title-${course.id}`;
  /*
    Only the course being worked on opens itself.

    Nine published courses, each listing every unit and lesson, made this page
    15,000 pixels tall — reaching the fifth course meant scrolling past seven
    thousand of them, and there was nowhere to stand and see what the study
    contained. The headers and progress bars stay, because that is the scan;
    the lesson lists fold, because that is the detail.

    "Started but not finished" is the one course a returning reader almost
    always wants, so it is the one already open. State is seeded from that and
    then owned by the reader — a fold they opened must not close itself on the
    next render.
  */
  const inProgress = completed > 0 && completed < lessons.length;
  // Exactly one fold starts open. A page where every course is shut asks the
  // reader to click before they can see what a course even looks like.
  const [open, setOpen] = useState(inProgress || openWhenNothingInProgress);
  return (
    <section className="formal-course" aria-labelledby={titleId}>
      <header className="formal-course__header">
        <div>
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
          <span>学完能做到的 {course.objectives.length} 件事</span>
        </summary>
        <ul>
          {course.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
      </details>
      <details
        className="course-units"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>
          <span>
            {course.units.length} 个单元 · {lessons.length} 节课
          </span>
        </summary>
        <div className="unit-list">
          {course.units.map((unit, unitIndex) => (
            <section className="unit-card" key={unit.id}>
              <div className="unit-card__number">{String(unitIndex + 1).padStart(2, "0")}</div>
              <div className="unit-card__body">
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
                          isCurrentLessonCompleted(lesson.progress, lesson.contentRevision)
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
      </details>
    </section>
  );
}
