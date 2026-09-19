import type { z } from "zod";
import type { PrimmPayloadSchema } from "../domain/schemas.js";
import { isSortComplete, isValidSortActivity, placeSortItem, type SortState } from "./sort.js";
import type { ActivityBase } from "./types.js";

export const PRIMM_PHASES = ["predict", "run", "investigate", "modify", "make"] as const;
export type PrimmPhase = (typeof PRIMM_PHASES)[number];
export type PrimmPayload = z.infer<typeof PrimmPayloadSchema>;
export type PrimmActivity = ActivityBase & PrimmPayload & { readonly kind: "primm" };
export type PrimmSource = PrimmPayload["sources"][number];
export type PrimmMaterial = PrimmPayload["materials"][number];
export type PrimmOperation = PrimmPayload["starter"]["operation"];
export type PrimmGame = PrimmPayload["investigate"]["game"];
export type PrimmInspectImageGame = Extract<PrimmGame, { kind: "inspect-image" }>;
export type PrimmSortGame = Extract<PrimmGame, { kind: "sort" }>;
export type PrimmLayoutGame = Extract<PrimmGame, { kind: "layout" }>;
export type PrimmEditGame = Extract<PrimmGame, { kind: "edit" }>;
export type PrimmCollectGame = Extract<PrimmGame, { kind: "collect" }>;

const repeated = (ids: readonly string[]) => new Set(ids).size !== ids.length;
const sorting = (game: PrimmSortGame) => ({ buckets: game.buckets, items: game.cards });

