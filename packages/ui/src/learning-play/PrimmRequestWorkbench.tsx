import { useId } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { useI18n } from "../i18n/index.js";
import type { PrimmActivity } from "./primm-types.js";

export interface RequestFragment {
  readonly id: string;
  readonly text: string;
}
export const joinRequestFragments = (fragments: readonly RequestFragment[]) =>
  fragments
    .map((fragment) => fragment.text.trim())
    .filter(Boolean)
    .join("\n");

/** Editable/reorderable scaffolding, not a multiple-choice answer bank. */
export function PrimmRequestWorkbench({
  workbench,
  fragments,
  observation,
  disabled,
  onChange,
}: {
  readonly workbench: NonNullable<PrimmActivity["modify"]["workbench"]>;
  readonly fragments: readonly RequestFragment[];
  readonly observation: string;
  readonly disabled: boolean;
  readonly onChange: (fragments: readonly RequestFragment[]) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const prompt = joinRequestFragments(fragments);
  const available = [
    ...workbench.pieces,
    ...(workbench.carryObservation && observation.trim()
      ? [{ id: "observation", label: t("primm.myObservation"), text: observation }]
      : []),
  ];
  const labelOf = (key: string) =>
    key === "starter"
      ? t("primm.originalRequest")
      : (available.find((piece) => piece.id === key)?.label ?? t("primm.myWords"));
  function change(next: readonly RequestFragment[]) {
    if (!disabled && next.length <= 12 && joinRequestFragments(next).length <= 2000) onChange(next);
  }
  function move(from: number, to: number) {
    if (from < 0 || to < 0 || from >= fragments.length || to >= fragments.length) return;
    const next = [...fragments];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    change(next);
  }
  return (
    <section className="primm-workbench" data-primm-operation="build-request">
      <p>{workbench.instruction}</p>
      <div className="primm__actions" aria-label={t("primm.addRequirement")}>
        {available
          .filter((piece) => !fragments.some((fragment) => fragment.id === piece.id))
          .map((piece) => (
            <GameButton
              key={piece.id}
              disabled={disabled || prompt.length + piece.text.length + 1 > 2000}
              onClick={() => change([...fragments, { id: piece.id, text: piece.text }])}
            >
              {t("primm.addPiece", { label: piece.label })}
            </GameButton>
          ))}
        <GameButton
          disabled={disabled || fragments.length >= 12}
          onClick={() => change([...fragments, { id: crypto.randomUUID(), text: "" }])}
        >
          {t("primm.addOwn")}
        </GameButton>
      </div>
      <ol className="primm-workbench__pieces">
        {fragments.map((fragment, index) => (
          <li
            key={fragment.id}
            data-fragment-id={fragment.id}
            onDragOver={(event) => {
              if (!disabled) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const from = fragments.findIndex(
                (piece) =>
                  piece.id === event.dataTransfer.getData("application/x-university-fragment"),
              );
              if (from >= 0) move(from, index);
            }}
          >
            <label htmlFor={`${id}-${fragment.id}`}>{labelOf(fragment.id)}</label>
            <textarea
              id={`${id}-${fragment.id}`}
              value={fragment.text}
              readOnly={disabled}
              maxLength={Math.max(0, 2000 - (prompt.length - fragment.text.trim().length))}
              onChange={(event) =>
                change(
                  fragments.map((item) =>
                    item.id === fragment.id ? { ...item, text: event.target.value } : item,
                  ),
                )
              }
            />
            <div className="primm__actions">
              <GameButton
                draggable={!disabled}
                disabled={disabled || index === 0}
                aria-label={t("primm.moveUp", { label: labelOf(fragment.id) })}
                title={t("primm.moveUp", { label: labelOf(fragment.id) })}
                onDragStart={(event) =>
                  event.dataTransfer.setData("application/x-university-fragment", fragment.id)
                }
                onClick={() => move(index, index - 1)}
              >
                ↑
              </GameButton>
              <GameButton
                disabled={disabled || index === fragments.length - 1}
                aria-label={t("primm.moveDown", { label: labelOf(fragment.id) })}
                title={t("primm.moveDown", { label: labelOf(fragment.id) })}
                onClick={() => move(index, index + 1)}
              >
                ↓
              </GameButton>
              <GameButton
                disabled={disabled}
                aria-label={t("primm.removePiece", { label: labelOf(fragment.id) })}
                title={t("primm.removePiece", { label: labelOf(fragment.id) })}
                onClick={() => change(fragments.filter((item) => item.id !== fragment.id))}
              >
                ×
              </GameButton>
            </div>
          </li>
        ))}
      </ol>
      <section className="primm-workbench__preview" aria-label={t("primm.assembledRequest")}>
        <h3>{t("primm.assembledRequest")}</h3>
        <pre className="primm__text">{prompt || t("primm.emptyRequest")}</pre>
      </section>
    </section>
  );
}
