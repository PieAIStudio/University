import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import {
  advanceAgent,
  advanceAgentRun,
  createAgentState,
  evaluateAgentWorkspace,
  inspectAgentAction,
  restoreAgentCheckpoint,
  setAgentCapability,
  type AgentActivity,
  type AgentMove,
  type AgentRunPause,
  type AgentState,
} from "@pieai/university-core";
import { translate } from "../i18n/index.js";
import { playSound } from "../sound/sound.js";
import type { ActivityControls } from "./controls.js";
import { AgentActionFiles } from "./AgentActionFiles.js";
import { AgentTools } from "./AgentTools.js";
import { AgentWorkspace } from "./AgentWorkspace.js";

// A visible step cadence, not simulated model latency. The first step is synchronous.
const RUN_STEP_MS = 850;

export function AgentGame({
  activity,
  disabled,
  guided = false,
  onAttempt,
}: ActivityControls<AgentActivity>) {
  const [state, setState] = useState<AgentState>(() => createAgentState(activity));
  const stateRef = useRef(state);
  const [fileId, setFileId] = useState(activity.files[0]?.id ?? "");
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);
  const [blockedToolId, setBlockedToolId] = useState<string | null>(null);
  const [needsScopeEdit, setNeedsScopeEdit] = useState(false);
  const [running, setRunning] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const runner = useRef<{ active: boolean; timer: ReturnType<typeof setTimeout> | null }>({
    active: false,
    timer: null,
  });
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const reported = useRef(false);
  const actionHeading = useRef<HTMLHeadingElement>(null);
  const scopeHeading = useRef<HTMLHeadingElement>(null);
  const driveRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const revealDrive = useRef(false);
  const toolHeadings = useRef(new Map<string, HTMLElement>());
  const currentAction = activity.actions[state.cursor];
  const currentTool = activity.tools.find((tool) => tool.id === currentAction?.toolId);
  const inspection = inspectAgentAction(activity, state);
  const evaluation = evaluateAgentWorkspace(activity, state);
  const readConsent =
    guided &&
    state.cursor === 0 &&
    currentTool?.capability === "read" &&
    currentAction?.authority === "user" &&
    currentAction.effects.length === 0 &&
    (state.capabilities[currentTool.id] ?? []).length === 0 &&
    !!inspection?.targets.length &&
    inspection.targets.every((target) => target.required && target.reads && !target.writes);
  const needsFiles =
    !!inspection &&
    !inspection.execution.accepted &&
    inspection.execution.reason === "scope-denied";
  const damaged = evaluation.changedProtectedFileIds.length > 0;
  const guideTitle = damaged
    ? "play.ai.agent.guide.damaged"
    : !currentAction
      ? evaluation.broadToolIds.length
        ? "play.ai.agent.guide.broad"
        : "play.ai.agent.guide.finish"
      : readConsent
        ? "play.ai.agent.guide.first"
        : currentAction.authority === "document"
          ? "play.ai.agent.guide.document"
          : inspection?.changedProtectedFileIds.length
            ? "play.ai.agent.guide.risk"
            : needsFiles || needsScopeEdit
              ? "play.ai.agent.guide.scope"
              : "play.ai.agent.guide.ready";
  const lastEntry = state.log.at(-1);
  const lastFileId =
    lastEntry?.changedFileIds.find((id) => evaluation.changedProtectedFileIds.includes(id)) ??
    lastEntry?.changedFileIds[0] ??
    lastEntry?.readFileIds[0];
  const lastFile = state.files.find((file) => file.id === lastFileId);
  const canRestore =
    state.cursor !== state.checkpoint.cursor || state.files !== state.checkpoint.files;
  const paths = (ids: readonly string[]) =>
    ids.map((id) => activity.files.find((file) => file.id === id)?.path ?? id).join(" · ");

  const stopRunning = useCallback(() => {
    if (runner.current.timer !== null) clearTimeout(runner.current.timer);
    runner.current.timer = null;
    runner.current.active = false;
    setRunning(false);
  }, []);

  useEffect(() => {
    function stopWhenHidden() {
      if (!document.hidden || !runner.current.active) return;
      stopRunning();
      setFeedback(translate("play.ai.agent.play.backgroundStopped"));
      setIsError(false);
    }
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", stopWhenHidden);
      if (runner.current.timer !== null) clearTimeout(runner.current.timer);
      runner.current.active = false;
    };
  }, [stopRunning]);

  useEffect(() => {
    if (disabled) stopRunning();
  }, [disabled, stopRunning]);

  useLayoutEffect(() => {
    if (!revealDrive.current) return;
    revealDrive.current = false;
    const drive = driveRef.current;
    if (!drive) return;
    const controls = drive.getBoundingClientRect();
    const result = resultRef.current?.getBoundingClientRect();
    const top = result?.top ?? controls.top;
    const margin = 16;
    if (top >= margin && controls.bottom <= window.innerHeight - margin) return;
    // A newly revealed multi-file action can grow above these controls on a phone.
    // Keep its real receipt and stop/decision controls together whenever they fit.
    if (result && controls.bottom - top <= window.innerHeight - margin * 2) {
      resultRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    } else {
      drive.scrollIntoView({ block: "end", behavior: "instant" });
    }
  }, [state.log.length, feedback, running]);

  function update(next: AgentState) {
    stateRef.current = next;
    setState(next);
  }

  function grant(toolId: string, fileIds: readonly string[]) {
    if (disabled || reported.current) return;
    stopRunning();
    playSound("ui.press");
    update(setAgentCapability(activity, stateRef.current, toolId, fileIds));
    setIsError(false);
    setNeedsScopeEdit(false);
    setBlockedToolId(null);
    setFeedback(
      translate(guided ? "play.ai.agent.guide.scopeChanged" : "play.ai.agent.play.scopeChanged", {
        tool: activity.tools.find((tool) => tool.id === toolId)?.label ?? toolId,
      }),
    );
  }

  function authorizeRead() {
    if (!readConsent || !currentTool || !inspection || disabled || reported.current) return;
    // The button names this exact read-only grant; it never enables a writing tool.
    update(
      setAgentCapability(
        activity,
        stateRef.current,
        currentTool.id,
        inspection.targets
          .filter((target) => target.required && target.reads)
          .map((target) => target.fileId),
      ),
    );
    advance("execute");
  }

  function focusScope() {
    playSound("ui.press");
    const section = scopeHeading.current?.closest("section");
    const target =
      section?.querySelector<HTMLButtonElement>(
        '[data-risk="true"] button, [data-reachable="false"] button',
      ) ?? scopeHeading.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "center", behavior: "instant" });
  }

  function openTools(toolId: string) {
    setToolsOpen(true);
    requestAnimationFrame(() => {
      const target = toolHeadings.current.get(toolId);
      const tool = target?.closest("details");
      if (tool) tool.open = true;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
  }

  function showExecuted(outcome: Extract<AgentMove, { accepted: true }>) {
    revealDrive.current = true;
    const action = activity.actions.find((item) => item.id === outcome.entry.actionId)!;
    setBlockedToolId(null);
    setNeedsScopeEdit(false);
    update(outcome.state);
    const damaged = evaluateAgentWorkspace(activity, outcome.state).changedProtectedFileIds;
    const changed = damaged[0] ?? outcome.entry.changedFileIds[0] ?? outcome.entry.readFileIds[0];
    if (changed) setFileId(changed);
    setIsError(damaged.length > 0);
    setFeedback(
      [
        translate(
          outcome.entry.outcome === "executed"
            ? "play.ai.agent.play.stepExecuted"
            : "play.ai.agent.rejected",
          {
            title: action.title,
          },
        ),
        outcome.entry.blockedFileIds.length
          ? translate("play.ai.agent.clipped", { paths: paths(outcome.entry.blockedFileIds) })
          : "",
        damaged.length ? translate("play.ai.agent.damaged", { paths: paths(damaged) }) : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  function advance(decision: "execute" | "reject") {
    if (disabled || reported.current) return;
    stopRunning();
    const before = stateRef.current;
    const action = activity.actions[before.cursor];
    if (!action) return;
    playSound("ui.press");
    const outcome = advanceAgent(activity, before, decision);
    if (!outcome.accepted) {
      revealDrive.current = true;
      const canAdjust = outcome.reason === "scope-denied" || outcome.reason === "required-action";
      setIsError(outcome.reason !== "required-action");
      setBlockedToolId(canAdjust ? action.toolId : null);
      setNeedsScopeEdit(canAdjust);
      setFeedback(
        outcome.reason === "required-action"
          ? translate(
              action.effects.length > 1
                ? "play.ai.agent.play.requiredPause"
                : "play.ai.agent.play.requiredPauseSimple",
            )
          : translate(`play.ai.agent.error.${outcome.reason}`, {
              tool:
                activity.tools.find((tool) => tool.id === action.toolId)?.label ?? action.toolId,
            }),
      );
      return;
    }
    showExecuted(outcome);
  }

  function pauseRun(reason: AgentRunPause, fileIds: readonly string[]) {
    revealDrive.current = true;
    stopRunning();
    const action = activity.actions[stateRef.current.cursor];
    const adjust = reason === "scope-denied" || reason === "protected-change";
    setBlockedToolId(adjust ? (action?.toolId ?? null) : null);
    setNeedsScopeEdit(adjust);
    setIsError(
      reason === "workspace-damaged" ||
        reason === "invalid-action" ||
        reason === "tool-unavailable",
    );
    const values = {
      paths: paths(fileIds),
      tool:
        activity.tools.find((tool) => tool.id === action?.toolId)?.label ?? action?.toolId ?? "",
    };
    setFeedback(
      reason === "document-action" ||
        reason === "protected-change" ||
        reason === "workspace-damaged" ||
        reason === "scope-denied" ||
        reason === "round-ended"
        ? translate(`play.ai.agent.play.pause.${reason}`, values)
        : translate(`play.ai.agent.error.${reason}`, values),
    );
  }

  function runStep() {
    if (!runner.current.active || disabledRef.current || reported.current) {
      stopRunning();
      return;
    }
    if (document.hidden) {
      stopRunning();
      setFeedback(translate("play.ai.agent.play.backgroundStopped"));
      return;
    }
    const outcome = advanceAgentRun(activity, stateRef.current);
    if (!outcome.accepted) {
      pauseRun(outcome.reason, outcome.fileIds);
      return;
    }
    showExecuted(outcome);
    if (outcome.state.cursor === activity.actions.length) {
      stopRunning();
      return;
    }
    runner.current.timer = setTimeout(runStep, RUN_STEP_MS);
  }

  function startRun() {
    if (disabled || reported.current || runner.current.active) return;
    playSound("ui.press");
    runner.current.active = true;
    setRunning(true);
    runStep();
  }

  function restore() {
    if (disabled || reported.current) return;
    stopRunning();
    playSound("ui.press");
    revealDrive.current = true;
    update(restoreAgentCheckpoint(stateRef.current));
    setNeedsScopeEdit(false);
    setBlockedToolId(null);
    setIsError(false);
    setFeedback(translate("play.ai.agent.restored"));
  }

  function check() {
    if (disabled || reported.current) return;
    stopRunning();
    playSound("ui.press");
    const current = stateRef.current;
    const result = evaluateAgentWorkspace(activity, current);
    const problems = [
      result.changedProtectedFileIds.length
        ? translate("play.ai.agent.damaged", { paths: paths(result.changedProtectedFileIds) })
        : "",
      result.unmetGoalFileIds.length
        ? translate("play.ai.agent.unmet", { paths: paths(result.unmetGoalFileIds) })
        : "",
      result.missingActionIds.length
        ? translate("play.ai.agent.unfinished", { count: result.missingActionIds.length })
        : "",
      result.broadToolIds.length
        ? translate("play.ai.agent.broad", {
            tools: result.broadToolIds
              .map((id) => activity.tools.find((tool) => tool.id === id)!.label)
              .join(" · "),
          })
        : "",
    ].filter(Boolean);
    const message = result.passed
      ? translate("play.ai.agent.difficulty.success", {
          outputs: activity.goals
            .map(
              (goal) =>
                activity.files.find((file) => file.id === goal.fileId)?.label ?? goal.fileId,
            )
            .join(" · "),
          protected: activity.files
            .filter((file) => file.protected)
            .map((file) => file.label)
            .join(" · "),
        })
      : problems.join(" ") || translate("play.ai.agent.pending");
    setIsError(!result.passed);
    setFeedback(message);
    if (result.passed) reported.current = true;
    const handoff = [
      `${translate("play.ai.agent.handoff")} — ${activity.title}`,
      activity.authorization,
      translate("play.ai.agent.handoffTools"),
      ...activity.tools.map(
        (tool) =>
          `${tool.label}: ${paths(current.capabilities[tool.id] ?? []) || translate("play.ai.agent.grantOff")}`,
      ),
      translate("play.ai.agent.handoffFiles"),
      ...current.files
        .filter((file) => !file.protected)
        .map((file) => `${file.path}\n${file.content}`),
    ].join("\n\n");
    onAttempt(
      result.passed,
      {
        capabilities: current.capabilities,
        files: current.files,
        completedActionIds: current.completedActionIds,
        rejectedActionIds: current.rejectedActionIds,
        log: current.log,
        recoveries: current.recoveries,
        verification: result,
        handoff,
      },
      message,
    );
  }

  const PrimaryFilesFrame = readConsent ? "details" : "div";
  const primaryAction = (
    <GameButton
      variant={guided ? "primary" : "secondary"}
      sound={false}
      disabled={disabled}
      onClick={
        guided && damaged
          ? restore
          : readConsent
            ? authorizeRead
            : guided && needsFiles
              ? focusScope
              : () => advance("execute")
      }
    >
      {translate(
        guided && damaged
          ? "play.ai.agent.restore"
          : readConsent
            ? "play.ai.agent.guide.readStart"
            : guided && needsFiles
              ? "play.ai.agent.guide.choose"
              : "play.ai.agent.execute",
      )}
    </GameButton>
  );
  const toolbox = (
    <AgentTools
      activity={activity}
      capabilities={state.capabilities}
      currentToolId={currentAction?.toolId}
      disabled={disabled}
      headingRefs={toolHeadings}
      onGrant={grant}
    />
  );
  const workspace = (
    <AgentWorkspace
      files={state.files}
      activeFileId={fileId}
      changedProtectedFileIds={evaluation.changedProtectedFileIds}
      onSelect={(id) => {
        setFileId(id);
        playSound("ui.press");
      }}
      onNext={
        currentAction
          ? () => {
              actionHeading.current?.focus({ preventScroll: true });
              actionHeading.current?.scrollIntoView({ block: "nearest" });
            }
          : undefined
      }
    />
  );

  return (
    <div className="play-ai-workflow play-ai-agent" data-guided={guided}>
      {!guided ? (
        <p className="play-ai-workflow__intro">{translate("play.ai.agent.play.intro")}</p>
      ) : null}
      <details className="play-ai-workflow__brief play-agent-authorization" open={!guided}>
        <summary>{guided ? activity.goal : translate("play.ai.agent.authorization")}</summary>
        <p>{activity.authorization}</p>
      </details>
      {!guided ? toolbox : null}
      <div className="play-ai-agent__cockpit">
        <section className="play-ai-agent__action">
          <header>
            <h4 ref={actionHeading} tabIndex={-1}>
              {guided
                ? (currentAction?.title ?? translate("play.ai.agent.check"))
                : translate("play.ai.agent.action")}
            </h4>
            <span>
              {translate("play.ai.agent.step", {
                current: Math.min(state.cursor + 1, activity.actions.length),
                total: activity.actions.length,
              })}
            </span>
          </header>
          {!guided ? (
            <ol className="play-ai-agent__track" aria-label={translate("play.ai.agent.action")}>
              {activity.actions.map((action, index) => (
                <li
                  key={action.id}
                  data-done={index < state.cursor}
                  data-current={index === state.cursor}
                  title={action.title}
                >
                  <span>{index < state.cursor ? "✓" : index + 1}</span>
                </li>
              ))}
            </ol>
          ) : null}
          {guided ? (
            <p
              className="play-agent-prompt"
              data-risk={damaged || !!inspection?.changedProtectedFileIds.length}
            >
              {translate(guideTitle)}
            </p>
          ) : null}
          {readConsent && inspection ? (
            <div className="play-agent-read-start">
              <ul aria-label={translate("play.ai.agent.inputs")}>
                {inspection.targets
                  .filter((target) => target.required && target.reads)
                  .map((target) => {
                    const file = state.files.find((item) => item.id === target.fileId)!;
                    return (
                      <li key={file.id}>
                        <strong>{file.label}</strong>
                        <code>{file.path}</code>
                      </li>
                    );
                  })}
              </ul>
              {primaryAction}
            </div>
          ) : null}
          {currentAction ? (
            <>
              {!guided ? (
                <>
                  <p
                    className="play-ai-agent__authority"
                    data-document={currentAction.authority === "document"}
                  >
                    {translate(
                      currentAction.authority === "document"
                        ? "play.ai.agent.authorityDocument"
                        : "play.ai.agent.authorityUser",
                    )}
                  </p>
                  <h5>{currentAction.title}</h5>
                  <p>{currentAction.intent}</p>
                </>
              ) : null}
              {currentAction.authority === "document" ? (
                <blockquote>{currentAction.authorityText}</blockquote>
              ) : null}
              <PrimaryFilesFrame className="play-agent-files-frame" data-read-consent={readConsent}>
                {readConsent ? (
                  <summary>{translate("play.ai.agent.guide.readDetails")}</summary>
                ) : null}
                {inspection && currentTool ? (
                  <AgentActionFiles
                    inspection={inspection}
                    files={state.files}
                    tool={currentTool}
                    disabled={disabled}
                    guided={guided}
                    readConsent={readConsent}
                    headingRef={scopeHeading}
                    onToggleFile={(id) => {
                      const grants = stateRef.current.capabilities[currentTool.id] ?? [];
                      grant(
                        currentTool.id,
                        grants.includes(id)
                          ? grants.filter((fileId) => fileId !== id)
                          : [...grants, id],
                      );
                    }}
                  />
                ) : null}
              </PrimaryFilesFrame>
            </>
          ) : (
            <p>{translate("play.ai.agent.roundEnd")}</p>
          )}
          {lastEntry?.outcome === "executed" && lastFile ? (
            <aside
              ref={resultRef}
              className="play-ai-agent__last-result"
              data-damaged={evaluation.changedProtectedFileIds.includes(lastFile.id)}
            >
              <header>
                <strong>
                  {translate(
                    guided ? "play.ai.agent.guide.result" : "play.ai.agent.play.resultTitle",
                  )}
                </strong>
                <code>{lastFile.path}</code>
              </header>
              <pre tabIndex={0}>{lastFile.content || translate("play.ai.agent.fileEmpty")}</pre>
              {!guided && lastEntry.changedFileIds.length ? (
                <p>
                  {translate("play.ai.agent.play.resultChanged", {
                    paths: paths(lastEntry.changedFileIds),
                  })}
                </p>
              ) : !guided ? (
                <p>
                  {translate("play.ai.agent.play.resultRead", {
                    paths: paths(lastEntry.readFileIds),
                  })}
                </p>
              ) : null}
              {lastEntry.blockedFileIds.length ? (
                <p>
                  {translate("play.ai.agent.play.resultBlocked", {
                    paths: paths(lastEntry.blockedFileIds),
                  })}
                </p>
              ) : null}
            </aside>
          ) : null}
          <div ref={driveRef} className="play-ai-agent__drive">
            {guided && lastEntry && currentAction ? (
              <strong className="play-agent-next">
                {translate("play.ai.agent.guide.next", { title: currentAction.title })}
              </strong>
            ) : null}
            {currentAction ? (
              <>
                {!guided || running ? (
                  <p className="play-ai-agent__run-note">
                    {translate(
                      running ? "play.ai.agent.play.running" : "play.ai.agent.play.runHelp",
                    )}
                  </p>
                ) : null}
                <div className="play-ai-agent__action-buttons">
                  {running ? (
                    <GameButton
                      variant="primary"
                      sound={false}
                      onClick={() => {
                        stopRunning();
                        playSound("ui.press");
                        setFeedback(translate("play.ai.agent.play.stopped"));
                        setIsError(false);
                      }}
                    >
                      {translate("play.ai.agent.play.stop")}
                    </GameButton>
                  ) : !guided ? (
                    <GameButton
                      variant="primary"
                      sound={false}
                      disabled={disabled}
                      onClick={startRun}
                    >
                      {translate("play.ai.agent.play.run")}
                    </GameButton>
                  ) : null}
                  {!readConsent ? primaryAction : null}
                  {!readConsent ? (
                    <GameButton
                      variant="secondary"
                      sound={false}
                      disabled={disabled}
                      onClick={() => advance("reject")}
                    >
                      {translate("play.ai.agent.reject")}
                    </GameButton>
                  ) : null}
                </div>
              </>
            ) : null}
            {guided && !currentAction ? (
              <GameButton
                variant="primary"
                disabled={disabled}
                sound={false}
                onClick={
                  damaged
                    ? restore
                    : evaluation.broadToolIds.length
                      ? () => openTools(evaluation.broadToolIds[0]!)
                      : check
                }
              >
                {translate(
                  damaged
                    ? "play.ai.agent.restore"
                    : evaluation.broadToolIds.length
                      ? "play.ai.agent.guide.tools"
                      : "play.ai.agent.check",
                )}
              </GameButton>
            ) : null}
            <p
              className="play-ai-agent__feedback"
              data-error={isError}
              role="status"
              aria-live="polite"
            >
              {feedback}
            </p>
            {needsScopeEdit && !(guided && needsFiles) ? (
              <GameButton
                variant="secondary"
                sound={false}
                disabled={disabled}
                onClick={focusScope}
              >
                {translate("play.ai.agent.play.adjustHere")}
              </GameButton>
            ) : null}
            {blockedToolId && !guided ? (
              <GameButton variant="ghost" sound={false} onClick={() => openTools(blockedToolId)}>
                {translate("play.ai.agent.adjustTool", {
                  tool:
                    activity.tools.find((tool) => tool.id === blockedToolId)?.label ??
                    blockedToolId,
                })}
              </GameButton>
            ) : null}
            {guided && currentAction ? (
              <details className="play-agent-more">
                <summary>{translate("play.ai.agent.guide.more")}</summary>
                <p className="play-ai-agent__run-note">
                  {translate("play.ai.agent.guide.runHelp")}
                </p>
                <div className="play-action-row">
                  {!running ? (
                    <GameButton
                      variant="secondary"
                      sound={false}
                      disabled={disabled}
                      onClick={startRun}
                    >
                      {translate("play.ai.agent.play.run")}
                    </GameButton>
                  ) : null}
                  {readConsent ? (
                    <GameButton
                      variant="secondary"
                      sound={false}
                      disabled={disabled}
                      onClick={() => advance("reject")}
                    >
                      {translate("play.ai.agent.reject")}
                    </GameButton>
                  ) : null}
                </div>
              </details>
            ) : null}
          </div>
        </section>
        {!guided ? workspace : null}
      </div>
      {guided ? (
        <>
          <details
            className="play-agent-tools"
            open={toolsOpen}
            onToggle={(event) => setToolsOpen(event.currentTarget.open)}
          >
            <summary>{translate("play.ai.agent.guide.tools")}</summary>
            {toolbox}
          </details>
          <details className="play-agent-workspace">
            <summary>{translate("play.ai.agent.guide.workspace")}</summary>
            {workspace}
          </details>
        </>
      ) : null}
      <details className="play-agent-recovery" open={!guided}>
        <summary>
          {translate("play.ai.agent.checkpoint", { count: state.checkpoint.cursor })}
        </summary>
        <section className="play-ai-agent__recovery">
          <div>
            <h4>{translate("play.ai.agent.checkpoint", { count: state.checkpoint.cursor })}</h4>
            <p>{translate("play.ai.agent.checkpointNote")}</p>
          </div>
          <GameButton
            variant="secondary"
            sound={false}
            disabled={disabled || !canRestore}
            onClick={restore}
          >
            {translate("play.ai.agent.restore")}
          </GameButton>
        </section>
      </details>
      {!guided ? (
        <GameButton variant="primary" sound={false} disabled={disabled} onClick={check}>
          {translate("play.ai.agent.check")}
        </GameButton>
      ) : null}
      <details className="play-ai-workflow__history">
        <summary>{translate("play.ai.agent.log")}</summary>
        {state.log.length ? (
          <ol>
            {state.log.map((entry, index) => (
              <li key={`${entry.actionId}-${index}`}>
                <strong>
                  {entry.outcome === "restored"
                    ? translate("play.ai.agent.logRestored")
                    : activity.actions.find((action) => action.id === entry.actionId)?.title}
                </strong>
                {entry.outcome === "rejected" ? (
                  <p>{translate("play.ai.agent.logRejected")}</p>
                ) : null}
                {entry.readFileIds.length ? (
                  <p>{translate("play.ai.agent.logRead", { paths: paths(entry.readFileIds) })}</p>
                ) : null}
                {entry.changedFileIds.length ? (
                  <p>
                    {translate("play.ai.agent.logChanged", { paths: paths(entry.changedFileIds) })}
                  </p>
                ) : null}
                {entry.blockedFileIds.length ? (
                  <p>
                    {translate("play.ai.agent.logBlocked", { paths: paths(entry.blockedFileIds) })}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p>{translate("play.ai.agent.logEmpty")}</p>
        )}
      </details>
    </div>
  );
}
