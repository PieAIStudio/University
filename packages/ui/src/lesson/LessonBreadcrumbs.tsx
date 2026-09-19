import { toPath, WORLD } from "@pieai/university-core";
import { LocationBreadcrumbs } from "../navigation/LocationBreadcrumbs.js";

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
  return (
    <LocationBreadcrumbs
      className="lesson-breadcrumb"
      items={[
        { id: `study:${locator.studyId}`, title: studyTitle, href: toPath(WORLD) },
        {
          id: `course:${locator.courseId}`,
          title: courseTitle,
          href: courseHref,
          onNavigate: onNavigateToCourse,
        },
        {
          id: `unit:${locator.unitId}`,
          title: unitTitle,
          href: courseHref,
          onNavigate: onNavigateToCourse,
          accessibleLabel: translate("ui.lesson.lessonBreadcrumbs.copy.回到课程地图-value0", {
            value0: unitTitle,
          }),
        },
        { id: `lesson:${locator.lessonId}`, title: lessonTitle },
      ]}
    />
  );
}
