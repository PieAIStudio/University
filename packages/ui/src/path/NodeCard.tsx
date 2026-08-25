import { useEffect, useId, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";

import { PathDialog } from "./PathDialog.js";
import { UnitCardBody } from "./UnitCard.js";
import {
  PREVIEW_UNIT_LABEL,
  lessonCostLine,
  startButtonLabel,
  type PathLesson,
  type PathUnit,
} from "./path-stats.js";

export type { PathLesson, PathUnit };
export { unlockedConceptIds } from "./path-stats.js";

/**
 * Screen 02: the card that opens on a path node instead of jumping into the
 * lesson. Three layers, same as the Duolingo node popup this copies — title,
 * cost, reward printed on the button — so a tap is a confirmation, not a
 * teleport. URL stays put until Start.
 *
 * `embedded` is the same card sitting in the settlement instead of floating
 * over the path: screen 12 asks for the next node as a card, not a text
 * link, and a second implementation of this body would be the two cards
 * drifting apart the first time either of them changes.
 */
export function NodeCard({
  open,
  lesson,
  unit,
  onClose,
  onStart,
  onStartUnit,
  returnFocusTo,
  embedded = false,
}: {
  readonly open: boolean;
  readonly lesson: PathLesson;
  readonly unit: PathUnit;
  readonly onClose?: () => void;
  readonly onStart: () => void;
  readonly onStartUnit: () => void;
  readonly returnFocusTo?: HTMLElement | null;
  readonly embedded?: boolean;
}) {
  const headingId = useId();
  const [previewUnit, setPreviewUnit] = useState(false);
  const cost = lessonCostLine(lesson);
  const startLabel = startButtonLabel(lesson.unlockCount);

  useEffect(() => {
    if (!open) setPreviewUnit(false);
  }, [open]);

  const body = (
    <>
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
    </>
  );

  if (embedded) {
    if (!open) return null;
    return (
      <section className="path-card path-card--embedded" aria-labelledby={headingId}>
        <header className="path-card__header">
          <h2 id={headingId} className="path-card__title">
            {lesson.title}
          </h2>
        </header>
        <div className="path-card__body">{body}</div>
      </section>
    );
  }

  return (
    <PathDialog
      open={open}
      title={lesson.title}
      onClose={() => {
        setPreviewUnit(false);
        onClose?.();
      }}
      returnFocusTo={returnFocusTo}
    >
      {body}
    </PathDialog>
  );
}
