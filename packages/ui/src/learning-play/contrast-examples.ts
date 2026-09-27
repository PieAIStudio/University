import type { ContrastActivity, ContrastCase } from "@pieai/university-core";

import { interfaceTranslator } from "../i18n/index.js";

/**
 * The lab's `contrast` fixture: 「按字找」 against 「比像不像」.
 *
 * The README's own audit of fifteen published lessons named this exact pair as
 * a shape none of the ten games could hold. It is the shape 117 of this
 * catalogue's 469 lessons are written in — 对比 — and what those lessons need
 * is not a diagram of two methods but the moment where the two methods are
 * handed the same thing and hand back different answers.
 *
 * Two of the five cases are deliberately not 「one is better」:
 * `homograph` has both land in the same wrong place, and `orderId` has the
 * cleverer method lose. A board where the fancy approach wins every time
 * teaches a preference, not a contrast.
 */
function cases(): Readonly<Record<string, ContrastCase>> {
  return {
    exact: {
      id: "exact",
      label: interfaceTranslator.t("play.contrast.search.exact"),
      detail: interfaceTranslator.t("play.contrast.search.exactDetail"),
      outcomes: {
        literal: interfaceTranslator.t("play.contrast.search.exactBoth"),
        similar: interfaceTranslator.t("play.contrast.search.exactBoth"),
      },
      why: interfaceTranslator.t("play.contrast.search.exactWhy"),
    },
    synonym: {
      id: "synonym",
      label: interfaceTranslator.t("play.contrast.search.synonym"),
      detail: interfaceTranslator.t("play.contrast.search.synonymDetail"),
      outcomes: {
        literal: interfaceTranslator.t("play.contrast.search.synonymLiteral"),
        similar: interfaceTranslator.t("play.contrast.search.synonymSimilar"),
      },
      why: interfaceTranslator.t("play.contrast.search.synonymWhy"),
    },
    typo: {
      id: "typo",
      label: interfaceTranslator.t("play.contrast.search.typo"),
      detail: interfaceTranslator.t("play.contrast.search.typoDetail"),
      outcomes: {
        literal: interfaceTranslator.t("play.contrast.search.typoLiteral"),
        similar: interfaceTranslator.t("play.contrast.search.typoSimilar"),
      },
      why: interfaceTranslator.t("play.contrast.search.typoWhy"),
    },
    homograph: {
      id: "homograph",
      label: interfaceTranslator.t("play.contrast.search.homograph"),
      detail: interfaceTranslator.t("play.contrast.search.homographDetail"),
      outcomes: {
        literal: interfaceTranslator.t("play.contrast.search.homographBoth"),
        similar: interfaceTranslator.t("play.contrast.search.homographBoth"),
      },
      why: interfaceTranslator.t("play.contrast.search.homographWhy"),
    },
    orderId: {
      id: "orderId",
      label: interfaceTranslator.t("play.contrast.search.orderId"),
      detail: interfaceTranslator.t("play.contrast.search.orderIdDetail"),
      outcomes: {
        literal: interfaceTranslator.t("play.contrast.search.orderIdLiteral"),
        similar: interfaceTranslator.t("play.contrast.search.orderIdSimilar"),
      },
      why: interfaceTranslator.t("play.contrast.search.orderIdWhy"),
    },
  };
}

/** Named so the tiers can pick from them without re-deriving which is which. */
export function getContrastCases(): Readonly<Record<string, ContrastCase>> {
  return cases();
}

export function getContrastExamples(): readonly ContrastActivity[] {
  const all = cases();
  return [
    {
      id: "contrast-two-ways-to-search",
      kind: "contrast",
      title: interfaceTranslator.t("play.contrast.search.title"),
      brief: interfaceTranslator.t("play.contrast.search.brief"),
      goal: interfaceTranslator.t("play.contrast.search.goal"),
      takeaway: interfaceTranslator.t("play.contrast.search.takeaway"),
      hint: interfaceTranslator.t("play.contrast.search.hint"),
      source: {
        label: interfaceTranslator.t("play.contrast.search.source"),
        url: "https://developer.mozilla.org/en-US/docs/Web/API/String/includes",
      },
      question: interfaceTranslator.t("play.contrast.search.question"),
      approaches: [
        {
          id: "literal",
          label: interfaceTranslator.t("play.contrast.search.literal"),
          note: interfaceTranslator.t("play.contrast.search.literalNote"),
        },
        {
          id: "similar",
          label: interfaceTranslator.t("play.contrast.search.similar"),
          note: interfaceTranslator.t("play.contrast.search.similarNote"),
        },
      ],
      cases: [all.exact!, all.synonym!, all.typo!, all.orderId!],
    },
  ];
}
