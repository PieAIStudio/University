import type { ContrastActivity, ContrastCase } from "@pieai/university-core";

import { translate } from "../i18n/index.js";

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
      label: translate("play.contrast.search.exact"),
      detail: translate("play.contrast.search.exactDetail"),
      outcomes: {
        literal: translate("play.contrast.search.exactBoth"),
        similar: translate("play.contrast.search.exactBoth"),
      },
      why: translate("play.contrast.search.exactWhy"),
    },
    synonym: {
      id: "synonym",
      label: translate("play.contrast.search.synonym"),
      detail: translate("play.contrast.search.synonymDetail"),
      outcomes: {
        literal: translate("play.contrast.search.synonymLiteral"),
        similar: translate("play.contrast.search.synonymSimilar"),
      },
      why: translate("play.contrast.search.synonymWhy"),
    },
    typo: {
      id: "typo",
      label: translate("play.contrast.search.typo"),
      detail: translate("play.contrast.search.typoDetail"),
      outcomes: {
        literal: translate("play.contrast.search.typoLiteral"),
        similar: translate("play.contrast.search.typoSimilar"),
      },
      why: translate("play.contrast.search.typoWhy"),
    },
    homograph: {
      id: "homograph",
      label: translate("play.contrast.search.homograph"),
      detail: translate("play.contrast.search.homographDetail"),
      outcomes: {
        literal: translate("play.contrast.search.homographBoth"),
        similar: translate("play.contrast.search.homographBoth"),
      },
      why: translate("play.contrast.search.homographWhy"),
    },
    orderId: {
      id: "orderId",
      label: translate("play.contrast.search.orderId"),
      detail: translate("play.contrast.search.orderIdDetail"),
      outcomes: {
        literal: translate("play.contrast.search.orderIdLiteral"),
        similar: translate("play.contrast.search.orderIdSimilar"),
      },
      why: translate("play.contrast.search.orderIdWhy"),
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
      title: translate("play.contrast.search.title"),
      brief: translate("play.contrast.search.brief"),
      goal: translate("play.contrast.search.goal"),
      takeaway: translate("play.contrast.search.takeaway"),
      hint: translate("play.contrast.search.hint"),
      source: {
        label: translate("play.contrast.search.source"),
        url: "https://developer.mozilla.org/en-US/docs/Web/API/String/includes",
      },
      question: translate("play.contrast.search.question"),
      approaches: [
        {
          id: "literal",
          label: translate("play.contrast.search.literal"),
          note: translate("play.contrast.search.literalNote"),
        },
        {
          id: "similar",
          label: translate("play.contrast.search.similar"),
          note: translate("play.contrast.search.similarNote"),
        },
      ],
      cases: [all.exact!, all.synonym!, all.typo!, all.orderId!],
    },
  ];
}
