import { CONCEPT_HEADS } from "@pieai/university-core/concepts/heads.js";
import type { ConceptHead } from "@pieai/university-core";

/**
 * One concept for the loading overlay, chosen from the assembled catalogue.
 *
 * Heads only: the bodies in `CONCEPT_ENTRIES` are 1.6MB of illustrated
 * entries, and this overlay paints before the map does. An empty catalogue
 * returns null rather than a placeholder — inventing a "cold fact" is worse
 * than a quiet wait.
 */
export function pickLoadingConcept(
  heads: readonly ConceptHead[] = CONCEPT_HEADS,
  random: () => number = Math.random,
): ConceptHead | null {
  if (heads.length === 0) return null;
  const index = Math.min(heads.length - 1, Math.floor(random() * heads.length));
  return heads[index] ?? null;
}
