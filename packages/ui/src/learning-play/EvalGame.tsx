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

const INPUTS = ["information", "availability", "supported"] as const;
const inputSummary = (activity: EvalActivity, input: EvalScenario): string =>
  INPUTS.map((key) => activity.inputs[key][input[key] ? "present" : "absent"]).join(" · ");
const sameCase = (left: EvalCase, right: EvalCase): boolean =>
  evalCaseSignature([left]) === evalCaseSignature([right]);

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

export function EvalGame({ activity, disabled, onAttempt }: ActivityControls<EvalActivity>) {
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
  const [focusRequest, setFocusRequest] = useState<{
    readonly target: "trial" | "release";
    readonly sequence: number;
  }>();
  const passed = useRef(false);
  const composer = useRef<HTMLHeadingElement>(null);
  const trialHeading = useRef<HTMLHeadingElement>(null);
  const releaseHeading = useRef<HTMLHeadingElement>(null);
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

  useEffect(() => {
    const heading =
      focusRequest?.target === "release"
        ? releaseHeading.current
        : focusRequest
          ? trialHeading.current
          : null;
    if (!heading) return;
    const rect = heading.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight - 100)
      heading.scrollIntoView({ block: "start", behavior: "instant" });
    heading.focus({ preventScroll: true });
  }, [focusRequest]);
  function focus(target: "trial" | "release") {
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
  function freezeAndProbe() {
    if (locked) return;
    const result = freezeEvalCase(cases, input, expected as EvalExpectation);
    if (!result.valid) {
      setMessage(t(`play.aiQuality.eval.${result.reason}`));
      return;
    }
    setCases((previous) => [...previous, result.testCase]);
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
    setMessage("");
    composer.current?.scrollIntoView({ block: "start", behavior: "instant" });
    composer.current?.focus({ preventScroll: true });
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
    setMessage(t("play.aiQuality.eval.caseChanged"));
    setReleaseMessage("");
    composer.current?.scrollIntoView({ block: "start", behavior: "instant" });
    composer.current?.focus({ preventScroll: true });
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
    setReleaseMessage(
      t(`play.aiQuality.eval.${assessment.reason}`, {
        missing: assessment.uncovered.map((item) => activity.outcomes[item].label).join("、"),
      }),
    );
    focus("release");
  }
  function finish() {
    if (locked) return;
    const result = assessEvalRelease(activity, cases, receipts, releaseRun);
    const summary = result.passed
      ? t("play.aiQuality.eval.success")
      : t(`play.aiQuality.eval.${result.reason}`, {
          missing: result.uncovered.map((item) => activity.outcomes[item].label).join("、"),
        });
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
    <div className="ai-quality ai-eval">
      <details className="ai-quality__contract ai-eval__contract" open>
        <summary>
          <strong>{activity.product}</strong>
        </summary>
        <p>{activity.contract}</p>
      </details>
      <section className="ai-eval__experiment">
        <div className="ai-quality__row">
          <h4 ref={composer} tabIndex={-1}>
            {t("play.aiQuality.eval.challenge")}
          </h4>
          {activeCase ? (
            <GameButton variant="ghost" disabled={locked} onClick={newQuestion}>
              {t("play.aiQuality.eval.newQuestion")}
            </GameButton>
          ) : null}
        </div>
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
                  setReleaseMessage(
                    t(`play.aiQuality.eval.${assessment.reason}`, {
                      missing: assessment.uncovered
                        .map((item) => activity.outcomes[item].label)
                        .join("、"),
                    }),
                  );
                }
              }}
            >
              {candidate.label}
            </GameButton>
          ))}
        </div>
        <p className="ai-quality__muted">{t("play.aiQuality.eval.unknownNote")}</p>
        <div className="ai-eval__test-pair">
          <div className="ai-eval__request-ticket">
            <strong>{t("play.aiQuality.eval.requestTicket")}</strong>
            {activeCase ? (
              <>
                <ul>
                  {INPUTS.map((key) => (
                    <li key={key}>
                      {activity.inputs[key][activeCase.input[key] ? "present" : "absent"]}
                    </li>
                  ))}
                </ul>
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
                              if (!locked) setInput({ ...input, [key]: present });
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
                          if (!locked) setExpected(outcome);
                        }}
                      >
                        {activity.outcomes[outcome].label}
                      </GameButton>
                    ))}
                  </div>
                </fieldset>
                <GameButton variant="primary" disabled={locked} onClick={freezeAndProbe}>
                  {t("play.aiQuality.eval.freezeAndProbe")}
                </GameButton>
                <p className="ai-quality__status" role="status">
                  {message}
                </p>
              </>
            )}
          </div>
          <div className="ai-eval__response-ticket">
            <h5 ref={trialHeading} tabIndex={-1}>
              {t("play.aiQuality.eval.responseTicket", { candidate: selected?.label ?? "" })}
            </h5>
            {activeCase ? (
              <div className="ai-eval__response-context">
                <p>{inputSummary(activity, activeCase.input)}</p>
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
            {activeCase ? (
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
            {activeReceipts.length === 1 ? (
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
            {activeCase ? (
              <p className="ai-quality__status" role="status">
                {message}
              </p>
            ) : null}
          </div>
        </div>
      </section>
      {cases.length > 0 ? (
        <>
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
          <section className="ai-quality__stage ai-eval__release">
            <h4 ref={releaseHeading} tabIndex={-1}>
              {t("play.aiQuality.eval.releaseTitle")}
            </h4>
            <p>{t("play.aiQuality.eval.chosen", { name: selected?.label ?? "" })}</p>
            <p className="ai-quality__muted">{t("play.aiQuality.eval.releaseNote")}</p>
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
        </>
      ) : null}
    </div>
  );
}
