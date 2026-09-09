import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  advanceAgent,
  advanceAgentRun,
  createAgentState,
  evaluateAgentWorkspace,
  evaluateContextPack,
  evaluateContextService,
  inspectAgentAction,
  restoreAgentCheckpoint,
  setAgentCapability,
  visitContextProduct,
  type AgentActivity,
  type AgentState,
  type ContextActivity,
} from "@pieai/university-core";
import { activeLocale, setActiveLocale } from "../i18n/index.js";
import { getAIWorkflowExamples } from "./ai-workflow-examples.js";
import { getWorkflowFamily } from "./workflow-difficulty.js";

const levels = ["intro", "practice", "challenge"] as const;
const contextIds = ["ai-context-cafe", "ai-context-workshop"] as const;
const agentIds = ["ai-agent-event", "ai-agent-recipe"] as const;
let previousLocale: string;

beforeEach(() => {
  previousLocale = activeLocale();
  setActiveLocale("zh-CN");
});
afterEach(() => setActiveLocale(previousLocale));

function contextFamily(id: string) {
  const family = getWorkflowFamily(getAIWorkflowExamples().find((item) => item.id === id)!);
  if (family.kind !== "ai-context") throw new Error("Expected context family");
  return family;
}
function agentFamily(id: string) {
  const family = getWorkflowFamily(getAIWorkflowExamples().find((item) => item.id === id)!);
  if (family.kind !== "ai-agent") throw new Error("Expected agent family");
  return family;
}
function boundedState(activity: AgentActivity) {
  return activity.tools.reduce(
    (state, tool) => setAgentCapability(activity, state, tool.id, tool.taskFileIds),
    createAgentState(activity),
  );
}
function advance(activity: AgentActivity, state: AgentState) {
  const action = activity.actions[state.cursor]!;
  const result = advanceAgent(
    activity,
    state,
    action.authority === "document" ? "reject" : "execute",
  );
  if (!result.accepted) throw new Error(`${activity.id}/${action.id}: ${result.reason}`);
  return result.state;
}
function finish(activity: AgentActivity, start = boundedState(activity)) {
  let state = start;
  while (state.cursor < activity.actions.length) state = advance(activity, state);
  return state;
}
function visits(activity: ContextActivity, selection: readonly string[]) {
  return activity.visitors!.map((visitor) => visitContextProduct(activity, selection, visitor.id)!);
}

describe("workflow difficulty families", () => {
  it("produces four families and twelve separate payloads without mutating the practice cases", () => {
    const originals = getAIWorkflowExamples();
    const before = structuredClone(originals);
    const families = originals.map(getWorkflowFamily);
    expect(families).toHaveLength(4);
    const payloads = families.flatMap((family) => Object.values(family.levels));
    expect(new Set(payloads.map((activity) => activity.id)).size).toBe(12);
    families.forEach((family, index) => {
      const base = originals[index]!;
      expect(family.id).toBe(base.id);
      expect(family.kind).toBe(base.kind);
      for (const difficulty of levels)
        expect(family.levels[difficulty]).toMatchObject({
          id: `${base.id}:${difficulty}:v1`,
          kind: base.kind,
          difficulty,
        });
      expect(family.levels.practice).toEqual({
        ...base,
        id: `${base.id}:practice:v1`,
        difficulty: "practice",
      });
    });
    expect(originals).toEqual(before);
  });
});

