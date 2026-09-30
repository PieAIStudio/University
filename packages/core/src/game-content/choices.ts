import { displayWidth, type GameLesson } from "./rounds.js";

/**
 * Lesson content as 三岔路 rounds (ADR-0011, content layer): a situation, the
 * choices on the table, the one that wins here and what each other one would
 * cost here — projected unchanged.
 *
 * Two authored shapes carry that today. A `weigh` activity is the whole of
 * it: one board of options, several situations, a best option per situation
 * with its reason and the cost of every other. A `decision` step of an
 * `interaction-path` is one situation with its own options, each explained;
 * an activity's decision steps make one round together.
 */
export interface ChoiceOption {
  readonly id: string;
  readonly label: string;
}

export interface ChoiceItem {
  readonly id: string;
  /** The situation, read while running toward the gates. */
  readonly text: string;
  readonly detail?: string;
  readonly options: readonly ChoiceOption[];
  readonly bestId: string;
  /** Why the best option wins here, in the lesson's words. */
  readonly why: string;
  /** What each other option would cost here, keyed by option id. */
  readonly whyNot: Readonly<Record<string, string>>;
}

export interface ChoiceRound {
  /** `${lessonId}/${activityId}`. */
  readonly id: string;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly question: string;
  readonly items: readonly ChoiceItem[];
}

/** A gate carries one option: 10 CJK characters on a sign. */
export const CHOICE_OPTION_MAX_WIDTH = 20;
/** Gates side by side on a path a thumb can steer. */
export const CHOICE_MAX_OPTIONS = 3;
/** The situation is read on the run: 40 CJK characters, two lines. */
export const CHOICE_TEXT_MAX_WIDTH = 80;

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

function options(raw: unknown): ChoiceOption[] | null {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > CHOICE_MAX_OPTIONS) return null;
  const result: ChoiceOption[] = [];
  for (const option of raw) {
    if (!isObject(option)) return null;
    const id = text(option.id);
    const label = text(option.label);
    if (!id || !label || displayWidth(label) > CHOICE_OPTION_MAX_WIDTH) return null;
    result.push({ id, label });
  }
  return new Set(result.map((option) => option.label)).size === result.length ? result : null;
}

function weighRound(lesson: GameLesson, activity: Json): ChoiceRound | null {
  const activityId = text(activity.id);
  const question = text(activity.question) ?? text(activity.title);
  const board = options(activity.options);
  if (!activityId || !question || !board || !Array.isArray(activity.situations)) return null;
  const items = activity.situations.flatMap((situation): ChoiceItem[] => {
    if (!isObject(situation)) return [];
    const id = text(situation.id);
    const label = text(situation.label);
    const bestId = text(situation.bestOptionId);
    const why = text(situation.why);
    const costs = isObject(situation.costOfOther) ? situation.costOfOther : null;
    if (!id || !label || !bestId || !why || !costs) return [];
    if (displayWidth(label) > CHOICE_TEXT_MAX_WIDTH) return [];
    if (!board.some((option) => option.id === bestId)) return [];
    const whyNot: Record<string, string> = {};
    for (const option of board) {
      if (option.id === bestId) continue;
      const cost = text(costs[option.id]);
      if (!cost) return [];
      whyNot[option.id] = cost;
    }
    const detail = text(situation.detail);
    return [
      { id, text: label, ...(detail ? { detail } : {}), options: board, bestId, why, whyNot },
    ];
  });
  return items.length
    ? {
        id: `${lesson.id}/${activityId}`,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        question,
        items,
      }
    : null;
}

function decisionRound(lesson: GameLesson, activity: Json): ChoiceRound | null {
  const activityId = text(activity.id);
  const question = text(activity.title);
  if (!activityId || !question || !Array.isArray(activity.steps)) return null;
  const items = activity.steps.flatMap((step): ChoiceItem[] => {
    if (!isObject(step) || step.kind !== "decision") return [];
    const id = text(step.id);
    const situation = text(step.question);
    const bestId = text(step.correctOptionId);
    const board = options(step.options);
    if (!id || !situation || !bestId || !board) return [];
    if (displayWidth(situation) > CHOICE_TEXT_MAX_WIDTH) return [];
    const explained = new Map<string, string>();
    for (const option of step.options as unknown[])
      if (isObject(option) && text(option.id) && text(option.explanation))
        explained.set(text(option.id)!, text(option.explanation)!);
    const why = explained.get(bestId) ?? text(step.explanation);
    if (!why || !board.some((option) => option.id === bestId)) return [];
    const whyNot: Record<string, string> = {};
    for (const option of board) {
      if (option.id === bestId) continue;
      const cost = explained.get(option.id);
      if (!cost) return [];
      whyNot[option.id] = cost;
    }
    const detail = text(step.brief);
    return [
      { id, text: situation, ...(detail ? { detail } : {}), options: board, bestId, why, whyNot },
    ];
  });
  return items.length
    ? {
        id: `${lesson.id}/${activityId}`,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        question,
        items,
      }
    : null;
}

/** Every 三岔路 round one lesson can give, in the order the lesson presents them. */
export function choiceRoundsFromLesson(lesson: GameLesson): readonly ChoiceRound[] {
  return (lesson.activities ?? []).flatMap((activity) => {
    if (!isObject(activity)) return [];
    const round =
      activity.kind === "weigh"
        ? weighRound(lesson, activity)
        : activity.kind === "interaction-path"
          ? decisionRound(lesson, activity)
          : null;
    return round ? [round] : [];
  });
}
