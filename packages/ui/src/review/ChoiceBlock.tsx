import { useEffect, useRef, useState } from "react";
import { GameBadge, GameButton, GameCallout, GamePanel } from "@pieai/swimmer-ui-kit";

import { LiquidCtaButton } from "../cta/LiquidCtaButton.js";
import { MarkdownContent } from "../markdown/MarkdownContent.js";
import { playSound } from "../sound/index.js";
import {
  INITIAL_CHOICE_BLOCK_STATE,
  applyChoicePick,
  choiceBlockFeedback,
} from "./choice-block.js";

/**
 * This block only ever renders a three-option judgement. `ChoiceExercise`
 * names that `kind: "choice"`, and a quiz payload has no other type. The
 * chip is that constant — not a per-question field we invented.
 */
export const CHOICE_BLOCK_KIND_LABEL = "判断";
export const CHOICE_SUBMIT_LABEL = "提交";
export const CHOICE_SOLVED_LABEL = "已答对";
export const CHOICE_NEXT_LABEL = "继续下一题 →";
export const CHOICE_WRONG_VERDICT = "答错";
export const CHOICE_CORRECT_VERDICT = "答对";

export interface ChoiceBlockOption {
  readonly id: string;
  readonly text: string;
  readonly explanation: string;
}

/**
 * The fields this block actually renders. A stored `ChoiceExercise` is
 * assignable; hashes, evidence and revision stay with the record, not the
 * buttons.
 */
export interface ChoiceBlockExercise {
  readonly id: string;
  readonly title?: string;
  readonly prompt: string;
  readonly options: readonly ChoiceBlockOption[];
  readonly correctOptionId: string;
}

function actionLabel(solved: boolean, hasNext: boolean): string {
  if (solved && hasNext) return CHOICE_NEXT_LABEL;
  if (solved) return CHOICE_SOLVED_LABEL;
  return CHOICE_SUBMIT_LABEL;
}

/**
 * A three-option judgement with per-option feedback.
 *
 * Selecting an option only marks it as chosen. Submitting is a second step, so
 * a fat-finger on a phone is not itself an answer. The submit control stays
 * visible while disabled: a button that pops in after the first tap hides the
 * fact that the tap did anything.
 *
 * Submitting a wrong option marks that option and shows its own explanation;
 * the next-question control stays unreachable until the correct option is
 * submitted. That is the whole teaching move: the sentence has to answer "you
 * thought this because…", not "wrong, try again".
 */
export function ChoiceBlock({
  exercise,
  onNext,
  onSolved,
  liquidPrimary = false,
}: {
  readonly exercise: ChoiceBlockExercise;
  /** Fires only from the control that appears after a correct submit. */
  readonly onNext?: () => void;
  /**
   * Fires once when the correct option is first submitted. The practice term
   * panel unlocks on this moment, not on `onNext`: waiting for the next-question
   * button would hide the page until the learner was already leaving it.
   */
  readonly onSolved?: () => void;
  /** Practice owns the single focal answer action; lesson exercises do not. */
  readonly liquidPrimary?: boolean;
}) {
  const [state, setState] = useState(INITIAL_CHOICE_BLOCK_STATE);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A different question is a different session. Carrying a previous miss
  // into the next prompt would mark an option the learner has not touched.
  const identity = useRef(exercise.id);
  useEffect(() => {
    if (identity.current === exercise.id) return;
    identity.current = exercise.id;
    setState(INITIAL_CHOICE_BLOCK_STATE);
    setSelectedId(null);
  }, [exercise.id]);

  const feedback = choiceBlockFeedback(state, exercise.options, exercise.correctOptionId);
  const correctFeedback = feedback?.kind === "correct";

  const canAdvance = state.solved && Boolean(onNext);
  const canSubmit = !state.solved && selectedId !== null;

  function select(optionId: string) {
    if (state.solved) return;
    if (!exercise.options.some((option) => option.id === optionId)) return;
    setSelectedId(optionId);
  }

  function submit() {
    if (state.solved || selectedId === null) return;
    if (!exercise.options.some((option) => option.id === selectedId)) return;
    const next = applyChoicePick(state, selectedId, exercise.correctOptionId);
    setState(next);
    setSelectedId(null);
    playSound(selectedId === exercise.correctOptionId ? "answer.correct" : "answer.wrong");
    if (next.solved && !state.solved) onSolved?.();
  }

  return (
    <GamePanel className="choice-block exercise-panel" title={exercise.title}>
      <div className="choice-block__kind">
        <GameBadge>{CHOICE_BLOCK_KIND_LABEL}</GameBadge>
      </div>
      <div className="choice-block__prompt exercise-prompt">
        <MarkdownContent>{exercise.prompt}</MarkdownContent>
      </div>
      <div className="choice-block__options" role="group" aria-label="选项">
        {exercise.options.map((option) => {
          const wrong = state.wrongOptionIds.includes(option.id);
          const correct = state.solved && option.id === exercise.correctOptionId;
          const selected = selectedId === option.id;
          const className = [
            "choice-block__option",
            selected ? "choice-block__option--selected" : "",
            wrong ? "choice-block__option--wrong" : "",
            correct ? "choice-block__option--correct" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={option.id}
              type="button"
              className={className}
              aria-pressed={selected}
              disabled={state.solved}
              onClick={() => select(option.id)}
            >
              <span className="choice-block__text">{option.text}</span>
              {wrong ? (
                <span className="choice-block__verdict">
                  <span className="choice-block__mark" aria-hidden="true">
                    ×
                  </span>
                  <span className="choice-block__verdict-text">{CHOICE_WRONG_VERDICT}</span>
                </span>
              ) : null}
              {correct ? (
                <span className="choice-block__verdict">
                  <span className="choice-block__mark" aria-hidden="true">
                    ✓
                  </span>
                  <span className="choice-block__verdict-text">{CHOICE_CORRECT_VERDICT}</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {feedback?.kind === "wrong" ? (
        <GameCallout heading="还不对" tone="danger" role="status">
          {feedback.explanation}
        </GameCallout>
      ) : null}
      {correctFeedback ? (
        <>
          <GameBadge className="choice-block__correct-merge" tone="success">
            ✓ 答对了
          </GameBadge>
          <GameCallout heading="答案解释" tone="success" role="status">
            {feedback.explanation}
          </GameCallout>
        </>
      ) : null}
      <div className="choice-block__submit">
        {liquidPrimary ? (
          <LiquidCtaButton
            disabled={!canAdvance && !canSubmit}
            onClick={() => {
              if (canAdvance) onNext?.();
              else submit();
            }}
          >
            {actionLabel(state.solved, Boolean(onNext))}
          </LiquidCtaButton>
        ) : (
          <GameButton
            variant="primary"
            type="button"
            disabled={!canAdvance && !canSubmit}
            onClick={() => {
              if (canAdvance) onNext?.();
              else submit();
            }}
          >
            {actionLabel(state.solved, Boolean(onNext))}
          </GameButton>
        )}
      </div>
    </GamePanel>
  );
}
