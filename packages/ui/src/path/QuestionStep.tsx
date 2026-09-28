import { GameButton } from "@pieai/swimmer-ui-kit";
import type { SkipTestCandidate } from "@pieai/university-core";

import { useI18n } from "../i18n/index.js";
import { ChoiceOptions } from "../review/ChoiceOptions.js";

/**
 * One machine-judged question from a lesson's own exercises: the prompt, the
 * options or a box to write in, and the button that hands it in.
 *
 * The skip test and the weekly boss ask the same kind of question from the
 * same pool (`skipTestCandidates`), so they ask it with this one card; what
 * surrounds it — a count of three, a boss's hearts — is theirs.
 */
export function QuestionStep({
  question,
  answer,
  blank,
  inputId,
  submitLabel,
  onAnswer,
  onSubmit,
}: {
  readonly question: SkipTestCandidate;
  readonly answer: string;
  /** Set after a blank submit, so the message is a reply rather than a rule. */
  readonly blank: boolean;
  readonly inputId: string;
  readonly submitLabel: string;
  readonly onAnswer: (answer: string) => void;
  readonly onSubmit: () => void;
}) {
  const interfaceTranslator = useI18n();
  return (
    <>
      <p className="question-step__prompt">{question.prompt}</p>
      {question.options ? (
        <ChoiceOptions options={question.options} selectedId={answer} onSelect={onAnswer} />
      ) : (
        <>
          <label className="question-step__label" htmlFor={inputId}>
            {interfaceTranslator.t("ui.path.unitSkipTest.copy.把你的答案写在这里")}
          </label>
          <textarea
            id={inputId}
            className="question-step__answer"
            rows={2}
            value={answer}
            onChange={(event) => onAnswer(event.target.value)}
          />
        </>
      )}
      {blank ? (
        <p className="question-step__note">
          {question.options
            ? interfaceTranslator.t("grading.answer.chooseHint")
            : interfaceTranslator.t("ui.path.unitSkipTest.copy.先写下你的答案-再交")}
        </p>
      ) : null}
      <GameButton variant="primary" onClick={onSubmit} data-question-action="submit">
        {submitLabel}
      </GameButton>
    </>
  );
}
