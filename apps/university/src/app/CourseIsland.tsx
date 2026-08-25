import type { CourseProgress, LessonRef } from "@pieai/university-core";
import { CourseRouteQuiz, hasRouteQuiz } from "@pieai/university-ui/path/CourseRouteQuiz.js";
import type { CourseView, UnitView } from "@pieai/university-ui/view/lesson-view.js";

export interface CourseIslandProps {
  readonly course: CourseView;
  readonly studyId: string;
  readonly viewedProgress: CourseProgress | null;
  readonly pathUnit: UnitView | undefined;
  readonly unitOverlayOpen: boolean;
  readonly backToMapLabel: string;
  readonly onOpenUnitOverlay: (unitId: string, returnFocusTo: HTMLElement) => void;
  readonly onBackToMap: () => void;
  readonly onOpenLesson: (locator: LessonRef) => void;
}

/** The course island panel, shared by the narrow underlay and wide HUD slots. */
export function CourseIsland({
  course,
  studyId,
  viewedProgress,
  pathUnit,
  unitOverlayOpen,
  backToMapLabel,
  onOpenUnitOverlay,
  onBackToMap,
  onOpenLesson,
}: CourseIslandProps) {
  return (
    <aside className="picked picked--left">
      <h3>{course.title}</h3>
      <p className="picked__study">
        {course.units.length} 单元 · {viewedProgress?.total ?? 0} 关 · 还剩{" "}
        {viewedProgress ? viewedProgress.total - viewedProgress.done : 0} 关
      </p>
      {pathUnit ? (
        <div className="unit-strip">
          <p className="unit-strip__name">{pathUnit.title}</p>
          <button
            type="button"
            className="unit-strip__list"
            aria-label="先看这一单元讲什么"
            aria-haspopup="dialog"
            aria-expanded={unitOverlayOpen ? true : undefined}
            onClick={(event) => onOpenUnitOverlay(pathUnit.id, event.currentTarget)}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path
                d="M3 4.5h10M3 8h10M3 11.5h7"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        </div>
      ) : null}
      {hasRouteQuiz(course.id) && viewedProgress?.done === 0 ? (
        <CourseRouteQuiz studyId={studyId} course={course} onOpenLesson={onOpenLesson} />
      ) : null}
      <button className="ghost block" onClick={onBackToMap}>
        {backToMapLabel}
      </button>
    </aside>
  );
}
