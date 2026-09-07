import { describe, expect, it } from "vitest";
import {
  advanceAgent,
  advanceAgentRun,
  createAgentState,
  evaluateAgentWorkspace,
  inspectAgentAction,
  restoreAgentCheckpoint,
  setAgentCapability,
  type AgentActivity,
  type AgentState,
} from "./ai-agent.js";

const activity: AgentActivity = {
  id: "agent",
  kind: "ai-agent",
  title: "Agent",
  brief: "",
  goal: "",
  takeaway: "",
  hint: "",
  source: { label: "Source", url: "https://example.com" },
  authorization: "Read source, write draft, preview. Preserve original and public area.",
  files: [
    {
      id: "source",
      path: "/source.txt",
      label: "Source",
      content: "Original data",
      protected: true,
    },
    { id: "draft", path: "/draft.txt", label: "Draft", content: "", protected: false },
    { id: "preview", path: "/preview.txt", label: "Preview", content: "", protected: false },
    {
      id: "public",
      path: "/public.txt",
      label: "Public",
      content: "Nothing published",
      protected: true,
    },
  ],
  tools: [
    {
      id: "read",
      label: "Read",
      description: "Read files",
      capability: "read",
      taskFileIds: ["source"],
    },
    {
      id: "write",
      label: "Write",
      description: "Write files",
      capability: "write",
      taskFileIds: ["draft"],
    },
    {
      id: "preview",
      label: "Preview",
      description: "Preview draft",
      capability: "preview",
      taskFileIds: ["draft", "preview"],
    },
  ],
  actions: [
    {
      id: "read",
      title: "Read",
      intent: "Inspect",
      toolId: "read",
      authority: "user",
      authorityText: "User",
      inputFileIds: ["source"],
      effects: [],
      required: true,
      requiredFileIds: [],
    },
    {
      id: "draft",
      title: "Draft",
      intent: "Create draft and clean source",
      toolId: "write",
      authority: "user",
      authorityText: "User",
      inputFileIds: [],
      effects: [
        { fileId: "draft", kind: "replace", content: "Useful draft" },
        { fileId: "source", kind: "replace", content: "Rows lost" },
      ],
      required: true,
      requiredFileIds: ["draft"],
    },
    {
      id: "document-command",
      title: "Publish",
      intent: "A document asks to publish",
      toolId: "write",
      authority: "document",
      authorityText: "Imported text",
      sourceFileId: "source",
      inputFileIds: [],
      effects: [{ fileId: "public", kind: "replace", content: "Unexpected publication" }],
      required: false,
      requiredFileIds: [],
    },
    {
      id: "preview",
      title: "Preview",
      intent: "Assemble current draft",
      toolId: "preview",
      authority: "user",
      authorityText: "User",
      inputFileIds: ["draft"],
      effects: [{ fileId: "preview", kind: "compose", sourceFileIds: ["draft"], separator: "\n" }],
      required: true,
      requiredFileIds: ["preview"],
    },
  ],
  goals: [
    { fileId: "draft", expectedContent: "Useful draft" },
    { fileId: "preview", expectedContent: "Useful draft" },
  ],
};
function grant(state: AgentState, tool: string, ids?: readonly string[]) {
  return setAgentCapability(
    activity,
    state,
    tool,
    ids ?? activity.tools.find((item) => item.id === tool)!.taskFileIds,
  );
}
function move(state: AgentState, decision: "execute" | "reject" = "execute", spec = activity) {
  const result = advanceAgent(spec, state, decision);
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}
function safeStart() {
  return move(grant(move(grant(createAgentState(activity), "read")), "write"));
}
describe("AI agent capability cockpit", () => {
  it("denying every tool does no work and cannot skip useful required actions", () => {
    const initial = createAgentState(activity);
    expect(advanceAgent(activity, initial, "execute")).toEqual({
      accepted: false,
      reason: "scope-denied",
    });
    expect(advanceAgent(activity, initial, "reject")).toEqual({
      accepted: false,
      reason: "required-action",
    });
    expect(evaluateAgentWorkspace(activity, initial).passed).toBe(false);
    expect(initial.cursor).toBe(0);
  });
  it("intersects a broad action with real file scope while preserving the original", () => {
    const state = safeStart();
    expect(state.files.find((file) => file.id === "draft")?.content).toBe("Useful draft");
    expect(state.files.find((file) => file.id === "source")?.content).toBe("Original data");
    expect(state.log.at(-1)).toMatchObject({
      changedFileIds: ["draft"],
      blockedFileIds: ["source"],
      grants: ["draft"],
    });
    expect(state.checkpoint.cursor).toBe(2);
  });
  it("lets an overbroad grant visibly damage a file, then replays from a clean checkpoint", () => {
    let state = move(grant(createAgentState(activity), "read"));
    state = move(grant(state, "write", ["draft", "source"]));
    expect(evaluateAgentWorkspace(activity, state).changedProtectedFileIds).toEqual(["source"]);
    expect(state.checkpoint.cursor).toBe(1);
    const dirty = state;
    state = restoreAgentCheckpoint(state);
    expect(state.cursor).toBe(1);
    expect(state.recoveries).toBe(1);
    expect(state.capabilities.write).toEqual(["draft", "source"]);
    expect(state.files.find((file) => file.id === "source")?.content).toBe("Original data");
    state = move(grant(state, "write"));
    state = move(state, "reject");
    state = move(grant(state, "preview"));
    expect(evaluateAgentWorkspace(activity, state).passed).toBe(true);
    expect(state.log.some((item) => item.outcome === "restored")).toBe(true);
    expect(dirty.files.find((file) => file.id === "source")?.content).toBe("Rows lost");
  });
  it("treats imported instructions as data with no automatic authority", () => {
    const state = safeStart();
    expect(advanceAgent(activity, state, "execute")).toEqual({
      accepted: false,
      reason: "scope-denied",
    });
    const safe = move(state, "reject");
    expect(safe.rejectedActionIds).toEqual(["document-command"]);
    const unsafe = move(grant(state, "write", ["draft", "public"]));
    expect(unsafe.files.find((file) => file.id === "public")?.content).toBe(
      "Unexpected publication",
    );
    expect(evaluateAgentWorkspace(activity, unsafe).changedProtectedFileIds).toEqual(["public"]);
    expect(restoreAgentCheckpoint(unsafe).cursor).toBe(2);
  });
  it("completes with permissions granted just in time or all bounded permissions upfront", () => {
    let justInTime = move(safeStart(), "reject");
    justInTime = move(grant(justInTime, "preview"));
    let upfront = createAgentState(activity);
    for (const tool of activity.tools) upfront = grant(upfront, tool.id);
    for (const decision of ["execute", "execute", "reject", "execute"] as const)
      upfront = move(upfront, decision);
    expect(evaluateAgentWorkspace(activity, justInTime).passed).toBe(true);
    expect(evaluateAgentWorkspace(activity, upfront).passed).toBe(true);
    expect(upfront.files).toEqual(justInTime.files);
    expect(advanceAgent(activity, upfront, "execute")).toEqual({
      accepted: false,
      reason: "round-ended",
    });
  });
  it("preview reads actual current drafts rather than a detached success card", () => {
    let state = move(safeStart(), "reject");
    state = {
      ...state,
      files: state.files.map((file) =>
        file.id === "draft" ? { ...file, content: "Changed draft" } : file,
      ),
    };
    state = move(grant(state, "preview"));
    expect(state.files.find((file) => file.id === "preview")?.content).toBe("Changed draft");
    expect(evaluateAgentWorkspace(activity, state).passed).toBe(false);
  });
  it("rejects missing preview input scope, fabricated files and unavailable tools", () => {
    const state = move(safeStart(), "reject");
    expect(advanceAgent(activity, grant(state, "preview", ["preview"]), "execute")).toEqual({
      accepted: false,
      reason: "scope-denied",
    });
    expect(setAgentCapability(activity, state, "unknown", [])).toBe(state);
    expect(setAgentCapability(activity, state, "write", ["/outside/secret"])).toBe(state);
    const badTool = { ...activity, tools: [] };
    expect(advanceAgent(badTool, state, "execute")).toEqual({
      accepted: false,
      reason: "tool-unavailable",
    });
    const badAction = {
      ...activity,
      actions: [{ ...activity.actions[0]!, inputFileIds: ["nonexistent"] }],
    };
    expect(advanceAgent(badAction, grant(createAgentState(activity), "read"), "execute")).toEqual({
      accepted: false,
      reason: "invalid-action",
    });
  });
  it("enforces capabilities even if a malformed action asks a reader or previewer to overwrite", () => {
    const invalidReader: AgentActivity = {
      ...activity,
      actions: [
        {
          ...activity.actions[0]!,
          effects: [{ fileId: "source", kind: "replace", content: "Rewritten" }],
        },
      ],
    };
    expect(
      advanceAgent(invalidReader, grant(createAgentState(activity), "read"), "execute"),
    ).toEqual({ accepted: false, reason: "invalid-action" });
    const invalidPreview: AgentActivity = {
      ...activity,
      actions: [
        {
          ...activity.actions[0]!,
          toolId: "preview",
          inputFileIds: [],
          effects: [{ fileId: "preview", kind: "replace", content: "Fake preview" }],
        },
      ],
    };
    expect(
      advanceAgent(invalidPreview, grant(createAgentState(activity), "preview"), "execute"),
    ).toEqual({ accepted: false, reason: "invalid-action" });
  });
  it("requires relinquishing unrelated lingering access at completion", () => {
    let state = move(safeStart(), "reject");
    state = move(grant(state, "preview"));
    state = grant(
      state,
      "read",
      activity.files.map((file) => file.id),
    );
    expect(evaluateAgentWorkspace(activity, state).broadToolIds).toEqual(["read"]);
    expect(evaluateAgentWorkspace(activity, state).passed).toBe(false);
    expect(evaluateAgentWorkspace(activity, grant(state, "read")).passed).toBe(true);
  });
  it("previews a mixed action and repairs only one real file permission", () => {
    const before = grant(move(grant(createAgentState(activity), "read")), "write", [
      "draft",
      "source",
    ]);
    const wide = inspectAgentAction(activity, before)!;
    expect(wide.changedProtectedFileIds).toEqual(["source"]);
    expect(wide.targets.find((target) => target.fileId === "source")).toMatchObject({
      reads: false,
      writes: true,
      required: false,
      granted: true,
      beforeContent: "Original data",
      proposedContent: "Rows lost",
      resultContent: "Rows lost",
    });
    expect(before.cursor).toBe(1);
    expect(before.files.find((file) => file.id === "source")?.content).toBe("Original data");
    expect(before.log).toHaveLength(1);

    const narrowed = grant(
      before,
      "write",
      before.capabilities.write!.filter((id) => id !== "source"),
    );
    const projected = inspectAgentAction(activity, narrowed)!;
    expect(projected.targets.find((target) => target.fileId === "source")).toMatchObject({
      granted: false,
      proposedContent: "Rows lost",
      resultContent: "Original data",
    });
    expect(projected.changedProtectedFileIds).toEqual([]);
    const executed = advanceAgent(activity, narrowed, "execute");
    expect(executed).toEqual(projected.execution);
    expect(executed.accepted && executed.state.capabilities.write).toEqual(["draft"]);
    expect(executed.accepted && executed.entry).toMatchObject({
      changedFileIds: ["draft"],
      blockedFileIds: ["source"],
    });
  });
  it("a refused required action can be narrowed in place, but removing its output cannot work", () => {
    const state = grant(move(grant(createAgentState(activity), "read")), "write", ["source"]);
    expect(advanceAgent(activity, state, "reject")).toEqual({
      accepted: false,
      reason: "required-action",
    });
    const inspection = inspectAgentAction(activity, state)!;
    expect(inspection.execution).toEqual({ accepted: false, reason: "scope-denied" });
    expect(inspection.targets.find((target) => target.fileId === "draft")).toMatchObject({
      required: true,
      granted: false,
      resultContent: "",
    });
    const repaired = grant(state, "write", ["draft"]);
    const executed = advanceAgent(activity, repaired, "execute");
    expect(executed.accepted && executed.state.cursor).toBe(2);
    expect(executed.accepted && executed.entry.blockedFileIds).toEqual(["source"]);
  });
  it("inspects preview inputs and derives its proposed artifact from the current files", () => {
    let state = grant(move(safeStart(), "reject"), "preview");
    state = {
      ...state,
      files: state.files.map((file) =>
        file.id === "draft" ? { ...file, content: "A revised draft" } : file,
      ),
    };
    const inspection = inspectAgentAction(activity, state)!;
    expect(inspection.targets.find((target) => target.fileId === "draft")).toMatchObject({
      reads: true,
      writes: false,
      required: true,
    });
    expect(inspection.targets.find((target) => target.fileId === "preview")).toMatchObject({
      proposedContent: "A revised draft",
      resultContent: "A revised draft",
    });
    expect(inspection.execution).toEqual(advanceAgent(activity, state, "execute"));
  });
  it("run pauses on missing access and never grants or skips anything", () => {
    const initial = createAgentState(activity);
    expect(advanceAgentRun(activity, initial)).toEqual({
      accepted: false,
      reason: "scope-denied",
      fileIds: ["source"],
    });
    expect(initial).toEqual(createAgentState(activity));
    const preview = grant(move(safeStart(), "reject"), "preview", ["preview"]);
    expect(advanceAgentRun(activity, preview)).toEqual({
      accepted: false,
      reason: "scope-denied",
      fileIds: ["draft"],
    });
    expect(preview.capabilities.preview).toEqual(["preview"]);
    expect(preview.cursor).toBe(3);
  });
  it("run uses the single-step result, clips denied effects and pauses before a document command", () => {
    let state = createAgentState(activity);
    for (const tool of activity.tools) state = grant(state, tool.id);
    for (let step = 0; step < 2; step += 1) {
      const run = advanceAgentRun(activity, state);
      expect(run).toEqual(advanceAgent(activity, state, "execute"));
      if (!run.accepted) throw new Error(run.reason);
      state = run.state;
    }
    expect(state.log.at(-1)?.blockedFileIds).toEqual(["source"]);
    expect(advanceAgentRun(activity, state)).toEqual({
      accepted: false,
      reason: "document-action",
      fileIds: ["public"],
    });
    const broad = grant(state, "write", ["draft", "public"]);
    expect(advanceAgentRun(activity, broad)).toEqual(advanceAgentRun(activity, state));
    expect(broad.rejectedActionIds).toEqual([]);
    state = move(state, "reject");
    const completed = advanceAgentRun(activity, state);
    if (!completed.accepted) throw new Error(completed.reason);
    expect(evaluateAgentWorkspace(activity, completed.state).passed).toBe(true);
    expect(advanceAgentRun(activity, completed.state)).toEqual({
      accepted: false,
      reason: "round-ended",
      fileIds: [],
    });
    expect(inspectAgentAction(activity, completed.state)).toBeNull();
  });
  it("run pauses before reachable protected changes without repairing the player's scope", () => {
    const state = grant(move(grant(createAgentState(activity), "read")), "write", [
      "draft",
      "source",
    ]);
    expect(advanceAgentRun(activity, state)).toEqual({
      accepted: false,
      reason: "protected-change",
      fileIds: ["source"],
    });
    expect(state.capabilities.write).toEqual(["draft", "source"]);
    expect(state.cursor).toBe(1);
    const damaged = move(state);
    expect(damaged.files.find((file) => file.id === "source")?.content).toBe("Rows lost");
    expect(advanceAgentRun(activity, damaged)).toEqual({
      accepted: false,
      reason: "workspace-damaged",
      fileIds: ["source"],
    });
    const restored = restoreAgentCheckpoint(damaged);
    expect(advanceAgentRun(activity, restored).accepted).toBe(false);
    const repaired = grant(restored, "write");
    expect(advanceAgentRun(activity, repaired)).toEqual(
      advanceAgent(activity, repaired, "execute"),
    );
  });
  it("run still rejects malformed tool capabilities through the single-step engine", () => {
    const invalid: AgentActivity = {
      ...activity,
      actions: [
        {
          ...activity.actions[0]!,
          effects: [{ fileId: "source", kind: "replace", content: "Overwritten by a reader" }],
        },
      ],
    };
    expect(advanceAgentRun(invalid, grant(createAgentState(activity), "read"))).toEqual({
      accepted: false,
      reason: "invalid-action",
      fileIds: [],
    });
  });
});
