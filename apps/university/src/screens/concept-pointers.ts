import { getConceptEntry as lookupConcept } from "@pieai/university-core";

import type { View } from "@pieai/university-core";

/**
 * How a concept page resolves its own 「先知道」 and 「相关」 pointers.
 *
 * Concepts point at concepts. Handing the page only the lexicon — which is what
 * it got at first — resolved none of them, so every pointer on all 281 pages
 * rendered as a bare id while every test passed, because the ids were valid
 * concept ids and the tests checked exactly that. The lexicon stays as the
 * fallback, since an entry is allowed to point at an English sense.
 */
export function CONCEPT_POINTERS(onOpen: (view: View) => void) {
  return {
    resolveSense: (id: string) => {
      const target = lookupConcept(id);
      return target ? { title: target.head.zh, subtitle: target.head.tagline } : undefined;
    },
    onOpenSense: (id: string) =>
      onOpen(lookupConcept(id) ? { kind: "concept", id } : { kind: "term", senseId: id }),
  };
}
