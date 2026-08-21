import {
  MATCH_THRESHOLD,
  foldSearchText,
  scoreFields,
  tokenize,
  type WeightedField,
} from "../search/tokens.js";
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
  readonly fields: readonly WeightedField[];
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
 * Fields a query may hit, and what a hit in each is worth.
 *
 * VibeHub indexes the colloquial sentence, which is why searching
 * 「鼠标放上去变色」 finds 「hover」. Indexing only names would lose the entire
 * point. Every one of the 267 entries now carries two independent phrasings,
 * because two people describing the same situation do not pick the same words
 * and a search field only helps the one whose words it happens to hold.
 *
 * `usage` is weighted below the rest: it says where the sense comes up at work,
 * which is useful context and a weaker signal of what someone is asking for
 * than the word, the gloss, or a sentence written to be the thing they'd say.
 */
function indexedFields(entry: LexiconEntry): readonly WeightedField[] {
  const fields: WeightedField[] = [
    { text: entry.headword, weight: 1 },
    { text: entry.gloss, weight: 1 },
    { text: entry.usage, weight: 0.8 },
  ];
  if (Array.isArray(entry.colloquial)) {
    for (const phrasing of entry.colloquial) fields.push({ text: phrasing, weight: 1 });
  }
  return fields.map((field) => ({ text: foldSearchText(field.text), weight: field.weight }));
}

/** Builds the searchable projection. Call once; search many times. */
export function createLexiconIndex(entries: readonly LexiconEntry[]): LexiconIndex {
  return {
    records: entries.map((entry) => ({ entry, fields: indexedFields(entry) })),
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
 * An empty query (after trim) is a browse: every entry, grouped by track, with
 * a count on each group. A non-empty query scores each entry against the shared
 * tokeniser and keeps the ones that clear the threshold.
 *
 * This used to be whole-query substring matching, and the comment defending
 * that said a fuzzy library would hide the behaviour behind a score nobody can
 * explain. That was right about libraries and wrong about the problem: the
 * matching was not too clever, it was too literal, and 「不写进代码里」 missed
 * 「不写进代码，从外面塞进来」 over one character. What replaced it is the
 * platform's own Chinese segmenter and a weighted count of which query tokens
 * landed — explainable in a sentence, and shared with the other two collections
 * rather than reimplemented per collection.
 */
export function searchLexiconIndex(index: LexiconIndex, query: string): LexiconSearchResult {
  const trimmed = query.trim();
  const tokens = tokenize(trimmed);
  const scored: { entry: LexiconEntry; score: number }[] = [];
  for (const record of index.records) {
    if (tokens.length === 0) {
      scored.push({ entry: record.entry, score: 0 });
      continue;
    }
    const score = scoreFields(tokens, record.fields);
    if (score >= MATCH_THRESHOLD) scored.push({ entry: record.entry, score });
  }
  if (tokens.length > 0) scored.sort((left, right) => right.score - left.score);
  const hits = scored.map((item) => item.entry);
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
