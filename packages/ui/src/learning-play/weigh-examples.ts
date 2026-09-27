import type { WeighActivity, WeighOption, WeighSituation } from "@pieai/university-core";

import { interfaceTranslator } from "../i18n/index.js";

/**
 * The lab's `weigh` fixture: how much of a project to read before changing it.
 *
 * 决策 is 104 of this catalogue's 469 lessons and had no shape at all — the
 * README says so in as many words, and says why `dispatch` is not it: dispatch
 * is spending a budget, not 「what this choice buys, what it costs, and when it
 * reverses」.
 *
 * The board is built so no option is the good one. 「只读那一块」 wins twice and
 * loses twice; the third option the challenge tier adds wins once and is then
 * shown failing too. A reader who finds a rule like 「always read everything」
 * here has found something the board does not contain.
 */
function options(): Readonly<Record<string, WeighOption>> {
  return {
    piece: {
      id: "piece",
      label: interfaceTranslator.t("play.weigh.reading.piece"),
      note: interfaceTranslator.t("play.weigh.reading.pieceNote"),
    },
    whole: {
      id: "whole",
      label: interfaceTranslator.t("play.weigh.reading.whole"),
      note: interfaceTranslator.t("play.weigh.reading.wholeNote"),
    },
    ask: {
      id: "ask",
      label: interfaceTranslator.t("play.weigh.reading.ask"),
      note: interfaceTranslator.t("play.weigh.reading.askNote"),
    },
  };
}

/**
 * What each losing choice would have cost, per situation.
 *
 * Every option is priced, including `ask`, which only the challenge tier puts
 * on the board — the same situation object serves both tiers, and a cost for an
 * option this board does not offer simply never renders.
 */
function costs(): Readonly<Record<string, Readonly<Record<string, string>>>> {
  const t = (key: string) => interfaceTranslator.t(key as never);
  return {
    button: {
      whole: t("play.weigh.reading.buttonCost"),
      ask: t("play.weigh.reading.buttonCostAsk"),
    },
    crash: {
      piece: t("play.weigh.reading.crashCost"),
      ask: t("play.weigh.reading.crashCostAsk"),
    },
    rename: {
      piece: t("play.weigh.reading.renameCost"),
      ask: t("play.weigh.reading.renameCostAsk"),
    },
    newPage: {
      whole: t("play.weigh.reading.newPageCost"),
      ask: t("play.weigh.reading.newPageCostAsk"),
    },
    firstDay: {
      piece: t("play.weigh.reading.firstDayCost"),
      whole: t("play.weigh.reading.firstDayCostWhole"),
    },
    nobody: {
      piece: t("play.weigh.reading.nobodyCost"),
      ask: t("play.weigh.reading.nobodyCostAsk"),
    },
  };
}

function situations(): Readonly<Record<string, WeighSituation>> {
  const cost = costs();
  return {
    button: {
      id: "button",
      label: interfaceTranslator.t("play.weigh.reading.button"),
      detail: interfaceTranslator.t("play.weigh.reading.buttonDetail"),
      bestOptionId: "piece",
      why: interfaceTranslator.t("play.weigh.reading.buttonWhy"),
      costOfOther: cost.button!,
    },
    crash: {
      id: "crash",
      label: interfaceTranslator.t("play.weigh.reading.crash"),
      detail: interfaceTranslator.t("play.weigh.reading.crashDetail"),
      bestOptionId: "whole",
      why: interfaceTranslator.t("play.weigh.reading.crashWhy"),
      costOfOther: cost.crash!,
    },
    rename: {
      id: "rename",
      label: interfaceTranslator.t("play.weigh.reading.rename"),
      detail: interfaceTranslator.t("play.weigh.reading.renameDetail"),
      bestOptionId: "whole",
      why: interfaceTranslator.t("play.weigh.reading.renameWhy"),
      costOfOther: cost.rename!,
    },
    newPage: {
      id: "newPage",
      label: interfaceTranslator.t("play.weigh.reading.newPage"),
      detail: interfaceTranslator.t("play.weigh.reading.newPageDetail"),
      bestOptionId: "piece",
      why: interfaceTranslator.t("play.weigh.reading.newPageWhy"),
      costOfOther: cost.newPage!,
    },
    firstDay: {
      id: "firstDay",
      label: interfaceTranslator.t("play.weigh.reading.firstDay"),
      detail: interfaceTranslator.t("play.weigh.reading.firstDayDetail"),
      bestOptionId: "ask",
      why: interfaceTranslator.t("play.weigh.reading.firstDayWhy"),
      costOfOther: cost.firstDay!,
    },
    nobody: {
      id: "nobody",
      label: interfaceTranslator.t("play.weigh.reading.nobody"),
      detail: interfaceTranslator.t("play.weigh.reading.nobodyDetail"),
      bestOptionId: "whole",
      why: interfaceTranslator.t("play.weigh.reading.nobodyWhy"),
      costOfOther: cost.nobody!,
    },
  };
}

export function getWeighOptions() {
  return options();
}
export function getWeighSituations() {
  return situations();
}

export function getWeighExamples(): readonly WeighActivity[] {
  const option = options();
  const situation = situations();
  return [
    {
      id: "weigh-how-much-to-read",
      kind: "weigh",
      title: interfaceTranslator.t("play.weigh.reading.title"),
      brief: interfaceTranslator.t("play.weigh.reading.brief"),
      goal: interfaceTranslator.t("play.weigh.reading.goal"),
      takeaway: interfaceTranslator.t("play.weigh.reading.takeaway"),
      hint: interfaceTranslator.t("play.weigh.reading.hint"),
      source: {
        label: interfaceTranslator.t("play.weigh.reading.source"),
        url: "https://docs.github.com/en/repositories/working-with-files/using-files/navigating-code-on-github",
      },
      question: interfaceTranslator.t("play.weigh.reading.question"),
      options: [option.piece!, option.whole!],
      situations: [situation.button!, situation.crash!, situation.rename!, situation.newPage!],
    },
  ];
}
