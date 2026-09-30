import { displayWidth, type GameLesson } from "./rounds.js";

/**
 * Lesson content as 打地鼠 rounds (ADR-0011, content layer): sentences to
 * check against a source, one of which the lesson asks the learner to point
 * out — projected unchanged.
 *
 * An `evidence` step of an `interaction-path` carries exactly that: the
 * source (`material.reference`), the sentences under check, each with the
 * lesson's explanation, and the one to point at. The step's own question says
 * which kind it is (the unsupported one, or the supported one), so the game
 * asks what the step asks and never flips it.
 */
export interface SpotSentence {
  readonly id: string;
  readonly text: string;
  /** The one to whack; the others are left alone. */
  readonly target: boolean;
  /** Why, in the lesson's words. */
  readonly why: string;
}

export interface SpotRound {
  /** `${lessonId}/${activityId}/${stepId}`. */
  readonly id: string;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly question: string;
  /** What the sentences are checked against, shown before the round. */
  readonly source?: string;
  readonly items: readonly SpotSentence[];
}

/** A mole holds its sentence up while it is read: 24 CJK characters. */
export const SPOT_SENTENCE_MAX_WIDTH = 48;

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

function evidenceRound(lesson: GameLesson, base: string, step: Json): SpotRound | null {
  const stepId = text(step.id);
  const question = text(step.question);
  const targetId = text(step.correctSentenceId);
  const material = isObject(step.material) ? step.material : null;
  if (!stepId || !question || !targetId || !material || !Array.isArray(material.sentences))
    return null;
  const items: SpotSentence[] = [];
  for (const sentence of material.sentences) {
    if (!isObject(sentence)) return null;
    const id = text(sentence.id);
    const body = text(sentence.label);
    const why = text(sentence.explanation);
    if (!id || !body || !why || displayWidth(body) > SPOT_SENTENCE_MAX_WIDTH) return null;
    items.push({ id, text: body, target: id === targetId, why });
  }
  if (items.filter((item) => item.target).length !== 1 || items.length < 3) return null;
  const reference = isObject(material.reference) ? text(material.reference.text) : null;
  return {
    id: `${base}/${stepId}`,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    question,
    ...(reference ? { source: reference } : {}),
    items,
  };
}

/** Every 打地鼠 round one lesson can give, in the order the lesson presents them. */
export function spotRoundsFromLesson(lesson: GameLesson): readonly SpotRound[] {
  const rounds: SpotRound[] = [];
  for (const activity of lesson.activities ?? []) {
    if (!isObject(activity) || activity.kind !== "interaction-path") continue;
    const activityId = text(activity.id);
    if (!activityId || !Array.isArray(activity.steps)) continue;
    for (const step of activity.steps) {
      if (!isObject(step) || step.kind !== "evidence") continue;
      const round = evidenceRound(lesson, `${lesson.id}/${activityId}`, step);
      if (round) rounds.push(round);
    }
  }
  return rounds;
}
