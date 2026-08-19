import { useState } from "react";

import { GameBadge, GameButton, GameProgress } from "@pieai/swimmer-ui-kit";

import type { CourseView, LessonLocator } from "@pieai/university-ui/view/lesson-view.js";
import { isCurrentLessonCompleted, progressLabel } from "@pieai/university-ui/view/lesson-view.js";

export function CourseSection({
  studyId,
  course,
  onOpenLesson,
  openWhenNothingInProgress = false,
  seedOpen = true,
}: {
  readonly studyId: string;
  readonly course: CourseView;
  readonly onOpenLesson: (locator: LessonLocator) => void;
  /** Set on one course so a shelf with no started course still shows a shape. */
  readonly openWhenNothingInProgress?: boolean;
  /** False on a shelf where one unrolled course would hide the others. */
  readonly seedOpen?: boolean;
}) {
  const lessons = course.units.flatMap((unit) =>
    unit.lessons.map((lesson) => ({ unitId: unit.id, lesson })),
  );
  // Progress counts only against the revision the lesson is on now, matching
  // the per-lesson badge and the server's choice of next lesson. Counting an
  // old completion would call a course finished while it still has work in it.
  const completed = lessons.filter((entry) =>
    isCurrentLessonCompleted(entry.lesson.progress, entry.lesson.contentRevision),
  ).length;
  const titleId = `course-title-${course.id}`;
  /*
    Where this course is actually resumed.

    Nine courses, and not one of them offered a way in: to start a course you
    had to unfold it, read down to a unit, and pick the first lesson yourself —
    for the one action a course page exists to support. The first lesson that
    is not done is the honest answer to "where was I", and it is the same
    answer whether the reader has never opened this course or stopped halfway.
  */
  const resume = lessons.find(
    (entry) => !isCurrentLessonCompleted(entry.lesson.progress, entry.lesson.contentRevision),
  );
  const finished = completed === lessons.length && lessons.length > 0;
  const entryPoint = resume ?? lessons[0];
  /*
    Nothing opens itself on a large shelf.

    Folding the lesson lists was a fix for nine courses, and it opened exactly
    one of them — the course being worked on, or else the first — so that a
    reader could see what a course looked like without clicking. TuringPact now
    publishes 31, and the one that opens is a 41-lesson course: 4,717px of a
    16,892px page, standing between the shelf and every other course on it.

    The reason to open one has also expired. Each course already shows a button
    that names the lesson it resumes at, and a line reading 「3 个单元 · 41 节课」.
    Both say what a course is and where you were, without unrolling it. A
    reader who wants the unit list clicks once, which is cheaper than everyone
    else scrolling past it.

    So the seed is kept only where it still pays: a shelf small enough that one
    open course cannot hide the rest.
  */
  const inProgress = completed > 0 && completed < lessons.length;
  const [open, setOpen] = useState(seedOpen && (inProgress || openWhenNothingInProgress));
  return (
    <section className="formal-course" aria-labelledby={titleId}>
      <header className="formal-course__header">
        <div>
          {/*
            No `正式课程 ·` prefix any more. It was set in the largest type on
            the page and repeated on all nine courses, so the four characters
            every title shared were the loudest thing about any of them — and
            the distinction they draw, formal course versus raw study material,
            is already made once at the top of the study. The badge went the
            same way: "课程已发布" was true of every course on screen, and a
            label that never varies is only decoration. "已学完" does vary, so
            it stays.
          */}
          <h2 id={titleId}>{course.title}</h2>
          <p>{course.description}</p>
        </div>
        {finished ? <GameBadge tone="success">已学完</GameBadge> : null}
      </header>
      {/*
        Only once there is progress to show.

        A bar with no number is decoration. "14%" is technically the same fact
        as "3 / 21 节", but only one of them tells you how many evenings are
        left — and lessons are the unit this progress is actually counted in.

        And a bar at zero is not information either; it is a promise of
        information. This study now carries 31 courses, 30 of them unstarted,
        which put thirty empty 20px troughs down the page saying nothing thirty
        times. How long the course is, the fold below already says. A bar on
        screen now means one thing: you have started this one.
      */}
      {completed > 0 ? (
        <GameProgress
          className="course-progress"
          value={completed}
          max={Math.max(lessons.length, 1)}
          label="课程完成度"
          tone={finished ? "success" : "accent"}
          valueLabel={`${completed} / ${lessons.length} 节`}
        />
      ) : null}
      {entryPoint ? (
        <div className="course-entry">
          <GameButton
            variant={finished ? "ghost" : "primary"}
            onClick={() =>
              onOpenLesson({
                studyId,
                courseId: course.id,
                unitId: entryPoint.unitId,
                lessonId: entryPoint.lesson.id,
              })
            }
          >
            {finished
              ? "从头再看一遍"
              : completed === 0
                ? "开始第 1 节"
                : `继续第 ${completed + 1} 节`}
          </GameButton>
          <span className="course-entry__lesson">{entryPoint.lesson.title}</span>
        </div>
      ) : null}
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
