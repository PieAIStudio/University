import { useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import type { AssemblyStep } from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";
import { PathArtifact } from "./PathArtifact.js";

export function PathAssembly({
  step,
  answer,
  submitted,
  onAdd,
  onRemove,
  onMove,
}: {
  readonly step: AssemblyStep;
  readonly answer: readonly string[];
  readonly submitted: boolean;
  readonly onAdd: (id: string) => void;
  readonly onRemove: (id: string) => void;
  readonly onMove: (index: number, delta: number) => void;
}) {
  const { t } = useI18n();
  const [ordering, setOrdering] = useState(false);
  return (
    <div className="path-workbench">
      <PathArtifact
        title={t(step.initialPieceIds.length ? "path.repairDraft" : "path.buildDraft")}
        tools={
          answer.length > 1 ? (
            <GameButton
              type="button"
              variant="ghost"
              sound={false}
              static
              aria-pressed={ordering}
              onClick={() => setOrdering(!ordering)}
            >
              {t(ordering ? "path.finishOrdering" : "path.changeOrder")}
            </GameButton>
          ) : null
        }
      >
        <ol className="interaction-path__assembly" aria-label={t("path.artifact")}>
          {answer.map((id, pieceIndex) => {
            const label = step.pieces.find((piece) => piece.id === id)!.label;
            return (
              <li key={id}>
                <span className="path-workbench__line" data-piece-row={id} tabIndex={-1}>
                  {label}
                </span>
                <div className="interaction-path__piece-actions">
                  {ordering ? (
                    <>
                      <GameButton
                        type="button"
                        variant="ghost"
                        sound={false}
                        static
                        aria-label={t("path.upLabel", { label })}
                        disabled={submitted || pieceIndex === 0}
                        onClick={() => onMove(pieceIndex, -1)}
                      >
                        {t("path.up")}
                      </GameButton>
                      <GameButton
                        type="button"
                        variant="ghost"
                        sound={false}
                        static
                        aria-label={t("path.downLabel", { label })}
                        disabled={submitted || pieceIndex === answer.length - 1}
                        onClick={() => onMove(pieceIndex, 1)}
                      >
                        {t("path.down")}
                      </GameButton>
                    </>
                  ) : null}
                  <GameButton
                    type="button"
                    variant="ghost"
                    sound={false}
                    static
                    aria-label={t("path.removeLabel", { label })}
                    disabled={submitted}
                    onClick={() => onRemove(id)}
                  >
                    {t("path.remove")}
                  </GameButton>
                </div>
              </li>
            );
          })}
        </ol>
        {!answer.length ? (
          <div className="path-workbench__blank">
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <p>{t("path.empty")}</p>
          </div>
        ) : null}
      </PathArtifact>
      <section className="path-workbench__supply" aria-label={t("path.pieces")}>
        <h3>{t("path.pieces")}</h3>
        <p className="path-workbench__instruction">{t("path.addInstruction")}</p>
        <div className="interaction-path__pieces" role="group" aria-label={t("path.pieces")}>
          {step.pieces.map((piece) => (
            <GameButton
              key={piece.id}
              data-piece={piece.id}
              type="button"
              variant={answer.includes(piece.id) && !submitted ? "primary" : "secondary"}
              sound={false}
              static
              disabled={submitted}
              aria-label={piece.label}
              aria-pressed={answer.includes(piece.id)}
              onClick={() => (answer.includes(piece.id) ? onRemove(piece.id) : onAdd(piece.id))}
            >
              <svg className="path-workbench__add" viewBox="0 0 24 24" aria-hidden="true">
                <path d={answer.includes(piece.id) ? "m5 12 4 4L19 6" : "M12 5v14M5 12h14"} />
              </svg>
              <span className="path-workbench__choice-label">{piece.label}</span>
            </GameButton>
          ))}
        </div>
        {!step.pieces.some((piece) => !answer.includes(piece.id)) ? (
          <p>{t("path.allAdded")}</p>
        ) : null}
        <details className="path-workbench__requirements">
          <summary>{t("path.constraints")}</summary>
          <ul className="interaction-path__constraints">
            {[...new Set(step.constraints.map((rule) => rule.label))].map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}
