/**
 * The learner's progress as a JSON document.
 *
 * This is the shape `university.progress.v2` already stores in the delivery
 * shell. The key stays the same so a machine that has been learning without
 * an account does not wake up empty the day sync lands. A version bump that
 * guessed at v1 cards already happened once; we are not doing it again.
 *
 * The document is the unit of merge. There is no per-card API on the remote
 * side yet, and inventing one before University has a schema would be a
 * second storage model that then has to be migrated.
 */

import { cloneAccountData, emptyAccountData, parseAccountData } from "../ports/account-data.js";
import type { PushSubscriptionRecord } from "../ports/notifications.js";
import type { ProgressDocument } from "../ports/progress.js";
import type { LessonRef } from "./contract.js";

/** Keep this string. Changing it orphans everyone who has already learned a lesson. */
export const PROGRESS_STORAGE_KEY = "university.progress.v2";

/** The stable id of the one virtual card a lesson may create for teach-back. */
export const RECAP_CARD_ID = "__recap__";

export const emptyProgress = (): ProgressDocument => ({
  lessons: {},
  cards: {},
  words: {},
  streak: { days: 0, lastDay: null },
  totalXp: 0,
  xpEvents: {},
  readerMarks: {},
  exerciseAttempts: {},
  retrievalAttempts: {},
  pushSubscriptions: {},
  account: emptyAccountData(),
});

/**
 * How this document names a lesson. Three segments, no unit.
 *
 * Not the same string as `lessonRefKey`, which carries the unit as well and is
 * what *shared surfaces* use to talk about a lesson. Both are legitimate — a
 * store may key its rows however it likes — and that is exactly why they have
 * to stop being interchangeable at the door of this module.
 *
 * This three-part projection is safe only under the content contract that a
 * course cannot contain the same lesson id in two units. The document cannot
 * recover a dropped unitId later, so the recovery/delivery boundary rejects
 * that shape before it can enter this store. Existing v2 documents remain on
 * this key; changing it here would be a data migration, not a refactor.
 *
 * They were not. `confirmLessonRead` was reached through a reader port that
 * built its argument with `lessonRefKey`, so the read confirmation landed on a
 * four-segment key while every reader of this document looked under the
 * three-segment one. Nothing threw: both are strings, both are valid keys, and
 * the document simply grew a row nobody read. The visible result was that a
 * lesson could not be finished in either shell — the confirm button never
 * changed, the settlement never came, and the map never moved.
 */
/**
 * A key in *this document's* `lessons` map, and nothing else.
 *
 * Branded so it cannot be confused with `lessonRefKey`'s four-segment name at
 * a call site. That is not hypothetical caution: the two were passed to the
 * same function, and because both are strings the compiler had nothing to say.
 */
export type LessonDocumentKey = string & { readonly __lessonDocumentKey: unique symbol };

export const lessonKey = (studyId: string, courseId: string, lessonId: string) =>
  `${studyId}/${courseId}/${lessonId}` as LessonDocumentKey;

/**
 * The same key, from a locator.
 *
 * Exists so a caller holding a `LessonRef` never has to decide which of the
 * two key builders in this repository it wanted. Deciding is what went wrong.
 */
export const lessonKeyOf = (ref: {
  readonly studyId: string;
  readonly courseId: string;
  readonly lessonId: string;
}): LessonDocumentKey => lessonKey(ref.studyId, ref.courseId, ref.lessonId);

/**
 * The recap card keeps the unit in its key because its prompt is the unit's
 * capability sentence. It deliberately does not reuse `lessonKeyOf`: that
 * three-segment document key predates unit-aware learner cards.
 */
export const recapCardKeyOf = (ref: LessonRef): string =>
  `${ref.studyId}/${ref.courseId}/${ref.unitId}/${ref.lessonId}/${RECAP_CARD_ID}`;

