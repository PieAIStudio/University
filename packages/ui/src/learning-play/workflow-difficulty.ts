import type { ActivityFamily, AgentActivity, ContextActivity } from "@pieai/university-core";
import { translate } from "../i18n/index.js";

function requireRole<T>(value: T | undefined, role: string, activityId: string): T {
  if (value === undefined) throw new Error(`Workflow family ${activityId} is missing ${role}`);
  return value;
}

function contextFamily(base: ContextActivity): Extract<ActivityFamily, { kind: "ai-context" }> {
  const slot = requireRole(
    base.slots.find((item) => item.id === "offering"),
    "offering slot",
    base.id,
  );
  const visitor = requireRole(
    base.visitors?.find((item) => item.slotId === slot.id),
    "offering visitor",
    base.id,
  );
  const documents = ["brief", "trial"].map((id) => {
    const document = requireRole(
      base.documents.find((item) => item.id === id),
      id,
      base.id,
    );
    const paragraph = requireRole(
      document.paragraphs.find((item) => item.facts.some((fact) => fact.slotId === slot.id)),
      `${id} offering paragraph`,
      base.id,
    );
    return { ...document, paragraphs: [paragraph] };
  });
  const intro: ContextActivity = {
    ...base,
    id: `${base.id}:intro:v1`,
    difficulty: "intro",
    title: translate("play.ai.context.difficulty.intro.title", { name: visitor.name }),
    brief: translate("play.ai.context.difficulty.intro.brief", { work: base.workTitle }),
    goal: translate("play.ai.context.difficulty.intro.goal", {
      name: visitor.name,
      question: visitor.question,
    }),
    hint: translate("play.ai.context.difficulty.intro.hint"),
    authorityNote: translate("play.ai.context.difficulty.intro.authority", {
      slot: slot.label,
      source: documents[0]!.title,
      trial: documents[1]!.title,
    }),
    capacity: documents.reduce((total, document) => total + document.paragraphs[0]!.units, 0),
    slots: [slot],
    visitors: [visitor],
    documents,
    initialParagraphIds: documents.map((document) => document.paragraphs[0]!.id),
  };
  const capacity = 8;
  return {
    id: base.id,
    kind: base.kind,
    levels: {
      intro,
      practice: { ...base, id: `${base.id}:practice:v1`, difficulty: "practice" },
      challenge: {
        ...base,
        id: `${base.id}:challenge:v1`,
        difficulty: "challenge",
        capacity,
        title: translate("play.ai.context.difficulty.challenge.title", { capacity }),
        brief: translate("play.ai.context.difficulty.challenge.brief", {
          brief: base.brief,
          capacity,
        }),
        goal: translate("play.ai.context.difficulty.challenge.goal", {
          capacity,
          labels: base.slots.map((item) => item.label).join("、"),
        }),
        authorityNote: translate("play.ai.context.difficulty.challenge.authority", {
          authority: base.authorityNote,
          capacity,
        }),
        hint: translate("play.ai.context.difficulty.challenge.hint", { hint: base.hint, capacity }),
      },
    },
  };
}

