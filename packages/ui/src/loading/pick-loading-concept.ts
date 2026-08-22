import { CONCEPT_ENTRIES, type ConceptHead } from "@pieai/university-core";

/**
 * One concept for the loading overlay, chosen from the assembled catalogue.
 *
 * The public surface is `CONCEPT_ENTRIES`, not the raw authoring array: a
 * malformed record has already dropped out with a problem, and the head is
 * what a learner actually reads (zh, optional en, tagline). An empty
 * catalogue returns null rather than a placeholder — inventing a "cold fact"
 * is worse than a quiet wait.
 */
export function pickLoadingConcept(
  entries: readonly { readonly head: ConceptHead }[] = CONCEPT_ENTRIES,
  random: () => number = Math.random,
): ConceptHead | null {
  if (entries.length === 0) return null;
  const index = Math.min(entries.length - 1, Math.floor(random() * entries.length));
  return entries[index]?.head ?? null;
}
