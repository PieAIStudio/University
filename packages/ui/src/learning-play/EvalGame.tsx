import { useEffect, useRef, useState } from "react";
import { GameButton, GameToggle } from "@pieai/swimmer-ui-kit";
import {
  EMPTY_EVAL_POLICY,
  EVAL_EXPECTATIONS,
  assessEvalRelease,
  currentEvalReceipts,
  evalCaseSignature,
  freezeEvalCase,
  runEvalCandidate,
  runEvalTrial,
  type EvalActivity,
  type EvalCase,
  type EvalExpectation,
  type EvalPolicy,
  type EvalRun,
  type EvalScenario,
  type EvalTrialReceipt,
} from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";
import type { ActivityControls } from "./controls.js";
import { PlayGuide } from "./PlayGuide.js";
import { evalStarterQuestion } from "./QualityGuidance.js";

const INPUTS = ["information", "availability", "supported"] as const;
const inputSummary = (activity: EvalActivity, input: EvalScenario): string =>
  INPUTS.map((key) => activity.inputs[key][input[key] ? "present" : "absent"]).join(" · ");
const sameCase = (left: EvalCase, right: EvalCase): boolean =>
  evalCaseSignature([left]) === evalCaseSignature([right]);
const releaseMessageFor = (
  activity: EvalActivity,
  assessment: ReturnType<typeof assessEvalRelease>,
): string =>
  assessment.reason === "invalid-requirements"
    ? t("play.qualityDifficulty.eval.invalid-requirements")
    : assessment.reason === "input-coverage"
      ? t("play.qualityDifficulty.eval.input-coverage", {
          missing: assessment.uncoveredInputs
            .map((input) => inputSummary(activity, input))
            .join(" / "),
        })
      : t(`play.aiQuality.eval.${assessment.reason}`, {
          missing: assessment.uncovered.map((item) => activity.outcomes[item].label).join(" / "),
        });

