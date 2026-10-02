import type { PrimmStepOf } from "@pieai/university-core";
import { playSound } from "../../sound/index.js";
import { PrimmResultText } from "../PrimmResultText.js";
import type { Primary, StepContext, StepView } from "./context.js";

/** Choose one: a prediction is noted; a choice with a right answer stops a wrong one with its reason. */
export function chooseStep(current: PrimmStepOf<"choose">, ctx: StepContext): StepView {
  const {
    t,
    session,
    update,
    miss,
    finishStep,
    starterImage,
    photoUrl,
    asset,
    notes,
    activity,
    headingId,
  } = ctx;
  let primary: Primary | undefined;

  const picked = session.choices[current.id];
  const locked = session.done.includes(current.id);
  if (!locked)
    primary = {
      label: t(current.phase === "predict" ? "primm.steps.choose" : "primm.steps.check"),
      enabled: !!picked,
      onClick: () => {
        const option = current.options.find((item) => item.id === picked);
        if (!option) return;
        // A step with a right answer teaches by stopping a wrong one: say
        // why (the option's own note, when it has one) and let them choose
        // again. It used to mark the step done either way.
        if (current.answerId && option.id !== current.answerId) {
          miss(option.after ?? t("primm.steps.notThis"));
          const { [current.id]: _wrong, ...rest } = session.choices;
          update({ choices: rest });
          return;
        }
        const text = option.after ?? current.after;
        if (current.answerId)
          finishStep(current.id, {
            tone: option.id === current.answerId ? "good" : "bad",
            title: t(option.id === current.answerId ? "primm.steps.right" : "primm.steps.wrong"),
            ...(text ? { text } : {}),
          });
        else
          // A prediction is noted; any other open choice is echoed back as the learner's own.
          finishStep(current.id, {
            tone: "info",
            title: current.phase === "predict" ? t("primm.steps.noted") : option.label,
            ...(text ? { text } : {}),
          });
      },
    };
  const context =
    current.phase === "predict" && starterImage ? (
      <figure className="primm-steps__thumb">
        <img src={photoUrl(starterImage)} alt={asset(starterImage)?.alt ?? ""} />
      </figure>
    ) : current.phase === "predict" ? (
      notes(activity.starter.materialIds, false)
    ) : current.phase === "make" && session.runs.make ? (
      <div className="primm-steps__chat">
        <p className="primm-steps__bubble is-me">{session.runs.make.request.prompt}</p>
        <div className="primm-steps__bubble is-ai">
          <PrimmResultText text={session.runs.make.finalWork ?? session.runs.make.result.text} />
        </div>
      </div>
    ) : null;
  const body = (
    <>
      {context}
      <div
        className="primm-steps__options"
        role="radiogroup"
        aria-labelledby={headingId}
        data-guide="step-options"
      >
        {current.options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={picked === option.id}
            disabled={locked}
            className="primm-steps__option"
            onClick={() => {
              playSound("ui.press");
              update({ choices: { ...session.choices, [current.id]: option.id } });
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </>
  );
  return { body, primary };
}
