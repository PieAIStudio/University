import { isValidSortActivity } from "../learning-play/sort.js";

/**
 * Lesson content as game rounds (ADR-0011, content layer).
 *
 * A round is one sort a lesson already teaches — its question, its bins, its
 * items with the right bin and the reason — projected unchanged. The game adds
 * nothing: no invented distractor, no shortened item, no new answer key. What
 * cannot be projected is skipped, never paraphrased.
 *
 * Three authored shapes carry a sort today: a lesson-level `sort` activity,
 * a PRIMM investigate game of kind `sort` (experience v1/v2) and a PRIMM step
 * of kind `sort` (experience v3). Their field names differ; the round does not.
 */
export interface GameBin {
  readonly id: string;
  readonly label: string;
  /** What belongs here, when the lesson says so. */
  readonly note?: string;
}

export interface GameItem {
  readonly id: string;
  readonly text: string;
  readonly binId: string;
  /** Why it belongs in its bin, in the lesson's words. */
  readonly why: string;
  readonly tempting?: { readonly binId: string; readonly whyNot: string };
}

export interface GameRound {
  /** `${lessonId}/${activityId}` or `${lessonId}/${activityId}/${stepId}`. */
  readonly id: string;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly question: string;
  readonly bins: readonly GameBin[];
  readonly items: readonly GameItem[];
}

export interface GameLesson {
  readonly id: string;
  readonly title: string;
  readonly activities?: readonly unknown[];
}

/**
 * How much room a text takes when read: a CJK character counts two, anything
 * else one. Counting characters dropped most English rounds, whose words are
 * about twice as many characters for the same reading time.
 */
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text)
    width +=
      /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/u.test(
        char,
      )
        ? 2
        : 1;
  return width;
}

/** An item is read while it moves; wider than this (48 CJK characters) and it cannot be. */
export const GAME_ITEM_MAX_WIDTH = 96;
/** A bin is a button and a basket label: 16 CJK characters, two short lines. */
export const GAME_BIN_MAX_WIDTH = 32;
/** More bins than answer buttons a thumb can reach. */
export const GAME_MAX_BINS = 3;

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

function bins(raw: unknown): GameBin[] | null {
  if (!Array.isArray(raw)) return null;
  const result: GameBin[] = [];
  for (const bin of raw) {
    if (!isObject(bin)) return null;
    const id = text(bin.id);
    const label = text(bin.label);
    if (!id || !label) return null;
    const note = text(bin.note);
    result.push(note ? { id, label, note } : { id, label });
  }
  return result;
}

function items(raw: unknown, textField: "label" | "text"): GameItem[] | null {
  if (!Array.isArray(raw)) return null;
  const result: GameItem[] = [];
  for (const item of raw) {
    if (!isObject(item)) return null;
    const id = text(item.id);
    const body = text(item[textField]);
    const binId = text(item.bucketId);
    const why = text(item.why);
    if (!id || !body || !binId || !why) return null;
    const tempting = isObject(item.tempting)
      ? { binId: text(item.tempting.bucketId), whyNot: text(item.tempting.whyNot) }
      : null;
    result.push({
      id,
      text: body,
      binId,
      why,
      ...(tempting?.binId && tempting.whyNot
        ? { tempting: { binId: tempting.binId, whyNot: tempting.whyNot } }
        : {}),
    });
  }
  return result;
}

/**
 * Keep the round only if it is still the lesson's sort after dropping items a
 * mover cannot carry: every bin still receives something, and the engine that
 * grades the lesson would accept it.
 */
function round(
  lesson: GameLesson,
  id: string,
  question: string | null,
  rawBins: GameBin[] | null,
  rawItems: GameItem[] | null,
): GameRound | null {
  if (!question || !rawBins || !rawItems) return null;
  if (rawBins.length < 2 || rawBins.length > GAME_MAX_BINS) return null;
  if (rawBins.some((bin) => displayWidth(bin.label) > GAME_BIN_MAX_WIDTH)) return null;
  const kept = rawItems.filter((item) => displayWidth(item.text) <= GAME_ITEM_MAX_WIDTH);
  const rules = {
    buckets: rawBins,
    items: kept.map((item) => ({
      id: item.id,
      bucketId: item.binId,
      why: item.why,
      ...(item.tempting
        ? { tempting: { bucketId: item.tempting.binId, whyNot: item.tempting.whyNot } }
        : {}),
    })),
  };
  if (!isValidSortActivity(rules)) return null;
  return {
    id,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    question,
    bins: rawBins,
    items: kept,
  };
}

/** Every round one lesson can give, in the order the lesson presents them. */
export function gameRoundsFromLesson(lesson: GameLesson): readonly GameRound[] {
  const rounds: (GameRound | null)[] = [];
  for (const activity of lesson.activities ?? []) {
    if (!isObject(activity)) continue;
    const activityId = text(activity.id);
    if (!activityId) continue;
    const base = `${lesson.id}/${activityId}`;
    if (activity.kind === "sort") {
      rounds.push(
        round(
          lesson,
          base,
          text(activity.question),
          bins(activity.buckets),
          items(activity.items, "label"),
        ),
      );
      continue;
    }
    if (activity.kind !== "primm") continue;
    if (Array.isArray(activity.steps)) {
      for (const step of activity.steps) {
        if (!isObject(step) || step.kind !== "sort") continue;
        rounds.push(
          round(
            lesson,
            `${base}/${text(step.id) ?? "sort"}`,
            text(step.title),
            bins(step.buckets),
            items(step.cards, "text"),
          ),
        );
      }
      continue;
    }
    const investigate = isObject(activity.investigate) ? activity.investigate : null;
    const game = investigate && isObject(investigate.game) ? investigate.game : null;
    if (game?.kind === "sort")
      rounds.push(
        round(
          lesson,
          `${base}/investigate`,
          text(investigate!.title),
          bins(game.buckets),
          items(game.cards, "text"),
        ),
      );
  }
  return rounds.filter((value): value is GameRound => value !== null);
}

/**
 * The rounds for one place on the map: the segment's own lessons first, in
 * course order, then earlier lessons from the nearest backwards. `lessons` is
 * whatever the host already decided the learner may practise (completed or
 * proved); this never widens that.
 */
export function gameRoundsForSegment(
  lessons: readonly GameLesson[],
  segmentLessonIds: readonly string[],
): readonly GameRound[] {
  const inSegment = new Set(segmentLessonIds);
  const own = lessons.filter((lesson) => inSegment.has(lesson.id));
  const earlier = lessons.filter((lesson) => !inSegment.has(lesson.id)).reverse();
  return [...own, ...earlier].flatMap(gameRoundsFromLesson);
}
