import { useEffect, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";

import { PathDialog } from "./PathDialog.js";
import { UnitCardBody } from "./UnitCard.js";
import {
  PREVIEW_UNIT_LABEL,
  lessonCostLine,
  startButtonLabel,
  unlockEntryCount,
  type PathLesson,
  type PathUnit,
} from "./path-stats.js";

export type { PathLesson, PathUnit };

/**
 * Screen 02: the card that opens on a path node instead of jumping into the
 * lesson. Three layers, same as the Duolingo node popup this copies — title,
 * cost, reward printed on the button — so a tap is a confirmation, not a
 * teleport. URL stays put until Start.
 */
export function NodeCard({
  open,
  lesson,
  unit,
  onClose,
  onStart,
  onStartUnit,
  returnFocusTo,
}: {
  readonly open: boolean;
  readonly lesson: PathLesson;
  readonly unit: PathUnit;
  readonly onClose: () => void;
  readonly onStart: () => void;
  readonly onStartUnit: () => void;
  readonly returnFocusTo?: HTMLElement | null;
}) {
  const [previewUnit, setPreviewUnit] = useState(false);
  const cost = lessonCostLine(lesson);
  const startLabel = startButtonLabel(unlockEntryCount(lesson.content));

  useEffect(() => {
    if (!open) setPreviewUnit(false);
  }, [open]);

  return (
    <PathDialog
      open={open}
      title={lesson.title}
      onClose={() => {
        setPreviewUnit(false);
        onClose();
      }}
      returnFocusTo={returnFocusTo}
    >
      <p className="node-card__cost">{cost}</p>
      <GameButton variant="primary" className="path-card__start" onClick={onStart}>
        {startLabel}
      </GameButton>
      <button
        type="button"
        className="node-card__preview"
        aria-expanded={previewUnit}
        onClick={() => setPreviewUnit((openNow) => !openNow)}
      >
        {PREVIEW_UNIT_LABEL} {previewUnit ? "▴" : "▾"}
      </button>
      {previewUnit ? <UnitCardBody unit={unit} onStart={onStartUnit} /> : null}
    </PathDialog>
  );
}
