import { sectionsToMarkdown } from "../domain/entry-section.js";
import {
  MATCH_THRESHOLD,
  foldSearchText,
  scoreFields,
  tokenize,
  type WeightedField,
} from "../search/tokens.js";
import {
  CONCEPT_CATEGORY_IDS,
  CONCEPT_CATEGORY_LABEL,
  type ConceptCategory,
  type ConceptEntry,
} from "../domain/concept.js";

/**
 * Fields a query may hit, and what a hit in each is worth.
 *
 * The colloquial line is pulled out of the body and given full weight rather
 * than being left inside the folded Markdown. That field holds the sentence a
 * beginner would actually say, so a symptom query landing there is not a lucky
 * substring — it is the one match this catalogue is built to make.
 *
 * Everything else still goes in through `sectionsToMarkdown`, which means the
 * quiz stem, the 「什么时候不用」 cases and the agent prompt are all searchable
 * without a second indexer, and a section type added next month starts matching
 * on the day it is added. Same fold copy-as-Markdown uses, same reason: one
 * traversal of the registry rather than one per feature.
 */
function indexedFields(entry: ConceptEntry): readonly WeightedField[] {
  const colloquial = entry.sections.find((section) => section.type === "colloquial");
  const definition = entry.sections.find((section) => section.type === "definition");
  const aliases = entry.sections.find((section) => section.type === "aliases");
  return [
    { text: entry.head.zh, weight: 1 },
    { text: entry.head.en ?? "", weight: 1 },
    { text: entry.head.id, weight: 1 },
    { text: entry.head.tagline, weight: 1 },
    {
      text: colloquial?.type === "colloquial" ? colloquial.payload.text : "",
      weight: 1,
    },
    {
      text: aliases?.type === "aliases" ? aliases.payload.names.join(" ") : "",
      weight: 0.95,
    },
    {
      text:
        definition?.type === "definition"
          ? `${definition.payload.statement ?? ""} ${definition.payload.not ?? ""}`
          : "",
      weight: 0.85,
    },
    { text: `${entry.head.group} ${CONCEPT_CATEGORY_LABEL[entry.head.category]}`, weight: 0.75 },
    { text: sectionsToMarkdown(entry.sections), weight: 0.7 },
  ].map((field) => ({ text: foldSearchText(field.text), weight: field.weight }));
}

export interface ConceptIndex {
  readonly records: readonly IndexedConceptRecord[];
}

interface IndexedConceptRecord {
  readonly entry: ConceptEntry;
  readonly fields: readonly WeightedField[];
}

export interface ConceptSearchGroup {
  /**
   * Unique across categories, unlike `label`.
   *
   * The 42 sub-category names happen to be distinct today, which is exactly the
   * kind of fact that stops being true the first time someone adds a 「测试」
   * group under a second category and two unrelated lists silently merge into
   * one. Keying by category and label costs nothing and removes the trap.
   */
  readonly id: string;
  readonly category: ConceptCategory;
  readonly label: string;
  readonly count: number;
  readonly entries: readonly ConceptEntry[];
}

export interface ConceptSearchResult {
  /** The query after trimming; empty means "show everything in this category". */
  readonly query: string;
  readonly total: number;
  /**
   * Hits per category, over the query rather than over the whole catalogue.
   *
   * The chip on screen says 「前端 137」 when nothing is typed and 「前端 4」
   * once you type 「弹窗」, which answers the question a chip is actually asked:
   * is what I am looking for in there? A frozen total answers a different and
   * less useful question.
   */
  readonly counts: { readonly [C in ConceptCategory]: number };
  /** Sub-category groups within the selected category, in catalogue order. */
  readonly groups: readonly ConceptSearchGroup[];
}

export function createConceptIndex(entries: readonly ConceptEntry[]): ConceptIndex {
  return {
    records: entries.map((entry) => ({ entry, fields: indexedFields(entry) })),
  };
}

function groupBySubCategory(entries: readonly ConceptEntry[]): readonly ConceptSearchGroup[] {
  const order: string[] = [];
  const buckets = new Map<string, ConceptEntry[]>();
  for (const entry of entries) {
    const id = `${entry.head.category}/${entry.head.group}`;
    let bucket = buckets.get(id);
    if (!bucket) {
      bucket = [];
      buckets.set(id, bucket);
      order.push(id);
    }
    bucket.push(entry);
  }
  return order.map((id) => {
    const list = buckets.get(id) ?? [];
    const head = list[0]?.head;
    return {
      id,
      category: head?.category ?? CONCEPT_CATEGORY_IDS[0],
      label: head?.group ?? id,
      count: list.length,
      entries: list,
    };
  });
}

/**
 * An empty query is a browse of the selected category. A non-empty query keeps
 * an entry when any indexed field contains it.
 *
 * `category` filters the returned groups but never the counts, because the
 * counts are what tell a learner their word lives in a category they are not
 * currently looking at — which is the most common way this search is wrong for
 * someone who does not yet know the vocabulary well enough to guess.
 */
export function searchConceptIndex(
  index: ConceptIndex,
  query: string,
  category?: ConceptCategory,
): ConceptSearchResult {
  const trimmed = query.trim();
  const tokens = tokenize(trimmed);
  const scored: { entry: ConceptEntry; score: number }[] = [];
  for (const record of index.records) {
    if (tokens.length === 0) {
      scored.push({ entry: record.entry, score: 0 });
      continue;
    }
    const score = scoreFields(tokens, record.fields);
    if (score >= MATCH_THRESHOLD) scored.push({ entry: record.entry, score });
  }
  // Stable within a score so a catalogue in a deliberate order stays in it.
  // Only a genuinely better match is allowed to jump the queue.
  if (tokens.length > 0) scored.sort((left, right) => right.score - left.score);
  const hits = scored.map((item) => item.entry);
  const counts = Object.fromEntries(
    CONCEPT_CATEGORY_IDS.map((id) => [id, hits.filter((e) => e.head.category === id).length]),
  ) as { [C in ConceptCategory]: number };
  const visible = category ? hits.filter((entry) => entry.head.category === category) : hits;
  return {
    query: trimmed,
    total: visible.length,
    counts,
    groups: groupBySubCategory(visible),
  };
}

export function searchConcepts(
  entries: readonly ConceptEntry[],
  query: string,
  category?: ConceptCategory,
): ConceptSearchResult {
  return searchConceptIndex(createConceptIndex(entries), query, category);
}
