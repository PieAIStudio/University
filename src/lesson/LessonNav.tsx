import { GameBadge, GameButton } from "@pieai/swimmer-ui-kit";

import { Tip } from "../Tip.js";
import type { DetailMode } from "../language/detail-mode.js";
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
 * Every lesson control in one sticky band: leave, position, reading prefs,
 * status, and prev/next. Sits under the campus header so the reader never has
 * to scroll back up for navigation or the detail switch.
 */
export function LessonToolbar({
  neighbours,
  onOpenLesson,
  onBackToCourse,
  annotated,
  englishMode,
  onEnglishModeChange,
  detailMode,
  onDetailModeChange,
  completed,
  readConfirmed,
}: {
  readonly neighbours: LessonNeighbours;
  readonly onOpenLesson: (locator: LessonLocator) => void;
  readonly onBackToCourse: () => void;
  readonly annotated: boolean;
  readonly englishMode: boolean;
  readonly onEnglishModeChange: (enabled: boolean) => void;
  readonly detailMode: DetailMode;
  readonly onDetailModeChange: (mode: DetailMode) => void;
  readonly completed: boolean;
  readonly readConfirmed: boolean;
}) {
  const { previous, next } = neighbours;
  const detailed = detailMode === "all";

  return (
    <div className="lesson-toolbar">
      <nav className="lesson-toolbar__nav" aria-label="课程导航">
        <GameButton variant="ghost" onClick={onBackToCourse}>
          ← 返回课程
        </GameButton>
        <span className="lesson-toolbar__position">
          第 {neighbours.position} 节 / 共 {neighbours.total} 节
        </span>
      </nav>

      <div className="lesson-toolbar__settings">
        {annotated ? (
          // Only offered where there is something to offer. A toggle that
          // does nothing on most lessons teaches the learner to ignore it.
          <Tip term="english-mode">
            <button
              type="button"
              className="english-toggle"
              aria-pressed={englishMode}
              onClick={() => onEnglishModeChange(!englishMode)}
            >
              {englishMode ? "外语模式 · 开" : "外语模式 · 关"}
            </button>
          </Tip>
        ) : null}

        <div className="lesson-detail-switch">
          <span className="lesson-detail-switch__label" id="lesson-detail-switch-label">
            讲解层级
          </span>
          <button
            type="button"
            className="lesson-detail-switch__control"
            role="switch"
            aria-checked={detailed}
            aria-labelledby="lesson-detail-switch-label"
            onClick={() => onDetailModeChange(detailed ? "standard" : "all")}
          >
            <span className="lesson-detail-switch__option" data-active={!detailed || undefined}>
              标准讲解
            </span>
            <span className="lesson-detail-switch__option" data-active={detailed || undefined}>
              详细讲解
            </span>
          </button>
        </div>

        <GameBadge tone={completed ? "success" : "warning"}>
          {completed ? "已完成" : readConfirmed ? "课文已确认 · 练习待完成" : "待确认本次更新"}
        </GameBadge>
      </div>

      <div className="lesson-toolbar__steps">
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
      </div>
    </div>
  );
}
