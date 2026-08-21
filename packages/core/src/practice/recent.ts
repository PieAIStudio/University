/**
 * Recent-question de-duplication, as a document rather than a bag of ids.
 *
 * VibeHub stores `vibehub.practice.recent.v1` as a JSON array of
 * `<category>-<slug>` keys and stops there. The behaviour is worth keeping —
 * do not immediately re-serve the question the learner just saw — but the
 * bytes must not live in this file. Storage is an adapter, the same split as
 * favourites, so an account-backed store is a different reader/writer rather
 * than a second model.
 *
 * `version` sits inside the document, not in a storage key, so a future
 * migration branches here instead of growing `university.practice.recent.v2`.
 */

export const PRACTICE_RECENT_DOCUMENT_VERSION = 1;

/**
 * How many recently served ids we refuse to pick again.
 *
 * Large enough that a short sitting never repeats, small enough that a tiny
 * bank still has somewhere to go once the picker falls back. The cap is on
 * the buffer, not on the session: this is not a progress bar.
 */
export const PRACTICE_RECENT_LIMIT = 12;

export interface PracticeRecentState {
  readonly version: number;
  readonly ids: readonly string[];
}

export const EMPTY_PRACTICE_RECENT: PracticeRecentState = {
  version: PRACTICE_RECENT_DOCUMENT_VERSION,
  ids: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function withIds(ids: readonly string[]): PracticeRecentState {
  return ids.length === 0
    ? EMPTY_PRACTICE_RECENT
    : { version: PRACTICE_RECENT_DOCUMENT_VERSION, ids };
}

function isCurrentDocument(state: PracticeRecentState): boolean {
  return state.version === PRACTICE_RECENT_DOCUMENT_VERSION;
}

/**
 * Read a document of unknown provenance.
 *
 * Today's payload is version 1. A newer document keeps its version and yields
 * no ids, so an older client cannot skip questions it does not understand
 * *and* cannot rewrite the buffer as version 1 on the next save.
 */
export function parsePracticeRecent(input: unknown): PracticeRecentState {
  if (!isRecord(input)) return EMPTY_PRACTICE_RECENT;
  const { version } = input;
  if (version !== PRACTICE_RECENT_DOCUMENT_VERSION) {
    if (
      typeof version === "number" &&
      Number.isInteger(version) &&
      version > PRACTICE_RECENT_DOCUMENT_VERSION
    ) {
      return { version, ids: [] };
    }
    return EMPTY_PRACTICE_RECENT;
  }
  if (!Array.isArray(input.ids)) return EMPTY_PRACTICE_RECENT;
  const ids: string[] = [];
  for (const raw of input.ids) {
    const id = asId(raw);
    if (id) ids.push(id);
  }
  return withIds(uniqueIds(ids));
}

/**
 * Push `id` to the newest end of the ring, dropping the oldest when over cap.
 *
 * An id already in the buffer is moved, not duplicated, so "recent" means
 * "last seen" rather than "first seen this week". A foreign-version document
 * is left untouched, matching the favourites rule that makes a later
 * migration possible.
 */
export function rememberPracticeQuestion(
  state: PracticeRecentState,
  id: string,
  limit: number = PRACTICE_RECENT_LIMIT,
): PracticeRecentState {
  if (!isCurrentDocument(state)) return state;
  if (id.length === 0) return state;
  const cap = Number.isFinite(limit) ? Math.trunc(limit) : 0;
  if (cap <= 0) return EMPTY_PRACTICE_RECENT;
  const without = state.ids.filter((item) => item !== id);
  const next = [...without, id];
  return withIds(next.length > cap ? next.slice(next.length - cap) : next);
}

function pickIndex(length: number, random: () => number): number {
  if (length <= 1) return 0;
  let roll = random();
  if (!Number.isFinite(roll) || roll < 0) roll = 0;
  if (roll >= 1) roll = 0;
  return Math.min(length - 1, Math.floor(roll * length));
}

/**
 * Choose the next question id, avoiding whatever is still in the ring.
 *
 * If every id in the bank is recent — a three-term catalogue against a
 * twelve-slot buffer — fall back to "anything except the one just served"
 * so a tiny bank still moves. An empty bank has nothing to pick.
 */
export function pickPracticeQuestionId(
  ids: readonly string[],
  recent: readonly string[],
  random: () => number = Math.random,
): string | null {
  const bank = uniqueIds(ids);
  if (bank.length === 0) return null;

  const inBank = new Set(bank);
  const recentInBank = recent.filter((id) => inBank.has(id));
  const avoided = new Set(recentInBank);
  let pool = bank.filter((id) => !avoided.has(id));

  if (pool.length === 0) {
    const last = recentInBank[recentInBank.length - 1];
    pool = last && bank.length > 1 ? bank.filter((id) => id !== last) : bank;
  }

  if (pool.length === 0) return null;
  return pool[pickIndex(pool.length, random)] ?? null;
}
