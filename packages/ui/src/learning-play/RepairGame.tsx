import { useRef, useState } from "react";
import { GameButton, GameSlider } from "@pieai/swimmer-ui-kit";
import {
  appendRepairComparisonEvent,
  branchRepairComparison,
  branchRepairWorkspace,
  captureRepairEvidence,
  checkRepairComparisonRegression,
  checkRepairDefect,
  checkRepairRegression,
  createRepairComparison,
  createRepairWorkspace,
  firstRepairDivergence,
  operateRepairWorkspace,
  repairComparisonFrame,
  replayRepair,
  resetRepairWorkspace,
  restoreRepairCheckpoint,
  seekRepairComparison,
  type RepairActivity,
  type RepairComparison,
  type RepairEvent,
  type RepairEvidence,
  type RepairImplementation,
  type RepairTrace,
} from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";
import type { ActivityControls } from "./controls.js";
import {
  RepairProductView,
  RepairTraceRecord,
  repairEventLabel,
  repairProductSummary,
} from "./RepairProductView.js";

export function RepairGame({ activity, disabled, onAttempt }: ActivityControls<RepairActivity>) {
  const [workspace, setWorkspace] = useState(() => createRepairWorkspace(activity));
  const [evidence, setEvidence] = useState<RepairEvidence>();
  const [patch, setPatch] = useState<Exclude<RepairImplementation, "broken">>();
  const [comparison, setComparison] = useState<RepairComparison>();
  const [tapes, setTapes] = useState<
    readonly { readonly id: number; readonly comparison: RepairComparison }[]
  >([]);
  const nextTape = useRef(1);
  const [defectReceipt, setDefectReceipt] = useState<{
    readonly passed: boolean;
    readonly trace: RepairTrace;
  }>();
  const [regressionReceipt, setRegressionReceipt] = useState<RepairTrace>();
  const [regressionActive, setRegressionActive] = useState(false);
  const [message, setMessage] = useState("");
  const passed = useRef(false);
  const productHeading = useRef<HTMLHeadingElement>(null);
  const locked = disabled || passed.current;
  const frame = comparison ? repairComparisonFrame(activity, comparison) : undefined;
  const product = frame?.right ?? workspace.product;
  const versionLabel = (implementation: RepairImplementation) =>
    implementation === "broken"
      ? t("play.aiQuality.repair.original")
      : activity.patches[implementation].label;
  const version = versionLabel(workspace.implementation);
  const divergence = comparison ? firstRepairDivergence(activity, comparison) : undefined;
  const controlsLocked =
    locked ||
    (comparison
      ? comparison.mode === "replay" || comparison.cursor >= 40
      : workspace.events.length >= 40);
  const selectedPatches =
    activity.model === "booking"
      ? (["rewrite", "scoped", "removed"] as const)
      : (["scoped", "removed", "rewrite"] as const);

  function showProduct() {
    productHeading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    productHeading.current?.focus({ preventScroll: true });
  }
  function rememberTape(current = comparison) {
    if (!current || current.events.length === 0) return;
    const id = nextTape.current++;
    setTapes((previous) => [...previous, { id, comparison: current }].slice(-4));
  }
  function clearChecks() {
    setDefectReceipt(undefined);
    setRegressionReceipt(undefined);
    setRegressionActive(false);
  }
  function liveWorkspace() {
    const prefix = comparison
      ? replayRepair(activity, comparison.candidate, comparison.events.slice(0, comparison.cursor))
      : undefined;
    return prefix?.valid ? { ...workspace, ...prefix.trace } : workspace;
  }
  function operate(event: RepairEvent) {
    if (controlsLocked) return;
    if (comparison) {
      if (comparison.cursor < comparison.events.length) rememberTape();
      const next = appendRepairComparisonEvent(activity, comparison, event);
      setComparison(next);
      setWorkspace((current) => ({ ...current, ...next.right }));
      if (regressionActive) setRegressionReceipt(undefined);
    } else setWorkspace((current) => operateRepairWorkspace(activity, current, event));
  }
  function capture() {
    if (locked) return;
    const result = captureRepairEvidence(activity, workspace);
    if (!result) {
      setMessage(t("play.aiQuality.repair.noFailure"));
      return;
    }
    setEvidence(result);
    clearChecks();
    setMessage(t("play.aiQuality.repair.captured"));
  }
  function apply() {
    if (locked || !patch || !evidence) return;
    rememberTape();
    setWorkspace(branchRepairWorkspace(activity, liveWorkspace(), patch));
    setComparison(createRepairComparison(activity, "broken", patch, evidence.events));
    clearChecks();
    setMessage(t("play.aiQuality.repair.appliedTimeline"));
    showProduct();
  }
  function loadReplay() {
    if (locked || !evidence) return;
    rememberTape();
    setComparison(
      createRepairComparison(activity, "broken", workspace.implementation, evidence.events),
    );
    setRegressionActive(false);
    setMessage(t("play.aiQuality.repair.replayReady"));
    showProduct();
  }
  function verifyDefect() {
    if (locked || !evidence || !comparison) return;
    if (
      comparison.mode !== "replay" ||
      comparison.cursor !== comparison.events.length ||
      JSON.stringify(comparison.events) !== JSON.stringify(evidence.events)
    ) {
      setMessage(t("play.aiQuality.repair.replayIncomplete"));
      return;
    }
    const result = checkRepairDefect(activity, workspace.implementation, evidence);
    if (result.trace) setDefectReceipt({ passed: result.passed, trace: result.trace });
    setMessage(
      t(
        result.passed ? "play.aiQuality.repair.defectPassed" : "play.aiQuality.repair.defectFailed",
      ),
    );
  }
  function startRegression() {
    if (locked) return;
    rememberTape();
    setWorkspace((current) => resetRepairWorkspace(activity, current));
    setComparison(
      createRepairComparison(activity, "broken", workspace.implementation, [], "manual"),
    );
    setRegressionReceipt(undefined);
    setRegressionActive(true);
    setMessage(t("play.aiQuality.repair.regressionActive"));
    showProduct();
  }
  function verifyRegression() {
    if (locked || !comparison) return;
    const result = checkRepairComparisonRegression(activity, comparison);
    if (result === "passed") setRegressionReceipt(comparison.right);
    else setRegressionReceipt(undefined);
    setMessage(
      t(
        result === "passed"
          ? "play.aiQuality.repair.regressionPassed"
          : result === "failed"
            ? "play.aiQuality.repair.regressionFailed"
            : "play.aiQuality.repair.manualRequired",
      ),
    );
  }
  function forkHere() {
    if (locked || !comparison) return;
    rememberTape();
    setComparison(branchRepairComparison(comparison));
    setRegressionActive(
      regressionActive &&
        comparison.origins.slice(0, comparison.cursor).every((origin) => origin === "manual"),
    );
    setRegressionReceipt(undefined);
    setMessage(t("play.aiQuality.repair.branchReady"));
  }
  function finish() {
    if (locked) return;
    const success = Boolean(
      evidence &&
      defectReceipt?.passed &&
      defectReceipt.trace.implementation === workspace.implementation &&
      regressionReceipt?.implementation === workspace.implementation &&
      checkRepairRegression(activity, regressionReceipt) === "passed",
    );
    const summary = t(success ? "play.aiQuality.repair.success" : "play.aiQuality.repair.notReady");
    passed.current = success;
    setMessage(summary);
    const applied =
      workspace.implementation === "broken"
        ? undefined
        : activity.patches[workspace.implementation];
    const handoff =
      evidence && applied && defectReceipt && regressionReceipt
        ? t("play.aiQuality.repair.handoff", {
            product: activity.product,
            defect: activity.defect,
            steps: evidence.events
              .map((event, index) => `${index + 1}. ${repairEventLabel(activity, event)}`)
              .join("\n"),
            expected: repairProductSummary(activity, evidence.expected.product),
            actual: repairProductSummary(activity, evidence.actual.product),
            scope: applied.scope,
            change: applied.change,
            after: repairProductSummary(activity, defectReceipt.trace.product),
            regression: activity.regression,
            regressionSteps: regressionReceipt.events
              .map((event, index) => `${index + 1}. ${repairEventLabel(activity, event)}`)
              .join("\n"),
            regressionActual: repairProductSummary(activity, regressionReceipt.product),
            checkpoint:
              workspace.checkpoints.find((item) => item.implementation === "broken")?.id ??
              workspace.checkpoints[0]?.id ??
              0,
          })
        : "";
    onAttempt(
      success,
      {
        failure: evidence,
        appliedImplementation: workspace.implementation,
        defectReplay: defectReceipt,
        regression: regressionReceipt,
        branches: tapes,
        comparison,
        checkpoints: workspace.checkpoints.map((item) => ({
          id: item.id,
          implementation: item.implementation,
        })),
        handoff,
      },
      summary,
    );
  }

  return (
    <div className="ai-quality ai-repair">
      <section className="ai-quality__contract">
        <strong>{t("play.aiQuality.repair.report")}</strong>
        <p>{activity.defect}</p>
        <p>{t("play.aiQuality.repair.expect", { expected: activity.expected })}</p>
      </section>
      <section className="ai-repair__live">
        <h4 ref={productHeading} tabIndex={-1}>
          {activity.product}
        </h4>
        <p className="ai-quality__muted">{activity.productBrief}</p>
        {comparison && frame ? (
          <>
            <div className="ai-repair__time-caption" role="status">
              <strong>
                {t("play.aiQuality.repair.frame", {
                  step: comparison.cursor,
                  total: comparison.events.length,
                })}
              </strong>
              <span>
                {frame.event
                  ? repairEventLabel(activity, frame.event)
                  : t("play.aiQuality.repair.initialFrame")}
              </span>
              <span data-different={frame.different}>
                {t(
                  frame.different
                    ? "play.aiQuality.repair.framesDifferent"
                    : "play.aiQuality.repair.framesSame",
                )}
              </span>
            </div>
            <div className="ai-repair__paired-products" data-different={frame.different}>
              <RepairProductView
                activity={activity}
                product={frame.left}
                label={versionLabel(comparison.baseline)}
                effect={comparison.left.entries[comparison.cursor - 1]?.effect}
                compact
              />
              <RepairProductView
                activity={activity}
                product={frame.right}
                label={versionLabel(comparison.candidate)}
                effect={comparison.right.entries[comparison.cursor - 1]?.effect}
                compact
              />
            </div>
            <div className="ai-repair__time-controls">
              <fieldset
                className="ai-repair__cursor-field"
                disabled={locked || comparison.events.length === 0}
              >
                <GameSlider
                  label={t("play.aiQuality.repair.cursor")}
                  min={0}
                  max={Math.max(1, comparison.events.length)}
                  value={comparison.cursor}
                  onChange={(cursor) => {
                    if (!locked) setComparison(seekRepairComparison(comparison, cursor));
                  }}
                />
              </fieldset>
              <div className="ai-quality__choices">
                <GameButton
                  variant="secondary"
                  disabled={locked || comparison.cursor === 0}
                  onClick={() =>
                    setComparison(seekRepairComparison(comparison, comparison.cursor - 1))
                  }
                >
                  {t("play.aiQuality.repair.previous")}
                </GameButton>
                <GameButton
                  variant="primary"
                  disabled={locked || comparison.cursor >= comparison.events.length}
                  onClick={() =>
                    setComparison(seekRepairComparison(comparison, comparison.cursor + 1))
                  }
                >
                  {t("play.aiQuality.repair.next")}
                </GameButton>
                <GameButton
                  variant="ghost"
                  disabled={locked || divergence === undefined}
                  onClick={() => {
                    if (divergence !== undefined)
                      setComparison(seekRepairComparison(comparison, divergence));
                  }}
                >
                  {t("play.aiQuality.repair.jumpDifference")}
                </GameButton>
              </div>
              <GameButton variant="secondary" disabled={locked} onClick={forkHere}>
                {t("play.aiQuality.repair.forkHere")}
              </GameButton>
              {comparison.mode === "replay" ? (
                <p className="ai-quality__muted">{t("play.aiQuality.repair.replayControls")}</p>
              ) : (
                <p className="ai-quality__muted">{t("play.aiQuality.repair.sharedControls")}</p>
              )}
            </div>
          </>
        ) : (
          <RepairProductView
            activity={activity}
            product={product}
            label={version}
            effect={workspace.entries.at(-1)?.effect}
          />
        )}
        <div className="ai-repair__shared-inputs">
          <strong>
            {t(
              comparison
                ? "play.aiQuality.repair.oneActionBoth"
                : "play.aiQuality.repair.yourAction",
            )}
          </strong>
          <div className="ai-quality__choices ai-repair__product-choices">
            {activity.choices.map((choice) => (
              <GameButton
                key={choice.id}
                variant={product.choice === choice.id ? "primary" : "secondary"}
                aria-pressed={product.choice === choice.id}
                disabled={controlsLocked}
                onClick={() => operate({ type: "choose", value: choice.id })}
              >
                {choice.label}
              </GameButton>
            ))}
          </div>
          <div className="ai-quality__choices">
            <GameButton
              variant="primary"
              disabled={controlsLocked || (!comparison && workspace.implementation === "removed")}
              onClick={() => operate({ type: "submit" })}
            >
              {activity.submitLabel}
            </GameButton>
            <GameButton
              variant="secondary"
              disabled={controlsLocked}
              onClick={() => operate({ type: activity.model === "booking" ? "cancel" : "reload" })}
            >
              {t(
                activity.model === "booking"
                  ? "play.aiQuality.repair.cancel"
                  : "play.aiQuality.repair.reload",
              )}
            </GameButton>
          </div>
        </div>
        {workspace.implementation === "removed" ? (
          <p className="ai-quality__warning">{t("play.aiQuality.repair.removedNote")}</p>
        ) : null}
        {(comparison?.cursor ?? workspace.events.length) >= 40 ? (
          <p className="ai-quality__warning">{t("play.aiQuality.repair.traceLimit")}</p>
        ) : null}
        <details className="ai-repair__clues">
          <summary>
            {t(
              regressionActive
                ? "play.aiQuality.repair.regression"
                : "play.aiQuality.repair.reproduce",
            )}
          </summary>
          <ol>
            {(regressionActive ? activity.regressionSteps : activity.reproduceSteps).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>
        <div className="ai-quality__choices ai-repair__local-actions">
          {workspace.implementation === "broken" && !comparison ? (
            <GameButton variant="primary" disabled={locked} onClick={capture}>
              {t("play.aiQuality.repair.capture")}
            </GameButton>
          ) : null}
          {comparison?.mode === "replay" ? (
            <GameButton
              variant="primary"
              disabled={locked || comparison.cursor !== comparison.events.length}
              onClick={verifyDefect}
            >
              {t("play.aiQuality.repair.checkReplay")}
            </GameButton>
          ) : null}
          {regressionActive ? (
            <GameButton variant="primary" disabled={locked} onClick={verifyRegression}>
              {t("play.aiQuality.repair.regressionCheck")}
            </GameButton>
          ) : null}
          <GameButton
            variant="ghost"
            disabled={locked}
            onClick={() => {
              if (locked) return;
              if (comparison) startRegression();
              else setWorkspace((current) => resetRepairWorkspace(activity, current));
            }}
          >
            {t("play.aiQuality.repair.reset")}
          </GameButton>
        </div>
        <p className="ai-quality__status" role="status">
          {message}
        </p>
      </section>
      <RepairTraceRecord activity={activity} trace={comparison ? comparison.right : workspace} />
      {evidence ? (
        <>
          <details className="ai-repair__evidence">
            <summary>
              <strong>{t("play.aiQuality.repair.evidence")}</strong>
            </summary>
            <div className="ai-repair__comparison">
              <div>
                <span>{t("play.aiQuality.repair.actual")}</span>
                <strong>{repairProductSummary(activity, evidence.actual.product)}</strong>
              </div>
              <div>
                <span>{t("play.aiQuality.repair.expected")}</span>
                <strong>{repairProductSummary(activity, evidence.expected.product)}</strong>
              </div>
            </div>
            <RepairTraceRecord activity={activity} trace={evidence.actual} />
          </details>
          <section className="ai-quality__stage ai-repair__patches">
            <h4>{t("play.aiQuality.repair.patch")}</h4>
            <p className="ai-quality__muted">{t("play.aiQuality.repair.patchNote")}</p>
            <div className="ai-repair__patch-offers">
              {selectedPatches.map((id) => (
                <div key={id} data-selected={patch === id}>
                  <GameButton
                    variant={patch === id ? "primary" : "secondary"}
                    aria-pressed={patch === id}
                    disabled={locked}
                    onClick={() => {
                      if (!locked) setPatch(id);
                    }}
                  >
                    {activity.patches[id].label}
                  </GameButton>
                  <p>{activity.patches[id].claim ?? activity.patches[id].scope}</p>
                </div>
              ))}
            </div>
            {patch ? (
              <div className="ai-repair__scope">
                <strong>{t("play.aiQuality.repair.scopeLabel")}</strong>
                <p>{activity.patches[patch].scope}</p>
                <details>
                  <summary>{t("play.aiQuality.repair.changes")}</summary>
                  <p>{activity.patches[patch].change}</p>
                </details>
                <GameButton variant="primary" disabled={locked} onClick={apply}>
                  {t("play.aiQuality.repair.apply")}
                </GameButton>
              </div>
            ) : null}
          </section>
          <section className="ai-quality__stage">
            <h4>{t("play.aiQuality.repair.verify")}</h4>
            <div className="ai-repair__verification">
              <div className="ai-repair__check" data-passed={defectReceipt?.passed ?? false}>
                <strong>{t("play.aiQuality.repair.report")}</strong>
                <p>{activity.expected}</p>
                <GameButton variant="secondary" disabled={locked} onClick={loadReplay}>
                  {t("play.aiQuality.repair.replay")}
                </GameButton>
                {defectReceipt ? (
                  <p>
                    {t(
                      defectReceipt.passed
                        ? "play.aiQuality.repair.defectPassed"
                        : "play.aiQuality.repair.defectFailed",
                    )}
                  </p>
                ) : null}
              </div>
              <div className="ai-repair__check" data-passed={Boolean(regressionReceipt)}>
                <strong>{t("play.aiQuality.repair.regression")}</strong>
                <p>{activity.regression}</p>
                <GameButton variant="secondary" disabled={locked} onClick={startRegression}>
                  {t("play.aiQuality.repair.regressionStart")}
                </GameButton>
                {regressionReceipt ? <p>{t("play.aiQuality.repair.regressionPassed")}</p> : null}
              </div>
            </div>
            <GameButton variant="primary" disabled={locked} onClick={finish}>
              {t("play.aiQuality.repair.finish")}
            </GameButton>
          </section>
        </>
      ) : null}
      {tapes.length > 0 ? (
        <section className="ai-repair__tapes">
          <h4>{t("play.aiQuality.repair.tapes")}</h4>
          <ol>
            {tapes.map((tape) => (
              <li key={tape.id}>
                <strong>
                  {t("play.aiQuality.repair.tape", {
                    number: tape.id,
                    version: versionLabel(tape.comparison.candidate),
                    count: tape.comparison.events.length,
                  })}
                </strong>
                <GameButton
                  variant="ghost"
                  disabled={locked}
                  onClick={() => {
                    if (locked) return;
                    rememberTape();
                    setComparison(tape.comparison);
                    setWorkspace((current) => ({ ...current, ...tape.comparison.right }));
                    clearChecks();
                    setMessage(t("play.aiQuality.repair.tapeRestored"));
                    showProduct();
                  }}
                >
                  {t("play.aiQuality.repair.loadTape")}
                </GameButton>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <section className="ai-repair__timeline">
        <h4>{t("play.aiQuality.repair.checkpoints")}</h4>
        {workspace.checkpoints.length === 0 ? (
          <p className="ai-quality__muted">{t("play.aiQuality.repair.checkpointsEmpty")}</p>
        ) : (
          <ol>
            {workspace.checkpoints.map((checkpoint) => (
              <li key={checkpoint.id}>
                <div>
                  <strong>
                    {t("play.aiQuality.repair.checkpoint", {
                      number: checkpoint.id,
                      version: versionLabel(checkpoint.implementation),
                    })}
                  </strong>
                  <p>{repairProductSummary(activity, checkpoint.product)}</p>
                </div>
                <GameButton
                  variant="ghost"
                  disabled={locked}
                  onClick={() => {
                    if (locked) return;
                    rememberTape();
                    setWorkspace(restoreRepairCheckpoint(liveWorkspace(), checkpoint.id));
                    setComparison(undefined);
                    clearChecks();
                    setMessage(t("play.aiQuality.repair.restored"));
                    showProduct();
                  }}
                >
                  {t("play.aiQuality.repair.restore")}
                </GameButton>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
