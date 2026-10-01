/**
 * The learner's house, as account data (V7 amendment one; task 10).
 *
 * Three things, each merged so that two devices changing different parts at
 * once both keep their change:
 *
 * - **Where things stand.** One position per item id (a keepsake, a piece of
 *   wear, a pack-box decoration), in room units from 0 to 1 so a 2D room and a
 *   later 3D room read the same place. Last writer wins per item, never per
 *   house: moving the plane on the phone does not undo moving the jar on the
 *   laptop.
 * - **How the wall marks a used day.** The learner's choice of tally stroke,
 *   tick on the date, or sticker in the date cell; last writer wins.
 * - **「用了吗？」 answers.** One per lesson, used or not yet, with the local
 *   day it was answered. It is the learner's own word: never a score, never a
 *   reward. The wall is derived from it, and it is also what stops the question
 *   being asked twice.
 *
 * What the learner *holds* is not stored here. Keepsakes are derived from the
 * learning record (keepsakes.ts); wear and packs have their own store.
 */

export type WallMarkStyle = "tally" | "tick" | "sticker";
export type UsedAnswer = "used" | "not-yet";

export interface HousePlacement {
  readonly x: number;
  readonly y: number;
  readonly at: string;
}

export interface UsedRecord {
  readonly answer: UsedAnswer;
  /** The learner's local calendar day, YYYY-MM-DD. */
  readonly day: string;
  readonly at: string;
}

/** A lesson's 「今天就能做的小事」, kept when it was finished so it can be asked about later. */
export interface OfferedRecord {
  readonly task: string;
  /** The learner's local day the lesson was finished, YYYY-MM-DD. */
  readonly day: string;
  readonly at: string;
}

export interface HouseState {
  readonly placements: Readonly<Record<string, HousePlacement>>;
  readonly markStyle?: { readonly style: WallMarkStyle; readonly at: string };
  /** Keyed by lesson document key. */
  readonly used: Readonly<Record<string, UsedRecord>>;
  /**
   * Small things offered at the end of a lesson, keyed by lesson document key.
   * The question 「用了吗？」 comes on a later day, so the words must outlive the
   * lesson page that showed them.
   */
  readonly offered?: Readonly<Record<string, OfferedRecord>>;
}

