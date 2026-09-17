import { useId } from "react";
import { GameButton, GamePanel } from "@pieai/swimmer-ui-kit";
import { evaluateInteractionStep, type ExperimentStep } from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";

/** Only the current preset is previewed. Its verdict stays with explicit submission. */
export function PathExperiment({
  step,
  answer,
  onChange,
}: {
  readonly step: ExperimentStep;
  readonly answer: readonly string[];
  readonly onChange: (answer: string[]) => void;
}) {
  const { t } = useI18n();
  const previewId = useId();
  const currentCase = evaluateInteractionStep(step, answer).currentCase;
  return (
    <div className="path-experiment">
      <p className="path-experiment__note">{step.simulationNote}</p>
      <div className="path-experiment__controls" role="group" aria-label={t("path.conditions")}>
        {step.controls.map((control) => (
          <GameButton
            key={control.id}
            type="button"
            variant={answer.includes(control.id) ? "primary" : "secondary"}
            static
            sound={false}
            data-control-id={control.id}
            aria-pressed={answer.includes(control.id)}
            aria-controls={previewId}
            onClick={() =>
              onChange(
                answer.includes(control.id)
                  ? answer.filter((id) => id !== control.id)
                  : [...answer, control.id],
              )
            }
          >
            {control.label}
          </GameButton>
        ))}
      </div>
      <GamePanel
        id={previewId}
        className="path-experiment__preview"
        aria-live="polite"
        aria-atomic="true"
      >
        <h3>{currentCase?.title}</h3>
        <p>{currentCase?.text}</p>
      </GamePanel>
    </div>
  );
}
