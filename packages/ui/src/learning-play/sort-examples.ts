import type { SortActivity } from "@pieai/university-core";

import { interfaceTranslator } from "../i18n/index.js";

/**
 * The lab's `sort` fixture: 「这件事该开哪个文件？」
 *
 * `sort` is the game for a boundary — 「这算不算 X」, 「它不是 A 也不是 B」 — and
 * the boundary chosen here is the one this product's visitors meet first: a web
 * page is three files, and which one you open depends on whether you are adding
 * a thing, changing how it looks, or changing what happens when it is clicked.
 *
 * Every item carries a `tempting` bucket and the reason it does not hold. That
 * is the whole difference between this and a quiz: 「wrong, try again」 teaches
 * nothing about where the line is, and naming the answer somebody would
 * reasonably have reached for is what draws it.
 */
export function getSortExamples(): readonly SortActivity[] {
  return [
    {
      id: "sort-which-file",
      kind: "sort",
      title: interfaceTranslator.t("play.sort.files.title"),
      brief: interfaceTranslator.t("play.sort.files.brief"),
      goal: interfaceTranslator.t("play.sort.files.goal"),
      takeaway: interfaceTranslator.t("play.sort.files.takeaway"),
      hint: interfaceTranslator.t("play.sort.files.hint"),
      source: {
        label: interfaceTranslator.t("play.sort.files.source"),
        url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Your_first_website",
      },
      question: interfaceTranslator.t("play.sort.files.question"),
      buckets: [
        {
          id: "html",
          label: interfaceTranslator.t("play.sort.files.bucket.html"),
          note: interfaceTranslator.t("play.sort.files.bucket.htmlNote"),
        },
        {
          id: "css",
          label: interfaceTranslator.t("play.sort.files.bucket.css"),
          note: interfaceTranslator.t("play.sort.files.bucket.cssNote"),
        },
        {
          id: "js",
          label: interfaceTranslator.t("play.sort.files.bucket.js"),
          note: interfaceTranslator.t("play.sort.files.bucket.jsNote"),
        },
      ],
      items: [
        {
          id: "add-a-line",
          label: interfaceTranslator.t("play.sort.files.addLine"),
          detail: interfaceTranslator.t("play.sort.files.addLineDetail"),
          bucketId: "html",
          why: interfaceTranslator.t("play.sort.files.addLineWhy"),
          tempting: {
            bucketId: "css",
            whyNot: interfaceTranslator.t("play.sort.files.addLineNot"),
          },
        },
        {
          id: "rename-button",
          label: interfaceTranslator.t("play.sort.files.renameButton"),
          detail: interfaceTranslator.t("play.sort.files.renameButtonDetail"),
          bucketId: "html",
          why: interfaceTranslator.t("play.sort.files.renameButtonWhy"),
          tempting: {
            bucketId: "js",
            whyNot: interfaceTranslator.t("play.sort.files.renameButtonNot"),
          },
        },
        {
          id: "darker-button",
          label: interfaceTranslator.t("play.sort.files.darkerButton"),
          detail: interfaceTranslator.t("play.sort.files.darkerButtonDetail"),
          bucketId: "css",
          why: interfaceTranslator.t("play.sort.files.darkerButtonWhy"),
          tempting: {
            bucketId: "html",
            whyNot: interfaceTranslator.t("play.sort.files.darkerButtonNot"),
          },
        },
        {
          id: "wider-gap",
          label: interfaceTranslator.t("play.sort.files.widerGap"),
          detail: interfaceTranslator.t("play.sort.files.widerGapDetail"),
          bucketId: "css",
          why: interfaceTranslator.t("play.sort.files.widerGapWhy"),
          tempting: {
            bucketId: "html",
            whyNot: interfaceTranslator.t("play.sort.files.widerGapNot"),
          },
        },
        {
          id: "message-after-click",
          label: interfaceTranslator.t("play.sort.files.messageAfterClick"),
          detail: interfaceTranslator.t("play.sort.files.messageAfterClickDetail"),
          bucketId: "js",
          why: interfaceTranslator.t("play.sort.files.messageAfterClickWhy"),
          tempting: {
            bucketId: "html",
            whyNot: interfaceTranslator.t("play.sort.files.messageAfterClickNot"),
          },
        },
        {
          id: "disable-until-picked",
          label: interfaceTranslator.t("play.sort.files.disableUntilPicked"),
          detail: interfaceTranslator.t("play.sort.files.disableUntilPickedDetail"),
          bucketId: "js",
          why: interfaceTranslator.t("play.sort.files.disableUntilPickedWhy"),
          tempting: {
            bucketId: "css",
            whyNot: interfaceTranslator.t("play.sort.files.disableUntilPickedNot"),
          },
        },
      ],
    },
  ];
}

/**
 * The fourth bucket the challenge tier adds: 「这三层都不管」.
 *
 * Not a distractor. A learner who has just learned that a page is three files
 * will try to file everything into one of them, and the useful next thing to
 * know is that some changes are none of the three — the model this page
 * downloads is not markup, not a colour, and not a click handler. The engine
 * refuses an always-empty bucket for the same reason, so the tier that adds
 * this bucket also adds the item that belongs in it.
 */
export function getSortElsewhereBucket() {
  return {
    id: "elsewhere",
    label: interfaceTranslator.t("play.sort.files.bucket.elsewhere"),
    note: interfaceTranslator.t("play.sort.files.bucket.elsewhereNote"),
  };
}

export function getSortElsewhereItem() {
  return {
    id: "swap-the-model",
    label: interfaceTranslator.t("play.sort.files.swapModel"),
    detail: interfaceTranslator.t("play.sort.files.swapModelDetail"),
    bucketId: "elsewhere",
    why: interfaceTranslator.t("play.sort.files.swapModelWhy"),
    tempting: { bucketId: "js", whyNot: interfaceTranslator.t("play.sort.files.swapModelNot") },
  } as const;
}
