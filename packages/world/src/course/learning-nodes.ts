import { Vector3 } from "three";
import {
  nearestLearningSegment,
  learningNodeId,
  type LearningSegment,
  type MapLearningKind,
} from "@pieai/university-core";
import { translate } from "@pieai/university-ui/i18n.js";
import type { LessonPlacement, Marker } from "../Maps.js";

const symbols = { personal: "✦", challenge: "⚡", checkpoint: "◇" } as const;

/** Small DOM targets derived from the one authored road. No new island, lesson,
 * texture or geometry producer; the current label projection owns visibility. */
export function learningOpportunityMarkers(
  lessons: readonly LessonPlacement[],
  segments: readonly LearningSegment[],
  onPick: (segment: LearningSegment, kind: MapLearningKind) => void,
): readonly Marker[] {
  const nearby = nearestLearningSegment(
    segments,
    lessons.find((lesson) => lesson.state === "live")?.lessonId,
  );
  return segments.flatMap((segment) => {
    const index = lessons.findIndex(
      (lesson) => lesson.lessonId === segment.anchorLessonId && lesson.unitId === segment.unitId,
    );
    const anchor = lessons[index];
    if (!anchor) return [];
    const next = lessons[index + 1];
    const previous = lessons[index - 1];
    const tangent = next
      ? next.position.clone().sub(anchor.position)
      : previous
        ? anchor.position.clone().sub(previous.position)
        : new Vector3(0, 0, -1);
    tangent.y = 0;
    if (tangent.lengthSq() < 0.001) tangent.set(0, 0, -1);
    tangent.normalize();
    const side = new Vector3(-tangent.z, 0, tangent.x);
    return (["personal", "challenge", "checkpoint"] as const).map((kind) => {
      const position = anchor.position.clone();
      if (kind === "checkpoint") {
        const distance = next
          ? Math.min(anchor.position.distanceTo(next.position) * 0.5, 3.5)
          : 2.2;
        position.addScaledVector(tangent, distance);
      } else {
        position
          .addScaledVector(side, kind === "personal" ? -3.2 : 3.2)
          .addScaledVector(tangent, -0.5);
      }
      position.y += 1.4;
      const label = `${translate(`mapNodes.${kind}`)} · ${translate("mapNodes.range", { first: segment.firstIndex + 1, last: segment.lastIndex + 1 })}`;
      return {
        id: learningNodeId(segment, kind),
        kind: "icon" as const,
        learningKind: kind,
        text: symbols[kind],
        label,
        position,
        pinned: false,
        quiet: segment.id !== nearby?.id,
        weight: segment.id === nearby?.id ? 2.6 : 0,
        activate: () => onPick(segment, kind),
      };
    });
  });
}
