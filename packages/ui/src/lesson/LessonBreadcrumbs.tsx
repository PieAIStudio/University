import { toPath, WORLD } from "@pieai/university-core";
import { useLayoutEffect, useRef, type MouseEvent } from "react";

import { translate } from "../i18n/index.js";
import type { LessonRef } from "../view/lesson-view.js";

export interface LessonBreadcrumbsProps {
  /** The public lesson address; parent hrefs are derived from this locator. */
  readonly locator: LessonRef;
  readonly studyTitle: string;
  readonly courseTitle: string;
  readonly unitTitle: string;
  readonly lessonTitle: string;
  /** Keeps SPA navigation and its sound/stack behavior when the parent is known. */
  readonly onNavigateToCourse?: () => void;
}

function coursePathOf(locator: LessonRef): string {
  return toPath({
    kind: "course",
    studyId: locator.studyId,
    courseId: locator.courseId,
  });
}

function navigateToCourse(
  event: MouseEvent<HTMLAnchorElement>,
  onNavigateToCourse: (() => void) | undefined,
): void {
  // Keep modified clicks as ordinary links so opening the canonical course in
  // another tab remains possible. The shell callback is only for a normal SPA
  // navigation, where it can preserve the existing back sound and state.
  if (
    !onNavigateToCourse ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  event.preventDefault();
  onNavigateToCourse();
}

/**
 * The lesson's address, made legible and usable without asking the canvas.
 *
 * There is no unit-only route in the canonical router. The unit crumb therefore
 * links to the course map too: it is a real return path, not a second invented
 * address that could drift from `packages/core/src/routing/view.ts`.
 */
export function LessonBreadcrumbs({
  locator,
  studyTitle,
  courseTitle,
  unitTitle,
  lessonTitle,
  onNavigateToCourse,
}: LessonBreadcrumbsProps) {
  const courseHref = coursePathOf(locator);
  const breadcrumbRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    // On a narrow screen the four honest crumbs can be wider than the viewport.
    // Land on the current lesson first; the parent links remain one horizontal
    // swipe away instead of making the learner stare at a path with no endpoint.
    const breadcrumb = breadcrumbRef.current;
    if (breadcrumb) breadcrumb.scrollLeft = breadcrumb.scrollWidth;
  }, [lessonTitle]);

  return (
    <nav
      ref={breadcrumbRef}
      className="lesson-breadcrumb"
      aria-label={translate("ui.lesson.lessonBreadcrumbs.copy.当前位置")}
    >
      <ol className="lesson-breadcrumb__list">
        <li className="lesson-breadcrumb__item">
          <a className="lesson-breadcrumb__link" href={toPath(WORLD)}>
            {studyTitle}
          </a>
        </li>
        <li className="lesson-breadcrumb__item">
          <a
            className="lesson-breadcrumb__link"
            href={courseHref}
            onClick={(event) => navigateToCourse(event, onNavigateToCourse)}
          >
            {courseTitle}
          </a>
        </li>
        <li className="lesson-breadcrumb__item">
          <a
            className="lesson-breadcrumb__link"
            href={courseHref}
            aria-label={translate("ui.lesson.lessonBreadcrumbs.copy.回到课程地图-value0", {
              value0: unitTitle,
            })}
            onClick={(event) => navigateToCourse(event, onNavigateToCourse)}
          >
            {unitTitle}
          </a>
        </li>
        <li className="lesson-breadcrumb__item lesson-breadcrumb__item--current">
          <span className="lesson-breadcrumb__current" aria-current="page">
            {lessonTitle}
          </span>
        </li>
      </ol>
    </nav>
  );
}
