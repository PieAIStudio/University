import type { BriefActivity, BriefConfiguration } from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";

export function getAIBriefExamples(): readonly BriefActivity[] {
  const targets: readonly BriefConfiguration[] = [
    { access: "guest", confirmation: "review", roster: "private" },
    { access: "account", confirmation: "instant", roster: "public" },
  ];
  return (["walk", "club"] as const).map((name, index) => ({
    kind: "ai-brief",
    id: `ai-brief-${name}`,
    title: t(`play.ai.brief.${name}.title`),
    brief: t(`play.ai.brief.${name}.brief`),
    goal: t(`play.ai.brief.${name}.goal`),
    request: t(`play.ai.brief.${name}.request`),
    productName: t(`play.ai.brief.${name}.name`),
    productDescription: t(`play.ai.brief.${name}.description`),
    visitorName: t("play.ai.brief.visitorName"),
    actionLabel: t(`play.ai.brief.${name}.action`),
    hint: t("play.ai.brief.hint"),
    takeaway: t("play.ai.brief.takeaway"),
    source: {
      label: t("play.ai.brief.source"),
      url: "https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/",
    },
    target: targets[index]!,
    followUp: {
      request: t(`play.ai.brief.${name}.followUp`),
      target:
        name === "walk"
          ? { access: "guest", confirmation: "instant", roster: "private" }
          : { access: "account", confirmation: "instant", roster: "private" },
    },
    interpretations: [
      { access: "guest", confirmation: "instant", roster: "public" },
      { access: "account", confirmation: "review", roster: "private" },
    ],
    questions: [
      {
        axis: "access",
        label: t("play.ai.brief.access"),
        question: t("play.ai.brief.accessQuestion"),
        answer: t(`play.ai.brief.${name}.accessAnswer`),
        options: [
          {
            value: "guest",
            label: t("play.ai.brief.guest"),
            clause: t("play.ai.brief.guestClause"),
          },
          {
            value: "account",
            label: t("play.ai.brief.account"),
            clause: t("play.ai.brief.accountClause"),
          },
        ],
      },
      {
        axis: "confirmation",
        label: t("play.ai.brief.confirmation"),
        question: t("play.ai.brief.confirmQuestion"),
        answer: t(`play.ai.brief.${name}.confirmAnswer`),
        options: [
          {
            value: "instant",
            label: t("play.ai.brief.instant"),
            clause: t("play.ai.brief.instantClause"),
          },
          {
            value: "review",
            label: t("play.ai.brief.review"),
            clause: t("play.ai.brief.reviewClause"),
          },
        ],
      },
      {
        axis: "roster",
        label: t("play.ai.brief.visibility"),
        question: t("play.ai.brief.rosterQuestion"),
        answer: t(`play.ai.brief.${name}.rosterAnswer`),
        options: [
          {
            value: "private",
            label: t("play.ai.brief.private"),
            clause: t("play.ai.brief.privateClause"),
          },
          {
            value: "public",
            label: t("play.ai.brief.public"),
            clause: t("play.ai.brief.publicClause"),
          },
        ],
      },
    ],
  }));
}
