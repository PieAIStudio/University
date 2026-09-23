import {
  nearestLearningSegment,
  type LearningSegment,
  type MapLearningKind,
} from "@pieai/university-core";
import { translate } from "@pieai/university-ui/i18n.js";
import type { LessonPlacement, Marker } from "../Maps.js";
import { courseLearningSites, LEARNING_SITE_HEIGHT } from "./learning-sites.js";

const symbols = { personal: "✦", challenge: "⚡", checkpoint: "◇" } as const;
/**
 * Clearance between the top of an object and the bottom of the chip that names
 * it. Chips are bottom-anchored; a taller lift climbs into whatever stands
 * behind the object once the steep course camera folds depth into height.
 */
const CHIP_GAP = 0.45;
/** Where a chip floats when its node found no free ground and draws no object. */
const UNRESOLVED_LIFT = 1.4;

/**
 * DOM chips for the learning nodes. Their positions come from the same
 * `courseLearningSites` the 3D objects stand on, so the chip always names the
 * thing under it; the label projection still owns visibility.
 */
export function learningOpportunityMarkers(
  lessons: readonly LessonPlacement[],
  segments: readonly LearningSegment[],
  onPick: (segment: LearningSegment, kind: MapLearningKind) => void,
): readonly Marker[] {
  const nearby = nearestLearningSegment(
    segments,
    lessons.find((lesson) => lesson.state === "live")?.lessonId,
  );
  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  return courseLearningSites(lessons).flatMap((site) => {
    // The app's segments carry the real unit titles; the sites carry geometry.
    const segment = byId.get(site.segment.id);
    if (!segment) return [];
    const position = site.object.clone();
    position.y += site.resolved ? LEARNING_SITE_HEIGHT[site.kind] + CHIP_GAP : UNRESOLVED_LIFT;
    const label = `${translate(`mapNodes.${site.kind}`)} · ${translate("mapNodes.range", { first: segment.firstIndex + 1, last: segment.lastIndex + 1 })}`;
    return [
      {
        id: site.id,
        kind: "icon" as const,
        learningKind: site.kind,
        text: symbols[site.kind],
        label,
        position,
        pinned: false,
        quiet: segment.id !== nearby?.id,
        weight: segment.id === nearby?.id ? 2.6 : 0,
        activate: () => onPick(segment, site.kind),
      },
    ];
  });
}
