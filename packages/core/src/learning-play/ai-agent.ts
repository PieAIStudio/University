import type { ActivityBase } from "./types.js";

export interface AgentFile {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly content: string;
  readonly protected: boolean;
}
export interface AgentTool {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly capability: "read" | "write" | "preview";
  /** Exact sandbox file IDs in the user's authorization. No path wildcards are interpreted. */
  readonly taskFileIds: readonly string[];
}
export type AgentEffect =
  | { readonly fileId: string; readonly kind: "replace"; readonly content: string }
  | {
      readonly fileId: string;
      readonly kind: "compose";
      readonly sourceFileIds: readonly string[];
      readonly separator: string;
    };
export interface AgentAction {
  readonly id: string;
  readonly title: string;
  readonly intent: string;
  readonly toolId: string;
  readonly authority: "user" | "document";
  readonly authorityText: string;
  readonly sourceFileId?: string;
  readonly inputFileIds: readonly string[];
  readonly effects: readonly AgentEffect[];
  readonly required: boolean;
  readonly requiredFileIds: readonly string[];
}
export interface AgentActivity extends ActivityBase {
  readonly kind: "ai-agent";
  readonly authorization: string;
  readonly files: readonly AgentFile[];
  readonly tools: readonly AgentTool[];
  readonly actions: readonly AgentAction[];
  readonly goals: readonly { readonly fileId: string; readonly expectedContent: string }[];
}
export interface AgentLogEntry {
  readonly actionId: string;
  readonly outcome: "executed" | "rejected" | "restored";
  readonly changedFileIds: readonly string[];
  readonly readFileIds: readonly string[];
  readonly blockedFileIds: readonly string[];
  readonly grants: readonly string[];
}
interface AgentCheckpoint {
  readonly cursor: number;
  readonly files: readonly AgentFile[];
  readonly completedActionIds: readonly string[];
  readonly rejectedActionIds: readonly string[];
}
export interface AgentState extends AgentCheckpoint {
  readonly capabilities: Readonly<Record<string, readonly string[]>>;
  readonly checkpoint: AgentCheckpoint;
  readonly log: readonly AgentLogEntry[];
  readonly recoveries: number;
}
export type AgentRejection =
  | "round-ended"
  | "required-action"
  | "tool-unavailable"
  | "scope-denied"
  | "invalid-action";
export type AgentMove =
  | { readonly accepted: false; readonly reason: AgentRejection }
  | { readonly accepted: true; readonly state: AgentState; readonly entry: AgentLogEntry };
export interface AgentActionTarget {
  readonly fileId: string;
  readonly reads: boolean;
  readonly writes: boolean;
  readonly required: boolean;
  readonly granted: boolean;
  readonly beforeContent: string;
  readonly proposedContent: string;
  /** Actual projected content after the same capability checks as single-step execution. */
  readonly resultContent: string;
}
export interface AgentActionInspection {
  readonly actionId: string;
  readonly toolId: string;
  readonly targets: readonly AgentActionTarget[];
  readonly execution: AgentMove;
  readonly changedProtectedFileIds: readonly string[];
}
export type AgentRunPause =
  | AgentRejection
  | "document-action"
  | "protected-change"
  | "workspace-damaged";
export type AgentRunMove =
  | Extract<AgentMove, { accepted: true }>
  | {
      readonly accepted: false;
      readonly reason: AgentRunPause;
      readonly fileIds: readonly string[];
    };

function actionFileAccess(action: AgentAction) {
  const reads = [
    ...new Set([
      ...action.inputFileIds,
      ...action.effects.flatMap((effect) =>
        effect.kind === "compose" ? effect.sourceFileIds : [],
      ),
    ]),
  ];
  return {
    reads,
    requested: [...new Set([...reads, ...action.effects.map((effect) => effect.fileId)])],
    mandatory: [...new Set([...reads, ...action.requiredFileIds])],
  };
}

function effectContent(effect: AgentEffect, files: readonly AgentFile[]): string {
  return effect.kind === "replace"
    ? effect.content
    : effect.sourceFileIds
        .map((id) => files.find((file) => file.id === id)?.content ?? "")
        .join(effect.separator);
}

