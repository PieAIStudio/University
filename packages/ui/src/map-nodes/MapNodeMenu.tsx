import { useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import {
  learningSegments,
  type LearningSegment,
  type MapLearningKind,
  type SegmentCourse,
} from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";

export const MAP_NODE_SYMBOLS = { personal: "✦", challenge: "⚡", checkpoint: "◇" } as const;
export function MapNodeMenu({
  course,
  onOpen,
}: {
  course: SegmentCourse;
  onOpen: (segment: LearningSegment, kind: MapLearningKind, element: HTMLElement) => void;
}) {
  const { t } = useI18n();
  const segments = learningSegments(course);
  const [selected, setSelected] = useState(segments[0]?.id ?? "");
  const segment = segments.find((item) => item.id === selected) ?? segments[0];
  if (!segment) return null;
  return (
    <details className="map-node-menu">
      <summary>{t("mapNodes.opportunities")}</summary>
      <select
        aria-label={t("mapNodes.opportunities")}
        value={segment.id}
        onChange={(event) => setSelected(event.target.value)}
      >
        {segments.map((item) => (
          <option key={item.id} value={item.id}>
            {t("mapNodes.range", { first: item.firstIndex + 1, last: item.lastIndex + 1 })} ·{" "}
            {item.unitTitle}
          </option>
        ))}
      </select>
      {(["personal", "challenge", "checkpoint"] as const).map((kind) => (
        <GameButton
          variant="secondary"
          key={kind}
          className="map-node-menu__item"
          data-learning-menu={kind}
          onClick={(event) => onOpen(segment, kind, event.currentTarget)}
        >
          <span aria-hidden="true">{MAP_NODE_SYMBOLS[kind]}</span>
          <span>
            <strong>{t(`mapNodes.${kind}`)}</strong>
            <small>{t(`mapNodes.${kind}Pitch`)}</small>
          </span>
        </GameButton>
      ))}
    </details>
  );
}
