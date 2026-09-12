import { useState } from "react";
import {
  contrastCaseAgrees,
  createContrastState,
  isContrastComplete,
  predictContrast,
  type ContrastActivity,
  type ContrastState,
} from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";
import { playSound } from "../sound/index.js";
import type { ActivityControls } from "./controls.js";

/** Which case the last prediction was about, and whether it was right. */
interface Reveal {
  readonly caseId: string;
  readonly right: boolean;
}

/**
 * Say what you think will happen, then watch both columns fill in.
 *
 * The prediction is what makes this more than a table the reader scrolls past.
 * Both columns are revealed either way — a wrong guess is the moment the
 * lesson lands, and hiding the outcome until a lucky retry would turn it into
 * a dead end.
 */
export function ContrastGame({
  activity,
  disabled,
  onAttempt,
  guided = false,
}: ActivityControls<ContrastActivity>) {
  const [state, setState] = useState<ContrastState>(createContrastState);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const [first, second] = activity.approaches;
  const done = isContrastComplete(activity, state);

  function predict(caseId: string, predictedAgree: boolean) {
    if (disabled) return;
    const verdict = predictContrast(activity, state, caseId, predictedAgree);
    if (verdict.kind !== "right" && verdict.kind !== "wrong") return;
    const right = verdict.kind === "right";
    playSound(right ? "answer.correct" : "answer.wrong");
    setState(verdict.state);
    setReveal({ caseId, right });
    setOpen(caseId);
    if (right && isContrastComplete(activity, verdict.state)) {
      onAttempt(
        true,
        { settled: verdict.state.settled, misses: verdict.state.misses },
        activity.takeaway,
      );
    }
  }

  return (
    <div className="play-contrast">
      <p className="play-contrast__question">{activity.question}</p>

      <div className="play-contrast__approaches">
        {activity.approaches.map((approach) => (
          <section key={approach.id} className="play-contrast__approach">
            <strong>{approach.label}</strong>
            <small>{approach.note}</small>
          </section>
        ))}
      </div>

      {guided && !done ? (
        <p className="play-contrast__guide">{t("play.contrast.guidePredict")}</p>
      ) : null}

      <ul className="play-contrast__cases">
        {activity.cases.map((kase) => {
          const settled = state.settled[kase.id] !== undefined;
          const showing = settled && open === kase.id;
          const agrees = contrastCaseAgrees(activity, kase);
          return (
            <li key={kase.id} className="play-contrast__case">
              <div className="play-contrast__case-head">
                <span className="play-contrast__case-label">{kase.label}</span>
                <small>{kase.detail}</small>
              </div>

              {settled ? (
                <button
                  type="button"
                  className="play-contrast__toggle"
                  aria-expanded={showing}
                  onClick={() => setOpen((current) => (current === kase.id ? null : kase.id))}
                >
                  {agrees ? t("play.contrast.landedSame") : t("play.contrast.landedApart")}
                </button>
              ) : (
                <div className="play-contrast__choices">
                  <button
                    type="button"
                    className="play-contrast__choice"
                    disabled={disabled}
                    onClick={() => predict(kase.id, true)}
                  >
                    {t("play.contrast.predictSame")}
                  </button>
                  <button
                    type="button"
                    className="play-contrast__choice"
                    disabled={disabled}
                    onClick={() => predict(kase.id, false)}
                  >
                    {t("play.contrast.predictApart")}
                  </button>
                </div>
              )}

              {showing ? (
                <div className="play-contrast__outcomes">
                  {activity.approaches.map((approach) => (
                    <div key={approach.id} className="play-contrast__outcome">
                      <small>{approach.label}</small>
                      <span>{kase.outcomes[approach.id]}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {/*
                The reason comes from the case, not from the attempt.

                It used to be read off `reveal`, which holds only the most
                recent prediction — so reopening an earlier case with 「点开再看
                一次」 gave the reader two columns and no explanation of them,
                which is the half that was worth reopening for. `reveal` still
                decides whether to say 「跟你猜的不一样」, because that is a fact
                about the attempt rather than about the case.
              */}
              {showing ? (
                <p
                  className={`play-contrast__why play-contrast__why--${
                    reveal?.caseId === kase.id && !reveal.right ? "wrong" : "right"
                  }`}
                  role="status"
                >
                  {reveal?.caseId === kase.id && !reveal.right
                    ? `${t("play.contrast.notWhatYouSaid")} `
                    : ""}
                  {kase.why}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {done ? (
        <p className="play-contrast__done">
          {t("play.contrast.summary", { value0: first?.label ?? "", value1: second?.label ?? "" })}
          {` ${activity.takeaway}`}
        </p>
      ) : null}
      {state.misses > 0 && !done ? (
        <p className="play-contrast__misses">
          {t("play.contrast.misses", { value0: state.misses })}
        </p>
      ) : null}
    </div>
  );
}
