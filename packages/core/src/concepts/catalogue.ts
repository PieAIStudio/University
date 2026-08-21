import {
  CONCEPT_CATEGORY_IDS,
  loadConcept,
  type ConceptCategory,
  type ConceptEntry,
  type ConceptLoadProblem,
  type RawConcept,
} from "../domain/concept.js";
import { RAW_CONCEPTS } from "./data/index.js";

/**
 * The catalogue, assembled once at module load.
 *
 * Assembly is a fold over records that each report their own problems, so a
 * malformed entry drops out with a message instead of taking the shelf down.
 * `CONCEPT_PROBLEMS` is not a debug aid: a test asserts it is empty, which is
 * how a bad batch of authored content fails loudly in CI while still leaving a
 * working product on the branch.
 */
function assemble(records: readonly RawConcept[]): {
  entries: readonly ConceptEntry[];
  problems: readonly ConceptLoadProblem[];
} {
  const entries: ConceptEntry[] = [];
  const problems: ConceptLoadProblem[] = [];
  for (const record of records) {
    const { id, zh, en, category, group, tagline, body } = record;
    const result = loadConcept({ id, zh, en, category, group, tagline }, body);
    if (result.entry) entries.push(result.entry);
    problems.push(...result.problems);
  }
  return { entries, problems };
}

const assembled = assemble(RAW_CONCEPTS);

export const CONCEPT_ENTRIES: readonly ConceptEntry[] = assembled.entries;

export const CONCEPT_PROBLEMS: readonly ConceptLoadProblem[] = assembled.problems;

const BY_ID = new Map(CONCEPT_ENTRIES.map((entry) => [entry.head.id, entry] as const));

export function getConceptEntry(id: string): ConceptEntry | undefined {
  return BY_ID.get(id);
}

export function conceptsInCategory(category: ConceptCategory): readonly ConceptEntry[] {
  return CONCEPT_ENTRIES.filter((entry) => entry.head.category === category);
}

export const CONCEPT_COUNTS: { readonly [C in ConceptCategory]: number } = Object.fromEntries(
  CONCEPT_CATEGORY_IDS.map((category) => [category, conceptsInCategory(category).length]),
) as { [C in ConceptCategory]: number };

/**
 * Sub-category labels in the order they appear inside a category.
 *
 * Order comes from the entry list rather than a second constant, so a group is
 * created by writing an entry into it. A separate ordered list of group names
 * would be a second source of truth that drifts the first time someone adds an
 * entry and forgets the list.
 */
export function conceptGroupsIn(category: ConceptCategory): readonly string[] {
  const seen: string[] = [];
  for (const entry of CONCEPT_ENTRIES) {
    if (entry.head.category !== category) continue;
    if (!seen.includes(entry.head.group)) seen.push(entry.head.group);
  }
  return seen;
}

/**
 * The neighbours of one entry inside its own sub-category.
 *
 * C23's float navigation walks this, and it walks the group rather than the
 * whole category on purpose: 「前端」 is 137 entries and stepping through it
 * linearly is not a path anyone would choose, while 「表单」 is nineteen
 * entries that genuinely read in order.
 */
export function conceptNeighbours(id: string): {
  readonly previous?: ConceptEntry;
  readonly next?: ConceptEntry;
} {
  const entry = BY_ID.get(id);
  if (!entry) return {};
  const siblings = CONCEPT_ENTRIES.filter(
    (item) => item.head.category === entry.head.category && item.head.group === entry.head.group,
  );
  const index = siblings.findIndex((item) => item.head.id === id);
  return {
    previous: index > 0 ? siblings[index - 1] : undefined,
    next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined,
  };
}

/** Category order the index chips walk. Keep in lockstep with `CONCEPT_CATEGORY_IDS`. */
export const CONCEPT_CHIP_ORDER: readonly ConceptCategory[] = CONCEPT_CATEGORY_IDS;
