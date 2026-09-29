import { displayWidth, type GameLesson } from "./rounds.js";

/**
 * Lesson content as 连连看 rounds (ADR-0011, content layer).
 *
 * A round is one `connect` activity the lesson already teaches — its nodes,
 * the links between them with the lesson's reason for each, and the probes
 * that walk the finished picture — projected unchanged. A link is the item:
 * it is what the learner gets right, wrong or lets go by.
 *
 * Links are played without direction (tap either end first) and drawn with
 * it, so the game asks what the lesson asks — which things connect — and the
 * finished bridges still read the way the lesson's diagram does.
 */
export interface LinkNode {
  readonly id: string;
  readonly label: string;
}

export interface LinkEdge {
  /** `${from}>${to}`. */
  readonly id: string;
  readonly from: string;
  readonly to: string;
  /** Why these two connect, in the lesson's words. */
  readonly why: string;
}

export interface LinkRound {
  /** `${lessonId}/${activityId}`. */
  readonly id: string;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly question: string;
  /** The activity's own framing, when it has one. */
  readonly brief?: string;
  readonly nodes: readonly LinkNode[];
  readonly items: readonly LinkEdge[];
  /** Paths through the finished picture, walked once the round is linked. */
  readonly probes: readonly (readonly string[])[];
}

/** A stone's label is read while the tide runs: 13 CJK characters, one short line. */
export const LINK_NODE_MAX_WIDTH = 26;
/** Stones a phone's pond holds with every label still readable. */
export const LINK_MAX_NODES = 9;

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

function linkRound(lesson: GameLesson, activity: Json): LinkRound | null {
  const activityId = text(activity.id);
  const question = text(activity.title);
  if (!activityId || !question || !Array.isArray(activity.nodes) || !Array.isArray(activity.edges))
    return null;
  const nodes: LinkNode[] = [];
  for (const node of activity.nodes) {
    if (!isObject(node)) return null;
    const id = text(node.id);
    const label = text(node.label);
    if (!id || !label || displayWidth(label) > LINK_NODE_MAX_WIDTH) return null;
    nodes.push({ id, label });
  }
  if (nodes.length < 3 || nodes.length > LINK_MAX_NODES) return null;
  // Two stones that read the same could not be told apart.
  if (new Set(nodes.map((node) => node.label)).size !== nodes.length) return null;
  const known = new Set(nodes.map((node) => node.id));
  const items: LinkEdge[] = [];
  const pairs = new Set<string>();
  for (const edge of activity.edges) {
    if (!isObject(edge)) return null;
    const from = text(edge.from);
    const to = text(edge.to);
    const why = text(edge.why);
    if (!from || !to || !why || from === to || !known.has(from) || !known.has(to)) return null;
    // Played without direction, so a pair may be linked only once.
    const pair = [from, to].sort().join("|");
    if (pairs.has(pair)) return null;
    pairs.add(pair);
    items.push({ id: `${from}>${to}`, from, to, why });
  }
  if (items.length < 2) return null;
  const probes = Array.isArray(activity.probes)
    ? activity.probes.flatMap((probe) => {
        if (!isObject(probe) || !Array.isArray(probe.path)) return [];
        const path = probe.path.filter(
          (id): id is string => typeof id === "string" && known.has(id),
        );
        return path.length === probe.path.length && path.length >= 2 ? [path] : [];
      })
    : [];
  const brief = text(activity.brief);
  return {
    id: `${lesson.id}/${activityId}`,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    question,
    ...(brief ? { brief } : {}),
    nodes,
    items,
    probes,
  };
}

/** Every 连连看 round one lesson can give, in the order the lesson presents them. */
export function linkRoundsFromLesson(lesson: GameLesson): readonly LinkRound[] {
  return (lesson.activities ?? []).flatMap((activity) => {
    if (!isObject(activity) || activity.kind !== "connect") return [];
    const round = linkRound(lesson, activity);
    return round ? [round] : [];
  });
}
