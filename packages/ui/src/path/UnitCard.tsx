import { GameButton } from "@pieai/swimmer-ui-kit";

import { LiquidCtaButton } from "../cta/LiquidCtaButton.js";
import { PathDialog } from "./PathDialog.js";
import {
  START_UNIT_LABEL,
  UNIT_ABILITY_LABEL,
  UNIT_EVIDENCE_HEADING,
  unitEvidenceLocators,
  unitMetaLine,
  type PathUnit,
} from "./path-stats.js";

export type { PathUnit };

/**
 * Screen 03: what this unit is for, before a learner spends a lesson on it.
 *
 * The first-person ability sentence is the slot that sells the unit. Authors
 * have not written those yet, so this version puts `unit.objective` in that
 * slot rather than inventing a voice. The evidence list is coordinates only
 * — path and line range — because the cited repositories do not ship.
 */
export function UnitCard({
  open,
  unit,
  onClose,
  onStart,
  returnFocusTo,
}: {
  readonly open: boolean;
  readonly unit: PathUnit;
  readonly onClose: () => void;
  readonly onStart: () => void;
  readonly returnFocusTo?: HTMLElement | null;
}) {
  return (
    <PathDialog open={open} title={unit.title} onClose={onClose} returnFocusTo={returnFocusTo}>
      <UnitCardBody unit={unit} onStart={onStart} />
    </PathDialog>
  );
}

export function UnitCardBody({
  unit,
  onStart,
  liquid = true,
}: {
  readonly unit: PathUnit;
  readonly onStart: () => void;
  /** NodeCard already owns the one liquid action while its preview is open. */
  readonly liquid?: boolean;
}) {
  const locators = unitEvidenceLocators(unit.lessons);

  return (
    <div className="unit-card">
      <section className="unit-card__ability" aria-label={UNIT_ABILITY_LABEL}>
        <p className="unit-card__ability-label">{UNIT_ABILITY_LABEL}</p>
        <p className="unit-card__ability-text">{unit.objective}</p>
      </section>
      {locators.length > 0 ? (
        <section className="unit-card__evidence" aria-label={UNIT_EVIDENCE_HEADING}>
          <p className="unit-card__evidence-label">{UNIT_EVIDENCE_HEADING}</p>
          <ol className="unit-card__locators">
            {locators.map((locator) => (
              <li key={locator}>
                <code className="unit-card__locator">{locator}</code>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <p className="unit-card__meta">{unitMetaLine(unit.lessons)}</p>
      {liquid ? (
        <LiquidCtaButton width="full" className="path-card__start" onClick={onStart}>
          {START_UNIT_LABEL}
        </LiquidCtaButton>
      ) : (
        <GameButton variant="primary" className="path-card__start" onClick={onStart}>
          {START_UNIT_LABEL}
        </GameButton>
      )}
    </div>
  );
}
