import type { PrimmStepOf } from "@pieai/university-core";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { playSound } from "../../sound/index.js";
import { PrimmResultText } from "../PrimmResultText.js";
import { playCoach } from "../primm-coach.js";
import { PrimmAside } from "./materials.js";
import { AttachTile, RunStatus } from "./parts.js";
import type { StepContext, StepView } from "./context.js";

/** Send: attach the material when there is a photo, then really run the request once. */
export function sendStep(current: PrimmStepOf<"send">, ctx: StepContext): StepView {
  const {
    t,
    session,
    update,
    finishStep,
    execute,
    busy,
    error,
    cancel,
    requestOf,
    starterImage,
    photoUrl,
    activity,
  } = ctx;
  let demo: (() => void) | undefined;

  const request = requestOf(current);
  const work = request ? session.runs[request.key] : undefined;
  const image = starterImage;
  // A text-only request has nothing to attach: Send is ready at once.
  const attached = !image || !!session.attached[current.id] || !!work;
  demo = () => {
    const from = document.querySelector<HTMLElement>(`[data-attach="${current.id}"]`);
    const to = document.querySelector<HTMLElement>(`[data-composer="${current.id}"]`);
    if (from && to)
      void playCoach({ from, to, gesture: "drag", caption: t("primm.steps.coach.attach") });
  };
  const send = async () => {
    if (!request) return;
    const result = await execute(
      request.key,
      current.phase === "modify" ? "modify" : "run",
      request.prompt,
    );
    if (!result) return;
    const debrief =
      current.debriefs?.find((item) => item.requestId === request.key)?.text ?? current.after;
    finishStep(current.id, {
      tone: "info",
      title: t("primm.steps.answered"),
      ...(debrief ? { text: debrief } : {}),
    });
  };
  const body = (
    <>
      <div className="primm-steps__chat">
        {work ? (
          <>
            <div className="primm-steps__bubble is-me">
              {image ? (
                <img src={photoUrl(image)} alt="" />
              ) : current.attachmentLabel ? (
                <span className="primm-steps__file">{current.attachmentLabel}</span>
              ) : null}
              <p>{work.request.prompt}</p>
            </div>
            <div className="primm-steps__bubble is-ai" aria-live="polite">
              <PrimmResultText text={work.result.text} />
            </div>
            <p className="primm-steps__live">{t("primm.steps.liveNote")}</p>
          </>
        ) : null}
      </div>
      {!work ? (
        <>
          <div
            className={`primm-steps__composer${attached ? " is-filled" : ""}`}
            data-drop="composer"
            data-composer={current.id}
            role="group"
            aria-label={t("primm.conversation")}
          >
            {image ? (
              <div className="primm-steps__slot">
                {attached ? (
                  <img src={photoUrl(image)} alt={current.attachmentLabel ?? ""} />
                ) : (
                  <span>{t("primm.steps.composerTarget")}</span>
                )}
              </div>
            ) : current.attachmentLabel ? (
              <span className="primm-steps__file">{current.attachmentLabel}</span>
            ) : null}
            <p className="primm-steps__composer-text">{request?.prompt}</p>
            <GameButton
              variant="primary"
              data-guide="step-send"
              disabled={!attached || busy !== null || !request}
              onClick={() => void send()}
            >
              {busy === "run" ? t("primm.steps.running") : t("primm.steps.send")}
            </GameButton>
          </div>
          {!attached && image ? (
            <AttachTile
              stepId={current.id}
              label={current.attachmentLabel ?? ""}
              hint={t("primm.steps.attachHint")}
              url={photoUrl(image)}
              onAttach={() => {
                playSound("answer.correct");
                update({ attached: { ...session.attached, [current.id]: true } });
              }}
            />
          ) : null}
        </>
      ) : null}
      <RunStatus
        busy={busy === "run"}
        error={error}
        onCancel={cancel}
        onRetry={() => void send()}
      />
      {busy === "run" && current.wait ? (
        <PrimmAside
          text={current.wait.text}
          source={activity.sources.find((source) => source.id === current.wait!.sourceId)}
        />
      ) : null}
    </>
  );
  return { body, demo };
}
