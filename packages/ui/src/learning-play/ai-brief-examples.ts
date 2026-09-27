import type { BriefAction, BriefActivity, BriefConfiguration } from "@pieai/university-core";
import { interfaceTranslator } from "../i18n/index.js";

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
    title: interfaceTranslator.t(`play.ai.brief.${name}.title`),
    brief: interfaceTranslator.t(`play.ai.brief.${name}.brief`),
    goal: interfaceTranslator.t(`play.ai.brief.${name}.goal`),
    request: interfaceTranslator.t(`play.ai.brief.${name}.request`),
    productName: interfaceTranslator.t(`play.ai.brief.${name}.name`),
    productDescription: interfaceTranslator.t(`play.ai.brief.${name}.description`),
    visitorName: interfaceTranslator.t("play.ai.brief.visitorName"),
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
        label: interfaceTranslator.t(`play.ai.brief.${name}.action`),
        decidedBy: "confirmation",
        outcomes: {
          instant: interfaceTranslator.t("play.ai.brief.result.joined"),
          review: interfaceTranslator.t("play.ai.brief.result.queued"),
          login: interfaceTranslator.t("play.ai.brief.result.login"),
        },
      },
      {
        id: "roster",
        label: interfaceTranslator.t("play.ai.brief.roster"),
        decidedBy: "roster",
        outcomes: {
          private: interfaceTranslator.t("play.ai.brief.result.private"),
          public: interfaceTranslator.t("play.ai.brief.result.public"),
          login: interfaceTranslator.t("play.ai.brief.result.login"),
        },
        // A public list shows you too, once you are on it. That is what makes
        // 「公开」 a decision rather than a word.
        after: {
          action: "submit",
          outcome: "instant",
          outcomes: {
            public: `${interfaceTranslator.t("play.ai.brief.result.public")} ${interfaceTranslator.t(
              "play.ai.brief.ownEntry",
              {
                name: interfaceTranslator.t("play.ai.brief.visitorName"),
              },
            )}`,
          },
        },
      },
    ]),
    gate: {
      axis: "access",
      requiresUnlock: "account",
      unlockLabel: interfaceTranslator.t("play.ai.brief.login"),
      blockedOutcome: "login",
    },
    hint: interfaceTranslator.t("play.ai.brief.hint"),
    takeaway: interfaceTranslator.t("play.ai.brief.takeaway"),
    source: {
      label: interfaceTranslator.t("play.ai.brief.source"),
      url: "https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/",
    },
    target: targets[index]!,
    followUp: {
      request: interfaceTranslator.t(`play.ai.brief.${name}.followUp`),
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
        label: interfaceTranslator.t("play.ai.brief.access"),
        question: interfaceTranslator.t("play.ai.brief.accessQuestion"),
        answer: interfaceTranslator.t(`play.ai.brief.${name}.accessAnswer`),
        options: [
          {
            value: "guest",
            label: interfaceTranslator.t("play.ai.brief.guest"),
            clause: interfaceTranslator.t("play.ai.brief.guestClause"),
          },
          {
            value: "account",
            label: interfaceTranslator.t("play.ai.brief.account"),
            clause: interfaceTranslator.t("play.ai.brief.accountClause"),
          },
        ],
      },
      {
        axis: "confirmation",
        label: interfaceTranslator.t("play.ai.brief.confirmation"),
        question: interfaceTranslator.t("play.ai.brief.confirmQuestion"),
        answer: interfaceTranslator.t(`play.ai.brief.${name}.confirmAnswer`),
        options: [
          {
            value: "instant",
            label: interfaceTranslator.t("play.ai.brief.instant"),
            clause: interfaceTranslator.t("play.ai.brief.instantClause"),
          },
          {
            value: "review",
            label: interfaceTranslator.t("play.ai.brief.review"),
            clause: interfaceTranslator.t("play.ai.brief.reviewClause"),
          },
        ],
      },
      {
        axis: "roster",
        label: interfaceTranslator.t("play.ai.brief.visibility"),
        question: interfaceTranslator.t("play.ai.brief.rosterQuestion"),
        answer: interfaceTranslator.t(`play.ai.brief.${name}.rosterAnswer`),
        options: [
          {
            value: "private",
            label: interfaceTranslator.t("play.ai.brief.private"),
            clause: interfaceTranslator.t("play.ai.brief.privateClause"),
          },
          {
            value: "public",
            label: interfaceTranslator.t("play.ai.brief.public"),
            clause: interfaceTranslator.t("play.ai.brief.publicClause"),
          },
        ],
      },
    ],
  }));
}
