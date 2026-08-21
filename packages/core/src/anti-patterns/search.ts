import { sectionsToMarkdown } from "../domain/entry-section.js";
import {
  MATCH_THRESHOLD,
  foldSearchText,
  scoreFields,
  tokenize,
  type WeightedField,
} from "../search/tokens.js";
import {
  ANTI_PATTERN_CATEGORY_IDS,
  ANTI_PATTERN_CATEGORY_LABEL,
  type AntiPatternCategory,
  type AntiPatternEntry,
} from "../domain/anti-pattern.js";

/**
 * Fields a query may hit. The body is folded through `sectionsToMarkdown` so
 * a new section type starts matching without a second indexer — the same
 * reason copy-as-Markdown is a fold over the registry.
 */
function indexedFields(entry: AntiPatternEntry): readonly WeightedField[] {
  return [
    { text: entry.head.id, weight: 1 },
    { text: entry.head.name, weight: 1 },
    // The spoken complaint is the way in. Someone who could name the
    // anti-pattern mostly does not need to look it up.
    { text: entry.head.complaint, weight: 1 },
    {
      text: `${entry.head.category} ${ANTI_PATTERN_CATEGORY_LABEL[entry.head.category]}`,
      weight: 0.75,
    },
    { text: sectionsToMarkdown(entry.sections), weight: 0.7 },
  ].map((field) => ({ text: foldSearchText(field.text), weight: field.weight }));
}

export interface AntiPatternIndex {
  readonly records: readonly IndexedAntiPatternRecord[];
}

interface IndexedAntiPatternRecord {
  readonly entry: AntiPatternEntry;
  readonly fields: readonly WeightedField[];
}

export interface AntiPatternSearchGroup {
  readonly category: AntiPatternCategory;
  readonly count: number;
  readonly entries: readonly AntiPatternEntry[];
}

export interface AntiPatternSearchResult {
  /** The query after trimming; empty means "show the whole catalogue". */
  readonly query: string;
  readonly total: number;
  readonly groups: readonly AntiPatternSearchGroup[];
}

export function createAntiPatternIndex(entries: readonly AntiPatternEntry[]): AntiPatternIndex {
  return {
    records: entries.map((entry) => ({
      entry,
      fields: indexedFields(entry),
    })),
  };
}

function groupByCategory(entries: readonly AntiPatternEntry[]): readonly AntiPatternSearchGroup[] {
  const buckets = new Map<AntiPatternCategory, AntiPatternEntry[]>(
    ANTI_PATTERN_CATEGORY_IDS.map((category) => [category, []]),
  );
  for (const entry of entries) {
    const bucket = buckets.get(entry.head.category);
    if (bucket) bucket.push(entry);
  }
  const groups: AntiPatternSearchGroup[] = [];
  for (const category of ANTI_PATTERN_CATEGORY_IDS) {
    const list = buckets.get(category);
    if (!list || list.length === 0) continue;
    groups.push({ category, count: list.length, entries: list });
  }
  return groups;
}

/**
 * An empty query (after trim) is a browse: every entry, grouped by category.
 * A non-empty query keeps an entry when any indexed field contains it.
 */
export function searchAntiPatternIndex(
  index: AntiPatternIndex,
  query: string,
): AntiPatternSearchResult {
  const trimmed = query.trim();
  const tokens = tokenize(trimmed);
  const scored: { entry: AntiPatternEntry; score: number }[] = [];
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
  return {
    query: trimmed,
    total: hits.length,
    groups: groupByCategory(hits),
  };
}

export function searchAntiPatterns(
  entries: readonly AntiPatternEntry[],
  query: string,
): AntiPatternSearchResult {
  return searchAntiPatternIndex(createAntiPatternIndex(entries), query);
}
