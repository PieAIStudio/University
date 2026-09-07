import { useEffect, useRef, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import {
  actOnBrief,
  BRIEF_AXES,
  briefFingerprint,
  createBriefPreview,
  evaluateBrief,
  evaluateBriefRounds,
  resolveBrief,
  type BriefActivity,
  type BriefAxis,
  type BriefChoices,
  type BriefObservation,
  type BriefPreview,
  type BriefAcceptance,
} from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";
import type { ActivityControls } from "./controls.js";
import { PlayIcon } from "./PlayIcon.js";
import { playSound } from "../sound/index.js";

export function BriefGame({ activity, disabled, onAttempt }: ActivityControls<BriefActivity>) {
  const [choices, setChoices] = useState<BriefChoices>({});
  const [previews, setPreviews] = useState<readonly BriefPreview[]>([
    createBriefPreview(),
    createBriefPreview(),
  ]);
  const [observations, setObservations] = useState<readonly BriefObservation[]>([]);
  const [asked, setAsked] = useState<readonly BriefAxis[]>([]);
  const [accepted, setAccepted] = useState<readonly BriefAcceptance[]>([]);
  const [experiments, setExperiments] = useState<
    readonly {
      action: string;
      configuration: string;
      results: readonly BriefObservation["result"][];
    }[]
  >([]);
  const requestTop = useRef<HTMLQuoteElement>(null);
  const revised = accepted.length > 0 && activity.followUp !== undefined;
  const currentActivity = revised ? { ...activity, target: activity.followUp!.target } : activity;
  useEffect(() => {
    if (revised) {
      requestTop.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
      requestTop.current?.focus({ preventScroll: true });
    }
  }, [revised]);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const remaining = BRIEF_AXES.filter((axis) => choices[axis] === undefined).length;
  const experimentConfiguration = ([0, 1] as const)
    .map((variant) => briefFingerprint(resolveBrief(activity, choices, variant)))
    .join(";");
  const converged =
    briefFingerprint(resolveBrief(activity, choices, 0)) ===
    briefFingerprint(resolveBrief(activity, choices, 1));
  function choose(axis: BriefAxis, value?: string) {
    const next = { ...choices };
    if (value === undefined) delete next[axis];
    else Object.assign(next, { [axis]: value });
    setChoices(next);
    setPreviews([createBriefPreview(), createBriefPreview()]);
    setObservations([]);
  }
  function operate(variant: 0 | 1, action: "submit" | "roster" | "login") {
    if (disabled) return;
    const result = actOnBrief(
      resolveBrief(activity, choices, variant),
      previews[variant]!,
      action,
      variant,
    );
    setPreviews((previous) =>
      previous.map((state, index) => (index === variant ? result.state : state)),
    );
    if (result.observation)
      setObservations((previous) => [...previous, result.observation!].slice(-16));
  }
  function compare(action: "submit" | "roster") {
    if (disabled) return;
    const trials = ([0, 1] as const).map((variant) =>
      actOnBrief(resolveBrief(activity, choices, variant), previews[variant]!, action, variant),
    );
    setPreviews(trials.map((trial) => trial.state));
    setObservations((previous) =>
      [
        ...previous,
        ...trials.flatMap((trial) => (trial.observation ? [trial.observation] : [])),
      ].slice(-16),
    );
    setExperiments((previous) =>
      [
        ...previous,
        {
          action,
          configuration: experimentConfiguration,
          results: trials.map((trial) => trial.observation!.result),
        },
      ].slice(-4),
    );
    playSound("ui.press");
  }
  function showPreview() {
    previewHeading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    previewHeading.current?.focus({ preventScroll: true });
  }
  function verify() {
    const result = evaluateBrief(currentActivity, choices, observations);
    const checkpoint: BriefAcceptance = { choices, observations };
    if (result.passed && activity.followUp && !revised) {
      setAccepted([checkpoint]);
      setPreviews([createBriefPreview(), createBriefPreview()]);
      setObservations([]);
      setExperiments([]);
      playSound("answer.correct");
      return;
    }
    const names = (axes: readonly BriefAxis[]) =>
      axes
        .map((axis) => activity.questions.find((question) => question.axis === axis)!.label)
        .join(" / ");
    const unchecked = [
      !result.accessChecked && t("play.ai.brief.checkAccess"),
      !result.submitted && t("play.ai.brief.checkSubmit"),
      !result.rosterChecked && t("play.ai.brief.checkRoster"),
    ]
      .filter(Boolean)
      .join(" / ");
    const message = result.missing.length
      ? t("play.ai.brief.missing", { items: names(result.missing) })
      : result.mismatches.length
        ? t("play.ai.brief.mismatch", { items: names(result.mismatches) })
        : !result.passed
          ? t("play.ai.brief.untested", { items: unchecked })
          : t("play.ai.brief.done");
    const clauses = activity.questions.flatMap((question) =>
      question.options
        .filter((option) => option.value === choices[question.axis])
        .map((option) => option.clause),
    );
    const handoff = [
      t("play.ai.brief.handoffTask", { name: activity.productName }),
      activity.productDescription,
      "",
      t("play.ai.brief.handoffRules"),
      ...clauses.map((line) => `- ${line}`),
      ...(revised ? ["", t("play.ai.brief.changeRecorded"), activity.followUp!.request] : []),
      ...accepted.flatMap((round) => [
        "",
        t("play.ai.brief.firstContract"),
        ...activity.questions.flatMap((question) =>
          question.options
            .filter((option) => option.value === round.choices[question.axis])
            .map((option) => `- ${option.clause}`),
        ),
      ]),
      "",
      t("play.ai.brief.handoffChecks"),
      t("play.ai.brief.handoffUnknown"),
    ].join("\n");
    const rounds = [...accepted, checkpoint];
    const final = evaluateBriefRounds(activity, rounds);
    onAttempt(
      result.passed && final.passed,
      { choices, asked, observations, checks: result, rounds, experiments, handoff },
      message,
    );
  }
  return (
    <div className="ai-brief">
      <blockquote
        ref={requestTop}
        tabIndex={-1}
        className="ai-brief__request"
        data-revised={revised}
      >
        <span>{t(revised ? "play.ai.brief.newRequest" : "play.ai.brief.request")}</span>
        {revised ? <strong>{t("play.ai.brief.firstAccepted")}</strong> : null}
        <p>{revised ? activity.followUp!.request : activity.request}</p>
        {revised ? <small>{t("play.ai.brief.keepOtherRules")}</small> : null}
      </blockquote>
      <div className="ai-brief__preview-title">
        <h3 ref={previewHeading} tabIndex={-1}>
          {t("play.ai.brief.interpretations")}
        </h3>
        <p>{t("play.ai.brief.previewNote")}</p>
        <div className="play-action-row ai-brief__compare-controls">
          <GameButton variant="primary" disabled={disabled} onClick={() => compare("submit")}>
            {t("play.ai.brief.compareSubmit")}
          </GameButton>
          <GameButton variant="secondary" disabled={disabled} onClick={() => compare("roster")}>
            {t("play.ai.brief.compareRoster")}
          </GameButton>
        </div>
        {experiments.at(-1)?.configuration === experimentConfiguration ? (
          <div className="ai-brief__comparison" role="status">
            <strong>{t("play.ai.brief.sameAction")}</strong>
            {experiments.at(-1)!.results.map((value, index) => (
              <p key={index}>
                <b>{index === 0 ? "A" : "B"}</b>
                {t(`play.ai.brief.result.${value}`)}
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <div className="ai-brief__prototypes" data-converged={converged}>
        {([0, 1] as const).map((variant) => {
          const state = previews[variant]!;
          const configuration = resolveBrief(activity, choices, variant);
          const name = variant === 0 ? "A" : "B";
          return (
            <section
              className="ai-brief__prototype"
              key={variant}
              aria-label={t("play.ai.brief.previewLabel", { name })}
            >
              <div className="ai-brief__prototype-top">
                <strong>{t("play.ai.brief.interpretation", { name })}</strong>
                <PlayIcon name={converged ? "check" : "ai-brief"} />
              </div>
              <div className="ai-brief__product">
                <h4>{activity.productName}</h4>
                <p>{activity.productDescription}</p>
                <div className="ai-brief__identity">
                  {t(state.signedIn ? "play.ai.brief.member" : "play.ai.brief.visitor", {
                    name: activity.visitorName,
                  })}
                </div>
                <GameButton
                  type="button"
                  sound={false}
                  disabled={
                    disabled || state.submission === "joined" || state.submission === "queued"
                  }
                  onClick={() => operate(variant, "submit")}
                >
                  {activity.actionLabel}
                </GameButton>
                <div
                  className="ai-brief__product-response"
                  role="status"
                  data-result={state.submission}
                >
                  <p>
                    {state.submission === "none"
                      ? t("play.ai.brief.status.none")
                      : t(`play.ai.brief.result.${state.submission}`)}
                  </p>
                  {state.submission === "login" ? (
                    <GameButton
                      type="button"
                      variant="secondary"
                      disabled={disabled}
                      onClick={() => operate(variant, "login")}
                    >
                      {t("play.ai.brief.login")}
                    </GameButton>
                  ) : null}
                </div>
                <GameButton
                  type="button"
                  variant="ghost"
                  static
                  disabled={disabled}
                  onClick={() => operate(variant, "roster")}
                >
                  {t("play.ai.brief.roster")}
                </GameButton>
                {state.rosterOpen ? (
                  <p className="ai-brief__roster" role="status">
                    {t(
                      `play.ai.brief.result.${configuration.access === "account" && !state.signedIn ? "login" : configuration.roster}`,
                    )}
                  </p>
                ) : null}
                {state.rosterOpen &&
                configuration.roster === "public" &&
                state.submission === "joined" ? (
                  <p className="ai-brief__roster" role="status">
                    {t("play.ai.brief.ownEntry", { name: activity.visitorName })}
                  </p>
                ) : null}
                {(state.signedIn || state.submission !== "none") && !disabled ? (
                  <GameButton
                    type="button"
                    variant="ghost"
                    static
                    onClick={() =>
                      setPreviews((previous) =>
                        previous.map((value, index) =>
                          index === variant ? createBriefPreview() : value,
                        ),
                      )
                    }
                  >
                    {t("play.ai.brief.reset")}
                  </GameButton>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
      <section className="ai-brief__contract" aria-label={t("play.ai.brief.contract")}>
        <h3>{t("play.ai.brief.contract")}</h3>
        <p className="ai-brief__convergence" role="status">
          {remaining
            ? t("play.ai.brief.openAssumptions", { count: remaining })
            : t("play.ai.brief.converged")}
        </p>
        <div className="ai-brief__questions">
          {activity.questions.map((question) => (
            <fieldset key={question.axis} disabled={disabled}>
              <legend>{question.label}</legend>
              <details
                onToggle={(event) => {
                  if (event.currentTarget.open)
                    setAsked((previous) => [...new Set([...previous, question.axis])]);
                }}
              >
                <summary>{t("play.ai.brief.ask", { question: question.question })}</summary>
                <p>
                  {revised &&
                  activity.target[question.axis] !== currentActivity.target[question.axis]
                    ? `${t("play.ai.brief.updatedAnswer")} ${question.options.find((option) => option.value === currentActivity.target[question.axis])!.clause}`
                    : question.answer}
                </p>
              </details>
              <div className="ai-brief__options">
                {question.options.map((option) => (
                  <GameButton
                    key={option.value}
                    type="button"
                    static
                    variant={choices[question.axis] === option.value ? "primary" : "secondary"}
                    aria-pressed={choices[question.axis] === option.value}
                    onClick={() => choose(question.axis, option.value)}
                  >
                    {option.label}
                  </GameButton>
                ))}
              </div>
              {choices[question.axis] ? (
                <GameButton
                  type="button"
                  variant="ghost"
                  static
                  className="ai-brief__clear"
                  onClick={() => choose(question.axis)}
                >
                  {t("play.ai.brief.clear")}
                </GameButton>
              ) : (
                <span className="ai-brief__empty-clause">{t("play.ai.brief.unwritten")}</span>
              )}
            </fieldset>
          ))}
        </div>
        <div className="play-action-row">
          <GameButton type="button" sound={false} variant="secondary" onClick={showPreview}>
            {t("play.ai.brief.returnPreview")}
          </GameButton>
          <GameButton type="button" sound={false} disabled={disabled} onClick={verify}>
            {t("play.ai.brief.verify")}
          </GameButton>
        </div>
      </section>
      <details className="play-model-note">
        <summary>{t("play.ai.brief.receipt")}</summary>
        {observations.length ? (
          <ol>
            {observations.map((observation, index) => (
              <li key={index}>
                {t("play.ai.brief.observed", {
                  variant: observation.variant === 0 ? "A" : "B",
                  result: t(`play.ai.brief.result.${observation.result}`),
                })}
              </li>
            ))}
          </ol>
        ) : (
          <p>{t("play.ai.brief.noReceipt")}</p>
        )}
      </details>
    </div>
  );
}