export function createAgentState(activity: AgentActivity): AgentState {
  const checkpoint: AgentCheckpoint = {
    cursor: 0,
    files: activity.files.map((file) => ({ ...file })),
    completedActionIds: [],
    rejectedActionIds: [],
  };
  return { ...checkpoint, capabilities: {}, checkpoint, log: [], recoveries: 0 };
}

export function setAgentCapability(
  activity: AgentActivity,
  state: AgentState,
  toolId: string,
  fileIds: readonly string[],
): AgentState {
  if (!activity.tools.some((tool) => tool.id === toolId)) return state;
  if (fileIds.some((id) => !activity.files.some((file) => file.id === id))) return state;
  return {
    ...state,
    capabilities: { ...state.capabilities, [toolId]: [...new Set(fileIds)] },
  };
}

export function evaluateAgentWorkspace(activity: AgentActivity, state: AgentState) {
  const changedProtectedFileIds = activity.files
    .filter(
      (file) =>
        file.protected && state.files.find((item) => item.id === file.id)?.content !== file.content,
    )
    .map((file) => file.id);
  const unmetGoalFileIds = activity.goals
    .filter(
      (goal) =>
        state.files.find((file) => file.id === goal.fileId)?.content !== goal.expectedContent,
    )
    .map((goal) => goal.fileId);
  const missingActionIds = activity.actions
    .filter((action) => action.required && !state.completedActionIds.includes(action.id))
    .map((action) => action.id);
  const broadToolIds = activity.tools
    .filter((tool) =>
      (state.capabilities[tool.id] ?? []).some((id) => !tool.taskFileIds.includes(id)),
    )
    .map((tool) => tool.id);
  return {
    passed:
      state.cursor === activity.actions.length &&
      changedProtectedFileIds.length === 0 &&
      unmetGoalFileIds.length === 0 &&
      missingActionIds.length === 0 &&
      broadToolIds.length === 0,
    changedProtectedFileIds,
    unmetGoalFileIds,
    missingActionIds,
    broadToolIds,
  };
}

/** Runs one fixed sandbox action through the actual current capability intersection. */
export function advanceAgent(
  activity: AgentActivity,
  state: AgentState,
  decision: "execute" | "reject",
): AgentMove {
  const action = activity.actions[state.cursor];
  if (!action) return { accepted: false, reason: "round-ended" };
  if (decision === "reject" && action.required)
    return { accepted: false, reason: "required-action" };
  const tool = activity.tools.find((item) => item.id === action.toolId);
  if (!tool) return { accepted: false, reason: "tool-unavailable" };
  if (
    decision === "execute" &&
    action.effects.some(
      (effect) =>
        tool.capability === "read" ||
        (tool.capability === "write" && effect.kind !== "replace") ||
        (tool.capability === "preview" && effect.kind !== "compose"),
    )
  ) {
    return { accepted: false, reason: "invalid-action" };
  }
  const grants = state.capabilities[tool.id] ?? [];
  let files = state.files;
  let changedFileIds: readonly string[] = [];
  let readFileIds: readonly string[] = [];
  let blockedFileIds: readonly string[] = [];
  if (decision === "execute") {
    const { requested, mandatory } = actionFileAccess(action);
    if (requested.some((id) => !state.files.some((file) => file.id === id))) {
      return { accepted: false, reason: "invalid-action" };
    }
    if (
      mandatory.some((id) => !grants.includes(id)) ||
      !requested.some((id) => grants.includes(id))
    ) {
      return { accepted: false, reason: "scope-denied" };
    }
    const permitted = action.effects.filter((effect) => grants.includes(effect.fileId));
    blockedFileIds = [...new Set(requested.filter((id) => !grants.includes(id)))];
    readFileIds = [
      ...new Set([
        ...action.inputFileIds,
        ...permitted.flatMap((effect) => (effect.kind === "compose" ? effect.sourceFileIds : [])),
      ]),
    ];
    files = state.files.map((file) => {
      const effect = permitted.find((item) => item.fileId === file.id);
      if (!effect) return file;
      return { ...file, content: effectContent(effect, state.files) };
    });
    changedFileIds = files
      .filter((file) => state.files.find((item) => item.id === file.id)?.content !== file.content)
      .map((file) => file.id);
  }
  const entry: AgentLogEntry = {
    actionId: action.id,
    outcome: decision === "execute" ? "executed" : "rejected",
    changedFileIds,
    readFileIds,
    blockedFileIds,
    grants,
  };
  const next: AgentState = {
    ...state,
    cursor: state.cursor + 1,
    files,
    completedActionIds:
      decision === "execute" ? [...state.completedActionIds, action.id] : state.completedActionIds,
    rejectedActionIds:
      decision === "reject" ? [...state.rejectedActionIds, action.id] : state.rejectedActionIds,
    log: [...state.log, entry],
  };
  const safe =
    evaluateAgentWorkspace(activity, next).changedProtectedFileIds.length === 0 &&
    !(decision === "execute" && action.authority === "document" && changedFileIds.length > 0);
  return {
    accepted: true,
    entry,
    state: safe
      ? {
          ...next,
          checkpoint: {
            cursor: next.cursor,
            files: next.files,
            completedActionIds: next.completedActionIds,
            rejectedActionIds: next.rejectedActionIds,
          },
        }
      : next,
  };
}

