import type { AgentActivity, ContextActivity, ContextParagraph } from "@pieai/university-core";
import { interfaceTranslator } from "../i18n/index.js";

function contextExample(scenario: "cafe" | "workshop"): ContextActivity {
  const paragraph = (
    id: string,
    text: string,
    units: number,
    slotId?: string,
    value?: string,
    valueId = "current",
  ): ContextParagraph => ({
    id,
    text,
    units,
    facts: slotId && value ? [{ slotId, valueId, text: value }] : [],
  });
  return {
    id: `ai-context-${scenario}`,
    kind: "ai-context",
    title: interfaceTranslator.t(`play.ai.context.${scenario}.title`),
    brief: interfaceTranslator.t(`play.ai.context.${scenario}.brief`),
    goal: interfaceTranslator.t(`play.ai.context.${scenario}.goal`),
    takeaway: interfaceTranslator.t(`play.ai.context.${scenario}.takeaway`),
    hint: interfaceTranslator.t(`play.ai.context.${scenario}.hint`),
    source: {
      label: interfaceTranslator.t("play.ai.context.source"),
      url: "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents",
    },
    capacity: 16,
    initialParagraphIds: [
      "brief-offering",
      "brief-feedback",
      "brief-story",
      "trial-offering",
      "trial-limit",
    ],
    visitors: (["offering", "limit", "feedback"] as const).map((slotId, index) => ({
      id: `visitor-${slotId}`,
      name: interfaceTranslator.t(
        (
          [
            "play.ai.context.visitor.0",
            "play.ai.context.visitor.1",
            "play.ai.context.visitor.2",
          ] as const
        )[index]!,
      ),
      question: interfaceTranslator.t(`play.ai.context.${scenario}.question.${slotId}`),
      slotId,
    })),
    authorityNote: interfaceTranslator.t(`play.ai.context.${scenario}.authority`),
    workTitle: interfaceTranslator.t(`play.ai.context.${scenario}.workTitle`),
    slots: [
      {
        id: "offering",
        label: interfaceTranslator.t(`play.ai.context.${scenario}.slotOffering`),
        expectedValueId: "current",
        authorityDocumentIds: ["brief"],
      },
      {
        id: "limit",
        label: interfaceTranslator.t(`play.ai.context.${scenario}.slotLimit`),
        expectedValueId: "current",
        authorityDocumentIds: ["policy"],
      },
      {
        id: "feedback",
        label: interfaceTranslator.t(`play.ai.context.${scenario}.slotFeedback`),
        expectedValueId: "current",
        authorityDocumentIds: ["brief", "summary"],
      },
    ],
    documents: [
      {
        id: "brief",
        title: interfaceTranslator.t(`play.ai.context.${scenario}.briefTitle`),
        provenance: interfaceTranslator.t(`play.ai.context.${scenario}.briefBy`),
        date: "2026-09-05",
        paragraphs: [
          paragraph(
            "brief-offering",
            interfaceTranslator.t(`play.ai.context.${scenario}.brief1`),
            3,
            "offering",
            interfaceTranslator.t(`play.ai.context.${scenario}.offeringValue`),
          ),
          paragraph(
            "brief-feedback",
            interfaceTranslator.t(`play.ai.context.${scenario}.brief2`),
            3,
            "feedback",
            interfaceTranslator.t(`play.ai.context.${scenario}.feedbackValue`),
          ),
          paragraph("brief-story", interfaceTranslator.t(`play.ai.context.${scenario}.brief3`), 3),
        ],
      },
      {
        id: "policy",
        title: interfaceTranslator.t(`play.ai.context.${scenario}.policyTitle`),
        provenance: interfaceTranslator.t(`play.ai.context.${scenario}.policyBy`),
        date: "2026-08-28",
        paragraphs: [
          paragraph(
            "policy-limit",
            interfaceTranslator.t(`play.ai.context.${scenario}.policy1`),
            3,
            "limit",
            interfaceTranslator.t(`play.ai.context.${scenario}.limitValue`),
          ),
          paragraph(
            "policy-extra",
            interfaceTranslator.t(`play.ai.context.${scenario}.policy2`),
            2,
          ),
        ],
      },
      {
        id: "summary",
        title: interfaceTranslator.t(`play.ai.context.${scenario}.summaryTitle`),
        provenance: interfaceTranslator.t(`play.ai.context.${scenario}.summaryBy`),
        date: "2026-09-06",
        paragraphs: [
          paragraph(
            "summary-feedback",
            interfaceTranslator.t(`play.ai.context.${scenario}.summary1`),
            2,
            "feedback",
            interfaceTranslator.t(`play.ai.context.${scenario}.feedbackValue`),
          ),
          paragraph(
            "summary-extra",
            interfaceTranslator.t(`play.ai.context.${scenario}.summary2`),
            2,
          ),
        ],
      },
      {
        id: "trial",
        title: interfaceTranslator.t(`play.ai.context.${scenario}.trialTitle`),
        provenance: interfaceTranslator.t(`play.ai.context.${scenario}.trialBy`),
        date: "2026-09-07",
        paragraphs: [
          paragraph(
            "trial-offering",
            interfaceTranslator.t(`play.ai.context.${scenario}.trial1`),
            2,
            "offering",
            interfaceTranslator.t(`play.ai.context.${scenario}.trialOffering`),
            "proposed",
          ),
          paragraph(
            "trial-limit",
            interfaceTranslator.t(`play.ai.context.${scenario}.trial2`),
            2,
            "limit",
            interfaceTranslator.t(`play.ai.context.${scenario}.trialLimit`),
            "proposed",
          ),
        ],
      },
      {
        id: "inspiration",
        title: interfaceTranslator.t(`play.ai.context.${scenario}.inspirationTitle`),
        provenance: interfaceTranslator.t(`play.ai.context.${scenario}.inspirationBy`),
        date: "2026-09-04",
        paragraphs: [
          paragraph(
            "inspiration-photo",
            interfaceTranslator.t(`play.ai.context.${scenario}.inspiration1`),
            4,
          ),
        ],
      },
    ],
  };
}

