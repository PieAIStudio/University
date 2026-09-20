import {
  emptyInvestigation,
  investigationComplete,
  type InvestigationDraft,
} from "./PrimmInvestigate.js";
import type { PrimmClassicActivity, PrimmEvaluation, PrimmWork } from "./primm-types.js";

export interface PrimmSession {
  readonly attached: boolean;
  readonly fragments: readonly { id: string; text: string }[];
  readonly stage: number;
  readonly prediction: string;
  readonly investigation: InvestigationDraft;
  readonly modifyPrompt: string;
  readonly makePrompt: string;
  readonly run: PrimmWork | null;
  readonly modify: PrimmWork | null;
  readonly make: PrimmWork | null;
  readonly evaluation: PrimmEvaluation | null;
}
export function initialPrimmSession(activity: PrimmClassicActivity): PrimmSession {
  return {
    attached: false,
    fragments: [{ id: "starter", text: activity.starter.prompt }],
    stage: 0,
    prediction: "",
    investigation: emptyInvestigation(),
    modifyPrompt: activity.starter.prompt,
    makePrompt: "",
    run: null,
    modify: null,
    make: null,
    evaluation: null,
  };
}
function isWork(value: unknown): value is PrimmWork {
  if (!value || typeof value !== "object") return false;
  const work = value as PrimmWork;
  return (
    typeof work.request?.prompt === "string" &&
    work.result?.prompt === work.request.prompt &&
    work.result?.kind === "live" &&
    typeof work.result.text === "string" &&
    !!work.result.text.trim() &&
    typeof work.result.requestId === "string" &&
    typeof work.result.model === "string" &&
    typeof work.result.createdAt === "string" &&
    Array.isArray(work.result.sourceIds)
  );
}
/** Drafts restore work, never trust an arbitrary saved stage number as evidence. */
export function restorePrimmSession(activity: PrimmClassicActivity, answer: string): PrimmSession {
  const initial = initialPrimmSession(activity);
  try {
    const saved = JSON.parse(answer) as PrimmSession;
    if (
      !saved ||
      typeof saved.modifyPrompt !== "string" ||
      typeof saved.makePrompt !== "string" ||
      !saved.investigation
    )
      return initial;
    const investigation = saved.investigation;
    if (
      typeof investigation.selected !== "string" ||
      typeof investigation.observation !== "string" ||
      typeof investigation.edited !== "string" ||
      typeof investigation.format !== "string" ||
      !Array.isArray(investigation.order) ||
      !investigation.placed ||
      !investigation.decisions
    )
      return initial;
    const game = activity.investigate.game;
    if (
      saved.fragments !== undefined &&
      (!Array.isArray(saved.fragments) ||
        saved.fragments.length > 12 ||
        saved.fragments.some(
          (item) =>
            !item ||
            typeof item.id !== "string" ||
            typeof item.text !== "string" ||
            item.text.length > 2000,
        ) ||
        new Set(saved.fragments.map((item) => item.id)).size !== saved.fragments.length)
    )
      return initial;
    const dictionary = (value: unknown): value is Record<string, unknown> =>
      !!value && typeof value === "object" && !Array.isArray(value);
    if (
      saved.modifyPrompt.length > 2000 ||
      saved.makePrompt.length > 2000 ||
      investigation.observation.length > 2000 ||
      investigation.edited.length > 8000 ||
      !dictionary(investigation.placed) ||
      !dictionary(investigation.decisions) ||
      !Object.values(investigation.placed).every((value) => typeof value === "string") ||
      !Object.values(investigation.decisions).every((value) => typeof value === "boolean") ||
      !investigation.order.every((value) => typeof value === "string")
    )
      return initial;
    if (
      game.kind === "layout" &&
      investigation.order.length &&
      (investigation.order.length !== game.items.length ||
        new Set(investigation.order).size !== game.items.length ||
        investigation.order.some((id) => !game.items.some((item) => item.id === id)))
    )
      return initial;
    const run =
      isWork(saved.run) &&
      saved.run.request.prompt === activity.starter.prompt &&
      (activity.experienceVersion !== 2 || saved.attached === true)
        ? saved.run
        : null;
    const modify =
      isWork(saved.modify) &&
      (!activity.modify.workbench ||
        (saved.fragments ?? initial.fragments)
          .map((piece) => piece.text.trim())
          .filter(Boolean)
          .join("\n") === saved.modifyPrompt) &&
      saved.modify.request.prompt === saved.modifyPrompt &&
      saved.modifyPrompt.trim() !== activity.starter.prompt.trim()
        ? saved.modify
        : null;
    const make =
      isWork(saved.make) && saved.make.request.prompt === saved.makePrompt ? saved.make : null;
    // A cached grade is only display recovery. Re-check it through the native seam before ending.
    const evaluation =
      make &&
      saved.evaluation &&
      ["pass", "fail", "undecided"].includes(saved.evaluation.outcome) &&
      typeof saved.evaluation.explanation === "string"
        ? { ...saved.evaluation, outcome: "undecided" as const }
        : null;
    let max = activity.predict.options.some((o) => o.id === saved.prediction) ? 1 : 0;
    if (max === 1 && run) max = 2;
    if (max === 2 && investigationComplete(activity, investigation)) max = 3;
    if (max === 3 && modify) max = 4;
    return {
      ...initial,
      ...saved,
      attached: saved.attached === true,
      fragments: saved.fragments ?? initial.fragments,
      modifyPrompt: activity.modify.workbench
        ? (saved.fragments ?? initial.fragments)
            .map((piece) => piece.text.trim())
            .filter(Boolean)
            .join("\n")
        : saved.modifyPrompt,
      stage: Math.min(Number.isInteger(saved.stage) ? Math.max(0, saved.stage) : 0, max),
      run,
      modify,
      make,
      evaluation,
    };
  } catch {
    return initial;
  }
}