/** Read-only action projection. Execution and the projected result share the exact same engine. */
export function inspectAgentAction(
  activity: AgentActivity,
  state: AgentState,
): AgentActionInspection | null {
  const action = activity.actions[state.cursor];
  if (!action) return null;
  const access = actionFileAccess(action);
  const grants = state.capabilities[action.toolId] ?? [];
  const execution = advanceAgent(activity, state, "execute");
  const resultFiles = execution.accepted ? execution.state.files : state.files;
  return {
    actionId: action.id,
    toolId: action.toolId,
    execution,
    targets: access.requested.flatMap((fileId) => {
      const file = state.files.find((item) => item.id === fileId);
      if (!file) return [];
      const effect = action.effects.find((item) => item.fileId === fileId);
      return [
        {
          fileId,
          reads: access.reads.includes(fileId),
          writes: !!effect,
          required: access.mandatory.includes(fileId),
          granted: grants.includes(fileId),
          beforeContent: file.content,
          proposedContent: effect ? effectContent(effect, state.files) : file.content,
          resultContent: resultFiles.find((item) => item.id === fileId)?.content ?? file.content,
        },
      ];
    }),
    changedProtectedFileIds: execution.accepted
      ? execution.entry.changedFileIds.filter((id) =>
          activity.files.some((file) => file.id === id && file.protected),
        )
      : [],
  };
}

/** One optional run step: pause before judgment, never grant access or reject an action. */
export function advanceAgentRun(activity: AgentActivity, state: AgentState): AgentRunMove {
  const damaged = evaluateAgentWorkspace(activity, state).changedProtectedFileIds;
  if (damaged.length) return { accepted: false, reason: "workspace-damaged", fileIds: damaged };
  const action = activity.actions[state.cursor];
  if (!action) return { accepted: false, reason: "round-ended", fileIds: [] };
  if (action.authority === "document") {
    return {
      accepted: false,
      reason: "document-action",
      fileIds: action.effects.map((effect) => effect.fileId),
    };
  }
  const inspection = inspectAgentAction(activity, state)!;
  if (!inspection.execution.accepted) {
    return {
      accepted: false,
      reason: inspection.execution.reason,
      fileIds: inspection.targets
        .filter((target) => target.required && !target.granted)
        .map((target) => target.fileId),
    };
  }
  if (inspection.changedProtectedFileIds.length) {
    return {
      accepted: false,
      reason: "protected-change",
      fileIds: inspection.changedProtectedFileIds,
    };
  }
  return inspection.execution;
}

/** Keeps the audit trail and current grants; replay requires the learner to repair the scope. */
export function restoreAgentCheckpoint(state: AgentState): AgentState {
  if (state.cursor === state.checkpoint.cursor && state.files === state.checkpoint.files)
    return state;
  return {
    ...state,
    ...state.checkpoint,
    recoveries: state.recoveries + 1,
    log: [
      ...state.log,
      {
        actionId: "checkpoint",
        outcome: "restored",
        changedFileIds: [],
        readFileIds: [],
        blockedFileIds: [],
        grants: [],
      },
    ],
  };
}
