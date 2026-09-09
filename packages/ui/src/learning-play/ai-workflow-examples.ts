import type { AgentActivity, ContextActivity, ContextParagraph } from "@pieai/university-core";
import { translate } from "../i18n/index.js";

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
    title: translate(`play.ai.context.${scenario}.title`),
    brief: translate(`play.ai.context.${scenario}.brief`),
    goal: translate(`play.ai.context.${scenario}.goal`),
    takeaway: translate(`play.ai.context.${scenario}.takeaway`),
    hint: translate(`play.ai.context.${scenario}.hint`),
    source: {
      label: translate("play.ai.context.source"),
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
      name: translate(
        (
          [
            "play.ai.context.visitor.0",
            "play.ai.context.visitor.1",
            "play.ai.context.visitor.2",
          ] as const
        )[index]!,
      ),
      question: translate(`play.ai.context.${scenario}.question.${slotId}`),
      slotId,
    })),
    authorityNote: translate(`play.ai.context.${scenario}.authority`),
    workTitle: translate(`play.ai.context.${scenario}.workTitle`),
    slots: [
      {
        id: "offering",
        label: translate(`play.ai.context.${scenario}.slotOffering`),
        expectedValueId: "current",
        authorityDocumentIds: ["brief"],
      },
      {
        id: "limit",
        label: translate(`play.ai.context.${scenario}.slotLimit`),
        expectedValueId: "current",
        authorityDocumentIds: ["policy"],
      },
      {
        id: "feedback",
        label: translate(`play.ai.context.${scenario}.slotFeedback`),
        expectedValueId: "current",
        authorityDocumentIds: ["brief", "summary"],
      },
    ],
    documents: [
      {
        id: "brief",
        title: translate(`play.ai.context.${scenario}.briefTitle`),
        provenance: translate(`play.ai.context.${scenario}.briefBy`),
        date: "2026-09-05",
        paragraphs: [
          paragraph(
            "brief-offering",
            translate(`play.ai.context.${scenario}.brief1`),
            3,
            "offering",
            translate(`play.ai.context.${scenario}.offeringValue`),
          ),
          paragraph(
            "brief-feedback",
            translate(`play.ai.context.${scenario}.brief2`),
            3,
            "feedback",
            translate(`play.ai.context.${scenario}.feedbackValue`),
          ),
          paragraph("brief-story", translate(`play.ai.context.${scenario}.brief3`), 3),
        ],
      },
      {
        id: "policy",
        title: translate(`play.ai.context.${scenario}.policyTitle`),
        provenance: translate(`play.ai.context.${scenario}.policyBy`),
        date: "2026-08-28",
        paragraphs: [
          paragraph(
            "policy-limit",
            translate(`play.ai.context.${scenario}.policy1`),
            3,
            "limit",
            translate(`play.ai.context.${scenario}.limitValue`),
          ),
          paragraph("policy-extra", translate(`play.ai.context.${scenario}.policy2`), 2),
        ],
      },
      {
        id: "summary",
        title: translate(`play.ai.context.${scenario}.summaryTitle`),
        provenance: translate(`play.ai.context.${scenario}.summaryBy`),
        date: "2026-09-06",
        paragraphs: [
          paragraph(
            "summary-feedback",
            translate(`play.ai.context.${scenario}.summary1`),
            2,
            "feedback",
            translate(`play.ai.context.${scenario}.feedbackValue`),
          ),
          paragraph("summary-extra", translate(`play.ai.context.${scenario}.summary2`), 2),
        ],
      },
      {
        id: "trial",
        title: translate(`play.ai.context.${scenario}.trialTitle`),
        provenance: translate(`play.ai.context.${scenario}.trialBy`),
        date: "2026-09-07",
        paragraphs: [
          paragraph(
            "trial-offering",
            translate(`play.ai.context.${scenario}.trial1`),
            2,
            "offering",
            translate(`play.ai.context.${scenario}.trialOffering`),
            "proposed",
          ),
          paragraph(
            "trial-limit",
            translate(`play.ai.context.${scenario}.trial2`),
            2,
            "limit",
            translate(`play.ai.context.${scenario}.trialLimit`),
            "proposed",
          ),
        ],
      },
      {
        id: "inspiration",
        title: translate(`play.ai.context.${scenario}.inspirationTitle`),
        provenance: translate(`play.ai.context.${scenario}.inspirationBy`),
        date: "2026-09-04",
        paragraphs: [
          paragraph("inspiration-photo", translate(`play.ai.context.${scenario}.inspiration1`), 4),
        ],
      },
    ],
  };
}

