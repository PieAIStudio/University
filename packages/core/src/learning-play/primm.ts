import type { z } from "zod";
import type { PrimmPayloadSchema } from "../domain/schemas.js";
import { isSortComplete, isValidSortActivity, placeSortItem, type SortState } from "./sort.js";
import type { ActivityBase } from "./types.js";

export const PRIMM_PHASES = ["predict", "run", "investigate", "modify", "make"] as const;
export type PrimmPhase = (typeof PRIMM_PHASES)[number];
export type PrimmPayload = z.infer<typeof PrimmPayloadSchema>;
/** Version 3: a sequence of one-action steps inside the five fixed phases. */
export type PrimmStepsPayload = Extract<PrimmPayload, { experienceVersion: 3 }>;
/** Versions 1–2: one screen per phase with fixed fields. */
export type PrimmClassicPayload = Exclude<PrimmPayload, { experienceVersion: 3 }>;
export type PrimmActivity = ActivityBase & PrimmPayload & { readonly kind: "primm" };
export type PrimmStepsActivity = ActivityBase & PrimmStepsPayload & { readonly kind: "primm" };
export type PrimmClassicActivity = ActivityBase & PrimmClassicPayload & { readonly kind: "primm" };
export type PrimmStep = PrimmStepsPayload["steps"][number];
export type PrimmStepOf<K extends PrimmStep["kind"]> = Extract<PrimmStep, { kind: K }>;
export type PrimmSource = PrimmPayload["sources"][number];
export type PrimmMaterial = PrimmPayload["materials"][number];
export type PrimmOperation = PrimmPayload["starter"]["operation"];
export type PrimmGame = PrimmClassicPayload["investigate"]["game"];

