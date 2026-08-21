import { z } from "zod";

import {
  parseEntrySections,
  sectionsToMarkdown,
  type EntrySection,
  type SectionProblem,
} from "./entry-section.js";
import type { LexiconEntry } from "./schemas.js";

/**
 * The collections this entry system already knows.
 *
 * A second detail-page component for anti-patterns is SPEC-0004 failing. The
 * page shell is collection-generic; only the head changes. Adding a collection
 * is a new head adapter, not a new page.
 */
export const COLLECTION_IDS = ["terms", "anti-patterns"] as const;

export type CollectionId = (typeof COLLECTION_IDS)[number];

export const CollectionIdSchema = z.enum(COLLECTION_IDS);

/**
 * Head plus an ordered list of typed sections.
 *
 * For terms the head *is* the existing `LexiconEntry` — not a copy of it, not a
 * superset stored elsewhere. `[[term:senseId]]`, the reference panel, the term
 * index, search, and the full entry page stay one data source. The panel shows
 * the head; the page shows head plus sections.
 *
 * An entry with zero sections is valid and renders as what we already ship.
 */
export interface StructuredEntry<Head = unknown> {
  readonly collection: CollectionId;
  readonly head: Head;
  readonly sections: readonly EntrySection[];
}

export type TermEntry = StructuredEntry<LexiconEntry>;

export interface AssembledEntry<Head> {
  readonly entry: StructuredEntry<Head>;
  readonly problems: readonly SectionProblem[];
}

function joinMarkdown(parts: readonly string[]): string {
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("\n\n");
}

/**
 * Assembles an entry from a typed head and raw sections.
 *
 * Never throws. A section that fails validation is dropped and returned as a
 * problem; the surviving sections and the head still make an entry. That is the
 * same absorb-failure contract as a broken `[[term:]]`: the page stays up, and
 * the caller gets data rather than an exception that takes the lesson with it.
 *
 * The head is trusted as already-typed. Re-validating a `LexiconEntry` here
 * would invent a second gate in front of the lexicon we already loaded.
 */
export function assembleStructuredEntry<Head>(input: {
  readonly collection: CollectionId;
  readonly head: Head;
  readonly sections?: unknown;
}): AssembledEntry<Head> {
  const parsed = parseEntrySections(input.sections);
  return {
    entry: {
      collection: input.collection,
      head: input.head,
      sections: parsed.sections,
    },
    problems: parsed.problems,
  };
}

/** Terms are the first collection; this is just `collection: "terms"` filled in. */
export function assembleTermEntry(
  head: LexiconEntry,
  sections?: unknown,
): AssembledEntry<LexiconEntry> {
  return assembleStructuredEntry({ collection: "terms", head, sections });
}

/**
 * The lexicon record as Markdown. Sections are folded separately so a term with
 * nothing authored beyond today's 267 entries still serialises to a usable paste.
 */
export function termHeadToMarkdown(head: LexiconEntry): string {
  const parts: string[] = [`# ${head.headword}`, `${head.phonetic} · ${head.partOfSpeech}`];
  if (head.colloquial && head.colloquial.length > 0) {
    // First phrasing only, matching the page. The others are search surface.
    parts.push(`> **你可能会说**\n> ${head.colloquial[0]}`);
  }
  parts.push(head.gloss, head.usage);
  return parts.join("\n\n");
}

/**
 * Head serialiser plus the section fold. Collection-generic on purpose: an
 * anti-pattern page reuses the same fold with a different head function.
 */
export function entryToMarkdown<Head>(
  entry: StructuredEntry<Head>,
  serialiseHead: (head: Head) => string,
): string {
  return joinMarkdown([serialiseHead(entry.head), sectionsToMarkdown(entry.sections)]);
}

export function termEntryToMarkdown(entry: TermEntry): string {
  return entryToMarkdown(entry, termHeadToMarkdown);
}
