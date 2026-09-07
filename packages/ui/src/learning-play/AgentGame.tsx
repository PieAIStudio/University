import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GameButton, GameToggle } from "@pieai/swimmer-ui-kit";
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

// A visible step cadence, not simulated model latency. The first step is synchronous.
const RUN_STEP_MS = 850;

export function AgentGame({ activity, disabled, onAttempt }: ActivityControls<AgentActivity>) {
  const [state, setState] = useState<AgentState>(() => createAgentState(activity));
  const stateRef = useRef(state);
  const [fileId, setFileId] = useState(activity.files[0]?.id ?? "");
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);
  const [blockedToolId, setBlockedToolId] = useState<string | null>(null);
  const [needsScopeEdit, setNeedsScopeEdit] = useState(false);
  const [running, setRunning] = useState(false);
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
  const activeFile = state.files.find((file) => file.id === fileId);
  const evaluation = evaluateAgentWorkspace(activity, state);
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
    setFeedback(
      translate("play.ai.agent.play.scopeChanged", {
        tool: activity.tools.find((tool) => tool.id === toolId)?.label ?? toolId,
      }),
    );
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
      ? translate("play.ai.agent.success")
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

  return (
    <div className="play-ai-workflow play-ai-agent">
      <p className="play-ai-workflow__intro">{translate("play.ai.agent.play.intro")}</p>
      <aside className="play-ai-workflow__brief">
        <strong>{translate("play.ai.agent.authorization")}</strong>
        <p>{activity.authorization}</p>
      </aside>
      <section className="play-ai-agent__tools">
        <h4>{translate("play.ai.agent.toolbox")}</h4>
        <p className="play-ai-workflow__note">{translate("play.ai.agent.scopeHelp")}</p>
        <div className="play-ai-agent__tool-list">
          {activity.tools.map((tool) => {
            const grants = state.capabilities[tool.id] ?? [];
            const isTaskScope =
              grants.length === tool.taskFileIds.length &&
              tool.taskFileIds.every((id) => grants.includes(id));
            return (
              <details
                key={tool.id}
                className="play-ai-agent__tool"
                open={currentAction?.toolId === tool.id}
              >
                <summary
                  ref={(node) => {
                    if (node) toolHeadings.current.set(tool.id, node);
                    else toolHeadings.current.delete(tool.id);
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="play-ai-agent__tool-light"
                    data-enabled={grants.length > 0}
                  />
                  <strong>{tool.label}</strong>
                  <span>{grants.length ? grants.length : "—"}</span>
                </summary>
                <p>{tool.description}</p>
                <div className="play-ai-agent__scope" role="group" aria-label={tool.label}>
                  <GameButton
                    variant={grants.length === 0 ? "primary" : "secondary"}
                    sound={false}
                    disabled={disabled}
                    aria-pressed={grants.length === 0}
                    onClick={() => grant(tool.id, [])}
                  >
                    {translate("play.ai.agent.grantOff")}
                  </GameButton>
                  <GameButton
                    variant={isTaskScope ? "primary" : "secondary"}
                    sound={false}
                    disabled={disabled}
                    aria-pressed={isTaskScope}
                    onClick={() => grant(tool.id, tool.taskFileIds)}
                  >
                    {translate("play.ai.agent.grantTask")}
                  </GameButton>
                  <GameButton
                    variant={grants.length === activity.files.length ? "primary" : "secondary"}
                    sound={false}
                    disabled={disabled}
                    aria-pressed={grants.length === activity.files.length}
                    onClick={() =>
                      grant(
                        tool.id,
                        activity.files.map((file) => file.id),
                      )
                    }
                  >
                    {translate("play.ai.agent.grantAll")}
                  </GameButton>
                </div>
                <p className="play-ai-agent__grant-paths">
                  {grants.length
                    ? translate("play.ai.agent.grants", { paths: paths(grants) })
                    : translate("play.ai.agent.noAccess")}
                </p>
                <details className="play-ai-agent__custom-scope">
                  <summary>{translate("play.ai.agent.chooseFiles")}</summary>
                  {activity.files.map((file) => (
                    <GameToggle
                      key={file.id}
                      checked={grants.includes(file.id)}
                      disabled={disabled}
                      label={`${tool.label} · ${file.path}`}
                      onClick={() =>
                        grant(
                          tool.id,
                          grants.includes(file.id)
                            ? grants.filter((id) => id !== file.id)
                            : [...grants, file.id],
                        )
                      }
                    />
                  ))}
                </details>
              </details>
            );
          })}
        </div>
      </section>
      <div className="play-ai-agent__cockpit">
        <section className="play-ai-agent__action">
          <header>
            <h4 ref={actionHeading} tabIndex={-1}>
              {translate("play.ai.agent.action")}
            </h4>
            <span>
              {translate("play.ai.agent.step", {
                current: Math.min(state.cursor + 1, activity.actions.length),
                total: activity.actions.length,
              })}
            </span>
          </header>
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
          {currentAction ? (
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
              {currentAction.authority === "document" ? (
                <blockquote>{currentAction.authorityText}</blockquote>
              ) : null}
              {inspection && currentTool ? (
                <AgentActionFiles
                  inspection={inspection}
                  files={state.files}
                  tool={currentTool}
                  disabled={disabled}
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
                <strong>{translate("play.ai.agent.play.resultTitle")}</strong>
                <code>{lastFile.path}</code>
              </header>
              <pre tabIndex={0}>{lastFile.content || translate("play.ai.agent.fileEmpty")}</pre>
              {lastEntry.changedFileIds.length ? (
                <p>
                  {translate("play.ai.agent.play.resultChanged", {
                    paths: paths(lastEntry.changedFileIds),
                  })}
                </p>
              ) : (
                <p>
                  {translate("play.ai.agent.play.resultRead", {
                    paths: paths(lastEntry.readFileIds),
                  })}
                </p>
              )}
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
            {currentAction ? (
              <>
                <p className="play-ai-agent__run-note">
                  {translate(running ? "play.ai.agent.play.running" : "play.ai.agent.play.runHelp")}
                </p>
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
                  ) : (
                    <GameButton
                      variant="primary"
                      sound={false}
                      disabled={disabled}
                      onClick={startRun}
                    >
                      {translate("play.ai.agent.play.run")}
                    </GameButton>
                  )}
                  <GameButton
                    variant="secondary"
                    sound={false}
                    disabled={disabled}
                    onClick={() => advance("execute")}
                  >
                    {translate("play.ai.agent.execute")}
                  </GameButton>
                  <GameButton
                    variant="secondary"
                    sound={false}
                    disabled={disabled}
                    onClick={() => advance("reject")}
                  >
                    {translate("play.ai.agent.reject")}
                  </GameButton>
                </div>
              </>
            ) : null}
            <p
              className="play-ai-agent__feedback"
              data-error={isError}
              role="status"
              aria-live="polite"
            >
              {feedback}
            </p>
            {needsScopeEdit ? (
              <GameButton
                variant="secondary"
                sound={false}
                disabled={disabled}
                onClick={() => {
                  playSound("ui.press");
                  const section = scopeHeading.current?.closest("section");
                  const target =
                    section?.querySelector<HTMLButtonElement>(
                      '[data-risk="true"] button, [data-reachable="false"] button',
                    ) ?? scopeHeading.current;
                  target?.focus({ preventScroll: true });
                  target?.scrollIntoView({ block: "center" });
                }}
              >
                {translate("play.ai.agent.play.adjustHere")}
              </GameButton>
            ) : null}
            {blockedToolId ? (
              <GameButton
                variant="ghost"
                sound={false}
                onClick={() => {
                  const target = toolHeadings.current.get(blockedToolId);
                  target?.focus({ preventScroll: true });
                  target?.scrollIntoView({ block: "nearest" });
                }}
              >
                {translate("play.ai.agent.adjustTool", {
                  tool:
                    activity.tools.find((tool) => tool.id === blockedToolId)?.label ??
                    blockedToolId,
                })}
              </GameButton>
            ) : null}
          </div>
        </section>
        <section className="play-ai-agent__workspace">
          <h4>{translate("play.ai.agent.workspace")}</h4>
          <div
            className="play-ai-agent__file-tabs"
            role="group"
            aria-label={translate("play.ai.agent.workspace")}
          >
            {state.files.map((file) => (
              <GameButton
                key={file.id}
                variant={file.id === fileId ? "primary" : "ghost"}
                aria-pressed={file.id === fileId}
                sound={false}
                onClick={() => {
                  setFileId(file.id);
                  playSound("ui.press");
                }}
              >
                {file.label}
                {evaluation.changedProtectedFileIds.includes(file.id) ? " !" : ""}
              </GameButton>
            ))}
          </div>
          {activeFile ? (
            <article
              className="play-ai-agent__file"
              data-damaged={evaluation.changedProtectedFileIds.includes(activeFile.id)}
            >
              <header>
                <code>{activeFile.path}</code>
                <span>
                  {translate(
                    evaluation.changedProtectedFileIds.includes(activeFile.id)
                      ? "play.ai.agent.changed"
                      : activeFile.protected
                        ? "play.ai.agent.protected"
                        : "play.ai.agent.editable",
                  )}
                </span>
              </header>
              <pre>{activeFile.content || translate("play.ai.agent.fileEmpty")}</pre>
            </article>
          ) : null}
          {currentAction ? (
            <GameButton
              variant="ghost"
              sound={false}
              onClick={() => {
                actionHeading.current?.focus({ preventScroll: true });
                actionHeading.current?.scrollIntoView({ block: "nearest" });
              }}
            >
              {translate("play.ai.agent.nextAction")}
            </GameButton>
          ) : null}
        </section>
      </div>
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
      <GameButton variant="primary" sound={false} disabled={disabled} onClick={check}>
        {translate("play.ai.agent.check")}
      </GameButton>
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