export function isPrimmSteps<T extends PrimmPayload>(
  payload: T,
): payload is Extract<T, { experienceVersion: 3 }> {
  return payload.experienceVersion === 3;
}
export type PrimmInspectImageGame = Extract<PrimmGame, { kind: "inspect-image" }>;
export type PrimmSortGame = Extract<PrimmGame, { kind: "sort" }>;
export type PrimmLayoutGame = Extract<PrimmGame, { kind: "layout" }>;
export type PrimmEditGame = Extract<PrimmGame, { kind: "edit" }>;
export type PrimmCollectGame = Extract<PrimmGame, { kind: "collect" }>;
export type PrimmCheckResultGame = Extract<PrimmGame, { kind: "check-result" }>;
export const PRIMM_CHECK_JUDGMENTS = ["kept", "changed", "missing"] as const;
export type PrimmCheckJudgment = (typeof PRIMM_CHECK_JUDGMENTS)[number];

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
  for (const id of payload.intro.sourceIds ?? []) {
    if (!payload.sources.some((source) => source.id === id))
      issues.push(`Unknown PRIMM introduction source: ${id}`);
  }
  for (const material of payload.materials) {
    if (material.sourceId && !payload.sources.some((source) => source.id === material.sourceId))
      issues.push(`Unknown PRIMM material source: ${material.sourceId}`);
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
  if (isPrimmSteps(payload)) return [...issues, ...primmStepIssues(payload)];
  unique("prediction", payload.predict.options);
  if (payload.experienceVersion === 2) {
    if (!payload.run.attachmentLabel || !payload.modify.workbench || !payload.make.artifactLabel)
      issues.push(
        "Everyday PRIMM requires attachment, request-building and independent-artifact operations",
      );
    if (payload.modify.workbench) unique("request piece", payload.modify.workbench.pieces);
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
      for (const answer of game.answers ?? [])
        if (
          answer.length !== game.items.length ||
          new Set(answer).size !== answer.length ||
          !answer.every((id) => game.items.some((item) => item.id === id))
        )
          issues.push("A PRIMM layout answer must order every item exactly once");
      break;
    case "edit":
      unique("sentence", game.sentences);
      if (!game.sentences.some((sentence) => sentence.id === game.targetId))
        issues.push(`Unknown PRIMM edit target: ${game.targetId}`);
      break;
    case "check-result":
      unique("check item", game.items);
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

const invalidRegion = (region: { x: number; y: number; width: number; height: number }) =>
  ![region.x, region.y, region.width, region.height].every(Number.isFinite) ||
  region.x < 0 ||
  region.y < 0 ||
  region.width <= 0 ||
  region.height <= 0 ||
  region.x + region.width > 1 ||
  region.y + region.height > 1;

/** The fixed frame: five phases in order, one to four steps each, exactly one
 * real run in Run and in Modify and one independent task in Make. Everything
 * else about a phase — how many steps and which kinds — is the lesson's choice. */
function primmStepIssues(payload: PrimmStepsPayload): string[] {
  const issues: string[] = [];
  const steps = payload.steps;
  const requests = payload.requests ?? [];
  if (repeated(steps.map((step) => step.id))) issues.push("Duplicate PRIMM step ID");
  if (repeated(requests.map((request) => request.id))) issues.push("Duplicate PRIMM request ID");
  const reserved = new Set(["starter", "chosen", "built"]);
  for (const request of requests) {
    if (reserved.has(request.id)) issues.push(`Reserved PRIMM request ID: ${request.id}`);
    if (request.prompt.trim() === payload.starter.prompt.trim())
      issues.push(`PRIMM request repeats the starter: ${request.id}`);
  }
  if (repeated(requests.map((request) => request.prompt.trim())))
    issues.push("Duplicate PRIMM request prompt");
  const known = new Set(["starter", ...requests.map((request) => request.id)]);
  const assets = new Set([...payload.starter.assetIds, ...payload.make.assetIds]);
  const counts = PRIMM_PHASES.map(() => 0);
  let phaseIndex = 0;
  let firstRun = -1;
  for (const [index, step] of steps.entries()) {
    const current = PRIMM_PHASES.indexOf(step.phase);
    if (current < phaseIndex) issues.push(`PRIMM step out of phase order: ${step.id}`);
    phaseIndex = Math.max(phaseIndex, current);
    counts[current]!++;
    const before = steps.slice(0, index);
    if (step.kind === "send" && firstRun < 0) firstRun = index;
    switch (step.kind) {
      case "choose":
        if (repeated(step.options.map((option) => option.id)))
          issues.push(`Duplicate PRIMM option ID: ${step.id}`);
        for (const option of step.options)
          if (option.requestId && !known.has(option.requestId))
            issues.push(`Unknown PRIMM request: ${option.requestId}`);
        if (step.answerId && !step.options.some((option) => option.id === step.answerId))
          issues.push(`Unknown PRIMM answer: ${step.id}`);
        break;
      case "send": {
        if (step.request === "chosen") {
          const choice = before.find(
            (earlier): earlier is PrimmStepOf<"choose"> =>
              earlier.kind === "choose" && earlier.phase === "predict",
          );
          if (step.phase !== "run" || !choice?.options.every((option) => option.requestId))
            issues.push(`PRIMM chosen request needs a Predict choice of requests: ${step.id}`);
        } else if (step.request === "built") {
          if (!before.some((earlier) => earlier.kind === "build" && earlier.phase === step.phase))
            issues.push(`PRIMM built request needs an earlier build: ${step.id}`);
        } else if (!known.has(step.request)) issues.push(`Unknown PRIMM request: ${step.request}`);
        for (const debrief of step.debriefs ?? [])
          if (!known.has(debrief.requestId))
            issues.push(`Unknown PRIMM debrief request: ${debrief.requestId}`);
        break;
      }
      case "find":
        if (!before.some((earlier) => earlier.kind === "send"))
          issues.push(`PRIMM find needs an earlier real run: ${step.id}`);
        break;
      case "match":
        if (repeated(step.requestIds)) issues.push(`Duplicate PRIMM match request: ${step.id}`);
        for (const id of step.requestIds)
          if (!known.has(id)) issues.push(`Unknown PRIMM request: ${id}`);
        break;
      case "sort":
        if (!isValidSortActivity({ buckets: step.buckets, items: step.cards }))
          issues.push(`Invalid PRIMM sort buckets/card mappings: ${step.id}`);
        break;
      case "point":
        if (repeated(step.regions.map((region) => region.id)))
          issues.push(`Duplicate PRIMM region ID: ${step.id}`);
        for (const region of step.regions)
          if (invalidRegion(region)) issues.push(`Invalid normalized PRIMM region: ${region.id}`);
        if (!step.regions.some((region) => region.id === step.targetId))
          issues.push(`Unknown PRIMM point target: ${step.targetId}`);
        if (!assets.has(step.assetId)) issues.push(`PRIMM point image is not an input: ${step.id}`);
        break;
      case "build": {
        const pieces = new Set(step.pieces.map((piece) => piece.id));
        if (pieces.size !== step.pieces.length) issues.push(`Duplicate PRIMM piece ID: ${step.id}`);
        for (const answer of step.answers)
          if (repeated(answer) || answer.some((id) => !pieces.has(id)))
            issues.push(`Invalid PRIMM build answer: ${step.id}`);
        if (repeated(step.answers.map((answer) => answer.join(" "))))
          issues.push(`Duplicate PRIMM build answer: ${step.id}`);
        break;
      }
      case "make":
        break;
    }
  }
  PRIMM_PHASES.forEach((phase, index) => {
    if (counts[index]! < 1 || counts[index]! > 4)
      issues.push(`PRIMM ${phase} needs one to four steps`);
  });
  for (const phase of ["run", "modify"] as const)
    if (steps.filter((step) => step.kind === "send" && step.phase === phase).length !== 1)
      issues.push(`PRIMM ${phase} needs exactly one real run`);
  const makes = steps.filter((step) => step.kind === "make");
  if (makes.length !== 1 || steps.find((step) => step.phase === "make")?.kind !== "make")
    issues.push("PRIMM make opens with exactly one independent task");
  if (firstRun < 0 || steps.findIndex((step) => step.kind === "match") > -1)
    for (const [index, step] of steps.entries())
      if (step.kind === "match" && index < firstRun)
        issues.push(`PRIMM match needs an earlier real run: ${step.id}`);
  return issues;
}

/** Every text the Run phase may execute: the starter, and a step lesson's
 * authored requests. Anything else is learner text and belongs to Modify or Make. */
export function primmRunPrompts(payload: PrimmPayload): string[] {
  return [
    payload.starter.prompt,
    ...(isPrimmSteps(payload) ? (payload.requests ?? []).map((request) => request.prompt) : []),
  ];
}

/** The exact prepared text of a request the lesson allows to run. */
export function primmRequestPrompt(payload: PrimmStepsPayload, requestId: string) {
  if (requestId === "starter") return payload.starter.prompt;
  return payload.requests?.find((request) => request.id === requestId)?.prompt;
}

/** Sentences of a live result, without Markdown emphasis, for tapping. */
export function primmSentences(text: string): string[] {
  return text
    .replace(/\*\*|__|`/g, "")
    .split(/(?<=[。！？])|(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.replace(/[\s#>*\-\d.、，,：:]/g, "").length > 1);
}

/** Which sentences mention any authored term; empty when this run did not. */
export function primmSentencesMentioning(sentences: readonly string[], terms: readonly string[]) {
  const needles = terms.map((term) => term.trim().toLowerCase()).filter(Boolean);
  return sentences.flatMap((sentence, index) =>
    needles.some((needle) => sentence.toLowerCase().includes(needle)) ? [index] : [],
  );
}

const cjk = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;
/** Chinese pieces join as written; words in other scripts need a space between them. */
export function joinPrimmPieces(texts: readonly string[]): string {
  return texts.reduce((joined, text) => {
    if (!joined) return text;
    const gap = cjk.test(joined.at(-1)!) || cjk.test(text[0] ?? "") ? "" : " ";
    return joined + gap + text;
  }, "");
}

export type PrimmBuildVerdict =
  | { readonly ok: true; readonly prompt: string }
  | { readonly ok: false; readonly reason: "extra"; readonly pieceId: string }
  | { readonly ok: false; readonly reason: "missing" | "order" };

/** A built request passes when it equals an authored answer; a piece outside
 * every answer is named, so its own reason can be shown. */
export function primmBuildVerdict(
  step: PrimmStepOf<"build">,
  pieceIds: readonly string[],
): PrimmBuildVerdict {
  const text = (ids: readonly string[]) =>
    joinPrimmPieces(ids.map((id) => step.pieces.find((piece) => piece.id === id)?.text ?? ""));
  if (step.answers.some((answer) => answer.join(" ") === pieceIds.join(" ")))
    return { ok: true, prompt: text(pieceIds) };
  const used = new Set(step.answers.flat());
  const extra = pieceIds.find((id) => !used.has(id));
  if (extra) return { ok: false, reason: "extra", pieceId: extra };
  const sameSet = step.answers.some(
    (answer) => answer.length === pieceIds.length && answer.every((id) => pieceIds.includes(id)),
  );
  return { ok: false, reason: sameSet ? "order" : "missing" };
}

/** Every prediction is allowed to continue; it is not an independently graded answer. */
export function canContinuePrimmPrediction(
  predict: PrimmClassicPayload["predict"],
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
  | { readonly kind: "layout"; readonly itemIds: readonly string[]; readonly formatId: string }
  | { readonly kind: "edit"; readonly targetId: string; readonly replacement: string }
  | { readonly kind: "collect"; readonly decisions: Readonly<Record<string, boolean>> }
  | { readonly kind: "check-result"; readonly judgments: Readonly<Record<string, string>> };

type LayoutGame = Extract<PrimmGame, { readonly kind: "layout" }>;
type EditGame = Extract<PrimmGame, { readonly kind: "edit" }>;

/** With accepted orders only one of them completes the layout; without, any full order does. */
export function layoutOrderAccepted(game: LayoutGame, itemIds: readonly string[]): boolean {
  if (!game.answers?.length) return true;
  return game.answers.some(
    (answer) => answer.length === itemIds.length && answer.every((id, i) => itemIds[i] === id),
  );
}

/**
 * The first item standing where the nearest accepted order does not put it.
 * Feedback names one item without revealing the whole order.
 */
export function layoutMisplacedItem(game: LayoutGame, itemIds: readonly string[]): string | null {
  if (!game.answers?.length || layoutOrderAccepted(game, itemIds)) return null;
  let nearest = game.answers[0]!;
  let matched = -1;
  for (const answer of game.answers) {
    const score = answer.filter((id, i) => itemIds[i] === id).length;
    if (score > matched) {
      nearest = answer;
      matched = score;
    }
  }
  const index = itemIds.findIndex((id, i) => nearest[i] !== id);
  return index === -1 ? null : itemIds[index]!;
}

/** With required ideas, the rewrite must name at least one of them. */
export function editMentionsRequired(game: EditGame, text: string): boolean {
  if (!game.mustMention?.length) return true;
  const lower = text.toLowerCase();
  return game.mustMention.some((term) => lower.includes(term.toLowerCase()));
}

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
      game.formats.some((format) => format.id === state.formatId) &&
      layoutOrderAccepted(game, state.itemIds)
    );
  if (game.kind === "edit" && state.kind === game.kind) {
    const target = game.sentences.find((sentence) => sentence.id === game.targetId);
    return (
      !!target &&
      state.targetId === target.id &&
      !!state.replacement.trim() &&
      state.replacement.trim() !== target.text.trim() &&
      editMentionsRequired(game, state.replacement)
    );
  }
  // Every item judged. There is no answer key: the live result differs per run.
  if (game.kind === "check-result" && state.kind === game.kind)
    return game.items.every((item) =>
      (PRIMM_CHECK_JUDGMENTS as readonly string[]).includes(state.judgments[item.id] ?? ""),
    );
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