/** Structural/reference validity only; these checks cannot establish learning. */
export function primmIssues(payload: PrimmPayload): string[] {
  const issues: string[] = [];
  const unique = (name: string, values: readonly { id: string }[]) => {
    if (repeated(values.map((value) => value.id))) issues.push(`Duplicate PRIMM ${name} ID`);
  };
  unique("source", payload.sources);
  unique("material", payload.materials);
  unique("prediction", payload.predict.options);
  for (const id of payload.intro.sourceIds ?? []) {
    if (!payload.sources.some((source) => source.id === id))
      issues.push(`Unknown PRIMM introduction source: ${id}`);
  }
  for (const material of payload.materials) {
    if (material.sourceId && !payload.sources.some((source) => source.id === material.sourceId))
      issues.push(`Unknown PRIMM material source: ${material.sourceId}`);
  }
  if (payload.experienceVersion === 2) {
    if (!payload.run.attachmentLabel || !payload.modify.workbench || !payload.make.artifactLabel)
      issues.push(
        "Everyday PRIMM requires attachment, request-building and independent-artifact operations",
      );
    if (payload.modify.workbench) unique("request piece", payload.modify.workbench.pieces);
  }
  for (const [name, input] of [
    ["starter", payload.starter],
    ["make", payload.make],
  ] as const) {
    if (repeated(input.materialIds) || repeated(input.assetIds))
      issues.push(`Duplicate PRIMM ${name} input reference`);
    if (!input.materialIds.length) issues.push(`PRIMM ${name} needs source-bound material`);
    for (const id of input.materialIds) {
      if (!payload.materials.some((material) => material.id === id))
        issues.push(`Unknown PRIMM ${name} material: ${id}`);
    }
  }
  for (const source of payload.sources) {
    if ("url" in source.reference && !/^https?:\/\//i.test(source.reference.url))
      issues.push(`PRIMM source needs an HTTP(S) URL: ${source.id}`);
  }
  const game = payload.investigate.game;
  switch (game.kind) {
    case "inspect-image":
      unique("region", game.regions);
      for (const region of game.regions) {
        if (
          ![region.x, region.y, region.width, region.height].every(Number.isFinite) ||
          region.x < 0 ||
          region.y < 0 ||
          region.width <= 0 ||
          region.height <= 0 ||
          region.x + region.width > 1 ||
          region.y + region.height > 1
        )
          issues.push(`Invalid normalized PRIMM region: ${region.id}`);
      }
      break;
    case "sort":
      if (!isValidSortActivity(sorting(game)))
        issues.push("Invalid PRIMM sort buckets/card mappings");
      break;
    case "layout":
      unique("layout item", game.items);
      unique("layout format", game.formats);
      if (
        game.selection &&
        (game.items.some((item) => typeof item.relevant !== "boolean" || !item.why?.trim()) ||
          !game.items.some((item) => item.relevant) ||
          !game.items.some((item) => item.relevant === false))
      )
        issues.push("PRIMM selected layout needs explained relevant and irrelevant items");
      break;
    case "edit":
      unique("sentence", game.sentences);
      if (!game.sentences.some((sentence) => sentence.id === game.targetId))
        issues.push(`Unknown PRIMM edit target: ${game.targetId}`);
      break;
    case "collect":
      unique("collector card", game.cards);
      if (!game.cards.some((card) => card.relevant) || !game.cards.some((card) => !card.relevant))
        issues.push("PRIMM collector needs both relevant records and distractors");
      for (const card of game.cards) {
        if (!payload.sources.some((source) => source.id === card.sourceId))
          issues.push(`Unknown PRIMM collector source: ${card.sourceId}`);
      }
  }
  return issues;
}

/** Every prediction is allowed to continue; it is not an independently graded answer. */
export function canContinuePrimmPrediction(
  predict: PrimmPayload["predict"],
  optionId: string,
): boolean {
  return predict.options.some((option) => option.id === optionId);
}

export function placePrimmSortCard(
  game: PrimmSortGame,
  state: SortState,
  cardId: string,
  bucketId: string,
) {
  return placeSortItem(sorting(game), state, cardId, bucketId);
}

export type PrimmGameState =
  | { readonly kind: "inspect-image"; readonly selectedRegionIds: readonly string[] }
  | { readonly kind: "sort"; readonly placed: Readonly<Record<string, string>> }
  | {
      readonly kind: "layout";
      readonly itemIds: readonly string[];
      readonly formatId: string;
      readonly includedItemIds?: readonly string[];
    }
  | { readonly kind: "edit"; readonly targetId: string; readonly replacement: string }
  | { readonly kind: "collect"; readonly decisions: Readonly<Record<string, boolean>> };

/** Checks the current manipulation, never a grade, click count or past successful state. */
export function isPrimmGameComplete(game: PrimmGame, state: PrimmGameState): boolean {
  if (game.kind === "inspect-image" && state.kind === game.kind)
    return (
      state.selectedRegionIds.length > 0 &&
      !repeated(state.selectedRegionIds) &&
      state.selectedRegionIds.every((id) => game.regions.some((region) => region.id === id))
    );
  if (game.kind === "sort" && state.kind === game.kind)
    return (
      Object.keys(state.placed).length === game.cards.length &&
      isSortComplete(sorting(game), { placed: state.placed, misses: 0 })
    );
  if (game.kind === "layout" && state.kind === game.kind)
    return (
      state.itemIds.length === game.items.length &&
      !repeated(state.itemIds) &&
      state.itemIds.every((id) => game.items.some((item) => item.id === id)) &&
      (!game.selection ||
        (!!state.includedItemIds &&
          !repeated(state.includedItemIds) &&
          state.includedItemIds.every((id) => game.items.some((item) => item.id === id)) &&
          game.items.every(
            (item) => state.includedItemIds!.includes(item.id) === item.relevant,
          ))) &&
      game.formats.some((format) => format.id === state.formatId)
    );
  if (game.kind === "edit" && state.kind === game.kind) {
    const target = game.sentences.find((sentence) => sentence.id === game.targetId);
    return (
      !!target &&
      state.targetId === target.id &&
      !!state.replacement.trim() &&
      state.replacement.trim() !== target.text.trim()
    );
  }
  if (game.kind === "collect" && state.kind === game.kind)
    return (
      Object.keys(state.decisions).length === game.cards.length &&
      game.cards.every(
        (card) =>
          Object.hasOwn(state.decisions, card.id) && state.decisions[card.id] === card.relevant,
      )
    );
  return false;
}