function agentExample(scenario: "event" | "recipe"): AgentActivity {
  const list = translate(`play.ai.agent.${scenario}.listContent`);
  const draft = translate(`play.ai.agent.${scenario}.draftContent`);
  const authorization = translate(`play.ai.agent.${scenario}.authorization`);
  return {
    id: `ai-agent-${scenario}`,
    kind: "ai-agent",
    title: translate(`play.ai.agent.${scenario}.title`),
    brief: translate(`play.ai.agent.${scenario}.brief`),
    goal: translate(`play.ai.agent.${scenario}.goal`),
    takeaway: translate(`play.ai.agent.${scenario}.takeaway`),
    hint: translate(`play.ai.agent.${scenario}.hint`),
    source: {
      label: translate("play.ai.agent.source"),
      url: "https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/",
    },
    authorization,
    files: [
      {
        id: "source",
        path: `/${scenario}/source/notes.txt`,
        label: translate(`play.ai.agent.${scenario}.sourceLabel`),
        content: translate(`play.ai.agent.${scenario}.sourceContent`),
        protected: true,
      },
      {
        id: "list",
        path: `/${scenario}/drafts/list.txt`,
        label: translate(`play.ai.agent.${scenario}.listLabel`),
        content: "",
        protected: false,
      },
      {
        id: "draft",
        path: `/${scenario}/drafts/card.txt`,
        label: translate(`play.ai.agent.${scenario}.draftLabel`),
        content: "",
        protected: false,
      },
      {
        id: "preview",
        path: `/${scenario}/preview/internal.txt`,
        label: translate(`play.ai.agent.${scenario}.previewLabel`),
        content: "",
        protected: false,
      },
      {
        id: "public",
        path: `/${scenario}/public/page.txt`,
        label: translate(`play.ai.agent.${scenario}.publicLabel`),
        content: translate(`play.ai.agent.${scenario}.publicContent`),
        protected: true,
      },
    ],
    tools: [
      {
        id: "read",
        label: translate(`play.ai.agent.${scenario}.readTool`),
        capability: "read",
        description: translate(`play.ai.agent.${scenario}.readDescription`),
        taskFileIds: ["source"],
      },
      {
        id: "write",
        label: translate(`play.ai.agent.${scenario}.writeTool`),
        capability: "write",
        description: translate(`play.ai.agent.${scenario}.writeDescription`),
        taskFileIds: ["list", "draft"],
      },
      {
        id: "preview",
        label: translate(`play.ai.agent.${scenario}.previewTool`),
        capability: "preview",
        description: translate(`play.ai.agent.${scenario}.previewDescription`),
        taskFileIds: ["list", "draft", "preview"],
      },
    ],
    actions: [
      {
        id: "read-source",
        title: translate(`play.ai.agent.${scenario}.readTitle`),
        intent: translate(`play.ai.agent.${scenario}.readIntent`),
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
        title: translate(`play.ai.agent.${scenario}.listTitle`),
        intent: translate(`play.ai.agent.${scenario}.listIntent`),
        toolId: "write",
        authority: "user",
        authorityText: authorization,
        inputFileIds: [],
        effects: [
          { fileId: "list", kind: "replace", content: list },
          {
            fileId: "source",
            kind: "replace",
            content: translate(`play.ai.agent.${scenario}.damagedSource`),
          },
        ],
        required: true,
        requiredFileIds: ["list"],
      },
      {
        id: "imported-command",
        title: translate(`play.ai.agent.${scenario}.injectTitle`),
        intent: translate(`play.ai.agent.${scenario}.injectIntent`),
        toolId: "write",
        authority: "document",
        authorityText: translate(`play.ai.agent.${scenario}.injectAuthority`),
        sourceFileId: "source",
        inputFileIds: [],
        effects: [
          {
            fileId: "public",
            kind: "replace",
            content: translate(`play.ai.agent.${scenario}.damagedPublic`),
          },
        ],
        required: false,
        requiredFileIds: [],
      },
      {
        id: "write-draft",
        title: translate(`play.ai.agent.${scenario}.draftTitle`),
        intent: translate(`play.ai.agent.${scenario}.draftIntent`),
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
        title: translate(`play.ai.agent.${scenario}.previewTitle`),
        intent: translate(`play.ai.agent.${scenario}.previewIntent`),
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
