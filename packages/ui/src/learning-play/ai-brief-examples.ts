import type { BriefAction, BriefActivity, BriefConfiguration } from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";

/** Widens each literal to `BriefAction` so the two outcome maps stay one type. */
const satisfiesActions = (actions: readonly BriefAction[]): readonly BriefAction[] => actions;

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
    /*
      The two things a visitor can do here, and which agreement decides each.

      They used to be built into the engine — a submit and a roster view, with a
      login in front of them — which is what made every lesson using this game
      teach a sign-up sheet. Written out, this product is one payload among
      possible others rather than the shape of the game.
    */
    actions: satisfiesActions([
      {
        id: "submit",
        label: t(`play.ai.brief.${name}.action`),
        decidedBy: "confirmation",
        outcomes: {
          instant: t("play.ai.brief.result.joined"),
          review: t("play.ai.brief.result.queued"),
          login: t("play.ai.brief.result.login"),
        },
      },
      {
        id: "roster",
        label: t("play.ai.brief.roster"),
        decidedBy: "roster",
        outcomes: {
          private: t("play.ai.brief.result.private"),
          public: t("play.ai.brief.result.public"),
          login: t("play.ai.brief.result.login"),
        },
        // A public list shows you too, once you are on it. That is what makes
        // 「公开」 a decision rather than a word.
        after: {
          action: "submit",
          outcome: "instant",
          outcomes: {
            public: `${t("play.ai.brief.result.public")} ${t("play.ai.brief.ownEntry", {
              name: t("play.ai.brief.visitorName"),
            })}`,
          },
        },
      },
    ]),
    gate: {
      axis: "access",
      requiresUnlock: "account",
      unlockLabel: t("play.ai.brief.login"),
      blockedOutcome: "login",
    },
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