describe.each(contextIds)("context witnesses: %s", (id) => {
  it.each(levels)("%s requires a repaired pack and actual visits to that pack", (difficulty) => {
    const activity = contextFamily(id).levels[difficulty];
    const initial = activity.initialParagraphIds!;
    expect(evaluateContextPack(activity, initial).passed).toBe(false);
    expect(evaluateContextService(activity, initial, []).passed).toBe(false);
    const selection =
      difficulty === "intro"
        ? ["brief-offering"]
        : ["brief-offering", "policy-limit", "summary-feedback"];
    expect(evaluateContextPack(activity, selection).passed).toBe(true);
    expect(evaluateContextService(activity, selection, []).passed).toBe(false);
    expect(evaluateContextService(activity, selection, visits(activity, initial)).passed).toBe(
      false,
    );
    const currentVisits = visits(activity, selection);
    expect(currentVisits.every((visit) => visit.passed)).toBe(true);
    expect(evaluateContextService(activity, selection, currentVisits).passed).toBe(true);
    // Source order is not an answer key: the same set is valid in either order.
    expect(evaluateContextService(activity, [...selection].reverse(), currentVisits).passed).toBe(
      true,
    );
  });

  it("offers a small conflicting introduction and more than one valid practice pack", () => {
    const { intro, practice } = contextFamily(id).levels;
    expect(intro.slots).toHaveLength(1);
    expect(intro.visitors).toHaveLength(1);
    expect(intro.documents.map((document) => document.paragraphs.length)).toEqual([1, 1]);
    const initial = evaluateContextPack(intro, intro.initialParagraphIds!);
    expect(initial.overCapacity).toBe(false);
    expect(initial.rows[0]?.status).toBe("conflict");
    expect(practice.capacity).toBe(16);
    expect(practice.visitors).toHaveLength(3);
    expect(practice.documents).toHaveLength(5);
    const whole = practice.documents
      .filter((document) => ["brief", "policy"].includes(document.id))
      .flatMap((document) => document.paragraphs.map((paragraph) => paragraph.id));
    const alternate = ["brief-offering", "policy-limit", "summary-feedback", "summary-extra"];
    for (const selection of [whole, alternate])
      expect(evaluateContextService(practice, selection, visits(practice, selection)).passed).toBe(
        true,
      );
  });

  it("makes excerpts necessary at eight units and refuses the old larger pack's visit receipts", () => {
    const { practice, challenge } = contextFamily(id).levels;
    expect(challenge.capacity).toBe(8);
    expect(challenge.documents).toEqual(practice.documents);
    const witness = ["brief-offering", "policy-limit", "summary-feedback"];
    expect(evaluateContextPack(challenge, witness)).toMatchObject({ units: 8, passed: true });
    const oversized = ["brief-offering", "policy-limit", "brief-feedback"];
    expect(evaluateContextPack(practice, oversized).passed).toBe(true);
    const hardResult = evaluateContextPack(challenge, oversized);
    expect(hardResult.rows.every((row) => row.status === "ready")).toBe(true);
    expect(hardResult).toMatchObject({ units: 9, overCapacity: true, passed: false });
    expect(evaluateContextService(challenge, oversized, visits(practice, oversized)).passed).toBe(
      false,
    );
    expect(evaluateContextService(challenge, witness, visits(practice, oversized)).passed).toBe(
      false,
    );
    for (let mask = 0; mask < 2 ** challenge.documents.length; mask += 1) {
      const whole = challenge.documents
        .filter((_, index) => mask & (1 << index))
        .flatMap((document) => document.paragraphs.map((paragraph) => paragraph.id));
      expect(evaluateContextPack(challenge, whole).passed).toBe(false);
    }
    expect(challenge.goal).toContain("8");
    expect(challenge.authorityNote).toContain("8");
  });
});

