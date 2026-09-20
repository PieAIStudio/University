import { GameButton } from "@pieai/swimmer-ui-kit";
import { translate } from "../i18n/index.js";

/** Selection only: native exercise/skip-test owners retain grading and progress. */
export function ChoiceOptions({
  options,
  selectedId,
  disabled = false,
  onSelect,
}: {
  readonly options: readonly { readonly id: string; readonly text: string }[];
  readonly selectedId: string;
  readonly disabled?: boolean;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <div className="exercise-choice" role="group" aria-label={translate("grading.answer.label")}>
      {options.map((option) => (
        <GameButton
          key={option.id}
          type="button"
          static
          sound={false}
          variant={selectedId === option.id ? "primary" : "secondary"}
          aria-pressed={selectedId === option.id}
          data-exercise-option={option.id}
          disabled={disabled}
          onClick={() => onSelect(option.id)}
        >
          {option.text}
        </GameButton>
      ))}
    </div>
  );
}
