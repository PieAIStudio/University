import type { PrimmStepOf } from "@pieai/university-core";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { PrimmAsset } from "../PrimmMaterials.js";
import { RunStatus } from "./parts.js";
import type { Primary, StepContext, StepView } from "./context.js";

/** Make: the learner's own request, run, refined, and graded before the lesson can finish. */
export function makeStep(current: PrimmStepOf<"make">, ctx: StepContext): StepView {
  const {
    t,
    session,
    update,
    activity,
    notes,
    asset,
    headingId,
    busy,
    error,
    cancel,
    execute,
    evaluate,
    go,
    screen,
    refreshPrimmEvaluation,
    copyPrimmEvaluation,
  } = ctx;
  let primary: Primary | undefined;

  const work = session.runs.make;
  const image = activity.make.assetIds[0];
  const passed = session.evaluation?.outcome === "pass";
  primary = {
    label: t("primm.steps.continue"),
    enabled: passed && session.done.includes(current.id),
    onClick: () => go(screen + 1),
  };
  const send = async () => {
    if (!session.makePrompt.trim()) return;
    update({ evaluation: null });
    await execute("make", "make", session.makePrompt.trim());
  };
  const body = (
    <>
      <p className="primm-steps__context">{activity.make.scenario}</p>
      {notes(activity.make.materialIds, true)}
      {image ? <PrimmAsset asset={asset(image)} /> : null}
      <div className="primm-steps__composer is-write" data-guide="step-make">
        <label className="primm-steps__visually-hidden" htmlFor={`${headingId}-make`}>
          {t("primm.request")}
        </label>
        <textarea
          id={`${headingId}-make`}
          maxLength={2000}
          rows={2}
          value={session.makePrompt}
          placeholder={activity.make.promptPlaceholder}
          readOnly={busy !== null}
          onChange={(event) =>
            update({
              makePrompt: event.target.value,
              evaluation: null,
              runs: Object.fromEntries(
                Object.entries(session.runs).filter(([key]) => key !== "make"),
              ),
            })
          }
        />
        <GameButton
          variant="primary"
          disabled={busy !== null || !session.makePrompt.trim()}
          onClick={() => void send()}
        >
          {busy === "run" ? t("primm.steps.running") : t("primm.steps.send")}
        </GameButton>
      </div>
      <ul className="primm-steps__checklist">
        {activity.make.checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <RunStatus
        busy={busy === "run"}
        error={busy === "evaluate" ? "" : error}
        onCancel={cancel}
        onRetry={() => void send()}
      />
      {work ? (
        <section className="primm-steps__artifact" aria-label={activity.make.artifactLabel}>
          <p className="primm-steps__live">{t("primm.steps.liveNote")}</p>
          <label htmlFor={`${headingId}-final`}>{t("primm.refineArtifact")}</label>
          <textarea
            id={`${headingId}-final`}
            data-final-work
            maxLength={8000}
            readOnly={busy !== null || passed}
            value={work.finalWork ?? work.result.text}
            onChange={(event) =>
              update({
                evaluation: null,
                runs: { ...session.runs, make: { ...work, finalWork: event.target.value } },
              })
            }
          />
          {!passed ? (
            <GameButton
              variant="secondary"
              disabled={busy !== null || !(work.finalWork ?? work.result.text).trim()}
              onClick={() => void evaluate()}
            >
              {t(busy === "evaluate" ? "primm.evaluating" : "primm.evaluate")}
            </GameButton>
          ) : null}
          {session.evaluation && !passed ? (
            <div role="status" className="primm-steps__verdict">
              <p>{t(`primm.${session.evaluation.outcome}`)}</p>
              <p>{session.evaluation.explanation}</p>
              {session.evaluation.outcome === "undecided" && refreshPrimmEvaluation ? (
                <GameButton disabled={busy !== null} onClick={() => void evaluate(true)}>
                  {t("primm.refreshGrade")}
                </GameButton>
              ) : null}
              {session.evaluation.outcome === "undecided" && copyPrimmEvaluation ? (
                <GameButton disabled={busy !== null} onClick={() => void copyPrimmEvaluation()}>
                  {t("primm.coaching")}
                </GameButton>
              ) : null}
            </div>
          ) : null}
          {busy === "evaluate" && error ? <p role="alert">{error}</p> : null}
        </section>
      ) : null}
    </>
  );
  return { body, primary };
}