function agentExample(scenario: "event" | "recipe"): AgentActivity {
  const list = interfaceTranslator.t(`play.ai.agent.${scenario}.listContent`);
  const draft = interfaceTranslator.t(`play.ai.agent.${scenario}.draftContent`);
  const authorization = interfaceTranslator.t(`play.ai.agent.${scenario}.authorization`);
  return {
    id: `ai-agent-${scenario}`,
    kind: "ai-agent",
    title: interfaceTranslator.t(`play.ai.agent.${scenario}.title`),
    brief: interfaceTranslator.t(`play.ai.agent.${scenario}.brief`),
    goal: interfaceTranslator.t(`play.ai.agent.${scenario}.goal`),
    takeaway: interfaceTranslator.t(`play.ai.agent.${scenario}.takeaway`),
    hint: interfaceTranslator.t(`play.ai.agent.${scenario}.hint`),
    source: {
      label: interfaceTranslator.t("play.ai.agent.source"),
      url: "https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/",
    },
    authorization,
    files: [
      {
        id: "source",
        path: `/${scenario}/source/notes.txt`,
        label: interfaceTranslator.t(`play.ai.agent.${scenario}.sourceLabel`),
        content: interfaceTranslator.t(`play.ai.agent.${scenario}.sourceContent`),
        protected: true,
      },
      {
        id: "list",
        path: `/${scenario}/drafts/list.txt`,
        label: interfaceTranslator.t(`play.ai.agent.${scenario}.listLabel`),
        content: "",
        protected: false,
      },
      {
        id: "draft",
        path: `/${scenario}/drafts/card.txt`,
        label: interfaceTranslator.t(`play.ai.agent.${scenario}.draftLabel`),
        content: "",
        protected: false,
      },
      {
        id: "preview",
        path: `/${scenario}/preview/internal.txt`,
        label: interfaceTranslator.t(`play.ai.agent.${scenario}.previewLabel`),
        content: "",
        protected: false,
      },
      {
        id: "public",
        path: `/${scenario}/public/page.txt`,
        label: interfaceTranslator.t(`play.ai.agent.${scenario}.publicLabel`),
        content: interfaceTranslator.t(`play.ai.agent.${scenario}.publicContent`),
        protected: true,
      },
    ],
    tools: [
      {
        id: "read",
        label: interfaceTranslator.t(`play.ai.agent.${scenario}.readTool`),
        capability: "read",
        description: interfaceTranslator.t(`play.ai.agent.${scenario}.readDescription`),
        taskFileIds: ["source"],
      },
      {
        id: "write",
        label: interfaceTranslator.t(`play.ai.agent.${scenario}.writeTool`),
        capability: "write",
        description: interfaceTranslator.t(`play.ai.agent.${scenario}.writeDescription`),
        taskFileIds: ["list", "draft"],
      },
      {
        id: "preview",
        label: interfaceTranslator.t(`play.ai.agent.${scenario}.previewTool`),
        capability: "preview",
        description: interfaceTranslator.t(`play.ai.agent.${scenario}.previewDescription`),
        taskFileIds: ["list", "draft", "preview"],
      },
    ],
    actions: [
      {
        id: "read-source",
        title: interfaceTranslator.t(`play.ai.agent.${scenario}.readTitle`),
        intent: interfaceTranslator.t(`play.ai.agent.${scenario}.readIntent`),
        toolId: "read",
        authority: "user",
        authorityText: authorization,
        inputFileIds: ["source"],
        effects: [],
        required: true,
        requiredFileIds: [],
      },
      {
        id: "write-list",
        title: interfaceTranslator.t(`play.ai.agent.${scenario}.listTitle`),
        intent: interfaceTranslator.t(`play.ai.agent.${scenario}.listIntent`),
        toolId: "write",
        authority: "user",
        authorityText: authorization,
        inputFileIds: [],
        effects: [
          { fileId: "list", kind: "replace", content: list },
          {
            fileId: "source",
            kind: "replace",
            content: interfaceTranslator.t(`play.ai.agent.${scenario}.damagedSource`),
          },
        ],
        required: true,
        requiredFileIds: ["list"],
      },
      {
        id: "imported-command",
        title: interfaceTranslator.t(`play.ai.agent.${scenario}.injectTitle`),
        intent: interfaceTranslator.t(`play.ai.agent.${scenario}.injectIntent`),
        toolId: "write",
        authority: "document",
        authorityText: interfaceTranslator.t(`play.ai.agent.${scenario}.injectAuthority`),
        sourceFileId: "source",
        inputFileIds: [],
        effects: [
          {
            fileId: "public",
            kind: "replace",
            content: interfaceTranslator.t(`play.ai.agent.${scenario}.damagedPublic`),
          },
        ],
        required: false,
        requiredFileIds: [],
      },
      {
        id: "write-draft",
        title: interfaceTranslator.t(`play.ai.agent.${scenario}.draftTitle`),
        intent: interfaceTranslator.t(`play.ai.agent.${scenario}.draftIntent`),
        toolId: "write",
        authority: "user",
        authorityText: authorization,
        inputFileIds: [],
        effects: [{ fileId: "draft", kind: "replace", content: draft }],
        required: true,
        requiredFileIds: ["draft"],
      },
      {
        id: "build-preview",
        title: interfaceTranslator.t(`play.ai.agent.${scenario}.previewTitle`),
        intent: interfaceTranslator.t(`play.ai.agent.${scenario}.previewIntent`),
        toolId: "preview",
        authority: "user",
        authorityText: authorization,
        inputFileIds: ["list", "draft"],
        effects: [
          {
            fileId: "preview",
            kind: "compose",
            sourceFileIds: ["list", "draft"],
            separator: "\n\n",
          },
        ],
        required: true,
        requiredFileIds: ["preview"],
      },
    ],
    goals: [
      { fileId: "list", expectedContent: list },
      { fileId: "draft", expectedContent: draft },
      { fileId: "preview", expectedContent: `${list}\n\n${draft}` },
    ],
  };
}

/** These fictional presets exercise deterministic mechanics; they are not authored lessons. */
export function getAIWorkflowExamples(): readonly (ContextActivity | AgentActivity)[] {
  return [
    contextExample("cafe"),
    contextExample("workshop"),
    agentExample("event"),
    agentExample("recipe"),
  ];
}