export function parseProgress(raw: string | null): ProgressDocument {
  if (!raw) return emptyProgress();
  try {
    const parsed = JSON.parse(raw) as Partial<ProgressDocument>;
    const xpEvents = parseXpEvents(parsed.xpEvents);
    const parsedTotalXp = parseXpAmount(parsed.totalXp);
    const eventTotal = sumXpEvents(xpEvents);
    if (parsedTotalXp > eventTotal) {
      xpEvents[LEGACY_XP_EVENT_ID] = Math.max(
        xpEvents[LEGACY_XP_EVENT_ID] ?? 0,
        parsedTotalXp - eventTotal,
      );
    }
    return {
      lessons: parsed.lessons ?? {},
      cards: parsed.cards ?? {},
      // Added after v2 shipped. Absent is the normal case for anyone who read a
      // lesson before the language layer existed, not a corrupt store.
      words: parsed.words ?? {},
      streak: parsed.streak ?? { days: 0, lastDay: null },
      totalXp: sumXpEvents(xpEvents),
      xpEvents,
      // Reader annotations and answer records were added after v2. An absent
      // field is an older device, not a corrupt document.
      readerMarks: parsed.readerMarks ?? {},
      exerciseAttempts: parsed.exerciseAttempts ?? {},
      retrievalAttempts: parsed.retrievalAttempts ?? {},
      pushSubscriptions: parsePushSubscriptions(parsed.pushSubscriptions),
      account: parseAccountData(parsed.account),
    };
  } catch {
    // A corrupt local store must not lock a learner out of their own campus.
    return emptyProgress();
  }
}

export function cloneProgress(document: ProgressDocument): ProgressDocument {
  return {
    lessons: { ...document.lessons },
    cards: { ...document.cards },
    words: { ...document.words },
    streak: { ...document.streak },
    totalXp: document.totalXp,
    xpEvents: { ...document.xpEvents },
    readerMarks: { ...document.readerMarks },
    exerciseAttempts: { ...document.exerciseAttempts },
    retrievalAttempts: { ...document.retrievalAttempts },
    pushSubscriptions: clonePushSubscriptions(document.pushSubscriptions ?? {}),
    account: cloneAccountData(document.account),
  };
}

function clonePushSubscriptions(
  subscriptions: Record<string, PushSubscriptionRecord>,
): Record<string, PushSubscriptionRecord> {
  return Object.fromEntries(
    Object.entries(subscriptions).map(([endpoint, record]) => [
      endpoint,
      clonePushSubscription(record),
    ]),
  );
}

function clonePushSubscription(record: PushSubscriptionRecord): PushSubscriptionRecord {
  return { ...record, keys: { ...record.keys } };
}

function parsePushSubscriptions(value: unknown): Record<string, PushSubscriptionRecord> {
  if (!isRecord(value)) return {};
  const subscriptions: Record<string, PushSubscriptionRecord> = {};
  for (const [endpoint, candidate] of Object.entries(value)) {
    const record = parsePushSubscription(candidate);
    if (record && record.endpoint === endpoint) subscriptions[endpoint] = record;
  }
  return subscriptions;
}

function parsePushSubscription(value: unknown): PushSubscriptionRecord | null {
  if (!isRecord(value) || typeof value.endpoint !== "string" || value.endpoint.length === 0) {
    return null;
  }
  if (
    !isRecord(value.keys) ||
    typeof value.keys.p256dh !== "string" ||
    value.keys.p256dh.length === 0 ||
    typeof value.keys.auth !== "string" ||
    value.keys.auth.length === 0
  ) {
    return null;
  }
  if (value.state !== "active" && value.state !== "revoked") return null;
  if (typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt))) {
    return null;
  }
  if (
    value.expirationTime !== null &&
    (typeof value.expirationTime !== "number" || !Number.isFinite(value.expirationTime))
  ) {
    return null;
  }
  if (
    value.vapidPublicKey !== undefined &&
    value.vapidPublicKey !== null &&
    typeof value.vapidPublicKey !== "string"
  ) {
    return null;
  }
  return {
    endpoint: value.endpoint,
    expirationTime: value.expirationTime,
    keys: { p256dh: value.keys.p256dh, auth: value.keys.auth },
    state: value.state,
    updatedAt: value.updatedAt,
    vapidPublicKey: value.vapidPublicKey ?? null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Older snapshots had only a scalar total, so keep that amount as a seed event. */
export const LEGACY_XP_EVENT_ID = "__legacy_total__";

export function parseXpAmount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function parseXpEvents(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const events: Record<string, number> = {};
  for (const [eventId, amount] of Object.entries(value)) {
    const parsedAmount = parseXpAmount(amount);
    if (eventId.length > 0 && parsedAmount >= 0) events[eventId] = parsedAmount;
  }
  return events;
}

export function sumXpEvents(events: Record<string, number>): number {
  return Object.values(events).reduce((total, amount) => total + parseXpAmount(amount), 0);
}