function ReleaseRecords({
  activity,
  cases,
  run,
}: {
  readonly activity: EvalActivity;
  readonly cases: readonly EvalCase[];
  readonly run: EvalRun;
}) {
  return (
    <div className="ai-eval__records">
      {cases.map((testCase, index) => {
        const records = run.observations.filter((item) => item.caseId === testCase.id);
        const passed = records.every((item) => item.passed);
        return (
          <details className="ai-eval__case-record" key={testCase.id} data-passed={passed}>
            <summary>
              <span>{t("play.aiQuality.eval.case", { number: index + 1 })}</span>
              <strong>{activity.outcomes[testCase.expected].label}</strong>
              <span
                className="ai-eval__trial-stamps"
                role="img"
                aria-label={t(passed ? "play.aiQuality.eval.pass" : "play.aiQuality.eval.fail")}
              >
                {records.map((record) => (
                  <span key={record.trial} data-passed={record.passed} aria-hidden="true">
                    {record.passed ? "✓" : "×"}
                  </span>
                ))}
              </span>
            </summary>
            <p>{inputSummary(activity, testCase.input)}</p>
            <ol>
              {records.map((record) => (
                <li key={record.trial}>
                  <strong>{t("play.aiQuality.eval.trial", { number: record.trial })}</strong>
                  <p>{activity.outcomes[record.actual].observation}</p>
                  <small>
                    {t(record.passed ? "play.aiQuality.eval.pass" : "play.aiQuality.eval.fail")}
                  </small>
                  {record.guarded ? <p>{t("play.aiQuality.eval.guarded")}</p> : null}
                  {record.expected !== record.contract ? (
                    <p className="ai-quality__warning">{t("play.aiQuality.eval.wrongCriterion")}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </details>
        );
      })}
    </div>
  );
}

export function EvalGame({
  activity,
  disabled,
  onAttempt,
  guided = false,
}: ActivityControls<EvalActivity>) {
  const [input, setInput] = useState<EvalScenario>({ ...activity.initial });
  const [expected, setExpected] = useState<EvalExpectation | "">("");
  const [cases, setCases] = useState<readonly EvalCase[]>([]);
  const [receipts, setReceipts] = useState<readonly EvalTrialReceipt[]>([]);
  const [activeCaseId, setActiveCaseId] = useState("");
  const [candidateId, setCandidateId] = useState(activity.candidates[0]?.id ?? "");
  const [policy, setPolicy] = useState<EvalPolicy>({ ...EMPTY_EVAL_POLICY });
  const [releaseRuns, setReleaseRuns] = useState<Readonly<Record<string, EvalRun>>>({});
  const [message, setMessage] = useState("");
  const [releaseMessage, setReleaseMessage] = useState("");
  const [composing, setComposing] = useState(false);
  const [starterId, setStarterId] = useState("");
  const [focusRequest, setFocusRequest] = useState<{
    readonly target: "composer" | "trial" | "release";
    readonly sequence: number;
  }>();
  const passed = useRef(false);
  const composer = useRef<HTMLHeadingElement>(null);
  const trialHeading = useRef<HTMLHeadingElement>(null);
  const releaseHeading = useRef<HTMLHeadingElement>(null);
  const releaseFold = useRef<HTMLDetailsElement>(null);
  const locked = disabled || passed.current;
  const activeCase = cases.find((item) => item.id === activeCaseId);
  const selected = activity.candidates.find((item) => item.id === candidateId);
  const activeReceipts = activeCase
    ? receipts.filter(
        (item) => item.candidateId === candidateId && sameCase(item.testCase, activeCase),
      )
    : [];
  const releaseRun = releaseRuns[candidateId];
  const changedResponse =
    activeReceipts.length > 1 &&
    new Set(activeReceipts.map((item) => item.observation.actual)).size > 1;
  const starter = evalStarterQuestion(activity);
  const showStarter = guided && !composing && cases.length === 0;
  const assessment = assessEvalRelease(activity, cases, receipts, releaseRun);
  const requiredCategories = activity.requiredExpectations ?? EVAL_EXPECTATIONS;
  const nextCategory = assessment.uncovered[0];
  const nextInput = assessment.uncoveredInputs[0];
  const needsQuestion = Boolean(nextCategory || nextInput);
  const nextQuestionPrompt = nextCategory
    ? t(`play.qualityGuide.eval.next.${nextCategory}`)
    : nextInput
      ? t("play.qualityDifficulty.eval.crossNext", { input: inputSummary(activity, nextInput) })
      : t("play.qualityGuide.eval.compose");
  const introObserved =
    activeReceipts.some((item) => !item.observation.passed) ||
    activeReceipts.length >= activity.trials;
  const canAddQuestion = !guided || composing || activeCase?.id !== starterId || introObserved;
  const guideTitle = showStarter
    ? t("play.qualityGuide.eval.start")
    : !activeCase
      ? nextQuestionPrompt
      : activeReceipts.length === 0
        ? t("play.qualityGuide.eval.tryCandidate")
        : activeReceipts.length < activity.trials && !introObserved
          ? t("play.qualityGuide.eval.repeat")
          : needsQuestion
            ? changedResponse
              ? t("play.qualityGuide.eval.discovered")
              : nextQuestionPrompt
            : assessment.reason === "blind-spot"
              ? t("play.qualityDifficulty.eval.moreTrials")
              : t("play.qualityDifficulty.eval.release");

  useEffect(() => {
    const heading =
      focusRequest?.target === "release"
        ? releaseHeading.current
        : focusRequest?.target === "composer"
          ? composer.current
          : focusRequest
            ? trialHeading.current
            : null;
    if (!heading) return;
    const rect = heading.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight - 100)
      heading.scrollIntoView({ block: "start", behavior: "instant" });
    heading.focus({ preventScroll: true });
  }, [focusRequest]);
  function focus(target: "composer" | "trial" | "release") {
    if (target === "release" && releaseFold.current) releaseFold.current.open = true;
    setFocusRequest((previous) => ({ target, sequence: (previous?.sequence ?? 0) + 1 }));
  }
  function probe(testCase: EvalCase) {
    if (locked) return;
    const trial =
      receipts.filter(
        (item) => item.candidateId === candidateId && sameCase(item.testCase, testCase),
      ).length + 1;
    if (trial > activity.trials) {
      setMessage(t("play.aiQuality.eval.sequenceDone"));
      return;
    }
    const result = runEvalTrial(activity, testCase, candidateId, trial);
    if (!result.valid) {
      setMessage(t("play.aiQuality.eval.invalidRun"));
      return;
    }
    setReceipts((previous) => [...previous, result.receipt]);
    setMessage(t("play.aiQuality.eval.observed", { count: trial, total: activity.trials }));
    focus("trial");
  }
  function freezeAndProbe(request = input, criterion = expected, starterRequest = false) {
    if (locked) return;
    const result = freezeEvalCase(cases, request, criterion as EvalExpectation);
    if (!result.valid) {
      setMessage(t(`play.aiQuality.eval.${result.reason}`));
      return;
    }
    setCases((previous) => [...previous, result.testCase]);
    if (starterRequest) {
      setStarterId(result.testCase.id);
      setInput({ ...request });
      setExpected(criterion);
    }
    setActiveCaseId(result.testCase.id);
    setReleaseRuns({});
    setReleaseMessage("");
    probe(result.testCase);
  }
  function newQuestion() {
    if (locked) return;
    setActiveCaseId("");
    setInput({ ...activity.initial });
    setExpected("");
    setComposing(true);
    setMessage("");
    focus("composer");
  }
  function removeCase(testCase: EvalCase, edit: boolean) {
    if (locked) return;
    const next = cases.filter((item) => item.id !== testCase.id);
    setCases(next);
    setReceipts((previous) => currentEvalReceipts(next, previous));
    setReleaseRuns({});
    if (edit) {
      setInput({ ...testCase.input });
      setExpected(testCase.expected);
    } else {
      setInput({ ...activity.initial });
      setExpected("");
    }
    setActiveCaseId("");
    setComposing(true);
    setMessage(t("play.aiQuality.eval.caseChanged"));
    setReleaseMessage("");
    focus("composer");
  }
  function rerunBoundary() {
    if (locked) return;
    const result = runEvalCandidate(activity, cases, candidateId, policy);
    if (!result.valid) {
      setReleaseMessage(t("play.aiQuality.eval.invalidRun"));
      return;
    }
    setReleaseRuns((previous) => ({ ...previous, [candidateId]: result.run }));
    const assessment = assessEvalRelease(activity, cases, receipts, result.run);
    setReleaseMessage(releaseMessageFor(activity, assessment));
    focus("release");
  }
  function finish() {
    if (locked) return;
    const result = assessEvalRelease(activity, cases, receipts, releaseRun);
    const summary = result.passed
      ? t("play.aiQuality.eval.success")
      : releaseMessageFor(activity, result);
    passed.current = result.passed;
    setReleaseMessage(summary);
    const handoff = [
      t("play.aiQuality.eval.handoffTitle", { product: activity.product }),
      ...cases.map((testCase, index) =>
        t("play.aiQuality.eval.handoffCase", {
          name: t("play.aiQuality.eval.case", { number: index + 1 }),
          input: inputSummary(activity, testCase.input),
          expected: activity.outcomes[testCase.expected].label,
          actual: (releaseRun?.observations ?? [])
            .filter((item) => item.caseId === testCase.id)
            .map(
              (item) =>
                `${t("play.aiQuality.eval.trial", { number: item.trial })}: ${activity.outcomes[item.actual].observation}`,
            )
            .join(" / "),
        }),
      ),
      t("play.aiQuality.eval.handoffPolicy", {
        candidate: selected?.label ?? "",
        policy:
          INPUTS.filter((key) => policy[key])
            .map((key) => activity.inputs[key].guard)
            .join("; ") || t("play.aiQuality.eval.noGuards"),
      }),
      ...receipts
        .filter((item) => !item.observation.passed)
        .slice(0, 8)
        .map((item) =>
          t("play.aiQuality.eval.handoffFailure", {
            candidate:
              activity.candidates.find((candidate) => candidate.id === item.candidateId)?.label ??
              "",
            case: t("play.aiQuality.eval.case", {
              number: cases.findIndex((testCase) => testCase.id === item.testCase.id) + 1,
            }),
            trial: item.observation.trial,
            expected: activity.outcomes[item.observation.expected].label,
            actual: activity.outcomes[item.observation.actual].observation,
          }),
        ),
      t("play.aiQuality.eval.handoffLimit"),
    ].join("\n\n");
    onAttempt(
      result.passed,
      { cases, trialReceipts: receipts, releaseRun, policy, handoff },
      summary,
    );
  }

  return (
    <div className="ai-quality ai-eval" data-guided={guided}>
      {guided ? <PlayGuide title={guideTitle} /> : null}
      <section className="ai-eval__experiment" data-starter={showStarter}>
        <div className="ai-quality__row" hidden={showStarter}>
          <h4 ref={composer} tabIndex={-1}>
            {showStarter ? t("play.qualityGuide.eval.starter") : t("play.aiQuality.eval.challenge")}
          </h4>
          {activeCase && canAddQuestion && !guided ? (
            <GameButton variant="ghost" disabled={locked} onClick={newQuestion}>
              {t(guided ? "play.qualityGuide.eval.ownQuestion" : "play.aiQuality.eval.newQuestion")}
            </GameButton>
          ) : null}
        </div>
        <div className="ai-eval__test-pair">
          <div className="ai-eval__request-ticket">
            <strong>
              {t(
                showStarter
                  ? "play.qualityGuide.eval.starter"
                  : "play.aiQuality.eval.requestTicket",
              )}
            </strong>
            {showStarter ? (
              <>
                <p className="quality-guide__request">{inputSummary(activity, starter.input)}</p>
                <div className="ai-eval__acceptance">
                  <span>{t("play.aiQuality.eval.expect")}</span>
                  <strong>{activity.outcomes[starter.expected].label}</strong>
                </div>
                <GameButton
                  variant="primary"
                  disabled={locked}
                  onClick={() => freezeAndProbe(starter.input, starter.expected, true)}
                >
                  {t("play.qualityGuide.eval.startAction")}
                </GameButton>
                <p className="ai-quality__muted quality-guide__starter-note">
                  {t("play.qualityGuide.eval.starterNote")}
                </p>
              </>
            ) : activeCase ? (
              <>
                {guided ? (
                  <p className="quality-guide__request">
                    {inputSummary(activity, activeCase.input)}
                  </p>
                ) : (
                  <ul>
                    {INPUTS.map((key) => (
                      <li key={key}>
                        {activity.inputs[key][activeCase.input[key] ? "present" : "absent"]}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="ai-eval__acceptance">
                  <span>{t("play.aiQuality.eval.expect")}</span>
                  <strong>{activity.outcomes[activeCase.expected].label}</strong>
                </div>
                <GameButton
                  variant="ghost"
                  disabled={locked}
                  onClick={() => removeCase(activeCase, true)}
                >
                  {t("play.aiQuality.eval.edit")}
                </GameButton>
              </>
            ) : (
              <>
                <div className="ai-eval__condition-folds">
                  {INPUTS.map((key) => (
                    <details key={key}>
                      <summary>
                        <span>{activity.inputs[key].label}</span>
                        <strong>{activity.inputs[key][input[key] ? "present" : "absent"]}</strong>
                      </summary>
                      <div className="ai-quality__choices">
                        {[true, false].map((present) => (
                          <GameButton
                            key={String(present)}
                            variant={input[key] === present ? "primary" : "secondary"}
                            disabled={locked}
                            aria-pressed={input[key] === present}
                            onClick={() => {
                              if (!locked) {
                                setInput({ ...input, [key]: present });
                                setComposing(true);
                              }
                            }}
                          >
                            {activity.inputs[key][present ? "present" : "absent"]}
                          </GameButton>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
                <fieldset className="ai-quality__fieldset ai-eval__expectations" disabled={locked}>
                  <legend>{t("play.aiQuality.eval.expect")}</legend>
                  <div className="ai-quality__choices">
                    {EVAL_EXPECTATIONS.map((outcome) => (
                      <GameButton
                        key={outcome}
                        variant={expected === outcome ? "primary" : "secondary"}
                        disabled={locked}
                        aria-pressed={expected === outcome}
                        onClick={() => {
                          if (!locked) {
                            setExpected(outcome);
                            setComposing(true);
                          }
                        }}
                      >
                        {activity.outcomes[outcome].label}
                      </GameButton>
                    ))}
                  </div>
                </fieldset>
                <GameButton variant="primary" disabled={locked} onClick={() => freezeAndProbe()}>
                  {t("play.aiQuality.eval.freezeAndProbe")}
                </GameButton>
                <p className="ai-quality__status" role="status">
                  {message}
                </p>
              </>
            )}
          </div>
          <div className="ai-eval__response-ticket" hidden={showStarter}>
            <h5 ref={trialHeading} tabIndex={-1}>
              {t("play.aiQuality.eval.responseTicket", { candidate: selected?.label ?? "" })}
            </h5>
            {activeCase ? (
              <div className="ai-eval__response-context">
                {!guided ? <p>{inputSummary(activity, activeCase.input)}</p> : null}
                <strong>
                  {t("play.aiQuality.eval.expected", {
                    result: activity.outcomes[activeCase.expected].label,
                  })}
                </strong>
              </div>
            ) : null}
            {activeReceipts.length === 0 ? (
              <p className="ai-quality__empty">
                {t(
                  activeCase
                    ? "play.aiQuality.eval.untried"
                    : "play.aiQuality.eval.responseWaiting",
                )}
              </p>
            ) : (
              <ol className="ai-eval__response-strip">
                {activeReceipts.map(({ observation }) => (
                  <li key={observation.trial} data-passed={observation.passed}>
                    <div className="ai-quality__row">
                      <strong>
                        {t("play.aiQuality.eval.trial", { number: observation.trial })}
                      </strong>
                      <span>
                        {t(
                          observation.passed
                            ? "play.aiQuality.eval.pass"
                            : "play.aiQuality.eval.fail",
                        )}
                      </span>
                    </div>
                    {activity.outcomes[observation.actual].artifact ? (
                      <div className="ai-eval__artifact">
                        <span>{activity.outcomes[observation.actual].artifact?.label}</span>
                        <strong>{activity.outcomes[observation.actual].artifact?.value}</strong>
                      </div>
                    ) : null}
                    <p>{activity.outcomes[observation.actual].observation}</p>
                    {observation.expected !== observation.contract ? (
                      <p className="ai-quality__warning">
                        {t("play.aiQuality.eval.wrongCriterion")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
            {changedResponse ? (
              <p className="ai-eval__discovery">{t("play.aiQuality.eval.responseChanged")}</p>
            ) : null}
            {activeCase && activeReceipts.length < activity.trials ? (
              <GameButton
                variant="primary"
                disabled={locked || activeReceipts.length >= activity.trials}
                onClick={() => probe(activeCase)}
              >
                {t(
                  activeReceipts.length === 0
                    ? "play.aiQuality.eval.probeCurrent"
                    : "play.aiQuality.eval.repeat",
                )}
              </GameButton>
            ) : null}
            {activeReceipts.length === 1 && !guided ? (
              <p className="ai-quality__muted">
                {t(
                  activeReceipts[0]!.observation.passed
                    ? "play.aiQuality.eval.firstOnly"
                    : "play.aiQuality.eval.firstFailure",
                )}
              </p>
            ) : null}
            {activeReceipts.length >= activity.trials ? (
              <p className="ai-quality__muted">{t("play.aiQuality.eval.sequenceDone")}</p>
            ) : null}
            {guided && activeCase && introObserved ? (
              <GameButton
                variant="secondary"
                disabled={locked}
                onClick={needsQuestion ? newQuestion : () => focus("release")}
              >
                {t(
                  needsQuestion
                    ? "play.qualityGuide.eval.ownQuestion"
                    : "play.qualityGuide.eval.openRelease",
                )}
              </GameButton>
            ) : null}
            {activeCase ? (
              <p className="ai-quality__status" role="status">
                {message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="quality-guide__eval-options">
          <details className="ai-quality__contract quality-guide__requirements" open={!guided}>
            <summary>
              {t("play.qualityDifficulty.eval.requirements", {
                count: requiredCategories.length,
                cross: activity.requiredInputs?.length
                  ? t("play.qualityDifficulty.eval.crossCount", {
                      count: activity.requiredInputs.length,
                    })
                  : "",
              })}
            </summary>
            <ul>
              {requiredCategories.map((category) => (
                <li key={category} data-complete={!assessment.uncovered.includes(category)}>
                  {activity.outcomes[category].label} ·{" "}
                  {t(
                    assessment.uncovered.includes(category)
                      ? "play.qualityDifficulty.eval.requirementPending"
                      : "play.qualityDifficulty.eval.requirementDone",
                  )}
                </li>
              ))}
            </ul>
            {activity.requiredInputs?.length ? (
              <>
                <strong>{t("play.qualityDifficulty.eval.crossHeading")}</strong>
                <ul>
                  {activity.requiredInputs.map((input) => {
                    const missing = assessment.uncoveredInputs.some((item) =>
                      INPUTS.every((key) => item[key] === input[key]),
                    );
                    return (
                      <li
                        key={INPUTS.map((key) => Number(input[key])).join("")}
                        data-complete={!missing}
                      >
                        {inputSummary(activity, input)} ·{" "}
                        {t(
                          missing
                            ? "play.qualityDifficulty.eval.requirementPending"
                            : "play.qualityDifficulty.eval.requirementDone",
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
          </details>
          <details className="ai-quality__contract ai-eval__contract" open={!guided}>
            <summary>
              <strong>{guided ? t("play.qualityGuide.eval.contract") : activity.product}</strong>
            </summary>
            <p>{activity.contract}</p>
          </details>
          <details className="quality-guide__candidate-fold" open={!guided}>
            <summary>
              {t("play.qualityGuide.eval.candidate", { candidate: selected?.label ?? "" })}
            </summary>
            <div
              className="ai-eval__candidate-switch"
              role="group"
              aria-label={t("play.aiQuality.eval.chooseCandidate")}
            >
              {activity.candidates.map((candidate) => (
                <GameButton
                  key={candidate.id}
                  variant={candidateId === candidate.id ? "primary" : "secondary"}
                  disabled={locked}
                  aria-pressed={candidateId === candidate.id}
                  onClick={() => {
                    if (!locked) {
                      setCandidateId(candidate.id);
                      setMessage("");
                      const assessment = assessEvalRelease(
                        activity,
                        cases,
                        receipts,
                        releaseRuns[candidate.id],
                      );
                      setReleaseMessage(releaseMessageFor(activity, assessment));
                    }
                  }}
                >
                  {candidate.label}
                </GameButton>
              ))}
            </div>
            <p className="ai-quality__muted">{t("play.aiQuality.eval.unknownNote")}</p>
          </details>
        </div>
      </section>
      {cases.length > 0 ? (
        <>
          <details className="quality-guide__collection-fold" open={!guided}>
            <summary>
              {t("play.aiQuality.eval.collection", { count: cases.length })} ·{" "}
              {t("play.qualityDifficulty.eval.coverage", {
                count: requiredCategories.length - assessment.uncovered.length,
                total: requiredCategories.length,
              })}
            </summary>
            <section className="ai-eval__collection">
              <div className="ai-quality__row">
                <h4>{t("play.aiQuality.eval.collection", { count: cases.length })}</h4>
                <GameButton variant="secondary" disabled={locked} onClick={newQuestion}>
                  {t("play.aiQuality.eval.newQuestion")}
                </GameButton>
              </div>
              <p className="ai-quality__muted">{t("play.aiQuality.eval.collectionNote")}</p>
              <ol className="ai-eval__case-sheet">
                {cases.map((testCase, index) => {
                  const records = receipts.filter((item) => sameCase(item.testCase, testCase));
                  return (
                    <li key={testCase.id}>
                      <span className="ai-eval__case-number" aria-hidden="true">
                        {index + 1}
                      </span>
                      <div>
                        <strong>{activity.outcomes[testCase.expected].label}</strong>
                        <p>{inputSummary(activity, testCase.input)}</p>
                        <small>
                          {t("play.aiQuality.eval.collectionEvidence", {
                            count: records.length,
                            failures: records.filter((item) => !item.observation.passed).length,
                          })}
                        </small>
                      </div>
                      <div className="ai-eval__case-actions">
                        <GameButton
                          variant="secondary"
                          disabled={locked}
                          onClick={() => {
                            if (!locked) {
                              setActiveCaseId(testCase.id);
                              setMessage("");
                              composer.current?.scrollIntoView({
                                block: "start",
                                behavior: "instant",
                              });
                              composer.current?.focus({ preventScroll: true });
                            }
                          }}
                        >
                          {t("play.aiQuality.eval.viewCase")}
                        </GameButton>
                        <GameButton
                          variant="ghost"
                          disabled={locked}
                          onClick={() => removeCase(testCase, false)}
                        >
                          {t("play.aiQuality.eval.remove")}
                        </GameButton>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          </details>
          <details
            className="quality-guide__release-fold"
            ref={releaseFold}
            open={!guided || !needsQuestion}
          >
            <summary>{t("play.qualityGuide.eval.releaseClosed")}</summary>
            <section className="ai-quality__stage ai-eval__release">
              <h4 ref={releaseHeading} tabIndex={-1}>
                {t("play.aiQuality.eval.releaseTitle")}
              </h4>
              <p>{t("play.aiQuality.eval.chosen", { name: selected?.label ?? "" })}</p>
              <p className="ai-quality__muted">{t("play.qualityDifficulty.eval.releaseNote")}</p>
              <div className="ai-eval__guards">
                {INPUTS.map((key) => (
                  <GameToggle
                    key={key}
                    label={activity.inputs[key].guard}
                    checked={policy[key]}
                    disabled={locked}
                    onClick={() => {
                      if (!locked) {
                        setPolicy({ ...policy, [key]: !policy[key] });
                        setReleaseRuns({});
                        setReleaseMessage(t("play.aiQuality.eval.stale-run"));
                      }
                    }}
                  />
                ))}
              </div>
              <GameButton variant="primary" onClick={rerunBoundary} disabled={locked}>
                {t("play.aiQuality.eval.runBoundary")}
              </GameButton>
              <p className="ai-quality__status" role="status">
                {releaseMessage}
              </p>
              {releaseRun ? (
                <ReleaseRecords activity={activity} cases={cases} run={releaseRun} />
              ) : null}
              <GameButton variant="primary" onClick={finish} disabled={locked}>
                {t("play.aiQuality.eval.finish")}
              </GameButton>
            </section>
          </details>
        </>
      ) : null}
    </div>
  );
}
