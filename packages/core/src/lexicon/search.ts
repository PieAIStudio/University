import type { LexiconEntry, LexiconTrack } from "../domain/schemas.js";

/**
 * The order groups appear in. Technical first because that is the vocabulary
 * this product exists to teach; general English is the supporting layer.
 */
const TRACK_ORDER: readonly LexiconTrack[] = ["technical", "general"];

/**
 * A lexicon folded into the fields a query is allowed to hit.
 *
 * Pure: it holds references to the entries it was given and the normalised
 * strings derived from them. It does not fetch, it does not read the disk, and
 * it does not care that a UI will later render the hits.
 */
export interface LexiconIndex {
  readonly records: readonly IndexedLexiconRecord[];
}

interface IndexedLexiconRecord {
  readonly entry: LexiconEntry;
  readonly fields: readonly string[];
}

export interface LexiconSearchGroup {
  readonly track: LexiconTrack;
  readonly count: number;
  readonly entries: readonly LexiconEntry[];
}

export interface LexiconSearchResult {
  /** The query after trimming; empty means "show the whole index". */
  readonly query: string;
  readonly total: number;
  readonly groups: readonly LexiconSearchGroup[];
}

/**
 * Fields a query may hit, in the order they are checked.
 *
 * VibeHub indexes the colloquial sentence, which is why searching
 * 「鼠标放上去变色」 finds 「hover」. Indexing only names would lose the
 * entire point of the feature. `colloquial` is optional because no entry
 * has it yet; when an author adds one, it starts matching without a
 * schema migration.
 */
function indexedFields(entry: LexiconEntry): readonly string[] {
  if (typeof entry.colloquial === "string") {
    return [entry.headword, entry.gloss, entry.usage, entry.colloquial];
  }
  return [entry.headword, entry.gloss, entry.usage];
}

/**
 * One fold for both scripts. Chinese has no case, so this is a no-op on CJK
 * and still lets 「API」 find 「api」. Substring matching is the whole
 * algorithm: a beginner types a fragment of a gloss, not a tokenised query,
 * and a fuzzy library would hide that fact behind a score nobody can explain.
 */
function foldSearchText(value: string): string {
  return value.toLowerCase();
}

/** Builds the searchable projection. Call once; search many times. */
export function createLexiconIndex(entries: readonly LexiconEntry[]): LexiconIndex {
  return {
    records: entries.map((entry) => ({
      entry,
      fields: indexedFields(entry).map(foldSearchText),
    })),
  };
}

function groupByTrack(entries: readonly LexiconEntry[]): readonly LexiconSearchGroup[] {
  const buckets = new Map<LexiconTrack, LexiconEntry[]>(TRACK_ORDER.map((track) => [track, []]));
  for (const entry of entries) {
    const bucket = buckets.get(entry.track);
    if (bucket) bucket.push(entry);
  }
  const groups: LexiconSearchGroup[] = [];
  for (const track of TRACK_ORDER) {
    const list = buckets.get(track);
    if (!list || list.length === 0) continue;
    groups.push({ track, count: list.length, entries: list });
  }
  return groups;
}

/**
 * Searches a previously built index.
 *
 * An empty query (after trim) is a browse: every entry, grouped by track,
 * with a count on each group. A non-empty query keeps an entry when any
 * indexed field contains it as a substring.
 */
export function searchLexiconIndex(index: LexiconIndex, query: string): LexiconSearchResult {
  const trimmed = query.trim();
  const needle = foldSearchText(trimmed);
  const hits: LexiconEntry[] = [];
  for (const record of index.records) {
    if (needle === "" || record.fields.some((field) => field.includes(needle))) {
      hits.push(record.entry);
    }
  }
  const groups = groupByTrack(hits);
  return {
    query: trimmed,
    total: hits.length,
    groups,
  };
}

/** Convenience for tests and one-off calls that have no reason to reuse an index. */
export function searchLexicon(
  entries: readonly LexiconEntry[],
  query: string,
): LexiconSearchResult {
  return searchLexiconIndex(createLexiconIndex(entries), query);
}
