import { displayWidth, type GameLesson } from "./rounds.js";

/** Authored graded V3 choices projected unchanged into 三岔路 rounds. */
export interface ChoiceOption {
  readonly id: string;
  readonly label: string;
}
export interface ChoiceItem {
  readonly id: string;
  readonly text: string;
  readonly detail?: string;
  readonly options: readonly ChoiceOption[];
  readonly bestId: string;
  readonly why: string;
  readonly whyNot: Readonly<Record<string, string>>;
}
export interface ChoiceRound {
  readonly id: string;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly question: string;
  readonly items: readonly ChoiceItem[];
}
export const CHOICE_OPTION_MAX_WIDTH = 20;
export const CHOICE_MAX_OPTIONS = 3;
export const CHOICE_TEXT_MAX_WIDTH = 80;
type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
function chooseRound(lesson: GameLesson, activity: Json): ChoiceRound | null {
  const activityId = text(activity.id);
  if (!activityId || !Array.isArray(activity.steps)) return null;
  const items = activity.steps.flatMap((step): ChoiceItem[] => {
    if (!isObject(step) || step.kind !== "choose") return [];
    const id = text(step.id);
    const question = text(step.title);
    const answerId = text(step.answerId);
    const rawOptions = Array.isArray(step.options) ? step.options : [];
    // Prediction has no right answer. It cannot become a graded game by taking option one.
    if (
      !id ||
      !question ||
      !answerId ||
      displayWidth(question) > CHOICE_TEXT_MAX_WIDTH ||
      rawOptions.length < 2 ||
      rawOptions.length > CHOICE_MAX_OPTIONS
    )
      return [];
    const options: ChoiceOption[] = [];
    const explanations = new Map<string, string>();
    for (const raw of rawOptions) {
      if (!isObject(raw)) return [];
      const optionId = text(raw.id);
      const label = text(raw.label);
      if (!optionId || !label || displayWidth(label) > CHOICE_OPTION_MAX_WIDTH) return [];
      options.push({ id: optionId, label });
      const explanation = text(raw.after);
      if (explanation) explanations.set(optionId, explanation);
    }
    if (
      new Set(options.map((option) => option.id)).size !== options.length ||
      new Set(options.map((option) => option.label)).size !== options.length ||
      !options.some((option) => option.id === answerId)
    )
      return [];
    const why = explanations.get(answerId) ?? text(step.after);
    if (!why) return [];
    const whyNot: Record<string, string> = {};
    for (const option of options) {
      if (option.id === answerId) continue;
      const explanation = explanations.get(option.id);
      if (!explanation) return [];
      whyNot[option.id] = explanation;
    }
    return [{ id, text: question, options, bestId: answerId, why, whyNot }];
  });
  return items.length
    ? {
        id: `${lesson.id}/${activityId}`,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        question: text(activity.title) ?? lesson.title,
        items,
      }
    : null;
}
export function choiceRoundsFromLesson(lesson: GameLesson): readonly ChoiceRound[] {
  return (lesson.activities ?? []).flatMap((activity) => {
    if (!isObject(activity) || activity.kind !== "primm") return [];
    const round = chooseRound(lesson, activity);
    return round ? [round] : [];
  });
}
