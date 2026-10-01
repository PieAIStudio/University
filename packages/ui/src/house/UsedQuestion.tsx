import { useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import type { UsedAnswer } from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";

/*
 * 「用了吗？」 (V7 amendment one): asked once, on a later day, about the small
 * thing a finished lesson left. The answer is the learner's own word — a mark
 * on the house wall, never a score — so both buttons are ordinary controls and
 * the page's one forward action stays wherever the host puts it.
 */
export function UsedQuestion({
  task,
  onAnswer,
}: {
  readonly task: string;
  readonly onAnswer: (answer: UsedAnswer) => void;
}) {
  const t = useI18n();
  const [answered, setAnswered] = useState<UsedAnswer | null>(null);
  if (answered)
    return (
      <p className="used-question used-question--done" role="status" data-used-answered={answered}>
        {t.t(answered === "used" ? "house.used.marked" : "house.used.later")}
      </p>
    );
  return (
    <div className="used-question" data-used-question>
      <p>{t.t("house.used.ask", { task })}</p>
      <div className="used-question__answers" role="group" aria-label={t.t("house.used.question")}>
        {(["used", "not-yet"] as const).map((answer) => (
          <GameButton
            key={answer}
            variant="secondary"
            static
            data-used-answer={answer}
            onClick={() => {
              setAnswered(answer);
              onAnswer(answer);
            }}
          >
            {t.t(answer === "used" ? "house.used.yes" : "house.used.notYet")}
          </GameButton>
        ))}
      </div>
    </div>
  );
}
