import { useEffect, useRef, useState } from "react";
import { GameButton, GameCallout, GamePanel } from "@pieai/swimmer-ui-kit";

import { MarkdownContent } from "../markdown/MarkdownContent.js";
import { playSound } from "../sound/index.js";
import {
  INITIAL_CHOICE_BLOCK_STATE,
  applyChoicePick,
  choiceBlockFeedback,
} from "./choice-block.js";

const OPTION_LETTERS = ["A", "B", "C"] as const;

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

/**
 * A three-option judgement with per-option feedback.
 *
 * Selecting a wrong option marks that option and shows its own explanation;
 * the next-question control stays hidden until the correct option is picked.
 * That is the whole teaching move: the sentence has to answer "you thought
 * this because…", not "wrong, try again".
 */
export function ChoiceBlock({
  exercise,
  onNext,
  onSolved,
}: {
  readonly exercise: ChoiceBlockExercise;
  /** Fires only from the control that appears after a correct pick. */
  readonly onNext?: () => void;
  /**
   * Fires once when the correct option is first picked. The practice term
   * panel unlocks on this moment, not on `onNext`: waiting for the next-question
   * button would hide the page until the learner was already leaving it.
   */
  readonly onSolved?: () => void;
}) {
  const [state, setState] = useState(INITIAL_CHOICE_BLOCK_STATE);

  // A different question is a different session. Carrying a previous miss
  // into the next prompt would mark an option the learner has not touched.
  const identity = useRef(exercise.id);
  useEffect(() => {
    if (identity.current === exercise.id) return;
    identity.current = exercise.id;
    setState(INITIAL_CHOICE_BLOCK_STATE);
  }, [exercise.id]);

  const feedback = choiceBlockFeedback(state, exercise.options, exercise.correctOptionId);

  function pick(optionId: string) {
    if (state.solved) return;
    if (!exercise.options.some((option) => option.id === optionId)) return;
    const next = applyChoicePick(state, optionId, exercise.correctOptionId);
    setState(next);
    playSound(optionId === exercise.correctOptionId ? "answer.correct" : "answer.wrong");
    if (next.solved && !state.solved) onSolved?.();
  }

  return (
    <GamePanel className="choice-block exercise-panel" title={exercise.title}>
      <div className="choice-block__prompt exercise-prompt">
        <MarkdownContent>{exercise.prompt}</MarkdownContent>
      </div>
      <div className="choice-block__options" role="group" aria-label="选项">
        {exercise.options.map((option, index) => {
          const letter = OPTION_LETTERS[index] ?? String(index + 1);
          const wrong = state.wrongOptionIds.includes(option.id);
          const correct = state.solved && option.id === exercise.correctOptionId;
          const pressed = wrong || correct || state.lastPickId === option.id;
          const className = [
            "choice-block__option",
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
              aria-pressed={pressed}
              aria-disabled={state.solved || undefined}
              onClick={() => pick(option.id)}
            >
              <span className="choice-block__letter" aria-hidden="true">
                {letter}
              </span>
              <span className="choice-block__text">{option.text}</span>
              {wrong ? (
                <span className="choice-block__mark" aria-hidden="true">
                  ×
                </span>
              ) : null}
              {correct ? (
                <span className="choice-block__mark" aria-hidden="true">
                  ✓
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
      {feedback?.kind === "correct" ? (
        <GameCallout heading="答对了" tone="success" role="status">
          {feedback.explanation}
        </GameCallout>
      ) : null}
      {state.solved ? (
        <div className="choice-block__next">
          <GameButton variant="primary" onClick={() => onNext?.()}>
            继续下一题 →
          </GameButton>
        </div>
      ) : null}
    </GamePanel>
  );
}