function agentFamily(base: AgentActivity): Extract<ActivityFamily, { kind: "ai-agent" }> {
  const read = requireRole(
    base.actions.find(
      (action) =>
        action.required &&
        base.tools.some((tool) => tool.id === action.toolId && tool.capability === "read"),
    ),
    "required read",
    base.id,
  );
  const draft = requireRole(
    base.actions.find((action) => action.id === "write-draft"),
    "write-draft",
    base.id,
  );
  const source = requireRole(
    base.files.find((file) => read.inputFileIds.includes(file.id)),
    "read source",
    base.id,
  );
  const draftFile = requireRole(
    base.files.find((file) => draft.requiredFileIds.includes(file.id)),
    "draft output",
    base.id,
  );
  const values = { source: source.label, draft: draftFile.label };
  const authorization = translate("play.ai.agent.difficulty.intro.authorization", values);
  const actions = [
    {
      ...read,
      title: translate("play.ai.agent.difficulty.intro.readTitle", values),
      intent: translate("play.ai.agent.difficulty.intro.readIntent", values),
      authorityText: authorization,
    },
    {
      ...draft,
      title: translate("play.ai.agent.difficulty.intro.writeTitle", values),
      intent: translate("play.ai.agent.difficulty.intro.writeIntent", values),
      authorityText: authorization,
    },
  ];
  const fileIds = new Set(
    actions.flatMap((action) => [
      ...action.inputFileIds,
      ...action.requiredFileIds,
      ...action.effects.flatMap((effect) => [
        effect.fileId,
        ...(effect.kind === "compose" ? effect.sourceFileIds : []),
      ]),
    ]),
  );
  const intro: AgentActivity = {
    ...base,
    id: `${base.id}:intro:v1`,
    difficulty: "intro",
    title: translate("play.ai.agent.difficulty.intro.title", values),
    brief: translate("play.ai.agent.difficulty.intro.brief", values),
    goal: translate("play.ai.agent.difficulty.intro.goal", values),
    hint: translate("play.ai.agent.difficulty.intro.hint"),
    authorization,
    actions,
    files: base.files.filter((file) => fileIds.has(file.id)),
    tools: base.tools
      .filter((tool) => actions.some((action) => action.toolId === tool.id))
      .map((tool) => ({
        ...tool,
        taskFileIds: tool.taskFileIds.filter((id) => fileIds.has(id)),
        description:
          tool.id === draft.toolId
            ? translate("play.ai.agent.difficulty.intro.writeTool", values)
            : tool.description,
      })),
    goals: base.goals.filter((goal) =>
      draft.effects.some((effect) => effect.fileId === goal.fileId),
    ),
  };
  const publicFile = requireRole(
    base.files.find((file) => file.id === "public" && file.protected),
    "protected public file",
    base.id,
  );
  const extraWrite = requireRole(
    base.actions
      .find((action) => action.authority === "document")
      ?.effects.find((effect) => effect.fileId === publicFile.id),
    "public copy effect",
    base.id,
  );
  const challengeValues = { draft: draftFile.label, public: publicFile.label };
  const challengeAuthorization = translate("play.ai.agent.difficulty.challenge.authorization", {
    authorization: base.authorization,
    ...challengeValues,
  });
  return {
    id: base.id,
    kind: base.kind,
    levels: {
      intro,
      practice: { ...base, id: `${base.id}:practice:v1`, difficulty: "practice" },
      challenge: {
        ...base,
        id: `${base.id}:challenge:v1`,
        difficulty: "challenge",
        title: translate("play.ai.agent.difficulty.challenge.title"),
        brief: translate("play.ai.agent.difficulty.challenge.brief", {
          brief: base.brief,
          ...challengeValues,
        }),
        goal: translate("play.ai.agent.difficulty.challenge.goal", { goal: base.goal }),
        authorization: challengeAuthorization,
        hint: translate("play.ai.agent.difficulty.challenge.hint", {
          hint: base.hint,
          ...challengeValues,
        }),
        actions: base.actions.map((action) =>
          action.id === draft.id
            ? {
                ...action,
                // The changed required decision needs fresh evidence from this payload.
                id: `${action.id}-with-public-copy`,
                title: translate("play.ai.agent.difficulty.challenge.writeTitle", challengeValues),
                intent: translate(
                  "play.ai.agent.difficulty.challenge.writeIntent",
                  challengeValues,
                ),
                authorityText: challengeAuthorization,
                effects: [...action.effects, extraWrite],
              }
            : action,
        ),
      },
    },
  };
}

/** Difficulty selects a payload; all three levels still execute the original shared engine. */
export function getWorkflowFamily(activity: ContextActivity | AgentActivity): ActivityFamily {
  return activity.kind === "ai-context" ? contextFamily(activity) : agentFamily(activity);
}
