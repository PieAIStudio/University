import { sectionsToMarkdown } from "../domain/entry-section.js";
import {
  ANTI_PATTERN_CATEGORY_IDS,
  ANTI_PATTERN_CATEGORY_LABEL,
  type AntiPatternCategory,
  type AntiPatternEntry,
} from "../domain/anti-pattern.js";

/**
 * One fold for both scripts. Chinese has no case; Latin still lets 「API」
 * find 「api」. Substring matching is the whole algorithm, same as the lexicon:
 * a beginner types a fragment of a complaint, not a tokenised query.
 */
function foldSearchText(value: string): string {
  return value.toLowerCase();
}

/**
 * Fields a query may hit. The body is folded through `sectionsToMarkdown` so
 * a new section type starts matching without a second indexer — the same
 * reason copy-as-Markdown is a fold over the registry.
 */
function indexedFields(entry: AntiPatternEntry): readonly string[] {
  return [
    entry.head.id,
    entry.head.name,
    entry.head.complaint,
    entry.head.category,
    ANTI_PATTERN_CATEGORY_LABEL[entry.head.category],
    sectionsToMarkdown(entry.sections),
  ].map(foldSearchText);
}

export interface AntiPatternIndex {
  readonly records: readonly IndexedAntiPatternRecord[];
}

interface IndexedAntiPatternRecord {
  readonly entry: AntiPatternEntry;
  readonly fields: readonly string[];
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
  const needle = foldSearchText(trimmed);
  const hits: AntiPatternEntry[] = [];
  for (const record of index.records) {
    if (needle === "" || record.fields.some((field) => field.includes(needle))) {
      hits.push(record.entry);
    }
  }
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