const MAX_PLACEMENTS = 400;
const MAX_USED = 2000;
const MAX_TASK = 400;
const ID = /^[\w./#:-]{1,200}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const validAt = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));
const unit = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
const later = <T extends { readonly at: string }>(a: T | undefined, b: T | undefined) =>
  !a ? b : !b ? a : Date.parse(b.at) >= Date.parse(a.at) ? b : a;

function entries<T>(value: unknown, valid: (v: Record<string, unknown>) => T | null, max: number) {
  const out: Record<string, T> = {};
  if (!isRecord(value)) return out;
  for (const [key, raw] of Object.entries(value).slice(0, max)) {
    if (!ID.test(key) || !isRecord(raw)) continue;
    const item = valid(raw);
    if (item) out[key] = item;
  }
  return out;
}

export function parseHouseState(value: unknown): HouseState | undefined {
  if (!isRecord(value)) return undefined;
  const placements = entries(
    value.placements,
    (raw) =>
      unit(raw.x) && unit(raw.y) && validAt(raw.at) ? { x: raw.x, y: raw.y, at: raw.at } : null,
    MAX_PLACEMENTS,
  );
  const used = entries(
    value.used,
    (raw): UsedRecord | null =>
      (raw.answer === "used" || raw.answer === "not-yet") &&
      typeof raw.day === "string" &&
      DAY.test(raw.day) &&
      validAt(raw.at)
        ? { answer: raw.answer, day: raw.day, at: raw.at }
        : null,
    MAX_USED,
  );
  const offered = entries(
    value.offered,
    (raw): OfferedRecord | null =>
      typeof raw.task === "string" &&
      raw.task.trim() &&
      raw.task.length <= MAX_TASK &&
      typeof raw.day === "string" &&
      DAY.test(raw.day) &&
      validAt(raw.at)
        ? { task: raw.task, day: raw.day, at: raw.at }
        : null,
    MAX_USED,
  );
  const style = isRecord(value.markStyle) ? value.markStyle : null;
  const markStyle: HouseState["markStyle"] =
    style &&
    (style.style === "tally" || style.style === "tick" || style.style === "sticker") &&
    validAt(style.at)
      ? { style: style.style, at: style.at }
      : undefined;
  return {
    placements,
    used,
    ...(markStyle ? { markStyle } : {}),
    ...(Object.keys(offered).length ? { offered } : {}),
  };
}

export function mergeHouseState(
  left: HouseState | undefined,
  right: HouseState | undefined,
): HouseState | undefined {
  if (!left) return right ? parseHouseState(right) : undefined;
  if (!right) return parseHouseState(left);
  const placements: Record<string, HousePlacement> = { ...left.placements };
  for (const [id, item] of Object.entries(right.placements))
    placements[id] = later(placements[id], item)!;
  const used: Record<string, UsedRecord> = { ...left.used };
  for (const [key, item] of Object.entries(right.used)) used[key] = later(used[key], item)!;
  const offered: Record<string, OfferedRecord> = { ...left.offered };
  for (const [key, item] of Object.entries(right.offered ?? {}))
    offered[key] = later(offered[key], item)!;
  const markStyle = later(left.markStyle, right.markStyle);
  return parseHouseState({ placements, used, offered, ...(markStyle ? { markStyle } : {}) });
}

const EMPTY: HouseState = { placements: {}, used: {} };

export function placeItem(
  house: HouseState | undefined,
  id: string,
  x: number,
  y: number,
  at: string,
): HouseState {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return mergeHouseState(house ?? EMPTY, {
    placements: { [id]: { x: clamp(x), y: clamp(y), at } },
    used: {},
  })!;
}

export function chooseMarkStyle(
  house: HouseState | undefined,
  style: WallMarkStyle,
  at: string,
): HouseState {
  return mergeHouseState(house ?? EMPTY, { placements: {}, used: {}, markStyle: { style, at } })!;
}

export function answerUsed(
  house: HouseState | undefined,
  lessonKey: string,
  answer: UsedAnswer,
  day: string,
  at: string,
): HouseState {
  return mergeHouseState(house ?? EMPTY, {
    placements: {},
    used: { [lessonKey]: { answer, day, at } },
  })!;
}

/** Days with at least one 「用了」, oldest first, for the wall. */
export function usedDays(house: HouseState | undefined): readonly string[] {
  return [
    ...new Set(
      Object.values(house?.used ?? {})
        .filter((record) => record.answer === "used")
        .map((record) => record.day),
    ),
  ].sort();
}

/** Whether 「用了吗？」 has already been answered for this lesson. */
export function hasAnsweredUsed(house: HouseState | undefined, lessonKey: string): boolean {
  return Boolean(house?.used[lessonKey]);
}

/** Keep a finished lesson's small thing, to ask about it on a later day. */
export function offerToday(
  house: HouseState | undefined,
  lessonKey: string,
  task: string,
  day: string,
  at: string,
): HouseState {
  return mergeHouseState(house ?? EMPTY, {
    placements: {},
    used: {},
    offered: { [lessonKey]: { task: task.trim().slice(0, MAX_TASK), day, at } },
  })!;
}

/**
 * The one 「用了吗？」 to ask now, if any: the most recently offered small thing
 * from an earlier day that has no answer yet. One question at a time, never on
 * the day the lesson was finished — there has been no chance to use it yet.
 */
export function pendingUsedQuestion(
  house: HouseState | undefined,
  today: string,
): { readonly lessonKey: string; readonly task: string; readonly day: string } | null {
  let best: { lessonKey: string; task: string; day: string } | null = null;
  for (const [lessonKey, offer] of Object.entries(house?.offered ?? {})) {
    if (offer.day >= today || house?.used[lessonKey]) continue;
    if (!best || offer.day > best.day) best = { lessonKey, task: offer.task, day: offer.day };
  }
  return best;
}