describe.each(agentIds)("agent witnesses: %s", (id) => {
  it.each(levels)(
    "%s starts without grants or receipts and completes through bounded real actions",
    (difficulty) => {
      const activity = agentFamily(id).levels[difficulty];
      const initial = createAgentState(activity);
      expect(initial.capabilities).toEqual({});
      expect(initial.log).toEqual([]);
      expect(initial.completedActionIds).toEqual([]);
      expect(evaluateAgentWorkspace(activity, initial).passed).toBe(false);
      expect(advanceAgent(activity, initial, "execute")).toEqual({
        accepted: false,
        reason: "scope-denied",
      });
      expect(evaluateAgentWorkspace(activity, boundedState(activity)).passed).toBe(false);
      const complete = finish(activity);
      expect(evaluateAgentWorkspace(activity, complete).passed).toBe(true);
      for (const goal of activity.goals)
        expect(complete.files.find((file) => file.id === goal.fileId)?.content).toBe(
          goal.expectedContent,
        );
      for (const file of activity.files.filter((file) => file.protected))
        expect(complete.files.find((item) => item.id === file.id)?.content).toBe(file.content);
      expect(complete.completedActionIds).toEqual(
        activity.actions.filter((action) => action.required).map((action) => action.id),
      );
      expect(complete.rejectedActionIds).toEqual(
        activity.actions
          .filter((action) => action.authority === "document")
          .map((action) => action.id),
      );
    },
  );

  it("keeps only the read and useful draft dependencies in the introduction", () => {
    const { intro, practice } = agentFamily(id).levels;
    expect(intro.actions).toHaveLength(2);
    expect(intro.files.map((file) => file.id)).toEqual(["source", "draft"]);
    expect(intro.tools.map((tool) => [tool.id, tool.taskFileIds])).toEqual([
      ["read", ["source"]],
      ["write", ["draft"]],
    ]);
    const originalDraft = practice.actions.find((action) => action.id === "write-draft")!;
    expect(intro.actions[1]).toMatchObject({
      inputFileIds: originalDraft.inputFileIds,
      requiredFileIds: originalDraft.requiredFileIds,
      effects: originalDraft.effects,
    });
    expect(intro.goals).toEqual(practice.goals.filter((goal) => goal.fileId === "draft"));
    const displayed = inspectAgentAction(intro, createAgentState(intro))!.targets;
    expect(
      displayed.map((target) => [target.fileId, target.reads, target.writes, target.required]),
    ).toEqual([["source", true, false, true]]);
    expect(intro.authorization).not.toContain("预览");
    expect(intro.goal).not.toContain("预览");
  });

  it("adds a second useful mixed write that damages a different protected target when over-authorized", () => {
    const challenge = agentFamily(id).levels.challenge;
    const mixed = challenge.actions.filter(
      (action) =>
        action.required &&
        action.effects.some((effect) =>
          challenge.files.some((file) => file.id === effect.fileId && file.protected),
        ),
    );
    expect(
      mixed.map((action) =>
        action.effects
          .filter((effect) =>
            challenge.files.some((file) => file.id === effect.fileId && file.protected),
          )
          .map((effect) => effect.fileId),
      ),
    ).toEqual([["source"], ["public"]]);
    let before = boundedState(challenge);
    while (challenge.actions[before.cursor]!.id !== mixed[1]!.id)
      before = advance(challenge, before);
    expect(advanceAgent(challenge, before, "reject")).toEqual({
      accepted: false,
      reason: "required-action",
    });
    const wide = setAgentCapability(challenge, before, "write", [
      ...before.capabilities.write!,
      "public",
    ]);
    expect(advanceAgentRun(challenge, wide)).toEqual({
      accepted: false,
      reason: "protected-change",
      fileIds: ["public"],
    });
    const damaged = advance(challenge, wide);
    expect(evaluateAgentWorkspace(challenge, damaged).changedProtectedFileIds).toEqual(["public"]);
    expect(damaged.files.find((file) => file.id === "public")?.content).not.toBe(
      before.files.find((file) => file.id === "public")?.content,
    );
    const restored = restoreAgentCheckpoint(damaged);
    expect(restored.cursor).toBe(before.cursor);
    expect(restored.capabilities.write).toContain("public");
    const repaired = setAgentCapability(
      challenge,
      restored,
      "write",
      challenge.tools.find((tool) => tool.id === "write")!.taskFileIds,
    );
    const complete = finish(challenge, repaired);
    expect(evaluateAgentWorkspace(challenge, complete).passed).toBe(true);
    expect(
      complete.log.findLast((entry) => entry.actionId === mixed[1]!.id)?.blockedFileIds,
    ).toEqual(["public"]);
    const preview = complete.files.find((file) => file.id === "preview")!;
    expect(preview.content).toBe(
      ["list", "draft"]
        .map((fileId) => complete.files.find((file) => file.id === fileId)!.content)
        .join("\n\n"),
    );
  });

  it("requires a fresh decision receipt for the changed challenge action", () => {
    const { practice, challenge } = agentFamily(id).levels;
    const previous = finish(practice);
    expect(evaluateAgentWorkspace(practice, previous).passed).toBe(true);
    const reused = evaluateAgentWorkspace(challenge, previous);
    expect(reused.passed).toBe(false);
    expect(reused.missingActionIds).toEqual(["write-draft-with-public-copy"]);
  });
});
