import type { PrimmStepOf } from "@pieai/university-core";
import { PrimmResultText } from "../PrimmResultText.js";
import type { StepContext, StepView } from "./context.js";

/** Point at a place on the photo. */
export function pointStep(current: PrimmStepOf<"point">, ctx: StepContext): StepView {
  const { t, session, update, finishStep, miss, latestRun, steps, photoUrl, asset } = ctx;

  const picked = session.pointed[current.id];
  const done = session.done.includes(current.id);
  const work = latestRun(steps.indexOf(current));
  const body = (
    <>
      {work && current.phase !== "make" ? (
        <div className="primm-steps__chat">
          <p className="primm-steps__bubble is-me">{work.request.prompt}</p>
          <div className="primm-steps__bubble is-ai">
            <PrimmResultText text={work.result.text} />
          </div>
        </div>
      ) : null}
      <figure className="primm-steps__point" data-guide="step-point">
        <img
          src={photoUrl(current.assetId)}
          alt={asset(current.assetId)?.alt ?? ""}
          onClick={() => !done && miss(current.miss)}
        />
        {current.regions.map((region) => (
          <button
            key={region.id}
            type="button"
            disabled={done}
            className={`primm-steps__region${picked === region.id ? " is-hit" : ""}`}
            style={{
              left: `${region.x * 100}%`,
              top: `${region.y * 100}%`,
              width: `${region.width * 100}%`,
              height: `${region.height * 100}%`,
            }}
            aria-label={region.label}
            onClick={() => {
              if (region.id !== current.targetId) return miss(current.miss);
              update({ pointed: { ...session.pointed, [current.id]: region.id } });
              finishStep(current.id, {
                tone: "good",
                title: t("primm.steps.pointed"),
                text: current.after,
              });
            }}
          >
            <span>{region.label}</span>
          </button>
        ))}
      </figure>
    </>
  );
  return { body };
}
