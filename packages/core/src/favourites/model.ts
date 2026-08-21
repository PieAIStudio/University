import type { LexiconEntry, LexiconTrack } from "../domain/schemas.js";

/**
 * A learner's private list of senses, as a document rather than a bag of ids.
 *
 * VibeHub keeps this in `localStorage` as `{ version, items[] }` and loses it
 * when the browser profile dies. The shape is worth keeping — a versioned
 * document is something an account row can hold without a rewrite — but the
 * bytes must not live in this file. Storage is an adapter. This module takes
 * a document and returns a new one, which is what lets the account-backed
 * store be a different reader/writer rather than a second model.
 *
 * `version` sits inside the document, not in a storage key, so a future
 * migration branches here instead of growing `university.favourites.v2`.
 */

export const FAVOURITES_DOCUMENT_VERSION = 1;

/**
 * The order groups appear in. Technical first because that is the vocabulary
 * this product exists to teach; general English is the supporting layer.
 * Kept next to the grouping function so a change of order is a change of this
 * file, not a silent dependency on the search index's private constant.
 */
const TRACK_ORDER: readonly LexiconTrack[] = ["technical", "general"];

export interface Favourite {
  readonly senseId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FavouritesState {
  readonly version: number;
  readonly items: readonly Favourite[];
}

export interface FavouritesTrackGroup {
  readonly track: LexiconTrack;
  readonly count: number;
  readonly entries: readonly LexiconEntry[];
}

export const EMPTY_FAVOURITES: FavouritesState = {
  version: FAVOURITES_DOCUMENT_VERSION,
  items: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asFavourite(value: unknown): Favourite | null {
  if (!isRecord(value)) return null;
  const { senseId, createdAt, updatedAt } = value;
  if (typeof senseId !== "string" || senseId.length === 0) return null;
  if (typeof createdAt !== "string" || createdAt.length === 0) return null;
  if (typeof updatedAt !== "string" || updatedAt.length === 0) return null;
  return { senseId, createdAt, updatedAt };
}

function timestampMs(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function compareRecency(a: Favourite, b: Favourite): number {
  const updated = timestampMs(b.updatedAt) - timestampMs(a.updatedAt);
  if (updated !== 0) return updated;
  const created = timestampMs(b.createdAt) - timestampMs(a.createdAt);
  if (created !== 0) return created;
  if (a.senseId < b.senseId) return -1;
  if (a.senseId > b.senseId) return 1;
  return 0;
}

/**
 * Collapse duplicate sense ids rather than letting a corrupt document mint
 * two stars for one sense. The earliest `createdAt` is the first time the
 * learner meant it; the latest `updatedAt` is the last time they said so.
 */
function dedupeItems(items: readonly Favourite[]): Favourite[] {
  const byId = new Map<string, Favourite>();
  for (const item of items) {
    const previous = byId.get(item.senseId);
    if (!previous) {
      byId.set(item.senseId, item);
      continue;
    }
    byId.set(item.senseId, {
      senseId: item.senseId,
      createdAt:
        timestampMs(previous.createdAt) <= timestampMs(item.createdAt)
          ? previous.createdAt
          : item.createdAt,
      updatedAt:
        timestampMs(previous.updatedAt) >= timestampMs(item.updatedAt)
          ? previous.updatedAt
          : item.updatedAt,
    });
  }
  return [...byId.values()];
}

function withItems(items: readonly Favourite[]): FavouritesState {
  return items.length === 0 ? EMPTY_FAVOURITES : { version: FAVOURITES_DOCUMENT_VERSION, items };
}

function isCurrentDocument(state: FavouritesState): boolean {
  return state.version === FAVOURITES_DOCUMENT_VERSION;
}

/** The sense ids a catalogue actually contains, for the add/toggle gate. */
export function senseIdsOf(entries: readonly { readonly senseId: string }[]): ReadonlySet<string> {
  return new Set(entries.map((entry) => entry.senseId));
}

export function hasFavourite(state: FavouritesState, senseId: string): boolean {
  return state.items.some((item) => item.senseId === senseId);
}

/**
 * Read a document of unknown provenance.
 *
 * This is the version switch. Today's payload is version 1. A newer document
 * keeps its version and yields no items, so an older client cannot display
 * what it does not understand *and* cannot rewrite it as version 1 on the
 * next save — mutations refuse to touch a foreign version, which is what
 * makes "branch on version later" possible rather than decorative.
 */
export function parseFavourites(input: unknown): FavouritesState {
  if (!isRecord(input)) return EMPTY_FAVOURITES;
  const { version } = input;
  if (version !== FAVOURITES_DOCUMENT_VERSION) {
    if (typeof version === "number" && Number.isInteger(version) && version > FAVOURITES_DOCUMENT_VERSION) {
      return { version, items: [] };
    }
    return EMPTY_FAVOURITES;
  }
  if (!Array.isArray(input.items)) return EMPTY_FAVOURITES;
  const items: Favourite[] = [];
  for (const raw of input.items) {
    const item = asFavourite(raw);
    if (item) items.push(item);
  }
  return withItems(dedupeItems(items));
}

/**
 * Add a sense, or refresh it.
 *
 * An unknown id is rejected rather than stored: a favourite that is not in
 * the lexicon cannot be grouped by track, cannot open a term page, and would
 * sit in the document as a row nobody can name. Re-adding a known id does
 * not duplicate it — it updates `updatedAt` so "recent" means "I still care",
 * not "the first time I pressed the star".
 */
export function addFavourite(
  state: FavouritesState,
  senseId: string,
  knownSenseIds: ReadonlySet<string>,
  now: string,
): FavouritesState {
  if (!isCurrentDocument(state)) return state;
  if (!knownSenseIds.has(senseId)) return state;
  const existing = state.items.find((item) => item.senseId === senseId);
  if (existing) {
    if (existing.updatedAt === now) return state;
    return {
      version: FAVOURITES_DOCUMENT_VERSION,
      items: state.items.map((item) =>
        item.senseId === senseId ? { senseId, createdAt: item.createdAt, updatedAt: now } : item,
      ),
    };
  }
  return {
    version: FAVOURITES_DOCUMENT_VERSION,
    items: [...state.items, { senseId, createdAt: now, updatedAt: now }],
  };
}

export function removeFavourite(state: FavouritesState, senseId: string): FavouritesState {
  if (!isCurrentDocument(state)) return state;
  if (!hasFavourite(state, senseId)) return state;
  return withItems(state.items.filter((item) => item.senseId !== senseId));
}

export function toggleFavourite(
  state: FavouritesState,
  senseId: string,
  knownSenseIds: ReadonlySet<string>,
  now: string,
): FavouritesState {
  if (hasFavourite(state, senseId)) return removeFavourite(state, senseId);
  return addFavourite(state, senseId, knownSenseIds, now);
}

/** Most recently touched first. The stored array is insertion order; this is a view. */
export function listByRecency(state: FavouritesState): readonly Favourite[] {
  if (state.items.length <= 1) return state.items;
  return [...state.items].sort(compareRecency);
}

/**
 * The recency list, folded into the same track groups the term index uses.
 *
 * A favourite whose sense has left the lexicon is omitted rather than parked
 * in an invented group: the document still has the row (so an account restore
 * can wait for the entry to return), but a view cannot render a headword it
 * does not have.
 */
export function listGroupedByTrack(
  state: FavouritesState,
  entries: readonly LexiconEntry[],
): readonly FavouritesTrackGroup[] {
  const entryById = new Map<string, LexiconEntry>();
  for (const entry of entries) {
    if (!entryById.has(entry.senseId)) entryById.set(entry.senseId, entry);
  }
  const buckets = new Map<LexiconTrack, LexiconEntry[]>(TRACK_ORDER.map((track) => [track, []]));
  for (const favourite of listByRecency(state)) {
    const entry = entryById.get(favourite.senseId);
    if (!entry) continue;
    buckets.get(entry.track)?.push(entry);
  }
  const groups: FavouritesTrackGroup[] = [];
  for (const track of TRACK_ORDER) {
    const list = buckets.get(track);
    if (!list || list.length === 0) continue;
    groups.push({ track, count: list.length, entries: list });
  }
  return groups;
}
