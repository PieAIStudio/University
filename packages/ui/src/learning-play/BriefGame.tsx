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
import { PlayGuide } from "./PlayGuide.js";
import { PlayIcon } from "./PlayIcon.js";
import { playSound } from "../sound/index.js";

export function BriefGame({
  activity,
  disabled,
  onAttempt,
  guided = false,
}: ActivityControls<BriefActivity>) {
  const [phase, setPhase] = useState<"observe" | "agree" | "test">("observe");
  const [questionIndex, setQuestionIndex] = useState(() =>
    Math.max(
      0,
      activity.questions.findIndex(
        (question) => activity.initialChoices?.[question.axis] === undefined,
      ),
    ),
  );
  const contractTop = useRef<HTMLElement>(null);
  const [choices, setChoices] = useState<BriefChoices>(activity.initialChoices ?? {});
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
    setPhase("test");
    previewHeading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    previewHeading.current?.focus({ preventScroll: true });
  }
  function verify() {
    const result = evaluateBrief(currentActivity, choices, observations);
    const checkpoint: BriefAcceptance = { choices, observations };
    if (result.passed && activity.followUp && !revised) {
      setAccepted([checkpoint]);
      setPhase("agree");
      setQuestionIndex(
        Math.max(
          0,
          activity.questions.findIndex(
            (question) =>
              activity.target[question.axis] !== activity.followUp!.target[question.axis],
          ),
        ),
      );
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
      {
        choices,
        providedChoices: activity.initialChoices ?? {},
        learnerChoices: Object.fromEntries(
          Object.entries(choices).filter(
            ([axis, value]) => activity.initialChoices?.[axis as BriefAxis] !== value,
          ),
        ),
        asked,
        observations,
        checks: result,
        rounds,
        experiments,
        handoff,
      },
      message,
    );
  }
  return (
    <div className="ai-brief" data-guided={guided} data-phase={phase}>
      {guided ? (
        <PlayGuide
          title={
            phase === "observe"
              ? t(
                  experiments.length
                    ? "play.usability.brief.difference"
                    : "play.usability.brief.start",
                )
              : phase === "agree"
                ? t(revised ? "play.usability.brief.change" : "play.usability.brief.question", {
                    current: activity.initialChoices ? 1 : questionIndex + 1,
                    total: activity.initialChoices
                      ? activity.questions.filter(
                          (question) => activity.initialChoices?.[question.axis] === undefined,
                        ).length
                      : activity.questions.length,
                  })
                : t("play.usability.brief.test")
          }
          action={
            phase === "observe"
              ? t(
                  experiments.length > 0
                    ? "play.usability.brief.ask"
                    : "play.ai.brief.compareSubmit",
                )
              : undefined
          }
          onAction={() => {
            if (!experiments.length) {
              compare("submit");
              return;
            }
            setPhase("agree");
            requestAnimationFrame(() =>
              contractTop.current?.scrollIntoView({ block: "nearest", behavior: "instant" }),
            );
          }}
          disabled={disabled}
        >
          {phase === "observe"
            ? experiments.length
              ? t("play.usability.brief.first")
              : activity.request
            : t(
                phase === "agree"
                  ? revised
                    ? "play.usability.brief.changed"
                    : "play.usability.brief.choose"
                  : "play.usability.brief.testNote",
              )}
        </PlayGuide>
      ) : null}
      <blockquote
        ref={requestTop}
        tabIndex={-1}
        className="ai-brief__request"
        hidden={guided && phase !== "agree"}
        data-revised={revised}
      >
        <span>{t(revised ? "play.ai.brief.newRequest" : "play.ai.brief.request")}</span>
        {revised ? <strong>{t("play.ai.brief.firstAccepted")}</strong> : null}
        <p>{revised ? activity.followUp!.request : activity.request}</p>
        {revised ? <small>{t("play.ai.brief.keepOtherRules")}</small> : null}
      </blockquote>
      <div className="ai-brief__preview-title" hidden={guided && phase === "agree"}>
        <h3 ref={previewHeading} tabIndex={-1} hidden={guided && phase === "observe"}>
          {t("play.ai.brief.interpretations")}
        </h3>
        <p hidden={guided}>{t("play.ai.brief.previewNote")}</p>
        <div
          className="play-action-row ai-brief__compare-controls"
          hidden={guided && phase === "observe"}
        >
          <GameButton variant="primary" disabled={disabled} onClick={() => compare("submit")}>
            {t("play.ai.brief.compareSubmit")}
          </GameButton>
          <GameButton
            variant="secondary"
            hidden={guided && phase === "observe"}
            disabled={disabled}
            onClick={() => compare("roster")}
          >
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
      <div
        className="ai-brief__prototypes"
        data-converged={converged}
        hidden={guided && phase !== "test"}
      >
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
      {guided && phase === "test" ? (
        <div className="play-action-row ai-brief__test-actions">
          <GameButton disabled={disabled} onClick={verify}>
            {t("play.ai.brief.verify")}
          </GameButton>
          <GameButton variant="ghost" disabled={disabled} onClick={() => setPhase("agree")}>
            {t("play.usability.brief.review")}
          </GameButton>
        </div>
      ) : null}
      {activity.initialChoices ? (
        <details className="play-model-note ai-brief__given">
          <summary>{t("play.difficulty.brief.given")}</summary>
          <p>{t("play.difficulty.brief.givenNote")}</p>
          <ul>
            {activity.questions.flatMap((question) =>
              question.options
                .filter((option) => activity.initialChoices?.[question.axis] === option.value)
                .map((option) => <li key={question.axis}>{option.clause}</li>),
            )}
          </ul>
        </details>
      ) : null}
      <section
        ref={contractTop}
        className="ai-brief__contract"
        aria-label={t("play.ai.brief.contract")}
        hidden={guided && phase !== "agree"}
      >
        <h3>{t("play.ai.brief.contract")}</h3>
        {guided ? (
          <nav className="ai-brief__question-tabs" aria-label={t("play.usability.brief.review")}>
            {activity.questions.map((question, index) => (
              <GameButton
                key={question.axis}
                variant={index === questionIndex ? "primary" : "ghost"}
                aria-pressed={index === questionIndex}
                onClick={() => setQuestionIndex(index)}
                disabled={disabled}
              >
                {question.label}
              </GameButton>
            ))}
          </nav>
        ) : null}
        <p className="ai-brief__convergence" role="status">
          {remaining
            ? t("play.ai.brief.openAssumptions", { count: remaining })
            : t("play.ai.brief.converged")}
        </p>
        <div className="ai-brief__questions">
          {activity.questions.map((question, index) => (
            <fieldset
              key={question.axis}
              hidden={guided && index !== questionIndex}
              disabled={disabled}
            >
              <legend>{question.label}</legend>
              <details
                open={guided ? true : undefined}
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
        {guided ? (
          <GameButton
            disabled={disabled || !choices[activity.questions[questionIndex]!.axis]}
            onClick={() => {
              const next = activity.questions.findIndex(
                (question, index) => index > questionIndex && !choices[question.axis],
              );
              if (next >= 0) setQuestionIndex(next);
              else if (remaining > 0)
                setQuestionIndex(
                  activity.questions.findIndex((question) => !choices[question.axis]),
                );
              else {
                setPhase("test");
                requestAnimationFrame(showPreview);
              }
            }}
          >
            {t(remaining === 0 ? "play.usability.brief.try" : "play.usability.brief.next")}
          </GameButton>
        ) : null}
        <div className="play-action-row" hidden={guided}>
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
