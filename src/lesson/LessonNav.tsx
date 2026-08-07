import { GameButton } from "@pieai/swimmer-ui-kit";

import type { CourseView, LessonLocator } from "../view/lesson-view.js";

export interface LessonNeighbour extends LessonLocator {
  readonly title: string;
}

export interface LessonNeighbours {
  readonly previous: LessonNeighbour | null;
  readonly next: LessonNeighbour | null;
  /** 1-based position within the course, for "第 7 节 / 共 41 节". */
  readonly position: number;
  readonly total: number;
}

/**
 * The lesson before and after this one, within its own course.
 *
 * Flattened across units rather than stopping at unit boundaries, because a
 * unit boundary is an authoring decision the learner never agreed to — running
 * out of "next" three lessons in reads as the course ending.
 *
 * Deliberately does not cross into another course. Courses have their own
 * audiences and prerequisites, so falling out of one into whichever happens to
 * sort next would be a worse surprise than stopping.
 */
export function lessonNeighbours(
  courses: readonly CourseView[],
  locator: LessonLocator,
): LessonNeighbours | null {
  const course = courses.find((item) => item.id === locator.courseId);
  if (!course) return null;
  const flat = course.units.flatMap((unit) =>
    unit.lessons.map((lesson) => ({
      studyId: locator.studyId,
      courseId: course.id,
      unitId: unit.id,
      lessonId: lesson.id,
      title: lesson.title,
    })),
  );
  const index = flat.findIndex((item) => item.lessonId === locator.lessonId);
  if (index === -1) return null;
  return {
    previous: flat[index - 1] ?? null,
    next: flat[index + 1] ?? null,
    position: index + 1,
    total: flat.length,
  };
}

/**
 * Where to go when this lesson is done.
 *
 * Rendered twice per lesson — once quietly above the title, once properly at
 * the end. The bottom copy is the one that matters: finishing a lesson and
 * finding nothing but whitespace is the moment a learner leaves, and asking
 * them to scroll back up to a breadcrumb to continue is asking them to do the
 * app's job.
 */
export function LessonNav({
  neighbours,
  onOpenLesson,
  onBackToCourse,
  variant,
}: {
  readonly neighbours: LessonNeighbours;
  readonly onOpenLesson: (locator: LessonLocator) => void;
  readonly onBackToCourse: () => void;
  readonly variant: "top" | "bottom";
}) {
  const { previous, next } = neighbours;
  const position = (
    <span className="lesson-nav__position">
      第 {neighbours.position} 节 / 共 {neighbours.total} 节
    </span>
  );

  // Above the title this is a breadcrumb: where am I, and how do I get out.
  // Titles are left off on purpose — a second set of lesson names competing
  // with the actual heading is exactly the noise this variant exists to avoid.
  if (variant === "top") {
    return (
      <nav className="lesson-nav lesson-nav--top" aria-label="课程导航">
        <GameButton variant="ghost" onClick={onBackToCourse}>
          ← 返回课程
        </GameButton>
        {position}
        <span className="lesson-nav__steps">
          {previous ? (
            <GameButton variant="ghost" onClick={() => onOpenLesson(previous)}>
              上一节
            </GameButton>
          ) : null}
          {next ? (
            <GameButton variant="ghost" onClick={() => onOpenLesson(next)}>
              下一节
            </GameButton>
          ) : null}
        </span>
      </nav>
    );
  }

  return (
    <nav className="lesson-nav lesson-nav--bottom" aria-label="学完这节之后">
      <div className="lesson-nav__side">
        {previous ? (
          <GameButton variant="ghost" onClick={() => onOpenLesson(previous)}>
            <span className="lesson-nav__step">← 上一节</span>
            <span className="lesson-nav__title">{previous.title}</span>
          </GameButton>
        ) : null}
      </div>
      <div className="lesson-nav__centre">
        <GameButton variant="ghost" onClick={onBackToCourse}>
          回到目录
        </GameButton>
        {position}
      </div>
      <div className="lesson-nav__side lesson-nav__side--end">
        {next ? (
          <GameButton variant="primary" onClick={() => onOpenLesson(next)}>
            <span className="lesson-nav__step">下一节 →</span>
            <span className="lesson-nav__title">{next.title}</span>
          </GameButton>
        ) : null}
      </div>
    </nav>
  );
}
