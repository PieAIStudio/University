import type { PrimmStepOf } from "@pieai/university-core";
import { primmSentences, primmSentencesMentioning } from "@pieai/university-core";
import type { StepContext, StepView } from "./context.js";

/** Point at a sentence: tap the sentence in the live answer that says what was asked, or say it is not there. */
export function findStep(current: PrimmStepOf<"find">, ctx: StepContext): StepView {
  const { t, session, update, finishStep, miss, latestRun, steps } = ctx;

  const work = latestRun(steps.indexOf(current));
  const sentences = work ? primmSentences(work.result.text) : [];
  const hits = primmSentencesMentioning(sentences, current.terms);
  const found = session.found[current.id];
  const done = session.done.includes(current.id);
  const body = (
    <>
      <div className="primm-steps__bubble is-ai primm-steps__sentences" data-guide="step-sentences">
        {sentences.map((sentence, index) => (
          <button
            key={`${index}:${sentence}`}
            type="button"
            className={`primm-steps__sentence${found === index ? " is-hit" : ""}`}
            disabled={done}
            onClick={() => {
              if (!hits.includes(index)) return miss(t("primm.steps.tryAgainToast"));
              update({ found: { ...session.found, [current.id]: index } });
              finishStep(current.id, {
                tone: "good",
                title: t("primm.steps.found"),
                text: current.found,
              });
            }}
          >
            {sentence}
          </button>
        ))}
      </div>
      <p className="primm-steps__live">{t("primm.steps.liveNote")}</p>
      {!done ? (
        <button
          type="button"
          className="primm-steps__link"
          onClick={() => {
            if (hits.length) return miss(t("primm.steps.mentionedToast"));
            update({ found: { ...session.found, [current.id]: -1 } });
            finishStep(current.id, {
              tone: "info",
              title: t("primm.steps.notMentioned"),
              text: current.absent,
            });
          }}
        >
          {t("primm.steps.notMentioned")}
        </button>
      ) : null}
    </>
  );
  return { body };
}
