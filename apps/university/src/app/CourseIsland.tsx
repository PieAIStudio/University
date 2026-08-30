import { translate } from "@pieai/university-ui/i18n.js";
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

/**
 * The course island panel, rendered into the narrow underlay and the wide HUD.
 *
 * One component in two slots, not two panels. It was two: the same aside was
 * written out twice in `App.tsx`, and the wide copy had grown a
 * `CourseRouteQuiz` the narrow copy never got — so the quiz did not exist on a
 * phone at all. Which slot the panel lands in is layout; what it contains is
 * not, and `wide` may only decide the first.
 */
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
        {course.units.length} {translate("app.app.courseIsland.copy.单元")}{" "}
        {viewedProgress?.total ?? 0} {translate("app.app.courseIsland.copy.关-还剩")}{" "}
        {viewedProgress ? viewedProgress.total - viewedProgress.done : 0}{" "}
        {translate("app.app.courseIsland.copy.关")}
      </p>
      {pathUnit ? (
        <div className="unit-strip">
          <p className="unit-strip__name">{pathUnit.title}</p>
          <button
            type="button"
            className="unit-strip__list"
            aria-label={translate("app.app.courseIsland.copy.先看这一单元讲什么")}
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
      {/*
        「我该从哪一关开始」, asked once and only where it is live.

        It was in the authoring workbench, three screens from any course and
        compiled out of the delivery build entirely. A learner deciding where
        to start is standing on the island — and only before the first stone is
        done, because a quiz still offering to choose your starting point when
        you are twenty lessons in is asking about a decision you already made.
      */}
      {hasRouteQuiz(course.id) && viewedProgress?.done === 0 ? (
        <CourseRouteQuiz studyId={studyId} course={course} onOpenLesson={onOpenLesson} />
      ) : null}
      {/*
        The way out is pinned, not last.

        On a phone the panel is bounded by the stage and scrolls, and a
        三题分级测验 is tall enough to push this below the panel's own fold. An
        exit you have to discover a scroll to reach is an exit a beginner does
        not have.
      */}
      <button className="ghost block picked__exit" onClick={onBackToMap}>
        {backToMapLabel}
      </button>
    </aside>
  );
}
