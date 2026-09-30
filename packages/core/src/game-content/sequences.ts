import { displayWidth, type GameLesson } from "./rounds.js";

/**
 * Lesson content as 贪吃蛇 rounds (ADR-0011, content layer): something the
 * lesson already puts in order, projected unchanged.
 *
 * Two authored shapes carry an order today. A PRIMM step of kind `build`
 * (experience v3) assembles a request from pieces: its `answers` are the
 * orders that count, and a piece in none of them is a distractor with its own
 * `why`. A `connect` activity's probe is a path through the finished picture;
 * each stop's reason is the lesson's reason for the link that reaches it, and
 * the activity's other nodes stand by as stops the path does not make.
 */
export interface SequencePiece {
  readonly id: string;
  readonly text: string;
  /** A distractor's reason for not belonging, in the lesson's words. */
  readonly why?: string;
  /** Why this piece comes where it does, when the lesson says so. */
  readonly reason?: string;
}

export interface SequenceRound {
  /** `${lessonId}/${activityId}/${stepId}` or `${lessonId}/${activityId}/probe-${n}`. */
  readonly id: string;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly question: string;
  /** What the learner starts from, when the lesson shows it. */
  readonly context?: string;
  readonly items: readonly SequencePiece[];
  /** Every order that counts; a round is done when one of them is complete. */
  readonly answers: readonly (readonly string[])[];
}

/** A piece rides on the lawn with its words over it: 12 CJK characters. */
export const SEQUENCE_PIECE_MAX_WIDTH = 24;
/** Pieces a lawn holds with every label still readable. */
export const SEQUENCE_MAX_PIECES = 7;
/** Stops the path does not make, standing by on the lawn. */
const PROBE_DECOYS = 2;

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

function fits(round: SequenceRound): SequenceRound | null {
  const { items, answers } = round;
  if (items.length < 2 || items.length > SEQUENCE_MAX_PIECES) return null;
  if (items.some((piece) => displayWidth(piece.text) > SEQUENCE_PIECE_MAX_WIDTH)) return null;
  // Two pieces that read the same could not be told apart on the lawn.
  if (new Set(items.map((piece) => piece.text)).size !== items.length) return null;
  const known = new Set(items.map((piece) => piece.id));
  if (
    !answers.length ||
    answers.some((order) => !order.length || !order.every((id) => known.has(id)))
  )
    return null;
  // A single-piece answer is a pick, not an order.
  if (answers.every((order) => order.length < 2)) return null;
  return round;
}

function buildRound(lesson: GameLesson, base: string, step: Json): SequenceRound | null {
  const stepId = text(step.id);
  const question = text(step.title);
  if (!stepId || !question || !Array.isArray(step.pieces) || !Array.isArray(step.answers))
    return null;
  const items: SequencePiece[] = [];
  for (const piece of step.pieces) {
    if (!isObject(piece)) return null;
    const id = text(piece.id);
    const body = text(piece.text);
    if (!id || !body) return null;
    const why = text(piece.why);
    items.push(why ? { id, text: body, why } : { id, text: body });
  }
  const answers = step.answers.flatMap((order) =>
    Array.isArray(order) && order.every((id) => typeof id === "string") ? [order as string[]] : [],
  );
  // A piece that some answer uses is not a distractor, whatever else it says.
  const used = new Set(answers.flat());
  const context = text(step.context);
  return fits({
    id: `${base}/${stepId}`,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    question,
    ...(context ? { context } : {}),
    items: items.map((piece) =>
      used.has(piece.id) && piece.why ? { id: piece.id, text: piece.text } : piece,
    ),
    answers,
  });
}

function probeRounds(lesson: GameLesson, activity: Json): SequenceRound[] {
  const activityId = text(activity.id);
  const question = text(activity.title);
  if (!activityId || !question) return [];
  if (!Array.isArray(activity.nodes) || !Array.isArray(activity.edges)) return [];
  if (!Array.isArray(activity.probes)) return [];
  const labels = new Map<string, string>();
  for (const node of activity.nodes) {
    if (!isObject(node)) return [];
    const id = text(node.id);
    const label = text(node.label);
    if (!id || !label) return [];
    labels.set(id, label);
  }
  const reasons = new Map<string, string>();
  for (const edge of activity.edges) {
    if (!isObject(edge)) return [];
    const from = text(edge.from);
    const to = text(edge.to);
    const why = text(edge.why);
    if (from && to && why) reasons.set(`${from}>${to}`, why);
  }
  return activity.probes.flatMap((probe, index) => {
    if (!isObject(probe) || !Array.isArray(probe.path)) return [];
    const path = probe.path.filter((id): id is string => typeof id === "string");
    if (path.length < 3 || new Set(path).size !== path.length) return [];
    if (!path.every((id) => labels.has(id))) return [];
    // Every step of the path must be a link the lesson drew, with its reason.
    const stops = path.map((id, at) =>
      at === 0
        ? { id, text: labels.get(id)! }
        : { id, text: labels.get(id)!, reason: reasons.get(`${path[at - 1]}>${id}`) },
    );
    if (stops.slice(1).some((stop) => !stop.reason)) return [];
    const decoys = [...labels]
      .filter(([id]) => !path.includes(id))
      .slice(0, PROBE_DECOYS)
      .map(([id, label]) => ({ id, text: label }));
    const round = fits({
      id: `${lesson.id}/${activityId}/probe-${index + 1}`,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      question: text(probe.label) ? `${question}：${text(probe.label)}` : question,
      items: [
        ...stops.map((stop) => (stop.reason ? stop : { id: stop.id, text: stop.text })),
        ...decoys,
      ] as SequencePiece[],
      answers: [path],
    });
    return round ? [round] : [];
  });
}

/** Every 贪吃蛇 round one lesson can give, in the order the lesson presents them. */
export function sequenceRoundsFromLesson(lesson: GameLesson): readonly SequenceRound[] {
  const rounds: SequenceRound[] = [];
  for (const activity of lesson.activities ?? []) {
    if (!isObject(activity)) continue;
    const activityId = text(activity.id);
    if (!activityId) continue;
    if (activity.kind === "connect") {
      rounds.push(...probeRounds(lesson, activity));
      continue;
    }
    if (activity.kind !== "primm" || !Array.isArray(activity.steps)) continue;
    for (const step of activity.steps) {
      if (!isObject(step) || step.kind !== "build") continue;
      const round = buildRound(lesson, `${lesson.id}/${activityId}`, step);
      if (round) rounds.push(round);
    }
  }
  return rounds;
}
